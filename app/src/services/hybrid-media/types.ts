/**
 * Hybrid Media Provider - Type Definitions
 *
 * Core types for the hybrid playback engine that handles
 * video remuxing and audio decoding for rare codecs.
 */

/** Stream type identifier */
export type StreamType = 'video' | 'audio' | 'subtitle'

/** Media metadata from stream analysis */
export interface MediaMetadata {
  streams?: MediaStream[]
  format?: MediaFormat
}

/** Individual stream info */
export interface MediaStream {
  index: number
  codec_type?: StreamType
  codec_name?: string
  codec_id?: number
  profile?: string
  width?: number
  height?: number
  channels?: number
  sample_rate?: number
  bit_rate?: number
  tags?: {
    language?: string
    title?: string
    [key: string]: any
  }
}

/** Format info */
export interface MediaFormat {
  format_name?: string
  format_long_name?: string
  duration?: number
  size?: number
  bit_rate?: number
}

/** Codec information extracted from stream */
export interface CodecInfo {
  codecId: number
  codecName: string
  codecString: string  // e.g., "avc1.640028" for MSE
  profile?: string
  profileId?: number   // Numeric profile ID (e.g. 2 for HEVC Main 10)
  level?: number
  bitDepth?: number    // e.g. 8 or 10
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

/** Combined stream info result */
export interface CombinedStreamInfo {
  video?: StreamInfo | null
  audio?: StreamInfo | null
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
  'audioready': { audioElement: HTMLAudioElement }
  'seeked': { time: number }
  'progress': { progress: number }
}

/** Progress event data */
export interface ProgressData {
  loaded: number
  total: number
  type: 'video' | 'audio'
}

/** Network reader configuration */
export interface NetworkReaderConfig {
  chunkSize?: number       // Bytes per chunk (default: 256KB)
  maxCacheSize?: number    // Max cache entries (default: 50)
  prefetchCount?: number   // Chunks to prefetch ahead (default: 3)
  timeout?: number         // Request timeout ms (default: 30000)
  bufferSize?: number      // Buffer size in bytes
}

/** Video remuxer configuration */
export interface VideoRemuxerConfig {
  segmentDuration?: number  // fMP4 segment duration (default: 1s)
  bufferAhead?: number      // Seconds to buffer ahead (default: 30)
}

/** Hybrid engine configuration */
export interface HybridEngineConfig {
  network?: NetworkReaderConfig
  video?: VideoRemuxerConfig
  bufferSize?: number      // Buffer size in bytes
  prefetchSize?: number     // Prefetch size in bytes
  segmentSize?: number      // Segment size in bytes
  onProgress?: (data: ProgressData) => void
  onError?: (error: Error) => void
}

/** Keyframe index entry for seeking */
export interface KeyframeEntry {
  pts: number
  byteOffset: number
}
