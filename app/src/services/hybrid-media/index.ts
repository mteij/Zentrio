/**
 * Hybrid Media Provider
 * 
 * Play video files with rare/unsupported audio codecs (FLAC, Vorbis, AC3, DTS)
 * directly in the browser without server-side transcoding.
 * 
 * Architecture:
 * - Video: Remuxed to fMP4 on-the-fly, fed to MSE
 * - Audio: Decoded via WASM (libav.js), played through AudioWorklet
 * - I/O: HTTP Range requests with chunked caching
 */

// Core types
export type {
  StreamType,
  StreamInfo,
  CodecInfo,
  VideoPacket,
  AudioPacket,
  DecodedAudioFrame,
  SeekRequest,
  EngineState,
  EngineEvents,
  NetworkReaderConfig,
  VideoRemuxerConfig,
  AudioDecoderConfig,
  HybridEngineConfig,
  KeyframeEntry
} from './types'

// Core classes
export { HybridEngine } from './HybridEngine'
export { NetworkReader } from './NetworkReader'
export { VideoRemuxer } from './VideoRemuxer'
export { AudioDecoder } from './AudioDecoder'
export { AudioRingBuffer, RingBufferReader } from './AudioRingBuffer'

/**
 * Quick check if a URL might need hybrid playback
 * 
 * Note: This is a heuristic based on file extension.
 * For accurate detection, use HybridEngine.initialize() and check requiresHybridPlayback
 */
export function mightNeedHybridPlayback(url: string): boolean {
  const ext = url.split('.').pop()?.toLowerCase()
  
  // Containers that commonly have rare audio codecs
  const containerExts = ['mkv', 'webm', 'avi', 'mov', 'wmv', 'flv']
  
  return containerExts.includes(ext || '')
}

/**
 * List of audio codecs that require WASM decoding
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
