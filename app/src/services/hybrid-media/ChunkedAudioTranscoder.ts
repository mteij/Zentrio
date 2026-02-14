/**
 * ChunkedAudioTranscoder - True streaming audio transcoding
 *
 * Processes audio in chunks as they download, enabling playback
 * of large files without waiting for full download.
 *
 * Architecture:
 * 1. Download file in segments (e.g., 10MB chunks)
 * 2. Feed each chunk to FFmpeg for sequential transcoding
 * 3. Append transcoded output to MSE immediately
 * 4. Continue until file is complete
 *
 * IMPORTANT: This service is NOT supported in Tauri apps.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' &&
         ((window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined)
}

export interface ChunkedTranscoderConfig {
  /** Chunk size for processing (default: 10MB) */
  chunkSize?: number
  /** Audio bitrate (default: 192k) */
  bitrate?: string
  /** Overlap between chunks for seamless decoding (default: 1MB) */
  chunkOverlap?: number
}

interface ProcessedChunk {
  index: number
  data: Uint8Array
  startTime: number
  duration: number
}

export class ChunkedAudioTranscoder extends EventTarget {
  private ffmpeg: FFmpeg | null = null
  private ffmpegLoaded = false
  private abortController: AbortController | null = null

  private sourceUrl: string = ''
  private audioStreamIndex: number = 0
  private totalSize: number = 0
  private config: Required<ChunkedTranscoderConfig>

  // MediaSource for audio output
  private mediaSource: MediaSource | null = null
  private sourceBuffer: SourceBuffer | null = null
  private audioElement: HTMLAudioElement | null = null
  private pendingSegments: Uint8Array[] = []
  private isAppending = false

  // Chunk processing state
  private currentChunkIndex = 0
  private totalChunks = 0
  private isProcessing = false
  private processedChunks: Map<number, ProcessedChunk> = new Map()
  private nextAppendIndex = 0
  private cumulativeDuration = 0

  // Track if we've appended initialization segment
  private initSegmentAppended = false

  constructor(config: ChunkedTranscoderConfig = {}) {
    super()

    if (isTauriEnvironment()) {
      throw new Error('ChunkedAudioTranscoder is not supported in Tauri apps.')
    }

    this.config = {
      chunkSize: config.chunkSize ?? 10 * 1024 * 1024, // 10MB
      bitrate: config.bitrate ?? '192k',
      chunkOverlap: config.chunkOverlap ?? 1024 * 1024 // 1MB overlap
    }
  }

  /**
   * Load FFmpeg WASM
   */
  private async loadFFmpeg(): Promise<void> {
    if (this.ffmpegLoaded) return

    this.ffmpeg = new FFmpeg()

    this.ffmpeg.on('log', ({ message }) => {
      if (message.includes('Error') || message.includes('failed') ||
          message.includes('Stream mapping') || message.includes('Output #0')) {
        console.log('[ChunkedAudioTranscoder]', message)
      }
    })

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    this.ffmpegLoaded = true
    console.log('[ChunkedAudioTranscoder] FFmpeg WASM loaded')
  }

  /**
   * Initialize transcoding for a media file
   */
  async initialize(url: string, audioStreamIndex: number = 0): Promise<HTMLAudioElement> {
    this.sourceUrl = url
    this.audioStreamIndex = audioStreamIndex
    this.abortController = new AbortController()
    this.currentChunkIndex = 0
    this.processedChunks.clear()
    this.nextAppendIndex = 0
    this.cumulativeDuration = 0
    this.initSegmentAppended = false

    // Load FFmpeg
    await this.loadFFmpeg()

    // Get file size via HEAD request
    const headResp = await fetch(url, { method: 'HEAD' })
    this.totalSize = parseInt(headResp.headers.get('content-length') || '0')

    if (this.totalSize === 0) {
      throw new Error('Cannot determine file size')
    }

    this.totalChunks = Math.ceil(this.totalSize / this.config.chunkSize)
    console.log(`[ChunkedAudioTranscoder] File size: ${(this.totalSize / 1024 / 1024).toFixed(1)}MB, ${this.totalChunks} chunks`)

    // Create MediaSource for audio output
    this.mediaSource = new MediaSource()
    this.audioElement = document.createElement('audio')
    this.audioElement.src = URL.createObjectURL(this.mediaSource)

    // Wait for MediaSource to open
    await new Promise<void>((resolve) => {
      this.mediaSource!.addEventListener('sourceopen', () => resolve(), { once: true })
    })

    // Create SourceBuffer for AAC audio in fMP4 container
    this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mp4; codecs="mp4a.40.2"')
    this.sourceBuffer.mode = 'sequence'

    this.sourceBuffer.addEventListener('updateend', () => {
      this.isAppending = false
      this.appendNextSegment()
    })

    this.dispatchEvent(new CustomEvent('ready'))

    return this.audioElement
  }

  /**
   * Start chunked download and transcoding
   */
  async start(): Promise<void> {
    if (!this.ffmpeg || !this.sourceUrl) {
      throw new Error('Not initialized')
    }

    this.isProcessing = true

    try {
      // Process chunks sequentially
      for (let i = 0; i < this.totalChunks; i++) {
        if (this.abortController?.signal.aborted) {
          throw new Error('Aborted')
        }

        await this.processChunk(i)

        // Dispatch progress
        const percent = Math.round(((i + 1) / this.totalChunks) * 100)
        this.dispatchEvent(new CustomEvent('progress', {
          detail: {
            chunk: i + 1,
            totalChunks: this.totalChunks,
            percent,
            phase: 'transcoding'
          }
        }))
      }

      // Signal completion
      await this.waitForAppendComplete()
      if (this.mediaSource?.readyState === 'open') {
        this.mediaSource.endOfStream()
      }

      this.dispatchEvent(new CustomEvent('complete'))
      console.log('[ChunkedAudioTranscoder] All chunks processed')

    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('[ChunkedAudioTranscoder] Error:', error)
        this.dispatchEvent(new CustomEvent('error', { detail: { error } }))
      }
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Download and process a single chunk
   */
  private async processChunk(chunkIndex: number): Promise<void> {
    const start = chunkIndex * this.config.chunkSize
    const end = Math.min(start + this.config.chunkSize - 1, this.totalSize - 1)

    console.log(`[ChunkedAudioTranscoder] Processing chunk ${chunkIndex + 1}/${this.totalChunks} (bytes ${start}-${end})`)

    // Download chunk
    const response = await fetch(this.sourceUrl, {
      headers: { 'Range': `bytes=${start}-${end}` },
      signal: this.abortController?.signal
    })

    if (!response.ok && response.status !== 206) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }

    const chunkData = new Uint8Array(await response.arrayBuffer())
    console.log(`[ChunkedAudioTranscoder] Downloaded chunk ${chunkIndex}: ${(chunkData.length / 1024).toFixed(0)}KB`)

    // Transcode this chunk
    const transcodedData = await this.transcodeChunk(chunkData, chunkIndex, start === 0)

    if (transcodedData && transcodedData.length > 0) {
      // Store processed chunk
      this.processedChunks.set(chunkIndex, {
        index: chunkIndex,
        data: transcodedData,
        startTime: this.cumulativeDuration,
        duration: 0 // Will be determined by playback
      })

      // Try to append in order
      this.appendChunksInOrder()

      // Notify that audio is ready on first chunk
      if (chunkIndex === 0) {
        this.dispatchEvent(new CustomEvent('audioready'))
      }
    }
  }

  /**
   * Transcode a single chunk using FFmpeg
   */
  private async transcodeChunk(chunkData: Uint8Array, chunkIndex: number, isFirstChunk: boolean): Promise<Uint8Array | null> {
    if (!this.ffmpeg) return null

    const timestamp = Date.now()
    const inputFilename = `chunk_${chunkIndex}_${timestamp}_input.mkv`
    const outputFilename = `chunk_${chunkIndex}_${timestamp}_output.m4a`

    try {
      // Write chunk to FFmpeg FS
      await this.ffmpeg.writeFile(inputFilename, chunkData)

      // Build FFmpeg args for this chunk
      // For chunks after the first, we may need special handling for container boundaries
      const args: string[] = [
        '-i', inputFilename,
        '-map', `0:a:${this.audioStreamIndex}`,
        '-c:a', 'aac',
        '-b:a', this.config.bitrate,
        '-vn',
        '-f', 'mp4',
        '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
        '-y'
      ]

      // For non-first chunks, try to avoid re-encoding the init
      if (!isFirstChunk) {
        args.push('-avoid_negative_ts', 'make_zero')
      }

      args.push(outputFilename)

      console.log(`[ChunkedAudioTranscoder] Transcoding chunk ${chunkIndex}...`)

      // Execute FFmpeg
      await this.ffmpeg.exec(args)

      // Read output
      const output = await this.ffmpeg.readFile(outputFilename)
      const outputData = typeof output === 'string'
        ? new TextEncoder().encode(output)
        : new Uint8Array(output)

      console.log(`[ChunkedAudioTranscoder] Chunk ${chunkIndex} transcoded: ${(outputData.length / 1024).toFixed(0)}KB`)

      // Cleanup
      await this.ffmpeg.deleteFile(inputFilename)
      await this.ffmpeg.deleteFile(outputFilename)

      return outputData

    } catch (error) {
      console.error(`[ChunkedAudioTranscoder] Failed to transcode chunk ${chunkIndex}:`, error)

      // Cleanup on error
      try { await this.ffmpeg.deleteFile(inputFilename) } catch {}
      try { await this.ffmpeg.deleteFile(outputFilename) } catch {}

      // For chunks that fail, return null - we'll skip them
      // This allows partial playback even if some chunks fail
      return null
    }
  }

  /**
   * Append chunks to MSE in sequential order
   */
  private appendChunksInOrder(): void {
    while (this.processedChunks.has(this.nextAppendIndex)) {
      const chunk = this.processedChunks.get(this.nextAppendIndex)!
      this.queueSegment(chunk.data)
      this.processedChunks.delete(this.nextAppendIndex)
      this.nextAppendIndex++
    }
  }

  /**
   * Queue a segment for appending to SourceBuffer
   */
  private queueSegment(data: Uint8Array): void {
    this.pendingSegments.push(data)
    this.appendNextSegment()
  }

  /**
   * Append next pending segment to SourceBuffer
   */
  private appendNextSegment(): void {
    if (this.isAppending || this.pendingSegments.length === 0 || !this.sourceBuffer) {
      return
    }

    if (this.sourceBuffer.updating) {
      return
    }

    if (this.mediaSource?.readyState !== 'open') {
      return
    }

    const segment = this.pendingSegments.shift()!
    this.isAppending = true

    try {
      this.sourceBuffer.appendBuffer(segment.buffer.slice(
        segment.byteOffset,
        segment.byteOffset + segment.byteLength
      ) as ArrayBuffer)
    } catch (error) {
      console.error('[ChunkedAudioTranscoder] Append error:', error)
      this.isAppending = false

      // If QuotaExceededError, remove some buffered data and retry
      if ((error as Error).name === 'QuotaExceededError') {
        this.handleQuotaExceeded(segment)
      }
    }
  }

  /**
   * Handle quota exceeded by removing old buffer
   */
  private handleQuotaExceeded(segment: Uint8Array): void {
    if (!this.sourceBuffer || !this.audioElement) return

    try {
      const currentTime = this.audioElement.currentTime
      const buffered = this.sourceBuffer.buffered

      if (buffered.length > 0) {
        // Remove everything before current time minus 30 seconds
        const removeEnd = Math.max(0, currentTime - 30)
        if (removeEnd > 0) {
          this.sourceBuffer.remove(0, removeEnd)
          // Re-queue the segment
          this.pendingSegments.unshift(segment)
        }
      }
    } catch (e) {
      console.error('[ChunkedAudioTranscoder] Error handling quota exceeded:', e)
    }
  }

  /**
   * Wait for all pending appends to complete
   */
  private async waitForAppendComplete(): Promise<void> {
    while (this.pendingSegments.length > 0 || this.isAppending) {
      await new Promise(r => setTimeout(r, 50))
    }
  }

  /**
   * Get the audio element
   */
  getAudioElement(): HTMLAudioElement | null {
    return this.audioElement
  }

  /**
   * Seek to a specific time
   * Note: With chunked transcoding, seeking requires finding the right chunk
   */
  async seek(time: number): Promise<void> {
    // Estimate which chunk contains this time
    // This is approximate since we don't know exact duration per chunk
    if (this.audioElement && this.cumulativeDuration > 0) {
      this.audioElement.currentTime = time
    }
  }

  play(): void {
    this.audioElement?.play().catch(e =>
      console.warn('[ChunkedAudioTranscoder] Play failed:', e)
    )
  }

  pause(): void {
    this.audioElement?.pause()
  }

  /**
   * Stop and cleanup
   */
  async destroy(): Promise<void> {
    this.abortController?.abort()
    this.isProcessing = false

    if (this.audioElement) {
      this.audioElement.pause()
      const oldSrc = this.audioElement.src
      this.audioElement.src = ''
      URL.revokeObjectURL(oldSrc)
      this.audioElement = null
    }

    if (this.mediaSource) {
      if (this.mediaSource.readyState === 'open') {
        try {
          this.mediaSource.endOfStream()
        } catch {}
      }
      this.mediaSource = null
    }

    this.sourceBuffer = null
    this.pendingSegments = []
    this.processedChunks.clear()

    if (this.ffmpeg) {
      this.ffmpeg.terminate()
      this.ffmpeg = null
      this.ffmpegLoaded = false
    }

    console.log('[ChunkedAudioTranscoder] Destroyed')
  }
}
