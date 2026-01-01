/**
 * Demuxer - Placeholder for packet extraction
 * 
 * Note: True packet-level demuxing for streaming is extremely complex
 * with FFmpeg WASM. The practical approach is:
 * - Video: Use NetworkReader for range-based download + VideoRemuxer for fMP4 output
 * - Audio: Use AudioStreamTranscoder for incremental transcoding
 * 
 * This class is kept for API compatibility but delegates to
 * a simpler approach that works reliably.
 */

export interface DemuxerConfig {
  /** Segment duration in seconds (default: 2s) */
  segmentDuration?: number
}

export interface DemuxerEvents {
  'videopacket': any
  'audiopacket': any
  'done': void
  'error': Error
}

export class Demuxer extends EventTarget {
  private fileSize: number = 0
  private processedSize: number = 0
  private config: Required<DemuxerConfig>
  
  // State
  private isInitialized: boolean = false
  private isProcessing: boolean = false
  private shouldStop: boolean = false

  constructor(config: DemuxerConfig = {}) {
    super()
    this.config = {
      segmentDuration: config.segmentDuration ?? 2
    }
  }

  /**
   * Initialize demuxer with file metadata
   */
  async initialize(fileSize: number): Promise<void> {
    this.fileSize = fileSize
    
    console.log('[Demuxer] Initialized with file size:', (fileSize / 1024 / 1024).toFixed(2), 'MB')
    console.log('[Demuxer] Note: Using simplified approach for reliable streaming')
    
    this.isInitialized = true
  }

  /**
   * Process a chunk of data from the source file
   * In simplified mode, just tracks progress
   */
  async appendBuffer(data: Uint8Array): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Demuxer not initialized')
    }
    
    if (this.shouldStop) {
      return
    }
    
    this.isProcessing = true
    this.processedSize += data.length
    
    try {
      // Track progress
      const percent = Math.round((this.processedSize / this.fileSize) * 100)
      if (percent % 10 === 0) {
        console.log(`[Demuxer] Progress: ${percent}% (${(this.processedSize / 1024 / 1024).toFixed(1)}MB)`)
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Stop demuxing
   */
  stop(): void {
    console.log('[Demuxer] Stopping...')
    this.shouldStop = true
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.isInitialized = false
    this.isProcessing = false
    console.log('[Demuxer] Destroyed')
  }

  // Getters
  get progress(): number {
    return this.fileSize > 0 ? (this.processedSize / this.fileSize) : 0
  }
}