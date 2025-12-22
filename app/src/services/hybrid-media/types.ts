/**
 * Hybrid Media Provider - Type Definitions
 * 
 * Core types for the hybrid playback engine that handles
 * video remuxing and audio decoding for rare codecs.
 */

/** Stream type identifier */
export type StreamType = 'video' | 'audio' | 'subtitle'

/** Codec information extracted from stream */
export interface CodecInfo {
  codecId: number
  codecName: string
  codecString: string  // e.g., "avc1.640028" for MSE
  profile?: string
  level?: number
  extradata?: Uint8Array  // SPS/PPS for H.264, etc.
}

/** Detected stream metadata */
export interface StreamInfo {
  index: number
  type: StreamType
  codec: CodecInfo
  
  // Video-specific
  width?: number
  height?: number
  frameRate?: number
  
  // Audio-specific
  sampleRate?: number
  channels?: number
  bitsPerSample?: number
  
  // Common
  duration: number  // seconds
  bitrate?: number
}

/** Raw video packet from demuxer */
export interface VideoPacket {
  streamIndex: number
  data: Uint8Array
  pts: number        // Presentation timestamp (seconds)
  dts: number        // Decode timestamp (seconds)
  isKeyframe: boolean
  duration?: number
}

/** Raw audio packet from demuxer */
export interface AudioPacket {
  streamIndex: number
  data: Uint8Array
  pts: number
  dts: number
  duration?: number
}

/** Decoded audio frame (PCM) */
export interface DecodedAudioFrame {
  samples: Float32Array[]  // Per-channel samples
  pts: number
  sampleRate: number
  channels: number
  samplesPerChannel: number
}

/** Seek operation parameters */
export interface SeekRequest {
  targetTime: number       // Target time in seconds
  keyframeBefore?: number  // Nearest keyframe before target
  byteOffset?: number      // Byte offset for file seek
}

/** Engine state */
export type EngineState = 
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'seeking'
  | 'buffering'
  | 'error'
  | 'destroyed'

/** Engine events */
export interface EngineEvents {
  'statechange': { state: EngineState }
  'timeupdate': { currentTime: number; duration: number }
  'streamsdetected': { streams: StreamInfo[] }
  'buffering': { isBuffering: boolean }
  'error': { error: Error }
  'ended': {}
}

/** Network reader configuration */
export interface NetworkReaderConfig {
  chunkSize?: number       // Bytes per chunk (default: 256KB)
  maxCacheSize?: number    // Max cache entries (default: 50)
  prefetchCount?: number   // Chunks to prefetch ahead (default: 3)
  timeout?: number         // Request timeout ms (default: 30000)
}

/** Video remuxer configuration */
export interface VideoRemuxerConfig {
  segmentDuration?: number  // fMP4 segment duration (default: 1s)
  bufferAhead?: number      // Seconds to buffer ahead (default: 30)
}

/** Audio decoder configuration */
export interface AudioDecoderConfig {
  bufferDuration?: number   // Ring buffer duration (default: 10s)
  sampleRate?: number       // Output sample rate (default: 48000)
  channels?: number         // Output channels (default: 2)
}

/** Hybrid engine configuration */
export interface HybridEngineConfig {
  network?: NetworkReaderConfig
  video?: VideoRemuxerConfig
  audio?: AudioDecoderConfig
}

/** Keyframe index entry for seeking */
export interface KeyframeEntry {
  pts: number
  byteOffset: number
}
