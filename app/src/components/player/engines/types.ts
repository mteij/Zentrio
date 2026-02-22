/**
 * Player Engine Types
 * 
 * Core abstraction layer for video playback engines.
 * All engines (Web, Tauri, Hybrid) must implement IPlayerEngine.
 */

/**
 * Current state of the player
 */
export interface PlayerState {
  /** Current playback time in seconds */
  currentTime: number
  /** Total duration in seconds */
  duration: number
  /** Volume level (0-1) */
  volume: number
  /** Whether audio is muted */
  muted: boolean
  /** Playback rate (1 = normal, 2 = double speed, etc.) */
  playbackRate: number
  /** Whether playback is paused */
  paused: boolean
  /** Whether the player is buffering */
  buffering: boolean
  /** Whether playback has ended */
  ended: boolean
  /** Whether the player is ready to play */
  ready: boolean
  /** Current buffered ranges */
  buffered: TimeRanges | null
}

/**
 * Subtitle track information
 */
export interface SubtitleTrack {
  /** Unique identifier for the track */
  id: string
  /** URL or source of the subtitle file */
  src: string
  /** Display label for the track */
  label: string
  /** Language code (e.g., 'en', 'es') */
  language: string
  /** Whether this track is currently enabled */
  enabled: boolean
  /** Optional addon name that provided this track */
  addonName?: string
  /** Track type (subtitles, captions) */
  kind?: 'subtitles' | 'captions'
}

/**
 * Audio track information
 */
export interface AudioTrack {
  /** Unique identifier for the track */
  id: string
  /** Display label for the track */
  label: string
  /** Language code (e.g., 'en', 'es') */
  language: string
  /** Whether this track is currently enabled */
  enabled: boolean
}

/**
 * Quality level information (for HLS/DASH)
 */
export interface QualityLevel {
  /** Unique identifier */
  id: string
  /** Display label (e.g., "1080p", "720p", "Auto") */
  label: string
  /** Width in pixels */
  width?: number
  /** Height in pixels */
  height?: number
  /** Bitrate in bits per second */
  bitrate?: number
  /** Whether this is currently selected */
  selected: boolean
}

/**
 * Event handler types
 */
export interface PlayerEventHandlers {
  /** Fired when current time updates */
  timeupdate: (time: number, duration: number) => void
  /** Fired when playback ends */
  ended: () => void
  /** Fired when an error occurs */
  error: (error: Error) => void
  /** Fired when player state changes */
  statechange: (state: Partial<PlayerState>) => void
  /** Fired when metadata (duration, etc.) is loaded */
  loadedmetadata: (duration: number) => void
  /** Fired when player can start playing */
  canplay: () => void
  /** Fired when player starts buffering */
  waiting: () => void
  /** Fired when player starts playing after buffering */
  playing: () => void
  /** Fired when volume changes */
  volumechange: (volume: number, muted: boolean) => void
  /** Fired when playback rate changes */
  ratechange: (rate: number) => void
  /** Fired when subtitle tracks change */
  subtitletrackschange: (tracks: SubtitleTrack[]) => void
  /** Fired when audio tracks change */
  audiotrackschange: (tracks: AudioTrack[]) => void
  /** Fired when quality levels change */
  qualitylevelschange: (levels: QualityLevel[]) => void
}

/**
 * Source configuration for loading media
 */
export interface MediaSource {
  /** URL of the media file */
  src: string
  /** MIME type hint (e.g., 'video/mp4', 'application/x-mpegurl') */
  type?: string
}

/**
 * Engine capabilities
 */
export interface EngineCapabilities {
  /** List of supported video codecs */
  videoCodecs: string[]
  /** List of supported audio codecs */
  audioCodecs: string[]
  /** Whether HLS is supported */
  hls: boolean
  /** Whether DASH is supported */
  dash: boolean
  /** Whether MSE (Media Source Extensions) is supported */
  mse: boolean
  /** Whether the engine can probe files for codec info */
  canProbe: boolean
}

/**
 * Main player engine interface
 * 
 * All playback engines must implement this interface to provide
 * a consistent API for the player UI components.
 */
export interface IPlayerEngine {
  // ============================================
  // Lifecycle Methods
  // ============================================
  
  /**
   * Initialize the engine with a video element
   * Called once when the player mounts
   */
  initialize(videoElement: HTMLVideoElement): Promise<void>
  
  /**
   * Load a media source
   * Can be called multiple times to change sources
   */
  loadSource(source: MediaSource): Promise<void>
  
  /**
   * Clean up all resources
   * Called when the player unmounts
   */
  destroy(): Promise<void>
  
  // ============================================
  // Playback Control
  // ============================================
  
  /**
   * Start or resume playback
   */
  play(): Promise<void>
  
  /**
   * Pause playback
   */
  pause(): void
  
  /**
   * Seek to a specific time in seconds
   */
  seek(time: number): Promise<void>
  
  /**
   * Set volume level (0-1)
   */
  setVolume(volume: number): void
  
  /**
   * Set muted state
   */
  setMuted(muted: boolean): void
  
  /**
   * Set playback rate
   */
  setPlaybackRate(rate: number): void
  
  // ============================================
  // State Access
  // ============================================
  
  /**
   * Get current player state
   */
  getState(): PlayerState
  
  /**
   * Get engine capabilities
   */
  getCapabilities(): EngineCapabilities
  
  // ============================================
  // Track Management
  // ============================================
  
  /**
   * Get all available subtitle tracks
   */
  getSubtitleTracks(): SubtitleTrack[]
  
  /**
   * Enable a subtitle track by ID, or disable all if null
   */
  setSubtitleTrack(id: string | null): void
  
  /**
   * Add external subtitle tracks
   */
  addSubtitleTracks(tracks: SubtitleTrack[]): void
  
  /**
   * Get all available audio tracks
   */
  getAudioTracks(): AudioTrack[]
  
  /**
   * Select an audio track by ID
   */
  setAudioTrack(id: string): void
  
  /**
   * Get all available quality levels (for adaptive streaming)
   */
  getQualityLevels(): QualityLevel[]
  
  /**
   * Set quality level by ID, or 'auto' for automatic selection
   */
  setQualityLevel(id: string): void
  
  // ============================================
  // Event Handling
  // ============================================
  
  /**
   * Add an event listener
   */
  addEventListener<K extends keyof PlayerEventHandlers>(
    event: K,
    handler: PlayerEventHandlers[K]
  ): void
  
  /**
   * Remove an event listener
   */
  removeEventListener<K extends keyof PlayerEventHandlers>(
    event: K,
    handler: PlayerEventHandlers[K]
  ): void
  
  // ============================================
  // Utility Methods
  // ============================================
  
  /**
   * Check if this engine can play a given source
   * Returns a confidence score (0-1) or boolean
   */
  canPlay(source: MediaSource): Promise<boolean>
}

/**
 * Engine type identifier
 */
export type EngineType = 'web' | 'tauri' | 'hybrid'

/**
 * Engine factory configuration
 */
export interface EngineConfig {
  /** Preferred engine type */
  preferredEngine?: EngineType
  /** Whether to enable HLS.js for HLS streams */
  enableHls?: boolean
  /** Whether to enable hybrid playback for rare codecs */
  enableHybrid?: boolean
  /** Custom HLS.js configuration */
  hlsConfig?: Record<string, unknown>
}

/**
 * Initial player state
 */
export const initialPlayerState: PlayerState = {
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

/**
 * Default engine capabilities for web browsers
 */
export const defaultWebCapabilities: EngineCapabilities = {
  videoCodecs: ['h264', 'vp8', 'vp9', 'av1'],
  audioCodecs: ['aac', 'mp3', 'opus', 'vorbis'],
  hls: true,
  dash: false,
  mse: true,
  canProbe: false
}

/**
 * Tauri engine capabilities (broader codec support via system decoders)
 */
export const tauriCapabilities: EngineCapabilities = {
  videoCodecs: ['h264', 'hevc', 'h265', 'vp8', 'vp9', 'av1', 'mpeg2', 'mpeg4'],
  audioCodecs: ['aac', 'mp3', 'opus', 'vorbis', 'flac', 'ac3', 'eac3', 'dts', 'truehd', 'pcm'],
  hls: true,
  dash: true,
  mse: true,
  canProbe: false
}
