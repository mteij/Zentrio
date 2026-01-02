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
import { AudioStreamTranscoder } from './AudioStreamTranscoder'
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
  private audioTranscoder: AudioStreamTranscoder | null = null
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

    // Start streaming both audio and video
    if (this.needsTranscoding && this.audioStreamIndex !== null) {
      console.log('[HybridEngine] Starting audio streaming...')
      this.startAudioStreaming()
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
  }

  /**
   * Start audio streaming (transcoded)
   */
  private async startAudioStreaming(): Promise<void> {
    if (this.audioStreamIndex === null || !this.ffmpeg) return

    console.log('[HybridEngine] Starting audio streaming...')

    // Initialize audio transcoder
    this.audioTranscoder = new AudioStreamTranscoder({
      bitrate: '192k',
      chunkSize: this.config.segmentSize,
      initialBufferSize: 2 * 1024 * 1024 // 2MB to avoid FFmpeg WASM memory issues
    })

    const audioElement = await this.audioTranscoder.initialize(
      this.sourceUrl,
      this.audioStreamIndex
    )

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
    
    // Start the download and transcoding process
    this.audioTranscoder.start().catch(e => {
      console.error('[HybridEngine] Audio transcoder start error:', e)
    })

    // Listen for audio ready event from transcoder
    this.audioTranscoder.addEventListener('audioready', () => {
      console.log('[HybridEngine] Audio data ready for playback')
      this.dispatchEvent(new CustomEvent('audioready', { detail: { audioElement } }))
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

    const fileSize = this.metadata.format?.size || 0
    while (this.isPlaying && offset < fileSize) {
      try {
        const chunk = await this.networkReader.read(offset, chunkSize)
        if (chunk.byteLength === 0) break

        // Append to MSE
        this.appendVideoSegment(chunk.buffer as ArrayBuffer)
        
        offset += chunk.byteLength
        this.processedVideoChunks++

        this.config.onProgress?.({
          loaded: offset,
          total: fileSize,
          type: 'video'
        })

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
   * Uses FFmpeg to convert the container format
   * For large files, uses chunked download with progress feedback
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
      // Generate unique filename for remuxed output
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 8)
      const inputFilename = `remux_input_${timestamp}_${random}.mkv`
      const outputFilename = `remux_output_${timestamp}_${random}.mp4`

      // Get file size first
      console.log('[HybridEngine] Getting file size...')
      const headResponse = await fetch(this.sourceUrl, { method: 'HEAD' })
      const contentLength = parseInt(headResponse.headers.get('content-length') || '0')
      const fileSizeMB = contentLength / 1024 / 1024
      
      console.log('[HybridEngine] File size:', fileSizeMB.toFixed(2), 'MB')

      // For files larger than 500MB, warn and try direct playback first
      if (fileSizeMB > 500) {
        console.warn('[HybridEngine] Large file detected (>500MB), trying direct playback first...')
        this.playVideoDirectly()
        return
      }

      // Download the MKV file with progress
      console.log('[HybridEngine] Downloading MKV file for remuxing...')
      const response = await fetch(this.sourceUrl)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Response body not available')
      }

      const chunks: Uint8Array[] = []
      let downloadedBytes = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        chunks.push(value)
        downloadedBytes += value.length
        
        const percent = Math.round((downloadedBytes / contentLength) * 100)
        if (percent % 10 === 0) {
          console.log(`[HybridEngine] Downloading: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)}MB)`)
          this.config.onProgress?.({
            loaded: downloadedBytes,
            total: contentLength,
            type: 'video'
          })
        }
      }

      // Combine chunks
      const totalLength = chunks.reduce((sum, c) => sum + c.length, 0)
      const mkvBuffer = new Uint8Array(totalLength)
      let offset = 0
      for (const chunk of chunks) {
        mkvBuffer.set(chunk, offset)
        offset += chunk.length
      }

      console.log('[HybridEngine] Downloaded MKV:', (mkvBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB')

      // Write input file to FFmpeg FS
      await this.ffmpeg.writeFile(inputFilename, mkvBuffer)

      // Remux to fMP4 (copy streams, just change container)
      console.log('[HybridEngine] Starting FFmpeg remux...')
      await this.ffmpeg.exec([
        '-i', inputFilename,
        '-c', 'copy', // Copy streams without re-encoding
        '-movflags', 'frag_keyframe+empty_moov+default_base_moof', // fMP4 format
        '-f', 'mp4',
        outputFilename
      ])

      // Read the remuxed file
      const remuxedData = await this.ffmpeg.readFile(outputFilename)
      const remuxedBuffer = remuxedData instanceof Uint8Array
        ? remuxedData.buffer
        : new Uint8Array(remuxedData as any).buffer

      console.log('[HybridEngine] Remuxed to fMP4:', (remuxedBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB')

      // Clean up FFmpeg files
      try {
        await this.ffmpeg.deleteFile(inputFilename)
        await this.ffmpeg.deleteFile(outputFilename)
      } catch (e) {
        // Ignore cleanup errors
      }

      // Append to MSE
      this.appendVideoSegment(remuxedBuffer)
      console.log('[HybridEngine] Remuxed video appended to MSE, waiting for MSE to process...')

      // Wait for MSE to process the data before attempting playback
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

      console.log('[HybridEngine] MSE processed data, attempting playback...')

      // Try to play after MSE has processed the data
      if (this.videoElement && this.isPlaying) {
        try {
          await this.videoElement.play()
          console.log('[HybridEngine] Remuxed video playing')
        } catch (e) {
          console.error('[HybridEngine] Remuxed video play error:', e)
        }
      }
    } catch (error) {
      console.error('[HybridEngine] Error remuxing MKV:', error)
      this.config.onError?.(error as Error)
      // Fallback to direct playback
      this.playVideoDirectly()
    }
  }

  /**
   * Play video directly without MSE
   * Fallback for unsupported containers
   */
  private playVideoDirectly(): void {
    console.log('[HybridEngine] Playing video directly (fallback)...')
    
    if (!this.videoElement) {
      console.error('[HybridEngine] Video element not available')
      return
    }

    // Set source directly - browser will try to play it
    this.videoElement.src = this.sourceUrl
    
    // Try to play
    this.videoElement.play().catch(e => {
      console.error('[HybridEngine] Direct playback error:', e)
      this.config.onError?.(new Error('Direct playback failed'))
    })
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

    // Flush video buffer for seeking
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

    // Seek audio
    if (this.audioElement) {
      this.audioElement.currentTime = time
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
