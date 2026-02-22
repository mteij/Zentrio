/**
 * Player Engines
 * 
 * Export all player engine implementations and utilities.
 */

// Types
export type {
  IPlayerEngine,
  PlayerState,
  PlayerEventHandlers,
  MediaSource,
  EngineCapabilities,
  SubtitleTrack,
  AudioTrack,
  QualityLevel,
  EngineType,
  EngineConfig
} from './types'

export {
  initialPlayerState,
  defaultWebCapabilities,
  tauriCapabilities
} from './types'

// Engine implementations
export { WebPlayerEngine } from './WebPlayerEngine'
export { TauriPlayerEngine } from './TauriPlayerEngine'
export { HybridPlayerEngine } from './HybridPlayerEngine'

// Factory functions
export {
  createEngine,
  createEngineByType,
  detectEngineType,
  getDefaultEngineType,
  canPlayNatively,
  isTauriEnvironment
} from './factory'
