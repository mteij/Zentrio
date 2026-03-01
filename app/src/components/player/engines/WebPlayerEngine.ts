/**
 * WebPlayerEngine
 * 
 * Standard web browser playback engine using HTML5 video element
 * with HLS.js for adaptive streaming support.
 */

import Hls from 'hls.js'
import type {
  IPlayerEngine,
  PlayerState,
  PlayerEventHandlers,
  MediaSource,
  EngineCapabilities,
  SubtitleTrack,
  AudioTrack,
  QualityLevel
} from './types'

/**
 * Extended HTMLVideoElement with audioTracks support (Safari/Chrome experimental)
 */
interface HTMLVideoElementWithAudioTracks extends HTMLVideoElement {
  audioTracks?: AudioTrackList
}

interface AudioTrackList {
  length: number
  [index: number]: {
    id: string
    label: string
    language: string
    enabled: boolean
  }
}

/**
 * Check if running in Tauri environment
 */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' &&
    ((window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined)
}

/**
 * Generate a unique ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

/**
 * WebPlayerEngine - Standard web browser playback
 * 
 * Features:
 * - Native HTML5 video playback
 * - HLS.js integration for m3u8 streams
 * - Subtitle track management
 * - Audio track management
 * - Quality level selection (HLS)
 */
export class WebPlayerEngine implements IPlayerEngine {
  private video: HTMLVideoElementWithAudioTracks | null = null
  private hls: Hls | null = null
  private state: PlayerState
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private eventHandlers: Map<keyof PlayerEventHandlers, Set<Function>> = new Map()
  private externalSubtitles: SubtitleTrack[] = []
  private currentSource: MediaSource | null = null
  
  // Bound event handlers for cleanup
  private boundHandlers: Map<string, EventListener> = new Map()

  constructor() {
    this.state = {
      currentTime: 0,
      duration: 0,
      volume: 1,
      muted: false,
      playbackRate: 1,
      paused: true,
      buffering: false,
      ended: false,
      ready: false,
      buffered: null
    }
  }

  // ============================================
  // Lifecycle Methods
  // ============================================

  async initialize(videoElement: HTMLVideoElement): Promise<void> {
    if (this.video) {
      console.warn('[WebPlayerEngine] Already initialized, destroying previous instance')
      await this.destroy()
    }

    this.video = videoElement as HTMLVideoElementWithAudioTracks
    this.setupVideoEventListeners()
    
    // Initialize state from video element
    this.state = {
      ...this.state,
      volume: videoElement.volume,
      muted: videoElement.muted,
      paused: videoElement.paused
    }

    console.log('[WebPlayerEngine] Initialized')
  }

  async loadSource(source: MediaSource): Promise<void> {
    if (!this.video) {
      throw new Error('[WebPlayerEngine] Not initialized - call initialize() first')
    }

    // Clean up previous source
    await this.cleanupSource()

    this.currentSource = source
    const { src, type } = source

    console.log('[WebPlayerEngine] Loading source:', src.substring(0, 80), 'type:', type)

    // Reset state
    this.state = {
      ...this.state,
      currentTime: 0,
      duration: 0,
      buffering: true,
      ended: false,
      ready: false,
      buffered: null
    }
    this.emit('statechange', this.state)

    // Determine how to load the source
    const isHLS = src.includes('.m3u8') || type === 'application/x-mpegurl' || type === 'application/vnd.apple.mpegurl'

    if (isHLS) {
      await this.loadHLS(src)
    } else {
      // Direct playback for MP4, WebM, etc.
      this.video.src = src
      this.video.load()
    }
  }

  private async loadHLS(src: string): Promise<void> {
    if (!this.video) return

    // Check if HLS is natively supported (Safari)
    if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('[WebPlayerEngine] Using native HLS support')
      this.video.src = src
      this.video.load()
      return
    }

    // Use HLS.js
    if (!Hls.isSupported()) {
      throw new Error('[WebPlayerEngine] HLS is not supported in this browser')
    }

    console.log('[WebPlayerEngine] Using HLS.js')

    this.hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 90,
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      startLevel: -1, // Auto
      capLevelToPlayerSize: true,
      abrEwmaDefaultEstimate: 500000,
    })

    this.hls.loadSource(src)
    this.hls.attachMedia(this.video)

    // Set up HLS.js event listeners
    this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log('[WebPlayerEngine] HLS manifest parsed')
      this.emit('canplay')
    })

    this.hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        console.error('[WebPlayerEngine] HLS fatal error:', data)
        this.emit('error', new Error(`HLS error: ${data.type} - ${data.details}`))
      }
    })

    this.hls.on(Hls.Events.LEVELS_UPDATED, () => {
      this.emitQualityLevels()
    })

    this.hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
      this.emitAudioTracks()
    })
  }

  private async cleanupSource(): Promise<void> {
    // Clean up HLS
    if (this.hls) {
      this.hls.destroy()
      this.hls = null
    }

    // Clean up video element
    if (this.video) {
      this.video.removeAttribute('src')
      this.video.load()
    }

    // Clear external subtitles
    this.externalSubtitles = []
  }

  async destroy(): Promise<void> {
    console.log('[WebPlayerEngine] Destroying...')

    await this.cleanupSource()

    // Remove all event listeners
    this.removeVideoEventListeners()
    this.eventHandlers.clear()
    this.boundHandlers.clear()

    this.video = null
    this.currentSource = null

    console.log('[WebPlayerEngine] Destroyed')
  }

  // ============================================
  // Playback Control
  // ============================================

  async play(): Promise<void> {
    if (!this.video) {
      throw new Error('[WebPlayerEngine] Not initialized')
    }

    try {
      await this.video.play()
      this.state.paused = false
      this.emit('statechange', { paused: false })
    } catch (error) {
      console.error('[WebPlayerEngine] Play error:', error)
      throw error
    }
  }

  pause(): void {
    if (!this.video) return

    this.video.pause()
    this.state.paused = true
    this.emit('statechange', { paused: true })
  }

  async seek(time: number): Promise<void> {
    if (!this.video) return

    this.video.currentTime = Math.max(0, Math.min(time, this.state.duration))
    this.state.currentTime = this.video.currentTime
    this.emit('statechange', { currentTime: this.video.currentTime })
  }

  setVolume(volume: number): void {
    if (!this.video) return

    const clampedVolume = Math.max(0, Math.min(1, volume))
    this.video.volume = clampedVolume
    this.state.volume = clampedVolume
    this.emit('volumechange', clampedVolume, this.state.muted)
  }

  setMuted(muted: boolean): void {
    if (!this.video) return

    this.video.muted = muted
    this.state.muted = muted
    this.emit('volumechange', this.state.volume, muted)
  }

  setPlaybackRate(rate: number): void {
    if (!this.video) return

    this.video.playbackRate = rate
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
      videoCodecs: ['h264', 'vp8', 'vp9', 'av1'],
      audioCodecs: ['aac', 'mp3', 'opus', 'vorbis'],
      hls: Hls.isSupported() || (this.video?.canPlayType('application/vnd.apple.mpegurl') !== ''),
      dash: false,
      mse: typeof MediaSource !== 'undefined',
      canProbe: false
    }
  }

  // ============================================
  // Track Management
  // ============================================

  getSubtitleTracks(): SubtitleTrack[] {
    if (!this.video) return []

    const tracks: SubtitleTrack[] = []

    // Get native text tracks
    for (let i = 0; i < this.video.textTracks.length; i++) {
      const track = this.video.textTracks[i]
      if (track.kind === 'subtitles' || track.kind === 'captions') {
        tracks.push({
          id: track.id || `native-${i}`,
          src: '', // Native tracks don't expose src
          label: track.label || track.language || `Track ${i}`,
          language: track.language || 'und',
          enabled: track.mode === 'showing',
          kind: track.kind as 'subtitles' | 'captions'
        })
      }
    }

    // Add external subtitle tracks
    this.externalSubtitles.forEach(track => {
      if (!tracks.find(t => t.id === track.id)) {
        tracks.push(track)
      }
    })

    return tracks
  }

  setSubtitleTrack(id: string | null): void {
    if (!this.video) return

    // Disable all tracks first
    for (let i = 0; i < this.video.textTracks.length; i++) {
      const track = this.video.textTracks[i]
      if (track.kind === 'subtitles' || track.kind === 'captions') {
        track.mode = 'disabled'
      }
    }

    // Enable the selected track
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

    tracks.forEach(track => {
      // Create a track element for external subtitles
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
    if (!this.video) return []

    const tracks: AudioTrack[] = []

    // Native audio tracks (limited browser support)
    if (this.video.audioTracks) {
      for (let i = 0; i < this.video.audioTracks.length; i++) {
        const track = this.video.audioTracks[i]
        tracks.push({
          id: track.id || `audio-${i}`,
          label: track.label || track.language || `Audio ${i}`,
          language: track.language || 'und',
          enabled: track.enabled
        })
      }
    }

    // HLS.js audio tracks
    if (this.hls && this.hls.audioTracks) {
      this.hls.audioTracks.forEach((track, i) => {
        tracks.push({
          id: String(track.id || i),
          label: track.name || track.lang || `Audio ${i}`,
          language: track.lang || 'und',
          enabled: this.hls!.audioTrack === track.id
        })
      })
    }

    return tracks
  }

  setAudioTrack(id: string): void {
    // HLS.js audio track selection
    if (this.hls) {
      const trackId = parseInt(id, 10)
      if (!isNaN(trackId)) {
        this.hls.audioTrack = trackId
        this.emit('audiotrackschange', this.getAudioTracks())
        return
      }
    }

    // Native audio track selection (limited browser support)
    if (this.video?.audioTracks) {
      for (let i = 0; i < this.video.audioTracks.length; i++) {
        const track = this.video.audioTracks[i]
        track.enabled = track.id === id || `audio-${i}` === id
      }
      this.emit('audiotrackschange', this.getAudioTracks())
    }
  }

  getQualityLevels(): QualityLevel[] {
    if (!this.hls) return []

    const levels: QualityLevel[] = [
      { id: 'auto', label: 'Auto', selected: this.hls.currentLevel === -1 }
    ]

    this.hls.levels.forEach((level, i) => {
      levels.push({
        id: String(i),
        label: level.height ? `${level.height}p` : `Level ${i}`,
        width: level.width,
        height: level.height,
        bitrate: level.bitrate,
        selected: this.hls!.currentLevel === i
      })
    })

    return levels
  }

  setQualityLevel(id: string): void {
    if (!this.hls) return

    if (id === 'auto') {
      this.hls.currentLevel = -1
    } else {
      const level = parseInt(id, 10)
      if (!isNaN(level)) {
        this.hls.currentLevel = level
      }
    }

    this.emit('qualitylevelschange', this.getQualityLevels())
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
      handlers.forEach(handler => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
          (handler as Function)(...args)
        } catch (error) {
          console.error(`[WebPlayerEngine] Error in ${event} handler:`, error)
        }
      })
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  async canPlay(source: MediaSource): Promise<boolean> {
    // Don't use WebPlayerEngine in Tauri
    if (isTauriEnvironment()) {
      return false
    }

    const { src, type } = source

    // Check for HLS
    if (src.includes('.m3u8') || type === 'application/x-mpegurl') {
      return Hls.isSupported() || (this.video?.canPlayType('application/vnd.apple.mpegurl') !== '')
    }

    // Check for DASH (not supported by this engine)
    if (src.includes('.mpd') || type === 'application/dash+xml') {
      return false
    }

    // For other formats, check if video element can play
    if (this.video && type) {
      return this.video.canPlayType(type) !== ''
    }

    // Assume we can try
    return true
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private setupVideoEventListeners(): void {
    if (!this.video) return

    // Time update
    this.addVideoListener('timeupdate', () => {
      if (!this.video) return
      this.state.currentTime = this.video.currentTime
      this.emit('timeupdate', this.video.currentTime, this.state.duration)
    })

    // Duration change
    this.addVideoListener('durationchange', () => {
      if (!this.video) return
      this.state.duration = this.video.duration
      this.emit('loadedmetadata', this.video.duration)
    })

    // Play/Pause
    this.addVideoListener('play', () => {
      this.state.paused = false
      this.state.ended = false
      this.emit('statechange', { paused: false, ended: false })
    })

    this.addVideoListener('pause', () => {
      this.state.paused = true
      this.emit('statechange', { paused: true })
    })

    // Ended
    this.addVideoListener('ended', () => {
      this.state.ended = true
      this.state.paused = true
      this.emit('ended')
      this.emit('statechange', { ended: true, paused: true })
    })

    // Buffering
    this.addVideoListener('waiting', () => {
      this.state.buffering = true
      this.emit('waiting')
      this.emit('statechange', { buffering: true })
    })

    this.addVideoListener('playing', () => {
      this.state.buffering = false
      this.state.ready = true
      this.emit('playing')
      this.emit('statechange', { buffering: false, ready: true })
    })

    this.addVideoListener('canplay', () => {
      this.state.ready = true
      this.emit('canplay')
    })

    // Progress (buffered)
    this.addVideoListener('progress', () => {
      if (!this.video) return
      this.state.buffered = this.video.buffered
      this.emit('statechange', { buffered: this.video.buffered })
    })

    // Error
    this.addVideoListener('error', () => {
      const error = this.video?.error
      const message = error ? `Media error: ${error.message || error.code}` : 'Unknown media error'
      this.emit('error', new Error(message))
    })

    // Volume
    this.addVideoListener('volumechange', () => {
      if (!this.video) return
      this.state.volume = this.video.volume
      this.state.muted = this.video.muted
      this.emit('volumechange', this.video.volume, this.video.muted)
    })

    // Rate
    this.addVideoListener('ratechange', () => {
      if (!this.video) return
      this.state.playbackRate = this.video.playbackRate
      this.emit('ratechange', this.video.playbackRate)
    })
  }

  private addVideoListener(event: string, handler: EventListener): void {
    if (!this.video) return

    this.video.addEventListener(event, handler)
    this.boundHandlers.set(event, handler)
  }

  private removeVideoEventListeners(): void {
    if (!this.video) return

    this.boundHandlers.forEach((handler, event) => {
      this.video!.removeEventListener(event, handler)
    })
    this.boundHandlers.clear()
  }

  private emitQualityLevels(): void {
    this.emit('qualitylevelschange', this.getQualityLevels())
  }

  private emitAudioTracks(): void {
    this.emit('audiotrackschange', this.getAudioTracks())
  }
}

export default WebPlayerEngine
