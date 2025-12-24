/**
 * HybridEngine - Main Coordinator for Hybrid Media Playback
 * 
 * Orchestrates:
 * - libav.js for demuxing
 * - NetworkReader for HTTP Range I/O
 * - VideoRemuxer for MSE output
 * - AudioDecoder + AudioWorklet for audio output
 */

import type {
  StreamInfo,
  VideoPacket,
  AudioPacket,
  CodecInfo,
  EngineState,
  HybridEngineConfig,
  SeekRequest,
  KeyframeEntry
} from './types'
import { NetworkReader } from './NetworkReader'
import { VideoRemuxer } from './VideoRemuxer'
import { AudioDecoder } from './AudioDecoder'
import { AudioRingBuffer } from './AudioRingBuffer'

// Codec ID constants from libav.js / FFmpeg
const CODEC_ID_H264 = 27
const CODEC_ID_HEVC = 173
const CODEC_ID_VP9 = 167
const CODEC_ID_AV1 = 225

// Audio codec IDs (from FFmpeg's avcodec.h)
const CODEC_ID_MP3 = 86017
const CODEC_ID_AAC = 86018
const CODEC_ID_FLAC = 86028
const CODEC_ID_VORBIS = 86021
const CODEC_ID_AC3 = 86019  // Note: Different from MP3
const CODEC_ID_EAC3 = 86056
const CODEC_ID_DTS = 86020
const CODEC_ID_OPUS = 86076
const CODEC_ID_PCM_S16LE = 65536
const CODEC_ID_PCM_S24LE = 65543

// Browsers typically support these natively via HTML5 audio/video
const NATIVE_AUDIO_CODECS = new Set([
  CODEC_ID_AAC,      // AAC
  CODEC_ID_MP3,      // MP3
  CODEC_ID_OPUS,     // Opus (in WebM/OGG containers)
  CODEC_ID_VORBIS,   // Vorbis (in WebM/OGG containers)
  CODEC_ID_PCM_S16LE, // PCM
  CODEC_ID_PCM_S24LE, // PCM 24-bit
])

export class HybridEngine extends EventTarget {
  private state: EngineState = 'idle'
  private libav: any = null
  private reader: NetworkReader | null = null
  private videoRemuxer: VideoRemuxer | null = null
  private audioDecoder: AudioDecoder | null = null
  private audioRingBuffer: AudioRingBuffer | null = null
  private audioContext: AudioContext | null = null
  private audioWorkletNode: AudioWorkletNode | null = null
  
  private fmtCtx: number = 0
  private videoStreamIndex: number = -1
  private audioStreamIndex: number = -1
  private streams: StreamInfo[] = []
  private keyframeIndex: KeyframeEntry[] = []
  private startTime: number = -1
  
  private isProcessing: boolean = false
  private shouldStop: boolean = false
  private currentTime: number = 0
  private duration: number = 0
  private videoElement: HTMLVideoElement | null = null
  
  private config: HybridEngineConfig

  constructor(config: HybridEngineConfig = {}) {
    super()
    this.config = config
  }

  /**
   * Initialize the engine with a media URL
   */
  async initialize(url: string): Promise<StreamInfo[]> {
    this.setState('initializing')

    try {
      // Create network reader
      this.reader = new NetworkReader(url, this.config.network)
      await this.reader.probe()

      // Import and initialize libav.js
      // Try custom Zentrio variant first (includes AC3/E-AC3 decoders)
      // Falls back to webcodecs variant if custom build not available
      let LibAV: any
      let variantName = 'webcodecs'
      
      try {
        // Check if custom variant is available (built via scripts/build-libav.ps1)
        const customResponse = await fetch('/libav.js-zentrio/libav-6.8.8.0-zentrio.js', { method: 'HEAD' })
        if (customResponse.ok) {
          // Load via dynamic script tag (Vite doesn't allow ES imports from /public)
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = '/libav.js-zentrio/libav-6.8.8.0-zentrio.js'
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load custom libav.js'))
            document.head.appendChild(script)
          })
          
          // libav.js exposes itself as a global
          LibAV = (window as any).LibAV
          if (!LibAV) throw new Error('LibAV global not found')
          
          variantName = 'zentrio (AC3/E-AC3 enabled)'
          console.log('[HybridEngine] Using custom Zentrio variant with AC3/E-AC3 support')
        } else {
          throw new Error('Custom variant not found')
        }
      } catch (e) {
        // Fall back to standard webcodecs variant
        LibAV = await import('@libav.js/variant-webcodecs')
        LibAV = LibAV.default
        console.log('[HybridEngine] Using standard webcodecs variant (AC3/E-AC3 not available)')
      }
      
      // Try to initialize - use noworker mode for better compatibility
      try {
        this.libav = await LibAV.LibAV({ noworker: true })
        console.log(`[HybridEngine] libav.js initialized (variant: ${variantName})`)
      } catch (libavError) {
        console.warn('[HybridEngine] Failed to initialize libav.js:', libavError)
        throw new Error('libav.js initialization failed')
      }

      // Register custom I/O with libav
      await this.registerCustomIO()

      // Open demuxer (libav.js ff_init_demuxer_file only takes filename and optional format)
      const [fmtCtx] = await this.libav.ff_init_demuxer_file('input.media')
      this.fmtCtx = fmtCtx
      
      console.log('[HybridEngine] Demuxer opened, configuring probe options...')

      // CRITICAL: Set probe options AFTER opening demuxer but BEFORE find_stream_info
      // Use av_opt_set which IS exported (unlike AVFormatContext_probesize_s which isn't)
      // av_opt_set signature: (obj, name, val, search_flags)
      // AV_OPT_SEARCH_CHILDREN = 1 is needed for format options
      //
      // NOTE: We use smaller values here because:
      // 1. We don't have an HEVC decoder (only parser), so video frame decoding will fail anyway
      // 2. Matroska containers have duration/stream info in headers, minimal probing needed
      // 3. Large values cause excessive "decoding for stream 0 failed" warnings
      const probeSize = '5000000'  // 5 MB - enough to read container headers
      const analyzeDuration = '5000000'  // 5 seconds in microseconds
      
      try {
        if (this.libav.av_opt_set) {
          // Set probesize - controls max data read to detect format
          const ret1 = await this.libav.av_opt_set(fmtCtx, 'probesize', probeSize, 1)
          console.log(`[HybridEngine] Set probesize=${probeSize}, result=${ret1}`)
          
          // Set analyzeduration - controls max time spent analyzing streams  
          const ret2 = await this.libav.av_opt_set(fmtCtx, 'analyzeduration', analyzeDuration, 1)
          console.log(`[HybridEngine] Set analyzeduration=${analyzeDuration}, result=${ret2}`)
        } else {
          console.warn('[HybridEngine] av_opt_set not available, using default probe options')
        }
      } catch (e) {
        console.warn('[HybridEngine] Failed to set probe options:', e)
      }

      // Now perform stream analysis with our settings applied
      const ret = await this.libav.avformat_find_stream_info(fmtCtx, 0)
      if (ret < 0) {
         console.warn('[HybridEngine] avformat_find_stream_info failed:', ret)
      } else {
         console.log('[HybridEngine] Stream analysis completed')
      }

      // Analyze streams
      this.streams = await this.analyzeStreams()
      
      // Get duration - handle AV_NOPTS_VALUE (very large negative number when unknown)
      let duration = await this.libav.AVFormatContext_duration(fmtCtx)
      // AV_NOPTS_VALUE is 0x8000000000000000, which shows as a large negative number
      // Duration should never be negative, so treat it as unknown/0
      this.duration = duration > 0 ? duration / 1000000 : 0 // Convert from microseconds

      // Fallback: try to get duration from individual streams if container duration is unknown
      if (this.duration <= 0) {
        console.log('[HybridEngine] Container duration unknown, checking streams...')
        for (const stream of this.streams) {
          if (stream.duration && stream.duration > 0) {
            this.duration = stream.duration
            console.log(`[HybridEngine] Using stream duration: ${this.duration}s`)
            break
          }
        }
      }

      console.log('[HybridEngine] Streams detected:', this.streams)
      console.log('[HybridEngine] Duration:', this.duration, 'seconds')

      this.setState('ready')
      this.dispatchEvent(new CustomEvent('streamsdetected', { 
        detail: { streams: this.streams }
      }))

      return this.streams
    } catch (error) {
      this.setState('error')
      throw error
    }
  }

  /**
   * Register custom I/O callbacks for libav.js
   */
  private async registerCustomIO(): Promise<void> {
    if (!this.reader || !this.libav) {
      throw new Error('Reader or libav not initialized')
    }

    const reader = this.reader
    const libav = this.libav

    // Create a block reader device (supports random access/seeking)
    await libav.mkblockreaderdev('input.media', reader.size)

    // Set up the block read callback
    libav.onblockread = async (name: string, position: number, length: number) => {
      if (name === 'input.media') {
        try {
          const data = await reader.read(position, length)
          await libav.ff_block_reader_dev_send(name, position, data)
        } catch (error) {
          console.error('[HybridEngine] Block read error:', error)
          // Send empty data on error
          await libav.ff_block_reader_dev_send(name, position, new Uint8Array(0))
        }
      }
    }
  }

  /**
   * Analyze streams and extract metadata
   */
  private async analyzeStreams(): Promise<StreamInfo[]> {
    const streams: StreamInfo[] = []
    const numStreams = await this.libav.AVFormatContext_nb_streams(this.fmtCtx)

    for (let i = 0; i < numStreams; i++) {
      const stream = await this.libav.AVFormatContext_streams_a(this.fmtCtx, i)
      const codecpar = await this.libav.AVStream_codecpar(stream)
      
      const codecType = await this.libav.AVCodecParameters_codec_type(codecpar)
      const codecId = await this.libav.AVCodecParameters_codec_id(codecpar)

      // Get stream-level duration (in stream time_base units)
      const streamDuration = await this.libav.AVStream_duration(stream)
      const timeBaseNum = await this.libav.AVStream_time_base_num(stream)
      const timeBaseDen = await this.libav.AVStream_time_base_den(stream)
      const timeBase = timeBaseDen > 0 ? timeBaseNum / timeBaseDen : 0
      // Convert stream duration to seconds (handle AV_NOPTS_VALUE)
      const streamDurationSeconds = (streamDuration > 0 && timeBase > 0) 
        ? streamDuration * timeBase 
        : 0

      if (codecType === 0) { // AVMEDIA_TYPE_VIDEO
        const width = await this.libav.AVCodecParameters_width(codecpar)
        const height = await this.libav.AVCodecParameters_height(codecpar)
        
        // Create explicit Safe Level variable for CodecInfo
        let safeLevel = await this.libav.AVCodecParameters_level(codecpar)
        let profile = await this.libav.AVCodecParameters_profile(codecpar)

        // Extract extradata (SPS/PPS)
        let extradata: Uint8Array | undefined
        const extradataSize = await this.libav.AVCodecParameters_extradata_size(codecpar)
        if (extradataSize > 0) {
          const extradataPtr = await this.libav.AVCodecParameters_extradata(codecpar)
          extradata = await this.libav.copyout_u8(extradataPtr, extradataSize)
          console.log(`[HybridEngine] Extracted extradata for video stream ${i}: ${extradataSize} bytes`)
        } else {
          console.warn(`[HybridEngine] No extradata for video stream ${i} - format detection might flap`)
        }
        
        // Manual profile detection from extradata if libav fails
        if ((profile <= 0 || profile === -99) && codecId === 173 && extradata && extradata.length > 5) {
             // Check for hvcC (configurationVersion = 1)
             if (extradata[0] === 1) {
                 // hvcC format: [ver][profile_space_tier_idc]...
                 // profile_idc is lower 5 bits of byte 1
                 const profileIdc = extradata[1] & 0x1F
                 console.log(`[HybridEngine] Parsed HEVC profile from hvcC: ${profileIdc}`)
                 if (profileIdc > 0) profile = profileIdc
             } else {
                 console.warn('[HybridEngine] Extradata exists but not hvcC, basic profile detection skipped')
             }
        }

        // Get codec string for MSE - NOW passing the potentially corrected profile
        const codecString = await this.getVideoCodecString(codecId, codecpar, profile)

        // Check for bit depth from pixel format
        const format = await this.libav.AVCodecParameters_format(codecpar)
        let bitDepth = 8
        // Map common 10-bit formats or use profile
        if (codecId === 173 && profile === 2) { // HEVC Main 10
             bitDepth = 10
        }

        console.log(`[HybridEngine] Stream ${i}: codec=${codecId} profile=${profile} level=${safeLevel} fmt=${format}`)
        // Map common 10-bit formats (e.g. AV_PIX_FMT_YUV420P10LE = 64?? need to check libav mapping)
        // For now, assume if profile is Main 10, it's 10-bit
        if (codecId === 173 && profile === 2) { // HEVC Main 10
             bitDepth = 10
        }

        // Fix invalid level
        if (safeLevel <= 0 && codecId === 173) {
             safeLevel = 120
        }
        
        const streamInfo: StreamInfo = {
          index: i,
          type: 'video',
          codec: {
            codecId,
            codecName: this.getCodecName(codecId),
            codecString,
            extradata,
            profileId: profile,
            level: safeLevel,
            bitDepth
          },
          width,
          height,
          duration: streamDurationSeconds
        }

        streams.push(streamInfo)
        
        if (this.videoStreamIndex === -1 && this.isRemuxableVideoCodec(codecId)) {
          this.videoStreamIndex = i
          console.log(`[HybridEngine] Selected video stream ${i}: ${streamInfo.codec.codecName}`)
        }
      } else if (codecType === 1) { // AVMEDIA_TYPE_AUDIO
        const sampleRate = await this.libav.AVCodecParameters_sample_rate(codecpar)
        const channels = await this.libav.AVCodecParameters_ch_layout_nb_channels(codecpar)
        
        const streamInfo: StreamInfo = {
          index: i,
          type: 'audio',
          codec: {
            codecId,
            codecName: this.getCodecName(codecId),
            codecString: ''
          },
          sampleRate,
          channels,
          duration: streamDurationSeconds
        }

        streams.push(streamInfo)

        if (this.audioStreamIndex === -1 && !this.isNativeAudioCodec(codecId)) {
          this.audioStreamIndex = i
          console.log(`[HybridEngine] Selected audio stream ${i}: ${streamInfo.codec.codecName} (needs WASM decoding)`)
        }
      }
    }

    return streams
  }

  /**
   * Check if video codec can be remuxed (not transcoded)
   */
  private isRemuxableVideoCodec(codecId: number): boolean {
    return [CODEC_ID_H264, CODEC_ID_HEVC, CODEC_ID_VP9, CODEC_ID_AV1].includes(codecId)
  }

  /**
   * Check if audio codec is natively supported
   */
  private isNativeAudioCodec(codecId: number): boolean {
    return NATIVE_AUDIO_CODECS.has(codecId)
  }

  /**
   * Get human-readable codec name
   */
  private getCodecName(codecId: number): string {
    const names: Record<number, string> = {
      [CODEC_ID_H264]: 'H.264',
      [CODEC_ID_HEVC]: 'HEVC',
      [CODEC_ID_VP9]: 'VP9',
      [CODEC_ID_AV1]: 'AV1',
      [CODEC_ID_MP3]: 'MP3',
      [CODEC_ID_AAC]: 'AAC',
      [CODEC_ID_FLAC]: 'FLAC',
      [CODEC_ID_VORBIS]: 'Vorbis',
      [CODEC_ID_AC3]: 'AC3',
      [CODEC_ID_EAC3]: 'E-AC3',
      [CODEC_ID_DTS]: 'DTS',
      [CODEC_ID_OPUS]: 'Opus',
    }
    return names[codecId] || `Unknown (${codecId})`
  }

  /**
   * Get MSE-compatible codec string
   */
  private async getVideoCodecString(codecId: number, codecpar: number, profileOverride?: number): Promise<string> {
    const profile = profileOverride ?? await this.libav.AVCodecParameters_profile(codecpar)
    const level = await this.libav.AVCodecParameters_level(codecpar)

    switch (codecId) {
      case CODEC_ID_H264:
        // AVC1: avc1.[profile][compatibility][level]
        // Simplified fallback for now, ideally strictly map profile/level pairs
        return 'avc1.640028' 
      
      case CODEC_ID_HEVC:
        // HEVC: hev1.[profile].[tier].[level].[constraints]
        // Profile 1 (Main) -> hev1.1.6.L...
        // Profile 2 (Main 10) -> hev1.2.4.L... (Main 10)
        
        // Profiles from libavcodec/avcodec.h
        const FF_PROFILE_HEVC_MAIN = 1
        const FF_PROFILE_HEVC_MAIN_10 = 2
        
        // Handle invalid/unknown level (-99)
        let safeLevel = level
        if (safeLevel <= 0) {
          // Robust fallback based on resolution
          const width = await this.libav.AVCodecParameters_width(codecpar)
          const height = await this.libav.AVCodecParameters_height(codecpar)
          const pixels = width * height
          
          console.log(`[HybridEngine] HEVC Level check: level=${level}, size=${width}x${height} (${pixels})`)

          if (pixels >= 3840 * 2160) { // 4K classification
             console.warn(`[HybridEngine] Invalid HEVC level ${level} for 4K, defaulting to 153 (5.1)`)
             safeLevel = 153 // Level 5.1
          } else if (width >= 1920 || height >= 1080) { // 1080p classification (covers 1920x800 etc)
             console.warn(`[HybridEngine] Invalid HEVC level ${level} for 1080p (width>=1920), defaulting to 123 (4.1)`)
             safeLevel = 123 // Level 4.1
          } else {
             // If resolution is unknown or small, default to 5.1 anyway to be safe.
             // Level 5.1 covers up to 4K @ 30fps and 4.0 content will play fine on a 5.1 decoder.
             // This avoids the risk of 4.0 being too low for weird resolutions.
             console.warn(`[HybridEngine] Invalid HEVC level ${level}, defaulting to 153 (5.1) for safety. Dimensions: ${width}x${height}`)
             safeLevel = 153 // Level 5.1
          }
        }

        if (profile === FF_PROFILE_HEVC_MAIN_10) {
          // Main 10, typically High Tier (4)
          // Switch to hvc1 tag for better compatibility (e.g. Windows/Android)
          return `hvc1.2.4.L${safeLevel}.B0`
        }
        // Default to Main Profile, Main Tier (6)
        return `hvc1.1.6.L${safeLevel}.B0`

      case CODEC_ID_VP9:
        return 'vp09.00.10.08'
      
      case CODEC_ID_AV1:
        // AV1: av01.[profile].[level]M.[tier]
        return 'av01.0.04M.08'
        
      default:
        return 'avc1.640028'
    }
  }

  /**
   * Attach video element for MSE output
   */
  async attachVideo(video: HTMLVideoElement): Promise<void> {
    this.videoElement = video
    
    if (this.videoStreamIndex === -1) {
      throw new Error('No remuxable video stream found')
    }

    const videoStream = this.streams.find(s => s.index === this.videoStreamIndex)
    if (!videoStream) {
      throw new Error('Video stream not found')
    }

    // Create and attach video remuxer
    this.videoRemuxer = new VideoRemuxer(this.config.video)
    await this.videoRemuxer.attach(video, videoStream.codec, videoStream.width, videoStream.height)

    // Mute video element (audio comes from worklet)
    video.muted = true

    // Sync engine state with video element events (allows UI controls to drive engine)
    video.addEventListener('play', () => {
      if (this.state !== 'playing') this.start()
    })

    video.addEventListener('pause', () => {
       if (this.state === 'playing') this.pause()
    })

    video.addEventListener('seeking', () => {
       // Only seek if the difference is significant to avoid micro-loops
       if (Math.abs(video.currentTime - this.currentTime) > 0.5) {
         this.seek(video.currentTime)
       }
    })
    
    console.log('[HybridEngine] Video attached and listeners registered')
  }

  /**
   * Attach audio context for AudioWorklet output
   */
  async attachAudio(audioContext?: AudioContext): Promise<void> {
    if (this.audioStreamIndex === -1) {
      console.log('[HybridEngine] No audio stream to attach')
      return
    }

    const audioStream = this.streams.find(s => s.index === this.audioStreamIndex)
    if (!audioStream) {
      throw new Error('Audio stream not found')
    }

    // Create or use provided AudioContext
    this.audioContext = audioContext || new AudioContext()
    
    // Create ring buffer
    this.audioRingBuffer = new AudioRingBuffer({
      sampleRate: audioStream.sampleRate || 48000,
      channels: audioStream.channels || 2,
      durationSeconds: this.config.audio?.bufferDuration ?? 10
    })

    // Create audio decoder
    this.audioDecoder = new AudioDecoder(this.audioRingBuffer, this.config.audio)

    // Load worklet processor
    const workletUrl = new URL('./audio-worklet-processor.ts', import.meta.url).href
    await this.audioContext.audioWorklet.addModule(workletUrl)

    // Create worklet node
    this.audioWorkletNode = new AudioWorkletNode(
      this.audioContext,
      'hybrid-audio-processor',
      {
        processorOptions: {
          capacity: this.audioRingBuffer.getBuffer().byteLength,
          channels: audioStream.channels || 2,
          sampleRate: audioStream.sampleRate || 48000
        }
      }
    )

    // Initialize worklet with SharedArrayBuffer
    this.audioWorkletNode.port.postMessage({
      type: 'init',
      data: {
        buffer: this.audioRingBuffer.getBuffer(),
        capacity: (audioStream.sampleRate || 48000) * (audioStream.channels || 2) * 
                  (this.config.audio?.bufferDuration ?? 10),
        channels: audioStream.channels || 2
      }
    })

    // Handle worklet messages
    this.audioWorkletNode.port.onmessage = (event) => {
      const { type, data } = event.data
      
      switch (type) {
        case 'ready':
          console.log('[HybridEngine] AudioWorklet ready')
          break
        case 'underrun':
          console.warn('[HybridEngine] Audio underrun:', data.count)
          break
        case 'drift':
          console.warn('[HybridEngine] Large audio drift:', data.driftMs, 'ms')
          // Could trigger a hard resync here
          break
        case 'status':
          // Periodic status update
          break
      }
    }

    // Connect to destination
    this.audioWorkletNode.connect(this.audioContext.destination)

    // Initialize audio decoder
    const codecpar = await this.libav.AVFormatContext_streams_a(this.fmtCtx, this.audioStreamIndex)
    const params = await this.libav.AVStream_codecpar(codecpar)
    await this.audioDecoder.initialize(this.libav, audioStream.codec, params)

    console.log('[HybridEngine] Audio attached')
  }

  /**
   * Start playback
   */
  async start(): Promise<void> {
    // If already playing, just return (idempotent)
    if (this.state === 'playing') {
      return
    }
    
    if (this.state !== 'ready' && this.state !== 'paused') {
      throw new Error(`Cannot start from state: ${this.state}`)
    }

    this.setState('playing')
    this.shouldStop = false

    // Start packet processing first to fill buffers
    this.processPackets()

    // Wait for sufficient audio buffer if we have an audio stream
    if (this.audioStreamIndex !== -1 && this.audioRingBuffer) {
      console.log('[HybridEngine] Buffering audio...')
      let attempts = 0
      // Buffer for up to 2000ms or until 0.5s of audio is buffered
      while (attempts < 200 && this.audioRingBuffer.bufferedSeconds < 0.5 && !this.shouldStop) {
        await new Promise(r => setTimeout(r, 10))
        attempts++
      }
      console.log(`[HybridEngine] Buffered ${this.audioRingBuffer.bufferedSeconds.toFixed(3)}s (attempts: ${attempts})`)
    }

    // Start audio worklet
    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.postMessage({ type: 'play' })
    }

    // Resume audio context if suspended
    if (this.audioContext?.state === 'suspended') {
      try {
        await this.audioContext.resume()
        console.log('[HybridEngine] AudioContext resumed successfully')
      } catch (e) {
        // This is expected if the user hasn't interacted with the page yet
        console.warn('[HybridEngine] Audio available but autoplay blocked. Waiting for user interaction to resume audio.')
        // Continue anyway - video should play, and next user interaction (play/pause) will retry resume
      }
    }

    // Start video element
    if (this.videoElement) {
      this.videoElement.play().catch(e => console.warn('Autoplay blocked:', e))
    }
  }

  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    if (this.state !== 'playing') return

    this.setState('paused')
    this.shouldStop = true

    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.postMessage({ type: 'pause' })
    }

    if (this.videoElement) {
      this.videoElement.pause()
    }
  }

  /**
   * Seek to a specific time
   */
  async seek(targetTime: number): Promise<void> {
    console.log(`[HybridEngine] Seeking to ${targetTime}s`)
    
    const wasPlaying = this.state === 'playing'
    this.setState('seeking')
    this.shouldStop = true

    // Wait for processing to stop
    while (this.isProcessing) {
      await new Promise(r => setTimeout(r, 10))
    }

    // Flush video remuxer
    if (this.videoRemuxer) {
      await this.videoRemuxer.flush()
    }

    // Flush audio decoder
    if (this.audioDecoder) {
      this.audioDecoder.flush()
    }

    // Reset audio ring buffer
    if (this.audioRingBuffer) {
      this.audioRingBuffer.reset()
    }

    // Reset worklet
    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.postMessage({ type: 'reset' })
    }

    // Find nearest keyframe
    const keyframe = this.findNearestKeyframe(targetTime)
    const seekTarget = keyframe?.pts ?? targetTime

    // Seek in libav
    const seekTs = Math.floor(seekTarget * 1000000) // Convert to microseconds
    await this.libav.av_seek_frame(
      this.fmtCtx,
      -1, // Any stream
      seekTs,
      1 // AVSEEK_FLAG_BACKWARD
    )

    // Update current time
    this.currentTime = targetTime

    // Clear network reader cache near old position
    this.reader?.onSeek(seekTs)

    this.setState(wasPlaying ? 'playing' : 'paused')
    this.shouldStop = !wasPlaying

    if (wasPlaying) {
      this.processPackets()
    }
  }

  /**
   * Find the nearest keyframe before a given time
   */
  private findNearestKeyframe(time: number): KeyframeEntry | null {
    if (this.keyframeIndex.length === 0) return null

    // Binary search for nearest keyframe
    let left = 0
    let right = this.keyframeIndex.length - 1
    let result: KeyframeEntry | null = null

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      if (this.keyframeIndex[mid].pts <= time) {
        result = this.keyframeIndex[mid]
        left = mid + 1
      } else {
        right = mid - 1
      }
    }

    return result
  }

  /**
   * Main packet processing loop
   */
  private async processPackets(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      const pkt = await this.libav.av_packet_alloc()
      
      while (!this.shouldStop) {
        // Read next packet
        const ret = await this.libav.av_read_frame(this.fmtCtx, pkt)
        
        if (ret < 0) {
          // End of file or error
          if (ret === -541478725) { // AVERROR_EOF
            console.log('[HybridEngine] End of stream')
            this.dispatchEvent(new CustomEvent('ended', {}))
          } else {
            console.error('[HybridEngine] Read error:', ret)
          }
          break
        }

        // Get packet info
        const streamIndex = await this.libav.AVPacket_stream_index(pkt)
        const pts = await this.libav.AVPacket_pts(pkt)
        const dts = await this.libav.AVPacket_dts(pkt)
        const flags = await this.libav.AVPacket_flags(pkt)
        const data = await this.libav.ff_copyout_packet(pkt)

        // Get time base for this stream
        const stream = await this.libav.AVFormatContext_streams_a(this.fmtCtx, streamIndex)
        const timeBaseNum = await this.libav.AVStream_time_base_num(stream)
        const timeBaseDen = await this.libav.AVStream_time_base_den(stream)
        const timeBase = timeBaseNum / timeBaseDen

        let ptsSeconds = pts * timeBase
        let dtsSeconds = dts * timeBase

        // Normalize timestamps if they start at a large offset
        if (this.startTime === -1) {
             // Try to get global start time from format context first
             // AVFormatContext.start_time is in AV_TIME_BASE units (microseconds usually, or 1/1,000,000)
             // But checking libav docs, it is AV_TIME_BASE (1,000,000)
             const fmtStartTime = await this.libav.AVFormatContext_start_time(this.fmtCtx)
             // AV_NOPTS_VALUE check
             if (fmtStartTime > -9223372036854775000 && fmtStartTime !== 0) {
                 this.startTime = fmtStartTime / 1000000
                 console.log(`[HybridEngine] Found container start time: ${this.startTime}s`)
             } else {
                 // Use first packet as zero point
                 this.startTime = ptsSeconds
                 console.log(`[HybridEngine] Using first packet as start time: ${this.startTime}s`)
             }
        }

        if (this.startTime > 0) {
            ptsSeconds = Math.max(0, ptsSeconds - this.startTime)
            dtsSeconds = Math.max(0, dtsSeconds - this.startTime)
        }

        const isKeyframe = (flags & 1) !== 0

        // Route packet based on stream
        if (streamIndex === this.videoStreamIndex) {
          // Video packet -> remuxer
          const videoPacket: VideoPacket = {
            streamIndex,
            data: data.data,
            pts: ptsSeconds,
            dts: dtsSeconds,
            isKeyframe
          }

          // Track keyframes for seeking
          if (isKeyframe) {
            this.keyframeIndex.push({
              pts: ptsSeconds,
              byteOffset: 0 // Would need to track actual byte offset
            })
          }

          if (this.videoRemuxer) {
            try {
              await this.videoRemuxer.push(videoPacket)
            } catch (remuxError) {
              console.error('[HybridEngine] Video remux error:', remuxError)
            }
          }

          this.currentTime = ptsSeconds
        } else if (streamIndex === this.audioStreamIndex) {
          // Audio packet -> decoder
          const audioPacket: AudioPacket = {
            streamIndex,
            data: data.data,
            pts: ptsSeconds,
            dts: dtsSeconds
          }

          if (this.audioDecoder?.initialized) {
            await this.audioDecoder.decode(audioPacket)
          }
        }

        // Update video clock in worklet
        if (this.audioWorkletNode && this.videoElement) {
          this.audioWorkletNode.port.postMessage({
            type: 'videoClock',
            data: { time: this.videoElement.currentTime }
          })
        }

        // Emit time update
        this.dispatchEvent(new CustomEvent('timeupdate', {
          detail: { currentTime: this.currentTime, duration: this.duration }
        }))

        // Unref packet for reuse
        await this.libav.av_packet_unref(pkt)

        // Check buffer levels and potentially pause reading
        // When AudioContext is suspended (waiting for user interaction), audio isn't being consumed
        // so we need to slow down decoding significantly to avoid buffer overflow
        if (this.audioRingBuffer) {
          const fillLevel = this.audioRingBuffer.fillLevel
          const isAudioSuspended = this.audioContext?.state === 'suspended'
          
          if (fillLevel > 0.95) {
            // Buffer critically full - wait longer
            await new Promise(r => setTimeout(r, 200))
          } else if (fillLevel > 0.9) {
            // Buffer nearly full - wait a bit
            await new Promise(r => setTimeout(r, 100))
          } else if (fillLevel > 0.7 && isAudioSuspended) {
            // Buffer filling up and audio not playing - slow down significantly
            await new Promise(r => setTimeout(r, 150))
          }
        }
      }

      await this.libav.av_packet_free_js(pkt)
    } catch (error) {
      console.error('[HybridEngine] Processing error:', error)
      this.setState('error')
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Destroy the engine and release all resources
   */
  async destroy(): Promise<void> {
    this.setState('destroyed')
    this.shouldStop = true

    // Wait for processing to stop
    while (this.isProcessing) {
      await new Promise(r => setTimeout(r, 10))
    }

    // Cleanup audio
    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.postMessage({ type: 'destroy' })
      this.audioWorkletNode.disconnect()
      this.audioWorkletNode = null
    }

    if (this.audioDecoder) {
      this.audioDecoder.destroy()
      this.audioDecoder = null
    }

    this.audioRingBuffer = null

    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        await this.audioContext.close()
      } catch {
        // Ignore close errors (may already be closed)
      }
    }
    this.audioContext = null

    // Cleanup video
    if (this.videoRemuxer) {
      await this.videoRemuxer.destroy()
      this.videoRemuxer = null
    }

    // Cleanup libav
    if (this.libav && this.fmtCtx) {
      await this.libav.avformat_close_input_js(this.fmtCtx)
    }
    this.libav = null

    // Cleanup reader
    if (this.reader) {
      this.reader.destroy()
      this.reader = null
    }

    this.streams = []
    this.keyframeIndex = []
    this.videoElement = null

    console.log('[HybridEngine] Destroyed')
  }

  /**
   * Update state and emit event
   */
  private setState(newState: EngineState): void {
    if (this.state === newState) return
    this.state = newState
    this.dispatchEvent(new CustomEvent('statechange', { detail: { state: newState } }))
  }

  // Getters
  get currentPlaybackTime(): number {
    return this.currentTime
  }

  get totalDuration(): number {
    return this.duration
  }

  get playbackState(): EngineState {
    return this.state
  }

  get detectedStreams(): StreamInfo[] {
    return this.streams
  }

  get requiresHybridPlayback(): boolean {
    // Returns true if there's an audio stream that can't be played natively
    return this.audioStreamIndex !== -1
  }
}
