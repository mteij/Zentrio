/**
 * HybridPlayerEngine
 *
 * Web playback engine with FFmpeg WASM transcoding support for rare codecs.
 * This engine is used when the browser cannot natively decode the audio codec
 * (e.g., FLAC, AC3, DTS in MKV containers).
 *
 * Architecture:
 * - Video: Passed through to MSE (Media Source Extensions)
 * - Audio: Transcoded to AAC via FFmpeg WASM
 *
 * IMPORTANT: This engine is NOT supported in Tauri apps.
 * Tauri uses native system decoders which support more codecs.
 */

import { isTauriRuntime } from '../../../lib/runtime-env'
import type {
  IPlayerEngine,
  PlayerState,
  PlayerEventHandlers,
  MediaSource,
  EngineCapabilities,
  SubtitleTrack,
  AudioTrack,
  QualityLevel,
  HybridConfirmationDetails,
} from './types'
import { createLogger } from '../../../utils/client-logger'

const log = createLogger('HybridPlayerEngine')

// Lazy load hybrid media dependencies
const HybridEnginePromise = import('../../../services/hybrid-media/HybridEngine').then(
  (m) => m.HybridEngine
)
const mightNeedHybridPlaybackPromise = import('../../../services/hybrid-media').then(
  (m) => m.mightNeedHybridPlayback
)
const TranscoderServicePromise = import('../../../services/hybrid-media/TranscoderService').then(
  (m) => m.TranscoderService
)

/**
 * Check if running in Tauri environment
 */
function isTauriEnvironment(): boolean {
  return isTauriRuntime()
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

/**
 * Global cache to prevent re-probing on remounts
 * Maps URL -> 'native' | 'hybrid' | 'failed'
 */
const probeCache = new Map<string, { mode: 'native' | 'hybrid'; duration?: number }>()

/**
 * HybridPlayerEngine - FFmpeg WASM transcoding for rare codecs
 *
 * This engine wraps the existing HybridEngine from services/hybrid-media
 * and adapts it to the IPlayerEngine interface.
 */
export class HybridPlayerEngine implements IPlayerEngine {
  private video: HTMLVideoElement | null = null
  private state: PlayerState
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private eventHandlers: Map<keyof PlayerEventHandlers, Set<Function>> = new Map()
  private externalSubtitles: SubtitleTrack[] = []
  private currentSource: MediaSource | null = null

  // Hybrid engine instance
  private hybridEngine: any = null
  private audioElement: HTMLAudioElement | null = null

  // Playback state
  private isInitialized: boolean = false
  private isHybridMode: boolean = false
  private needsTranscoding: boolean = false
  private hybridConfirmationPending: boolean = false
  private hybridConfirmed: boolean = false

  private static readonly HYBRID_CONFIRM_THRESHOLD = 150 * 1024 * 1024

  constructor() {
    this.state = {
      currentTime: 0,
      duration: 0,
      volume: 1,
      muted: false,
      playbackRate: 1,
      paused: true,
      buffering: true,
      ended: false,
      ready: false,
      buffered: null,
    }
  }

  // ============================================
  // Lifecycle Methods
  // ============================================

  async initialize(videoElement: HTMLVideoElement): Promise<void> {
    if (isTauriEnvironment()) {
      throw new Error('[HybridPlayerEngine] Not supported in Tauri environment')
    }

    if (this.video) {
      log.warn('Already initialized, destroying previous instance')
      await this.destroy()
    }

    this.video = videoElement

    // Initialize state from video element
    this.state = {
      ...this.state,
      volume: videoElement.volume,
      muted: videoElement.muted,
      paused: true,
    }

    this.isInitialized = true
    log.debug('Initialized')
  }

  async loadSource(source: MediaSource): Promise<void> {
    if (!this.video || !this.isInitialized) {
      throw new Error('[HybridPlayerEngine] Not initialized - call initialize() first')
    }

    // Clean up previous source
    await this.cleanupSource()

    this.currentSource = source
    const { src } = source

    log.debug('Loading source:', src.substring(0, 80))

    // Reset state
    this.state = {
      ...this.state,
      currentTime: 0,
      duration: 0,
      buffering: true,
      ended: false,
      ready: false,
      buffered: null,
    }
    this.emit('statechange', this.state)

    // Check cache first
    const cached = probeCache.get(src)
    if (cached) {
      log.debug('Using cached probe result:', cached.mode)
      if (cached.mode === 'hybrid') {
        this.state.duration = cached.duration || 0
        await this.startHybridPlayback(src)
      } else {
        await this.startNativePlayback(src)
      }
      return
    }

    // Probe the file to determine if hybrid playback is needed
    try {
      const [mightNeedHybrid, TranscoderService] = await Promise.all([
        mightNeedHybridPlaybackPromise,
        TranscoderServicePromise,
      ])

      if (!mightNeedHybrid(src)) {
        log.debug('Source likely plays natively')
        probeCache.set(src, { mode: 'native' })
        await this.startNativePlayback(src)
        return
      }

      // Probe for metadata
      log.debug('Probing source for codec info...')
      const metadata = await TranscoderService.probe(src)

      if (!metadata) {
        log.debug('No metadata, trying native playback')
        // Don't cache — missing metadata could be a truncated/failed fetch, not a definitive result
        await this.startNativePlayback(src)
        return
      }

      // Load HybridEngine to check if transcoding is needed
      const HybridEngine = await HybridEnginePromise
      const engine = new HybridEngine(src, metadata)

      if (engine.requiresHybridPlayback) {
        log.debug('Hybrid playback required')
        this.hybridEngine = engine
        this.needsTranscoding = true

        const duration = engine.getDuration()
        probeCache.set(src, { mode: 'hybrid', duration })
        this.state.duration = duration

        const fileSize = metadata?.format?.size || 0
        if (fileSize > HybridPlayerEngine.HYBRID_CONFIRM_THRESHOLD) {
          log.debug(
            `Large file detected (${(fileSize / 1024 / 1024).toFixed(0)}MB), requesting user confirmation`
          )

          const audioStream = (metadata?.streams || []).find(
            (s: any) => s.codec_type === 'audio' && s.index === engine.audioStreamIdx
          )
          const audioCodec = audioStream?.codec_name || 'unknown'
          const fileSizeLabel =
            fileSize >= 1024 * 1024 * 1024
              ? `${(fileSize / 1024 / 1024 / 1024).toFixed(1)} GB`
              : `${(fileSize / 1024 / 1024).toFixed(0)} MB`

          const confirmed = await new Promise<boolean>((resolve) => {
            const details: HybridConfirmationDetails = {
              fileSize,
              fileSizeLabel,
              audioCodec,
              proceed: () => resolve(true),
              cancel: () => resolve(false),
            }
            this.emit('hybridconfirmationneeded', details)
          })

          if (!confirmed) {
            log.debug('User cancelled hybrid playback')
            this.hybridEngine = null
            this.needsTranscoding = false
            this.emit(
              'error',
              new Error(
                'Playback cancelled: unsupported audio codec requires downloading large file'
              )
            )
            return
          }

          log.debug('User confirmed hybrid playback')
        }

        await this.startHybridPlayback(src)
      } else {
        log.debug('Native playback sufficient')
        probeCache.set(src, { mode: 'native' })
        await this.startNativePlayback(src)
      }
    } catch (error) {
      log.error('Probe failed, falling back to native:', error)
      // Don't cache — probe failure (e.g. network timeout) is transient, not a definitive result
      await this.startNativePlayback(src)
    }
  }

  private async startNativePlayback(src: string): Promise<void> {
    if (!this.video) return

    this.isHybridMode = false
    this.video.src = src
    this.video.load()

    // Set up standard video event listeners
    this.setupNativeEventListeners()
  }

  private async startHybridPlayback(src: string): Promise<void> {
    if (!this.video || !this.hybridEngine) return

    this.isHybridMode = true
    log.debug('Starting hybrid playback...')

    try {
      // Initialize the hybrid engine with our video element
      await this.hybridEngine.initialize(this.video)

      // Set up event listeners for hybrid engine
      this.hybridEngine.addEventListener('timeupdate', (e: any) => {
        const { currentTime } = e.detail
        this.state.currentTime = currentTime
        this.emit('timeupdate', currentTime, this.state.duration)
      })

      this.hybridEngine.addEventListener('ended', () => {
        this.state.ended = true
        this.state.paused = true
        this.emit('ended')
        this.emit('statechange', { ended: true, paused: true })
      })

      this.hybridEngine.addEventListener('error', (e: any) => {
        log.error('Hybrid engine error:', e.detail.error)
        this.emit('error', e.detail.error)
      })

      this.hybridEngine.addEventListener('audioready', () => {
        log.debug('Audio ready')
        this.state.ready = true
        this.state.buffering = false
        this.emit('canplay')
        this.emit('statechange', { ready: true, buffering: false })
      })

      // Seek completed — first new audio segment appended after seek restart
      this.hybridEngine.addEventListener('seekready', () => {
        log.debug('Seek ready — resuming')
        this.state.buffering = false
        this.emit('playing')
        this.emit('statechange', { buffering: false })
      })

      // Forward transcoding progress to the player UI
      this.hybridEngine.addEventListener('transcodingprogress', (e: any) => {
        this.emit('transcodingprogress', e.detail)
      })

      // Get the audio element for volume control
      this.audioElement = this.hybridEngine.getAudioElement()

      // Start playback
      await this.hybridEngine.play()
      this.state.paused = false
      this.emit('statechange', { paused: false })
    } catch (error) {
      log.error('Hybrid playback failed:', error)
      // Fall back to native
      this.isHybridMode = false
      await this.startNativePlayback(src)
    }
  }

  private setupNativeEventListeners(): void {
    if (!this.video) return

    const onTimeUpdate = () => {
      if (!this.video) return
      this.state.currentTime = this.video.currentTime
      this.emit('timeupdate', this.video.currentTime, this.state.duration)
    }

    const onDurationChange = () => {
      if (!this.video) return
      this.state.duration = this.video.duration
      this.emit('loadedmetadata', this.video.duration)
    }

    const onPlay = () => {
      this.state.paused = false
      this.state.ended = false
      this.emit('statechange', { paused: false, ended: false })
    }

    const onPause = () => {
      this.state.paused = true
      this.emit('statechange', { paused: true })
    }

    const onEnded = () => {
      this.state.ended = true
      this.state.paused = true
      this.emit('ended')
      this.emit('statechange', { ended: true, paused: true })
    }

    const onWaiting = () => {
      this.state.buffering = true
      this.emit('waiting')
      this.emit('statechange', { buffering: true })
    }

    const onPlaying = () => {
      this.state.buffering = false
      this.state.ready = true
      this.emit('playing')
      this.emit('statechange', { buffering: false, ready: true })
    }

    const onCanPlay = () => {
      this.state.ready = true
      this.emit('canplay')
    }

    const onError = () => {
      const error = this.video?.error
      const message = error ? `Media error: ${error.message || error.code}` : 'Unknown media error'
      this.emit('error', new Error(message))
    }

    this.video.addEventListener('timeupdate', onTimeUpdate)
    this.video.addEventListener('durationchange', onDurationChange)
    this.video.addEventListener('play', onPlay)
    this.video.addEventListener('pause', onPause)
    this.video.addEventListener('ended', onEnded)
    this.video.addEventListener('waiting', onWaiting)
    this.video.addEventListener('playing', onPlaying)
    this.video.addEventListener('canplay', onCanPlay)
    this.video.addEventListener('error', onError)
  }

  private async cleanupSource(): Promise<void> {
    // Destroy hybrid engine
    if (this.hybridEngine) {
      await this.hybridEngine.destroy()
      this.hybridEngine = null
    }

    // Clean up video element
    if (this.video) {
      this.video.removeAttribute('src')
      this.video.load()
    }

    this.audioElement = null
    this.externalSubtitles = []
    this.isHybridMode = false
    this.needsTranscoding = false
  }

  async destroy(): Promise<void> {
    log.debug('Destroying...')

    await this.cleanupSource()

    this.eventHandlers.clear()
    this.video = null
    this.currentSource = null
    this.isInitialized = false

    log.debug('Destroyed')
  }

  // ============================================
  // Playback Control
  // ============================================

  async play(): Promise<void> {
    if (!this.video) {
      throw new Error('[HybridPlayerEngine] Not initialized')
    }

    if (this.isHybridMode && this.hybridEngine) {
      await this.hybridEngine.resume()
      // Also play audio element
      if (this.audioElement) {
        await this.audioElement.play()
      }
    } else {
      await this.video.play()
    }

    this.state.paused = false
    this.emit('statechange', { paused: false })
  }

  pause(): void {
    if (!this.video) return

    if (this.isHybridMode && this.hybridEngine) {
      this.hybridEngine.pause()
    } else {
      this.video.pause()
    }

    this.state.paused = true
    this.emit('statechange', { paused: true })
  }

  async seek(time: number): Promise<void> {
    if (!this.video) return

    const clampedTime = Math.max(0, Math.min(time, this.state.duration))

    if (this.isHybridMode && this.hybridEngine) {
      await this.hybridEngine.seek(clampedTime)
    } else {
      this.video.currentTime = clampedTime
    }

    this.state.currentTime = clampedTime
    this.emit('statechange', { currentTime: clampedTime })
  }

  setVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume))

    if (this.isHybridMode && this.audioElement) {
      this.audioElement.volume = clampedVolume
    }

    if (this.video) {
      this.video.volume = clampedVolume
    }

    this.state.volume = clampedVolume
    this.emit('volumechange', clampedVolume, this.state.muted)
  }

  setMuted(muted: boolean): void {
    if (this.isHybridMode && this.audioElement) {
      this.audioElement.muted = muted
    }

    if (this.video) {
      this.video.muted = muted
    }

    this.state.muted = muted
    this.emit('volumechange', this.state.volume, muted)
  }

  setPlaybackRate(rate: number): void {
    if (this.video) {
      this.video.playbackRate = rate
    }

    // Note: Hybrid engine may not support playback rate changes
    // for the transcoded audio

    this.state.playbackRate = rate
    this.emit('ratechange', rate)
  }

  // ============================================
  // State Access
  // ============================================

  getState(): PlayerState {
    return { ...this.state }
  }

  getCapabilities(): EngineCapabilities {
    return {
      videoCodecs: ['h264', 'hevc', 'vp8', 'vp9', 'av1'],
      audioCodecs: ['aac', 'mp3', 'opus', 'vorbis', 'flac', 'ac3', 'eac3', 'dts', 'truehd'],
      hls: true,
      dash: false,
      mse: typeof MediaSource !== 'undefined',
      canProbe: true,
    }
  }

  // ============================================
  // Track Management
  // ============================================

  getSubtitleTracks(): SubtitleTrack[] {
    if (!this.video) return []

    const tracks: SubtitleTrack[] = []

    for (let i = 0; i < this.video.textTracks.length; i++) {
      const track = this.video.textTracks[i]
      if (track.kind === 'subtitles' || track.kind === 'captions') {
        tracks.push({
          id: track.id || `native-${i}`,
          src: '',
          label: track.label || track.language || `Track ${i}`,
          language: track.language || 'und',
          enabled: track.mode === 'showing',
          kind: track.kind as 'subtitles' | 'captions',
        })
      }
    }

    return [...tracks, ...this.externalSubtitles]
  }

  setSubtitleTrack(id: string | null): void {
    if (!this.video) return

    for (let i = 0; i < this.video.textTracks.length; i++) {
      const track = this.video.textTracks[i]
      if (track.kind === 'subtitles' || track.kind === 'captions') {
        track.mode = 'disabled'
      }
    }

    if (id !== null) {
      for (let i = 0; i < this.video.textTracks.length; i++) {
        const track = this.video.textTracks[i]
        const trackId = track.id || `native-${i}`
        if (trackId === id && (track.kind === 'subtitles' || track.kind === 'captions')) {
          track.mode = 'showing'
          break
        }
      }
    }

    this.emit('subtitletrackschange', this.getSubtitleTracks())
  }

  addSubtitleTracks(tracks: SubtitleTrack[]): void {
    if (!this.video) return

    tracks.forEach((track) => {
      const trackElement = document.createElement('track')
      trackElement.kind = track.kind || 'subtitles'
      trackElement.label = track.label
      trackElement.srclang = track.language
      trackElement.src = track.src
      if (track.enabled) {
        trackElement.default = true
      }

      this.video!.appendChild(trackElement)
      this.externalSubtitles.push({ ...track, id: track.id || generateId() })
    })

    this.emit('subtitletrackschange', this.getSubtitleTracks())
  }

  getAudioTracks(): AudioTrack[] {
    // Hybrid engine doesn't support multiple audio tracks
    // The audio is being transcoded
    return []
  }

  setAudioTrack(_id: string): void {
    // No-op for hybrid engine
  }

  getQualityLevels(): QualityLevel[] {
    // No quality level selection for hybrid
    return []
  }

  setQualityLevel(_id: string): void {
    // No-op for hybrid engine
  }

  // ============================================
  // Event Handling
  // ============================================

  addEventListener<K extends keyof PlayerEventHandlers>(
    event: K,
    handler: PlayerEventHandlers[K]
  ): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set())
    }
    this.eventHandlers.get(event)!.add(handler)
  }

  removeEventListener<K extends keyof PlayerEventHandlers>(
    event: K,
    handler: PlayerEventHandlers[K]
  ): void {
    this.eventHandlers.get(event)?.delete(handler)
  }

  private emit<K extends keyof PlayerEventHandlers>(
    event: K,
    ...args: Parameters<PlayerEventHandlers[K]>
  ): void {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
          ;(handler as Function)(...args)
        } catch (error) {
          log.error(`Error in ${event} handler:`, error)
        }
      })
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  async canPlay(source: MediaSource): Promise<boolean> {
    // Not supported in Tauri
    if (isTauriEnvironment()) {
      return false
    }

    // Check if we might need hybrid playback
    const mightNeedHybrid = await mightNeedHybridPlaybackPromise
    return mightNeedHybrid(source.src)
  }
}

export default HybridPlayerEngine
