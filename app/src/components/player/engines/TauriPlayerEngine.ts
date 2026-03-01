/**
 * TauriPlayerEngine
 * 
 * Native playback engine for Tauri desktop/mobile apps.
 * Uses the system's native media decoders which support more codecs
 * than web browsers (including HEVC, FLAC, AC3, DTS, etc.)
 */

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
 * TauriPlayerEngine - Native playback for Tauri apps
 * 
 * Features:
 * - Native system decoders (broader codec support)
 * - Direct file playback without transcoding
 * - Subtitle track management
 * - Audio track management
 * 
 * Note: This engine is only used when running in Tauri.
 * The webview in Tauri can play most formats natively using
 * the system's media framework (Media Foundation on Windows,
 * AVFoundation on macOS, GStreamer on Linux).
 */
export class TauriPlayerEngine implements IPlayerEngine {
  private video: HTMLVideoElement | null = null
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
    if (!isTauriEnvironment()) {
      console.warn('[TauriPlayerEngine] Not in Tauri environment - this engine may not work correctly')
    }

    if (this.video) {
      console.warn('[TauriPlayerEngine] Already initialized, destroying previous instance')
      await this.destroy()
    }

    this.video = videoElement
    this.setupVideoEventListeners()
    
    // Initialize state from video element
    this.state = {
      ...this.state,
      volume: videoElement.volume,
      muted: videoElement.muted,
      paused: videoElement.paused
    }

    console.log('[TauriPlayerEngine] Initialized')
  }

  async loadSource(source: MediaSource): Promise<void> {
    if (!this.video) {
      throw new Error('[TauriPlayerEngine] Not initialized - call initialize() first')
    }

    // Clean up previous source
    await this.cleanupSource()

    this.currentSource = source
    const { src, type } = source

    console.log('[TauriPlayerEngine] Loading source:', src.substring(0, 80), 'type:', type)

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

    // Tauri webview can play most formats directly
    // Just set the source and let the system handle it
    this.video.src = src
    this.video.load()
  }

  private async cleanupSource(): Promise<void> {
    if (this.video) {
      this.video.removeAttribute('src')
      this.video.load()
    }

    // Clear external subtitles
    this.externalSubtitles = []
  }

  async destroy(): Promise<void> {
    console.log('[TauriPlayerEngine] Destroying...')

    await this.cleanupSource()

    // Remove all event listeners
    this.removeVideoEventListeners()
    this.eventHandlers.clear()
    this.boundHandlers.clear()

    this.video = null
    this.currentSource = null

    console.log('[TauriPlayerEngine] Destroyed')
  }

  // ============================================
  // Playback Control
  // ============================================

  async play(): Promise<void> {
    if (!this.video) {
      throw new Error('[TauriPlayerEngine] Not initialized')
    }

    try {
      await this.video.play()
      this.state.paused = false
      this.emit('statechange', { paused: false })
    } catch (error) {
      console.error('[TauriPlayerEngine] Play error:', error)
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
      // Tauri webview uses system decoders - much broader support
      videoCodecs: ['h264', 'hevc', 'h265', 'vp8', 'vp9', 'av1', 'mpeg2', 'mpeg4', 'theora'],
      audioCodecs: ['aac', 'mp3', 'opus', 'vorbis', 'flac', 'ac3', 'eac3', 'dts', 'truehd', 'pcm', 'alac'],
      hls: true,
      dash: true,
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
          src: '',
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

    // Native audio tracks (limited browser support, but may work in Tauri)
    const videoWithAudioTracks = this.video as any
    if (videoWithAudioTracks.audioTracks) {
      for (let i = 0; i < videoWithAudioTracks.audioTracks.length; i++) {
        const track = videoWithAudioTracks.audioTracks[i]
        tracks.push({
          id: track.id || `audio-${i}`,
          label: track.label || track.language || `Audio ${i}`,
          language: track.language || 'und',
          enabled: track.enabled
        })
      }
    }

    return tracks
  }

  setAudioTrack(id: string): void {
    if (!this.video) return

    // Native audio track selection (limited support)
    const videoWithAudioTracks = this.video as any
    if (videoWithAudioTracks.audioTracks) {
      for (let i = 0; i < videoWithAudioTracks.audioTracks.length; i++) {
        const track = videoWithAudioTracks.audioTracks[i]
        track.enabled = track.id === id || `audio-${i}` === id
      }
      this.emit('audiotrackschange', this.getAudioTracks())
    }
  }

  getQualityLevels(): QualityLevel[] {
    // Tauri doesn't have adaptive streaming quality selection
    // The video plays at its native quality
    return []
  }

  setQualityLevel(_id: string): void {
    // No-op for Tauri - no quality level selection
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
          console.error(`[TauriPlayerEngine] Error in ${event} handler:`, error)
        }
      })
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  async canPlay(source: MediaSource): Promise<boolean> {
    // Only use TauriPlayerEngine in Tauri environment
    if (!isTauriEnvironment()) {
      return false
    }

    // Tauri can play almost anything via system decoders
    // Just check if we have a valid URL
    return !!source.src
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
}

export default TauriPlayerEngine
