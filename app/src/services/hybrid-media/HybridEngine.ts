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

      // Open input
      const [fmtCtx] = await this.libav.ff_init_demuxer_file('input.media')
      this.fmtCtx = fmtCtx

      // Find stream info
      await this.libav.avformat_find_stream_info(fmtCtx, 0)

      // Analyze streams
      this.streams = await this.analyzeStreams()
      
      // Get duration - handle AV_NOPTS_VALUE (very large negative number when unknown)
      const duration = await this.libav.AVFormatContext_duration(fmtCtx)
      // AV_NOPTS_VALUE is 0x8000000000000000, which shows as a large negative number
      // Duration should never be negative, so treat it as unknown/0
      this.duration = duration > 0 ? duration / 1000000 : 0 // Convert from microseconds

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

      if (codecType === 0) { // AVMEDIA_TYPE_VIDEO
        const width = await this.libav.AVCodecParameters_width(codecpar)
        const height = await this.libav.AVCodecParameters_height(codecpar)
        
        // Get codec string for MSE
        const codecString = this.getVideoCodecString(codecId, codecpar)
        
        const streamInfo: StreamInfo = {
          index: i,
          type: 'video',
          codec: {
            codecId,
            codecName: this.getCodecName(codecId),
            codecString
          },
          width,
          height,
          duration: this.duration
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
          duration: this.duration
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
  private getVideoCodecString(codecId: number, _codecpar: number): string {
    // Simplified codec strings - a proper implementation would extract
    // profile and level from the extradata
    switch (codecId) {
      case CODEC_ID_H264:
        return 'avc1.640028' // High Profile, Level 4.0
      case CODEC_ID_HEVC:
        return 'hev1.1.6.L120.90' // Main Profile
      case CODEC_ID_VP9:
        return 'vp09.00.10.08'
      case CODEC_ID_AV1:
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
    await this.videoRemuxer.attach(video, videoStream.codec)

    // Mute video element (audio comes from worklet)
    video.muted = true
    
    console.log('[HybridEngine] Video attached')
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
    if (this.state !== 'ready' && this.state !== 'paused') {
      throw new Error(`Cannot start from state: ${this.state}`)
    }

    this.setState('playing')
    this.shouldStop = false

    // Start audio worklet
    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.postMessage({ type: 'play' })
    }

    // Resume audio context if suspended
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume()
    }

    // Start video element
    if (this.videoElement) {
      this.videoElement.play().catch(e => console.warn('Autoplay blocked:', e))
    }

    // Start packet processing loop
    this.processPackets()
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

        const ptsSeconds = pts * timeBase
        const dtsSeconds = dts * timeBase
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
            await this.videoRemuxer.push(videoPacket)
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
        if (this.audioRingBuffer && this.audioRingBuffer.fillLevel > 0.9) {
          // Buffer nearly full, wait a bit
          await new Promise(r => setTimeout(r, 50))
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
      this.videoRemuxer.destroy()
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
