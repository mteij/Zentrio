/**
 * HybridEngine - Web-only hybrid playback engine
 *
 * Combines audio transcoding (via FFmpeg WASM) with direct video playback.
 * Audio is transcoded to AAC, video is passed through to MSE.
 *
 * IMPORTANT: This only works in web browsers, not in Tauri apps.
 * Tauri uses native system decoders which support more codecs than browsers.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import { NetworkReader } from './NetworkReader'
import { StreamingAudioTranscoder } from './StreamingAudioTranscoder'
import type { HybridEngineConfig, StreamInfo, MediaMetadata, CombinedStreamInfo } from './types'

/**
 * Check if running in Tauri environment
 */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' &&
         ((window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined)
}

const CORE_URL = new URL('/ffmpeg/ffmpeg-core.js', import.meta.url).href
const WASM_URL = new URL('/ffmpeg/ffmpeg-core.wasm', import.meta.url).href

export class HybridEngine extends EventTarget {
  private sourceUrl: string
  private metadata: MediaMetadata
  private config: HybridEngineConfig

  private ffmpeg: FFmpeg | null = null
  private audioTranscoder: StreamingAudioTranscoder | null = null
  private videoElement: HTMLVideoElement | null = null
  private audioElement: HTMLAudioElement | null = null

  private networkReader: NetworkReader | null = null
  private videoStreamIndex: number | null = null
  private audioStreamIndex: number | null = null

  private isInitialized: boolean = false
  private isPlaying: boolean = false
  private currentTime: number = 0
  private duration: number = 0

  private needsTranscoding: boolean = false
  private codecInfo: Map<number, { codecId: number; codecName: string; needsTranscode: boolean }> = new Map()

  private mediaSource: MediaSource | null = null
  private videoSourceBuffer: SourceBuffer | null = null
  private pendingVideoSegments: ArrayBuffer[] = []
  private isVideoAppending: boolean = false
  private videoInitSegmentGenerated: boolean = false

  private streamCache: Map<number, ArrayBuffer> = new Map()
  private processedVideoChunks: number = 0

  constructor(sourceUrl: string, metadata: MediaMetadata, config: HybridEngineConfig = {}) {
    super()
    
    // Guard: Hybrid playback is not supported in Tauri
    if (isTauriEnvironment()) {
      throw new Error('HybridEngine is not supported in Tauri apps. Use native playback instead.')
    }
    
    this.sourceUrl = sourceUrl
    this.metadata = metadata
    this.config = {
      network: config.network,
      video: config.video,
      bufferSize: config.bufferSize ?? 100 * 1024 * 1024,
      prefetchSize: config.prefetchSize ?? 50 * 1024 * 1024,
      segmentSize: config.segmentSize ?? 10 * 1024 * 1024,
      onProgress: config.onProgress,
      onError: config.onError
    }

    // Check if we need hybrid playback
    this.analyzeMetadata()
  }

  /**
   * Analyze metadata to determine if hybrid playback is needed
   */
  private analyzeMetadata(): void {
    this.needsTranscoding = false
    this.codecInfo.clear()

    const streams = this.metadata.streams || []
    let hasVideo = false
    let hasAudio = false

    // Browser-supported audio codecs
    const supportedAudioCodecs = ['aac', 'mp3', 'opus', 'vorbis', 'pcm_s16le', 'pcm_s24le', 'pcm_f32le']
    // Browser-supported video codecs
    const supportedVideoCodecs = ['h264', 'hevc', 'vp8', 'vp9', 'av1']

    for (const stream of streams) {
      if (stream.codec_type === 'video' && stream.index !== undefined) {
        hasVideo = true
        const codecName = (stream.codec_name || '').toLowerCase()
        const needsTranscode = !supportedVideoCodecs.includes(codecName)
        this.codecInfo.set(stream.index, {
          codecId: stream.codec_id || 0,
          codecName: codecName,
          needsTranscode: needsTranscode
        })
        // Always set video stream index - we'll attempt playback with MSE
        // even if codec is unsupported (MSE might still handle it or we'll get an error)
        this.videoStreamIndex = stream.index
      } else if (stream.codec_type === 'audio' && stream.index !== undefined) {
        hasAudio = true
        const codecName = (stream.codec_name || '').toLowerCase()
        const needsTranscode = !supportedAudioCodecs.includes(codecName)
        this.codecInfo.set(stream.index, {
          codecId: stream.codec_id || 0,
          codecName: codecName,
          needsTranscode: needsTranscode
        })
        if (needsTranscode) {
          this.audioStreamIndex = stream.index
        }
      }
    }

    // Need transcoding if audio codec is unsupported
    // Video should pass through if codec is supported
    if (hasAudio && this.audioStreamIndex !== null) {
      this.needsTranscoding = true
    }

    this.duration = this.metadata.format?.duration || 0

    console.log('[HybridEngine] Analysis:', {
      needsTranscoding: this.needsTranscoding,
      videoStreamIndex: this.videoStreamIndex,
      audioStreamIndex: this.audioStreamIndex,
      codecInfo: Array.from(this.codecInfo.entries())
    })
  }

  /**
   * Initialize the engine
   */
  async initialize(video: HTMLVideoElement): Promise<void> {
    console.log('[HybridEngine] Initializing...')
    this.videoElement = video

    // Initialize FFmpeg for audio transcoding
    if (this.needsTranscoding) {
      this.ffmpeg = new FFmpeg()
      
      this.ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message)
      })

      this.ffmpeg.on('progress', ({ progress }) => {
        this.dispatchEvent(new CustomEvent('progress', { detail: { progress } }))
      })
      // FFmpeg doesn't have an 'error' event, errors are handled via Promise rejection

      console.log('[HybridEngine] Loading FFmpeg...')
      await this.ffmpeg.load({
        coreURL: await toBlobURL(CORE_URL, 'text/javascript'),
        wasmURL: await toBlobURL(WASM_URL, 'application/wasm')
      })
      console.log('[HybridEngine] FFmpeg loaded')
    }

    // Set up MSE for video
    if (this.videoStreamIndex !== null) {
      await this.setupVideoMSE(video)
    }

    this.isInitialized = true
    console.log('[HybridEngine] Initialized')
  }

  /**
   * Set up MSE for video playback
   */
  private async setupVideoMSE(video: HTMLVideoElement): Promise<void> {
    console.log('[HybridEngine] Setting up MSE for video...')

    const stream = this.metadata.streams?.find((s: any) => s.index === this.videoStreamIndex)
    if (!stream) {
      throw new Error('Video stream not found')
    }

    // Create codec string
    let codecString = 'avc1.42E01E' // Default H.264 Baseline
    const codecName = (stream.codec_name || '').toLowerCase()
    const profile = (stream.profile || '').toLowerCase()

    if (codecName === 'h264') {
      if (profile.includes('high')) {
        codecString = 'avc1.640028'
      } else if (profile.includes('main')) {
        codecString = 'avc1.4D401E'
      } else {
        codecString = 'avc1.42E01E' // Baseline
      }
    } else if (codecName === 'hevc' || codecName === 'h265') {
      codecString = 'hev1.1.6.L93.B0'
    } else if (codecName === 'vp9') {
      codecString = 'vp09.00.10.08'
    }

    const mimeType = `video/mp4; codecs="${codecString}"`

    console.log('[HybridEngine] Using MIME type:', mimeType)

    if (!MediaSource.isTypeSupported(mimeType)) {
      console.warn('[HybridEngine] MIME type not supported, falling back:', mimeType)
      // Try simpler codec
      if (!MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"')) {
        throw new Error('No supported video codec found')
      }
    }

    this.mediaSource = new MediaSource()

    return new Promise((resolve, reject) => {
      const handleSourceOpen = async () => {
        try {
          this.mediaSource!.removeEventListener('sourceopen', handleSourceOpen)

          this.videoSourceBuffer = this.mediaSource!.addSourceBuffer(mimeType)
          this.videoSourceBuffer.mode = 'sequence'

          this.videoSourceBuffer.addEventListener('updateend', () => {
            this.isVideoAppending = false
            this.flushPendingVideoSegments()
          })

          this.videoSourceBuffer.addEventListener('error', (e) => {
            console.error('[HybridEngine] Video SourceBuffer error:', e)
            this.config.onError?.(new Error('Video buffer error'))
          })

          console.log('[HybridEngine] MSE setup complete')
          resolve()
        } catch (error) {
          reject(error)
        }
      }

      this.mediaSource!.addEventListener('sourceopen', handleSourceOpen)
      video.src = URL.createObjectURL(this.mediaSource!)
    })
  }

  /**
   * Helper method to play audio element with proper error handling
   */
  private playAudioElement(): void {
    if (!this.audioElement) {
      console.warn('[HybridEngine] playAudioElement called but no audio element')
      return
    }

    // Ensure audio is configured correctly
    this.audioElement.volume = 1.0
    this.audioElement.muted = false
    
    console.log('[HybridEngine] Playing audio element...')
    console.log('[HybridEngine]   - readyState:', this.audioElement.readyState)
    console.log('[HybridEngine]   - paused:', this.audioElement.paused)
    console.log('[HybridEngine]   - volume:', this.audioElement.volume)
    console.log('[HybridEngine]   - muted:', this.audioElement.muted)
    console.log('[HybridEngine]   - currentTime:', this.audioElement.currentTime)
    console.log('[HybridEngine]   - duration:', this.audioElement.duration)
    
    // Try to sync with video if available
    if (this.videoElement && this.videoElement.currentTime > 0) {
      console.log('[HybridEngine] Syncing audio to video time:', this.videoElement.currentTime)
      this.audioElement.currentTime = this.videoElement.currentTime
    }
    
    this.audioElement.play()
      .then(() => {
        console.log('[HybridEngine] Audio playback started successfully!')
        console.log('[HybridEngine] Audio is now playing:', !this.audioElement?.paused)
      })
      .catch(e => {
        console.error('[HybridEngine] Audio play() failed:', e)
        console.error('[HybridEngine] Error name:', e.name)
        console.error('[HybridEngine] Error message:', e.message)
        
        // If it's a NotAllowedError, the user hasn't interacted yet
        if (e.name === 'NotAllowedError') {
          console.warn('[HybridEngine] Audio blocked by autoplay policy - waiting for user interaction')
        }
      })
  }

  /**
   * Start playback
   */
  async play(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('HybridEngine not initialized')
    }

    console.log('[HybridEngine] Starting playback...')
    console.log('[HybridEngine] Video stream index:', this.videoStreamIndex)
    console.log('[HybridEngine] Audio stream index:', this.audioStreamIndex)
    console.log('[HybridEngine] Needs transcoding:', this.needsTranscoding)
    this.isPlaying = true

    // Initialize network reader
    this.networkReader = new NetworkReader(this.sourceUrl, {
      chunkSize: this.config.segmentSize
    })

    await this.networkReader.probe()
    console.log('[HybridEngine] Network reader probed successfully')

    // Check file size for audio transcoding
    // With streaming/chunked transcoding, we can handle larger files
    const fileSize = this.metadata.format?.size || 0
    const fileSizeMB = fileSize / (1024 * 1024)
    const MAX_AUDIO_TRANSCODE_SIZE_MB = 10 * 1024 // 10GB limit (streaming handles large files now)
    
    console.log(`[HybridEngine] File size: ${fileSizeMB.toFixed(0)}MB`)
    
    // Start streaming both audio and video
    if (this.needsTranscoding && this.audioStreamIndex !== null) {
      if (fileSizeMB > MAX_AUDIO_TRANSCODE_SIZE_MB) {
        console.warn(`[HybridEngine] File extremely large (${fileSizeMB.toFixed(0)}MB > ${MAX_AUDIO_TRANSCODE_SIZE_MB}MB)`)
        console.warn('[HybridEngine] Skipping audio transcoding - use desktop app for best results')
      } else {
        console.log(`[HybridEngine] Starting streaming audio transcoding (${fileSizeMB.toFixed(0)}MB file)...`)
        this.startAudioStreaming()
      }
    } else {
      console.log('[HybridEngine] Skipping audio streaming - transcoding:', this.needsTranscoding, 'audioIndex:', this.audioStreamIndex)
    }

    // Get container type to determine playback strategy
    const container = (this.metadata.format?.format_name || '').toLowerCase()
    const isDirectPlayback = container.includes('webm') || (!container.includes('mp4') && !container.includes('mov') && !container.includes('matroska'))

    if (this.videoStreamIndex !== null) {
      console.log('[HybridEngine] Starting video streaming...')
      this.startVideoStreaming()
    } else {
      console.warn('[HybridEngine] Video stream index is null - cannot stream video')
    }

    // Only try to play immediately for direct playback modes (WebM or fallback)
    // MSE-based playback needs data to be appended first
    if (this.videoElement && isDirectPlayback) {
      console.log('[HybridEngine] Attempting to play video element (direct playback)...')
      try {
        await this.videoElement.play()
        console.log('[HybridEngine] Video element playing')
      } catch (e) {
        console.error('[HybridEngine] Video element play error:', e)
        // Video might need user interaction first
      }
    } else if (this.videoElement) {
      console.log('[HybridEngine] MSE-based playback - will start when data is available')
    }

    console.log('[HybridEngine] Playback started')

    // If audio element is already ready (transcoding finished), start playing it now
    if (this.isPlaying && this.audioElement && this.audioElement.readyState >= 2) {
      console.log('[HybridEngine] Audio already ready, starting playback now')
      this.playAudioElement()
    }
  }

  /**
   * Start audio streaming (transcoded using progressive download)
   */
  private async startAudioStreaming(): Promise<void> {
    if (this.audioStreamIndex === null || !this.ffmpeg) return

    console.log('[HybridEngine] Starting progressive audio streaming...')

    // Initialize streaming audio transcoder
    // For files < 200MB: downloads full file, transcodes, appends to MSE
    // For files > 200MB: downloads in chunks, transcodes progressively
    // IMPORTANT: Pass shared FFmpeg instance to avoid memory conflicts
    this.audioTranscoder = new StreamingAudioTranscoder({
      bitrate: '192k',
      initialBufferSize: 5 * 1024 * 1024, // 5MB before playback starts
      maxFullDownloadSize: 200 * 1024 * 1024, // 200MB threshold
      ffmpegInstance: this.ffmpeg || undefined // Share FFmpeg instance
    })

    const audioElement = await this.audioTranscoder.initialize(
      this.sourceUrl,
      this.audioStreamIndex,
      this.duration
    )

    // Enable A/V sync and seek handling
    if (this.videoElement) {
      this.audioTranscoder.syncWithVideo(this.videoElement)
    }

    audioElement.addEventListener('timeupdate', () => {
      this.currentTime = audioElement.currentTime
      this.dispatchEvent(new CustomEvent('timeupdate', { detail: { currentTime: this.currentTime } }))
    })

    audioElement.addEventListener('ended', () => {
      this.isPlaying = false
      this.dispatchEvent(new Event('ended'))
    })

    audioElement.addEventListener('error', (e) => {
      console.error('[HybridEngine] Audio error:', e)
      this.config.onError?.(new Error('Audio playback error'))
    })

    this.audioElement = audioElement
    
    // Start the transcoding process
    this.audioTranscoder.start().catch(e => {
      console.error('[HybridEngine] Audio transcoder start error:', e)
    })

    // Listen for audio ready event from transcoder
    this.audioTranscoder.addEventListener('audioready', () => {
      console.log('[HybridEngine] Audio data ready for playback')
      console.log('[HybridEngine] Audio element readyState:', this.audioElement?.readyState)
      console.log('[HybridEngine] Audio element paused:', this.audioElement?.paused)
      console.log('[HybridEngine] Audio element volume:', this.audioElement?.volume)
      console.log('[HybridEngine] Audio element muted:', this.audioElement?.muted)
      
      this.dispatchEvent(new CustomEvent('audioready', { detail: { audioElement } }))
      
      // If we're already playing, start audio playback immediately
      if (this.isPlaying && this.audioElement) {
        console.log('[HybridEngine] Starting audio playback (engine already playing)')
        this.playAudioElement()
      }
    })

    // Also listen for canplay as a backup trigger
    audioElement.addEventListener('canplay', () => {
      console.log('[HybridEngine] Audio canplay event fired')
      if (this.isPlaying && this.audioElement && this.audioElement.paused) {
        console.log('[HybridEngine] Audio canplay - attempting to play')
        this.playAudioElement()
      }
    })

    // Don't auto-play - wait for user interaction
    // The VidstackPlayer will handle play on user click
  }

  /**
   * Start video streaming (direct via MSE)
   */
  private async startVideoStreaming(): Promise<void> {
    console.log('[HybridEngine] startVideoStreaming called')
    console.log('[HybridEngine] videoStreamIndex:', this.videoStreamIndex)
    console.log('[HybridEngine] networkReader:', !!this.networkReader)
    
    if (this.videoStreamIndex === null) {
      console.warn('[HybridEngine] Returning early - videoStreamIndex is null')
      return
    }
    
    if (!this.networkReader) {
      console.warn('[HybridEngine] Returning early - networkReader is null')
      return
    }

    console.log('[HybridEngine] Starting video streaming...')
    console.log('[HybridEngine] Video stream index:', this.videoStreamIndex)
    console.log('[HybridEngine] MediaSource readyState:', this.mediaSource?.readyState)
    console.log('[HybridEngine] VideoSourceBuffer:', this.videoSourceBuffer ? 'exists' : 'null')

    // For now, we'll use a simpler approach: download the video file in chunks
    // and append to MSE. This is not ideal for MKV containers but will work
    // for MP4 files. For true streaming from MKV, we'd need a demuxer.

    // Check if container is MP4 (which can be streamed) or WebM (natively supported)
    const container = (this.metadata.format?.format_name || '').toLowerCase()
    console.log('[HybridEngine] Container format:', container)
    
    if (container.includes('mp4') || container.includes('mov')) {
      // Direct streaming for MP4
      console.log('[HybridEngine] Using MP4 direct streaming')
      this.streamMP4Video()
    } else if (container.includes('webm')) {
      // WebM is natively supported by browsers - play directly
      console.log('[HybridEngine] Using WebM direct playback (native browser support)')
      this.playWebMDirectly()
    } else if (container.includes('matroska') || container.includes('mkv')) {
      // MKV needs remuxing to fMP4 for MSE
      console.log('[HybridEngine] Using MKV remuxing to fMP4 for MSE')
      await this.remuxMKVToMP4()
    } else {
      console.warn('[HybridEngine] Container type not directly streamable:', container)
      // For other containers, try to download and play directly
      console.log('[HybridEngine] Attempting direct video playback')
      this.playVideoDirectly()
    }
  }

  /**
   * Stream MP4 video directly to MSE
   */
  private hasVideoStartedPlaying: boolean = false

  private async streamMP4Video(): Promise<void> {
    if (!this.networkReader || !this.mediaSource || this.mediaSource.readyState !== 'open') {
      console.warn('[HybridEngine] Cannot stream MP4 - networkReader:', !!this.networkReader, 'mediaSource:', !!this.mediaSource, 'readyState:', this.mediaSource?.readyState)
      return
    }

    console.log('[HybridEngine] Streaming MP4 video...')
    console.log('[HybridEngine] File size:', this.metadata.format?.size)

    // For MP4, we can download chunks and append directly
    // The browser's MSE will handle parsing
    let offset = 0
    const chunkSize = 5 * 1024 * 1024 // 5MB chunks
    const MIN_BUFFER_TO_START = 2 * 1024 * 1024 // 2MB minimum before starting playback

    const fileSize = this.metadata.format?.size || 0
    let bufferedAmount = 0

    while (this.isPlaying && offset < fileSize) {
      try {
        const chunk = await this.networkReader.read(offset, chunkSize)
        if (chunk.byteLength === 0) break

        // Append to MSE
        this.appendVideoSegment(chunk.buffer as ArrayBuffer)
        
        offset += chunk.byteLength
        bufferedAmount += chunk.byteLength
        this.processedVideoChunks++

        this.config.onProgress?.({
          loaded: offset,
          total: fileSize,
          type: 'video'
        })

        // Start playing video once we have enough buffer and audio is ready
        if (!this.hasVideoStartedPlaying &&
            bufferedAmount >= MIN_BUFFER_TO_START &&
            this.videoElement &&
            this.videoElement.paused) {
          const bufferReady = this.videoSourceBuffer &&
                             this.videoSourceBuffer.buffered &&
                             this.videoSourceBuffer.buffered.length > 0 &&
                             this.videoSourceBuffer.buffered.end(0) > 0.5 // At least 0.5s buffered
          
          if (bufferReady) {
            console.log('[HybridEngine] Starting video playback (buffer ready)')
            this.videoElement.play().catch(e => {
              console.warn('[HybridEngine] Video play error:', e)
            })
            this.hasVideoStartedPlaying = true
          }
        }

        // Wait a bit to let buffer catch up
        if (this.videoSourceBuffer?.buffered && this.videoSourceBuffer.buffered.length > 0) {
          const bufferedEnd = this.videoSourceBuffer.buffered.end(0)
          if (this.videoElement) {
            if (bufferedEnd - this.videoElement.currentTime > 30) {
              // Too much buffered, wait
              await new Promise(r => setTimeout(r, 500))
            }
          }
        }

        // Rate limit if needed
        if (this.videoElement?.paused && this.videoSourceBuffer && this.videoSourceBuffer.buffered.length > 0) {
          await new Promise(r => setTimeout(r, 100))
        }
      } catch (error) {
        console.error('[HybridEngine] Error streaming video:', error)
        break
      }
    }

    console.log('[HybridEngine] Video streaming complete')
  }

  /**
   * Play WebM video directly (native browser support)
   * WebM is natively supported by modern browsers, so we can set the src directly
   */
  private async playWebMDirectly(): Promise<void> {
    console.log('[HybridEngine] Playing WebM directly...')
    
    if (!this.videoElement) {
      console.error('[HybridEngine] Video element not available')
      return
    }

    // Store handlers on video element for cleanup
    (this.videoElement as any).__webmHandlers = {
      loadedmetadata: null,
      error: null,
      timeupdate: null,
      ended: null,
      errorHandler: null
    }

    // Get handlers reference for use in this method
    const webmHandlers = (this.videoElement as any).__webmHandlers

    // Set the source URL directly - browser will handle WebM natively
    this.videoElement.src = this.sourceUrl
    
    // Wait for metadata to load
    if (!this.videoElement) {
      throw new Error('Video element not available')
    }
    
    await new Promise<void>((resolve, reject) => {
      const handleLoadedMetadata = () => {
        this.videoElement!.removeEventListener('loadedmetadata', handleLoadedMetadata)
        this.videoElement!.removeEventListener('error', handleError)
        resolve()
      }
      
      const handleError = (e: Event) => {
        this.videoElement!.removeEventListener('loadedmetadata', handleLoadedMetadata)
        this.videoElement!.removeEventListener('error', handleError)
        reject(new Error('Failed to load WebM video'))
      }
      
      webmHandlers.loadedmetadata = handleLoadedMetadata
      webmHandlers.error = handleError
      
      this.videoElement!.addEventListener('loadedmetadata', handleLoadedMetadata)
      this.videoElement!.addEventListener('error', handleError)
      
      // Set a timeout in case metadata never loads
      setTimeout(() => {
        this.videoElement!.removeEventListener('loadedmetadata', handleLoadedMetadata)
        this.videoElement!.removeEventListener('error', handleError)
        resolve() // Resolve anyway, let playback continue
      }, 10000)
    })
    
    console.log('[HybridEngine] WebM video loaded, duration:', this.videoElement.duration)
    
    // Update duration from actual video element
    this.duration = this.videoElement.duration
    
    // Set up time update tracking
    const timeUpdateHandler = () => {
      this.currentTime = this.videoElement!.currentTime || 0
      this.dispatchEvent(new CustomEvent('timeupdate', { detail: { currentTime: this.currentTime } }))
    }
    
    const endedHandler = () => {
      this.isPlaying = false
      this.dispatchEvent(new Event('ended'))
    }
    
    const errorHandler = (e: Event) => {
      console.error('[HybridEngine] WebM playback error:', e)
      this.config.onError?.(new Error('WebM playback error'))
    }
    
    webmHandlers.timeupdate = timeUpdateHandler
    webmHandlers.ended = endedHandler
    webmHandlers.errorHandler = errorHandler
    
    this.videoElement!.addEventListener('timeupdate', timeUpdateHandler)
    this.videoElement!.addEventListener('ended', endedHandler)
    this.videoElement!.addEventListener('error', errorHandler)
    
    // Try to play
    try {
      await this.videoElement.play()
      console.log('[HybridEngine] WebM playback started')
    } catch (e) {
      console.error('[HybridEngine] WebM play error:', e)
      // Video might need user interaction first
    }
  }

  /**
   * Download full video file as fallback
   */
  private async downloadFullVideo(): Promise<void> {
    console.log('[HybridEngine] Downloading full video file...')
    console.log('[HybridEngine] Source URL:', this.sourceUrl.substring(0, 80))

    try {
      const response = await fetch(this.sourceUrl)
      console.log('[HybridEngine] Fetch response status:', response.status, response.statusText)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const buffer = await response.arrayBuffer()
      console.log('[HybridEngine] Downloaded buffer size:', buffer.byteLength, 'bytes')
      
      this.appendVideoSegment(buffer)
      console.log('[HybridEngine] Full video downloaded and appended')
      
      // Try to play the video
      if (this.videoElement) {
        console.log('[HybridEngine] Attempting to play video element...')
        try {
          await this.videoElement.play()
          console.log('[HybridEngine] Video element playing')
        } catch (e) {
          console.error('[HybridEngine] Video element play error:', e)
        }
      }
    } catch (error) {
      console.error('[HybridEngine] Error downloading full video:', error)
      this.config.onError?.(error as Error)
    }
  }

  /**
   * Remux MKV to fMP4 for MSE playback
   * For files < 300MB: download full file and remux
   * For files >= 300MB: use direct playback (browser may handle it)
   */
  private async remuxMKVToMP4(): Promise<void> {
    console.log('[HybridEngine] Remuxing MKV to fMP4...')

    if (!this.ffmpeg) {
      console.error('[HybridEngine] FFmpeg not available for remuxing')
      this.playVideoDirectly()
      return
    }

    if (!this.videoElement) {
      console.error('[HybridEngine] Video element not available')
      return
    }

    try {
      // Get file size first
      console.log('[HybridEngine] Getting file size...')
      const headResponse = await fetch(this.sourceUrl, { method: 'HEAD' })
      const contentLength = parseInt(headResponse.headers.get('content-length') || '0')
      const fileSizeMB = contentLength / 1024 / 1024

      console.log('[HybridEngine] File size:', fileSizeMB.toFixed(2), 'MB')

      // For large files, use direct playback (browser may handle MKV natively)
      const MAX_REMUX_SIZE = 300 * 1024 * 1024 // 300MB
      if (contentLength > MAX_REMUX_SIZE) {
        console.log('[HybridEngine] File too large for remuxing, using direct playback')
        this.playVideoDirectly()
        return
      }

      // Download full file with progress
      console.log('[HybridEngine] Downloading MKV file...')
      const response = await fetch(this.sourceUrl)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body not available')
      }

      const chunks: Uint8Array[] = []
      let receivedLength = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value)
        receivedLength += value.length

        const percent = Math.round((receivedLength / contentLength) * 100)
        if (percent % 10 === 0) {
          console.log(`[HybridEngine] Downloaded: ${percent}%`)
          this.config.onProgress?.({
            loaded: receivedLength,
            total: contentLength,
            type: 'video'
          })
        }
      }

      // Combine chunks
      const mkvData = new Uint8Array(receivedLength)
      let offset = 0
      for (const chunk of chunks) {
        mkvData.set(chunk, offset)
        offset += chunk.length
      }

      console.log(`[HybridEngine] Downloaded ${(receivedLength / 1024 / 1024).toFixed(1)}MB, remuxing...`)

      // Remux full file
      await this.remuxFullMKV(mkvData)

    } catch (error) {
      console.error('[HybridEngine] Error remuxing MKV:', error)
      this.config.onError?.(error as Error)
      // Fallback to direct playback
      this.playVideoDirectly()
    }
  }

  /**
   * Remux full MKV file to fMP4
   */
  private async remuxFullMKV(mkvData: Uint8Array): Promise<void> {
    if (!this.ffmpeg) return

    const timestamp = Date.now()
    const inputFilename = `mkv_input_${timestamp}.mkv`
    const outputFilename = `mp4_output_${timestamp}.mp4`

    try {
      // Write to FFmpeg FS
      await this.ffmpeg.writeFile(inputFilename, mkvData)

      // Build FFmpeg args for remuxing
      const args = [
        '-i', inputFilename,
        '-c', 'copy', // Copy streams without re-encoding
        '-movflags', '+frag_keyframe+empty_moov+default_base_moof', // fMP4 format for streaming
        '-f', 'mp4',
        '-y',
        outputFilename
      ]

      console.log('[HybridEngine] Starting FFmpeg remux...')

      // Execute FFmpeg
      await this.ffmpeg.exec(args)

      // Read output
      const output = await this.ffmpeg.readFile(outputFilename)
      const outputData = typeof output === 'string'
        ? new TextEncoder().encode(output)
        : new Uint8Array(output)

      console.log(`[HybridEngine] Remuxed: ${(outputData.length / 1024 / 1024).toFixed(1)}MB`)

      // Append to MSE
      this.appendVideoSegment(outputData.buffer as ArrayBuffer)

      // Cleanup
      await this.ffmpeg.deleteFile(inputFilename)
      await this.ffmpeg.deleteFile(outputFilename)

      // Wait for MSE to process
      await new Promise<void>(resolve => {
        const checkProcessed = () => {
          if (!this.isVideoAppending && !this.videoSourceBuffer?.updating) {
            resolve()
          } else {
            setTimeout(checkProcessed, 100)
          }
        }
        checkProcessed()
      })

      // Try to start playback
      if (this.videoElement && this.isPlaying) {
        try {
          await this.videoElement.play()
          console.log('[HybridEngine] Video playback started')
        } catch (e) {
          console.warn('[HybridEngine] Video play error:', e)
        }
      }

    } catch (error) {
      console.error('[HybridEngine] Remux error:', error)

      // Cleanup on error
      try { await this.ffmpeg.deleteFile(inputFilename) } catch {}
      try { await this.ffmpeg.deleteFile(outputFilename) } catch {}

      throw error
    }
  }

  /**
   * Play video directly without MSE
   * Fallback for unsupported containers or large files
   */
  private playVideoDirectly(): void {
    console.log('[HybridEngine] Playing video directly (fallback)...')
    
    if (!this.videoElement) {
      console.error('[HybridEngine] Video element not available')
      return
    }

    // Clean up MSE if it was set up (prevents conflict with direct playback)
    if (this.mediaSource && this.mediaSource.readyState === 'open') {
      try {
        // Remove source buffers
        if (this.videoSourceBuffer) {
          this.mediaSource.removeSourceBuffer(this.videoSourceBuffer)
          this.videoSourceBuffer = null
        }
        this.mediaSource.endOfStream()
      } catch (e) {
        console.warn('[HybridEngine] Error cleaning up MSE:', e)
      }
    }
    this.mediaSource = null

    // Set source directly - browser will try to play it
    this.videoElement.src = this.sourceUrl
    this.videoElement.load() // Force reload with new source
    
    // Add event listeners for this video element
    const onCanPlay = () => {
      console.log('[HybridEngine] Direct video canplay - ready to play')
      // Auto-play if we're supposed to be playing
      if (this.isPlaying) {
        this.videoElement?.play().catch(e => {
          console.error('[HybridEngine] Direct video play error:', e)
        })
      }
      this.videoElement?.removeEventListener('canplay', onCanPlay)
    }
    
    this.videoElement.addEventListener('canplay', onCanPlay)
    
    this.videoElement.addEventListener('error', (e) => {
      console.error('[HybridEngine] Direct video error:', e)
    })
    
    // Add timeupdate listener to sync time bar in direct playback mode
    this.videoElement.addEventListener('timeupdate', () => {
      if (this.videoElement) {
        this.currentTime = this.videoElement.currentTime
        this.dispatchEvent(new CustomEvent('timeupdate', { 
          detail: { currentTime: this.currentTime } 
        }))
      }
    })
    
    // Also get duration when metadata loads
    this.videoElement.addEventListener('loadedmetadata', () => {
      if (this.videoElement && this.videoElement.duration) {
        this.duration = this.videoElement.duration
        console.log('[HybridEngine] Direct video duration:', this.duration)
      }
    })
    
    console.log('[HybridEngine] Direct playback source set, loading...')
  }

  /**
   * Append video segment to MSE
   */
  private appendVideoSegment(data: ArrayBuffer): void {
    if (!this.videoSourceBuffer || !this.mediaSource || this.mediaSource.readyState !== 'open') {
      return
    }

    if (this.isVideoAppending || this.videoSourceBuffer.updating) {
      this.pendingVideoSegments.push(data)
      return
    }

    try {
      this.isVideoAppending = true
      this.videoSourceBuffer.appendBuffer(data)
    } catch (error: any) {
      this.isVideoAppending = false
      if (error.name === 'QuotaExceededError') {
        console.warn('[HybridEngine] MSE quota exceeded, clearing buffer...')
        // Clear some buffer and retry
        if (this.videoSourceBuffer.buffered.length > 0) {
          const currentTime = this.videoElement?.currentTime || 0
          this.videoSourceBuffer.remove(0, currentTime - 10)
          // Retry after buffer update
          this.pendingVideoSegments.push(data)
        }
      } else {
        console.error('[HybridEngine] Error appending video segment:', error)
        this.config.onError?.(error as Error)
      }
    }
  }


  /**
   * Flush pending video segments
   */
  private flushPendingVideoSegments(): void {
    if (this.pendingVideoSegments.length > 0 &&
        this.videoSourceBuffer &&
        !this.videoSourceBuffer.updating &&
        this.mediaSource?.readyState === 'open') {
      const segment = this.pendingVideoSegments.shift()!
      this.appendVideoSegment(segment)
    } else if (this.pendingVideoSegments.length === 0 && this.videoElement) {
      // All segments appended, try to play if not already playing
      if (this.isPlaying && this.videoElement.paused) {
        console.log('[HybridEngine] All video segments appended, attempting to play...')
        this.videoElement.play().catch(e => {
          console.warn('[HybridEngine] Video play after append failed:', e)
        })
      }
    }
  }

  /**
   * Seek to a specific time
   */
  async seek(time: number): Promise<void> {
    console.log('[HybridEngine] Seeking to:', time)
    
    this.currentTime = time

    // Seek video element (direct playback mode) - video can seek anywhere
    if (this.videoElement) {
      this.videoElement.currentTime = time
    }

    // Flush video buffer for seeking (MSE mode)
    if (this.videoSourceBuffer && this.mediaSource?.readyState === 'open') {
      try {
        // Remove all buffered data
        const buffered = this.videoSourceBuffer.buffered
        if (buffered.length > 0) {
          this.videoSourceBuffer.remove(0, buffered.end(buffered.length - 1))
          
          await new Promise<void>(resolve => {
            const handler = () => {
              this.videoSourceBuffer?.removeEventListener('updateend', handler)
              resolve()
            }
            this.videoSourceBuffer?.addEventListener('updateend', handler)
          })
        }
      } catch (error) {
        console.error('[HybridEngine] Error flushing for seek:', error)
      }
    }

    // Seek audio - clamp to available buffer range
    if (this.audioElement) {
      try {
        const audioBuffered = this.audioElement.buffered
        if (audioBuffered.length > 0) {
          const audioEnd = audioBuffered.end(audioBuffered.length - 1)
          // If seeking beyond available audio content, clamp to end of buffer
          if (time > audioEnd) {
            console.log(`[HybridEngine] Seek ${time}s beyond audio buffer (${audioEnd.toFixed(1)}s), clamping`)
            this.audioElement.currentTime = Math.max(0, audioEnd - 0.5) // Stay slightly before end
          } else {
            this.audioElement.currentTime = time
          }
        } else {
          // No buffer yet, try seeking anyway
          this.audioElement.currentTime = time
        }
      } catch (e) {
        console.warn('[HybridEngine] Audio seek error:', e)
      }
    }

    // Restart streaming from new position
    if (this.isPlaying) {
      this.videoInitSegmentGenerated = false
      this.processedVideoChunks = 0
      // Note: For true seeking, we'd need to restart from a specific offset
      // This is simplified for now
    }

    this.dispatchEvent(new CustomEvent('seeked', { detail: { time } }))
  }

  /**
   * Pause playback
   */
  pause(): void {
    this.isPlaying = false
    this.audioElement?.pause()
    this.videoElement?.pause()
  }

  /**
   * Resume playback after pause
   */
  async resume(): Promise<void> {
    console.log('[HybridEngine] Resuming playback...')
    this.isPlaying = true
    
    // Resume video
    if (this.videoElement) {
      try {
        await this.videoElement.play()
      } catch (e) {
        console.error('[HybridEngine] Video resume error:', e)
      }
    }
    
    // Resume audio
    if (this.audioElement && this.audioElement.readyState >= 2) {
      try {
        await this.audioElement.play()
      } catch (e) {
        console.error('[HybridEngine] Audio resume error:', e)
      }
    }
  }

  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    return this.currentTime
  }

  /**
   * Get total duration
   */
  getDuration(): number {
    return this.duration
  }

  /**
   * Get the audio element for direct control
   */
  getAudioElement(): HTMLAudioElement | null {
    return this.audioElement
  }

  /**
   * Get stream information
   */
  async getStreamInfo(): Promise<CombinedStreamInfo | null> {
    if (this.videoStreamIndex === null || !this.networkReader) {
      return null
    }

    // NetworkReader doesn't have getStreamInfo, we use metadata directly
    const videoStream = this.metadata.streams?.find((s: any) => s.index === this.videoStreamIndex)
    const audioStream = this.metadata.streams?.find((s: any) => s.index === this.audioStreamIndex)

    // Helper to create CodecInfo with codecString
    const createCodecInfo = (stream: any): any => {
      const info = this.codecInfo.get(stream.index)
      if (!info) return null
      
      // Generate codec string based on codec name
      let codecString = ''
      const codecName = info.codecName.toLowerCase()
      const profile = (stream.profile || '').toLowerCase()
      
      if (codecName === 'h264') {
        if (profile.includes('high')) {
          codecString = 'avc1.640028'
        } else if (profile.includes('main')) {
          codecString = 'avc1.4D401E'
        } else {
          codecString = 'avc1.42E01E'
        }
      } else if (codecName === 'hevc' || codecName === 'h265') {
        codecString = 'hev1.1.6.L93.B0'
      } else if (codecName === 'vp9') {
        codecString = 'vp09.00.10.08'
      } else if (codecName === 'vp8') {
        codecString = 'vp08.00.10.08'
      } else if (codecName === 'av1') {
        codecString = 'av01.0.01M.08'
      } else if (codecName === 'aac') {
        codecString = 'mp4a.40.2'
      } else if (codecName === 'opus') {
        codecString = 'Opus'
      } else if (codecName === 'vorbis') {
        codecString = 'Vorbis'
      } else {
        codecString = codecName
      }
      
      return {
        codecId: info.codecId,
        codecName: info.codecName,
        codecString,
        profile: stream.profile,
        bitDepth: stream.bits_per_sample
      }
    }

    return {
      video: videoStream ? {
        index: videoStream.index,
        type: 'video',
        codec: createCodecInfo(videoStream),
        width: videoStream.width,
        height: videoStream.height,
        duration: this.duration
      } : null,
      audio: audioStream ? {
        index: audioStream.index,
        type: 'audio',
        codec: createCodecInfo(audioStream),
        sampleRate: audioStream.sample_rate,
        channels: audioStream.channels,
        duration: this.duration
      } : null
    }
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    console.log('[HybridEngine] Destroying...')

    this.isPlaying = false

    // Clean up audio
    if (this.audioElement) {
      this.audioElement.pause()
      this.audioElement = null
    }

    if (this.audioTranscoder) {
      await this.audioTranscoder.destroy()
      this.audioTranscoder = null
    }

    // Clean up WebM event handlers if present
    if (this.videoElement && (this.videoElement as any).__webmHandlers) {
      const handlers = (this.videoElement as any).__webmHandlers
      if (handlers.loadedmetadata) {
        this.videoElement.removeEventListener('loadedmetadata', handlers.loadedmetadata)
      }
      if (handlers.error) {
        this.videoElement.removeEventListener('error', handlers.error)
      }
      if (handlers.timeupdate) {
        this.videoElement.removeEventListener('timeupdate', handlers.timeupdate)
      }
      if (handlers.ended) {
        this.videoElement.removeEventListener('ended', handlers.ended)
      }
      if (handlers.errorHandler) {
        this.videoElement.removeEventListener('error', handlers.errorHandler)
      }
      delete (this.videoElement as any).__webmHandlers
    }

    // Clean up video MSE
    if (this.videoSourceBuffer && this.mediaSource?.readyState === 'open') {
      try {
        if (this.videoSourceBuffer.updating) {
          await new Promise<void>(resolve => {
            const handler = () => {
              this.videoSourceBuffer?.removeEventListener('updateend', handler)
              resolve()
            }
            this.videoSourceBuffer?.addEventListener('updateend', handler)
          })
        }
        this.mediaSource.removeSourceBuffer(this.videoSourceBuffer)
      } catch (e) {
        // Ignore
      }
      this.videoSourceBuffer = null
    }

    if (this.mediaSource) {
      if (this.mediaSource.readyState === 'open') {
        try {
          this.mediaSource.endOfStream()
        } catch (e) {
          // Ignore
        }
      }
      this.mediaSource = null
    }

    if (this.videoElement?.src) {
      URL.revokeObjectURL(this.videoElement.src)
      this.videoElement.src = ''
    }
    
    this.videoElement = null

    // Clean up FFmpeg
    if (this.ffmpeg) {
      try {
        await this.ffmpeg.terminate()
      } catch (e) {
        // Ignore
      }
      this.ffmpeg = null
    }

    // Clean up network reader
    if (this.networkReader) {
      this.networkReader.destroy()
      this.networkReader = null
    }

    this.isInitialized = false
    this.pendingVideoSegments = []
    this.streamCache.clear()

    console.log('[HybridEngine] Destroyed')
  }

  /**
   * Check if hybrid playback is required
   */
  get requiresHybridPlayback(): boolean {
    return this.needsTranscoding
  }
}
