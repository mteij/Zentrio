/**
 * Player Engine Factory
 * 
 * Selects and creates the appropriate player engine based on:
 * - Environment (Tauri vs Web)
 * - Source type and codec requirements
 * - User preferences
 */

import type { IPlayerEngine, MediaSource, EngineConfig, EngineType } from './types'
import { isTauriRuntime } from '../../../lib/runtime-env'
import { getAppTarget } from '../../../lib/app-target'
import { WebPlayerEngine } from './WebPlayerEngine'
import { TauriPlayerEngine } from './TauriPlayerEngine'
import { AndroidNativePlayerEngine } from './AndroidNativePlayerEngine'
import { createLogger } from '../../../utils/client-logger'

const log = createLogger('PlayerFactory')

// Lazy import for hybrid engine to reduce initial bundle size
let HybridPlayerEngine: typeof import('./HybridPlayerEngine').HybridPlayerEngine | null = null

/**
 * Check if running in Tauri environment
 */
export function isTauriEnvironment(): boolean {
  return isTauriRuntime()
}

/**
 * Check if a URL might need hybrid playback (rare audio codecs)
 * This is a quick check - actual probing happens in the hybrid engine
 */
function mightNeedHybridPlayback(url: string): boolean {
  // Tauri (desktop/iOS) system decoders handle everything natively.
  // Android uses ExoPlayer, so hybrid playback is only relevant on the web.
  if (isTauriEnvironment()) {
    return false
  }

  // Check for known problematic containers
  const lowerUrl = url.toLowerCase()
  
  // MKV often contains rare codecs
  if (lowerUrl.includes('.mkv') || lowerUrl.includes('.matroska')) {
    return true
  }
  
  // AVI can have various codecs
  if (lowerUrl.includes('.avi')) {
    return true
  }
  
  // For debrid streams and unknown URLs, we should probe
  // Can't determine codec from URL alone
  if (!lowerUrl.includes('.mp4') && !lowerUrl.includes('.webm') && !lowerUrl.includes('.m3u8')) {
    return true
  }

  return false
}

/**
 * Detect the best engine type for a given source
 */
export async function detectEngineType(
  source: MediaSource,
  config: EngineConfig = {}
): Promise<EngineType> {
  if (isTauriEnvironment()) {
    const target = getAppTarget()

    // Android TV → ExoPlayer (hardware-accelerated, native HLS/DASH)
    if (target.isTv) return 'android-native'

    // Android phone/tablet → ExoPlayer (hardware-accelerated, native HLS/DASH).
    // ExoPlayer handles HLS without a .m3u8 extension, rare codecs, and Dolby audio
    // far better than the Android WebView (which doesn't support HLS natively).
    if (target.os === 'android') return 'android-native'

    // Desktop (Windows/macOS/Linux) and iOS → system decoders via Tauri WebView
    return 'tauri'
  }

  // Check if hybrid is disabled
  if (config.enableHybrid === false) {
    return 'web'
  }

  // Check if source might need hybrid playback
  if (mightNeedHybridPlayback(source.src)) {
    // Try to load hybrid engine
    try {
      if (!HybridPlayerEngine) {
        const module = await import('./HybridPlayerEngine')
        HybridPlayerEngine = module.HybridPlayerEngine
      }
      
      // Check if hybrid engine can handle this source
      if (HybridPlayerEngine) {
        const engine = new HybridPlayerEngine()
        const canPlay = await engine.canPlay(source)
        if (canPlay) {
          return 'hybrid'
        }
      }
    } catch (error) {
      log.warn('Hybrid engine not available:', error)
    }
  }

  // Default to web engine
  return 'web'
}

/**
 * Create a player engine instance
 */
export async function createEngine(
  source?: MediaSource,
  config: EngineConfig = {}
): Promise<IPlayerEngine> {
  // If source is provided, detect best engine
  if (source) {
    const engineType = config.preferredEngine || await detectEngineType(source, config)
    return createEngineByType(engineType)
  }

  // No source — create the default engine for this environment so it's ready
  // for the first loadSource() call. TV gets TvPlayerEngine from the start to
  // avoid an unnecessary engine-switch on first load.
  if (isTauriEnvironment()) {
    const target = getAppTarget()
    if (target.isTv) return createEngineByType('android-native')
    if (target.os === 'android') return createEngineByType('android-native')
    return createEngineByType('tauri')
  }

  return createEngineByType('web')
}

/**
 * Create an engine by explicit type
 */
export async function createEngineByType(type: EngineType): Promise<IPlayerEngine> {
  switch (type) {
    case 'android-native':
      return new AndroidNativePlayerEngine()

    case 'tauri':
      if (!isTauriEnvironment()) {
        log.warn('Creating TauriPlayerEngine outside of Tauri environment')
      }
      return new TauriPlayerEngine()

    case 'hybrid':
      if (isTauriEnvironment()) {
        log.warn('Hybrid engine not supported in Tauri, using native engine')
        return new TauriPlayerEngine()
      }
      if (!HybridPlayerEngine) {
        const module = await import('./HybridPlayerEngine')
        HybridPlayerEngine = module.HybridPlayerEngine
      }
      return new HybridPlayerEngine!()

    case 'web':
    default:
      // Tauri targets should always resolve to native engines even if 'web' is
      // requested explicitly somewhere higher up.
      if (isTauriEnvironment()) {
        const target = getAppTarget()
        return target.os === 'android' ? new AndroidNativePlayerEngine() : new TauriPlayerEngine()
      }
      return new WebPlayerEngine()
  }
}

/**
 * Get the default engine for the current environment
 */
export function getDefaultEngineType(): EngineType {
  if (isTauriEnvironment()) {
    const target = getAppTarget()
    if (target.isTv) return 'android-native'
    if (target.os === 'android') return 'android-native'
    return 'tauri'
  }
  return 'web'
}

/**
 * Check if a source can be played without hybrid engine
 */
export async function canPlayNatively(source: MediaSource): Promise<boolean> {
  // Tauri can play everything natively
  if (isTauriEnvironment()) {
    return true
  }

  // Check with web engine
  const webEngine = new WebPlayerEngine()
  return webEngine.canPlay(source)
}

// Re-export types
export type { IPlayerEngine, MediaSource, EngineConfig, EngineType }
