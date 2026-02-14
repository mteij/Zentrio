/**
 * Hybrid Media Provider
 *
 * Play video files with rare/unsupported audio codecs (FLAC, Vorbis, AC3, DTS)
 * directly in the browser using FFmpeg WASM for transcoding.
 *
 * IMPORTANT: Hybrid playback is NOT supported in Tauri apps.
 * Tauri uses native system decoders which support more codecs than browsers.
 *
 * Architecture:
 * - Video: Remuxed to fMP4 on-the-fly, fed to MSE
 * - Audio: Transcoded to AAC via FFmpeg WASM, played via HTMLAudioElement
 * - I/O: HTTP Range requests with chunked caching
 */

/**
 * Check if running in Tauri environment
 */
export function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' &&
         ((window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined)
}

// Core types
export type {
  StreamType,
  StreamInfo,
  CodecInfo,
  VideoPacket,
  AudioPacket,
  SeekRequest,
  EngineState,
  EngineEvents,
  NetworkReaderConfig,
  VideoRemuxerConfig,
  HybridEngineConfig,
  KeyframeEntry
} from './types'

// Core classes
export { HybridEngine } from './HybridEngine'
export { NetworkReader } from './NetworkReader'
export { VideoRemuxer } from './VideoRemuxer'
export { TranscoderService } from './TranscoderService'
export { AudioStreamTranscoder } from './AudioStreamTranscoder'
export { ChunkedAudioTranscoder } from './ChunkedAudioTranscoder'
export { StreamingAudioTranscoder } from './StreamingAudioTranscoder'
export { Demuxer } from './Demuxer'

/**
 * Quick check if a URL might need hybrid playback
 *
 * Note: For debrid streams and unknown URLs, we should always probe
 * since we can't determine codec from URL alone.
 * For accurate detection, use HybridEngine.initialize() and check requiresHybridPlayback
 *
 * IMPORTANT: Always returns false in Tauri environment
 */
export function mightNeedHybridPlayback(url: string): boolean {
  // Hybrid playback is not supported in Tauri - always return false
  if (isTauriEnvironment()) {
    return false
  }
  
  // Always probe - we can't reliably determine codec from URL
  // Especially important for debrid streams which may have no extension
  return true
}

/**
 * List of audio codecs that require transcoding
 */
export const RARE_AUDIO_CODECS = [
  'flac',
  'vorbis', 
  'ac3',
  'eac3',
  'dts',
  'truehd',
  'mlp',
  'opus'  // Opus in some containers
]

/**
 * List of video codecs that can be remuxed (not transcoded)
 */
export const REMUXABLE_VIDEO_CODECS = [
  'h264',
  'avc1',
  'hevc',
  'hev1',
  'hvc1',
  'vp9',
  'av1',
  'av01'
]
