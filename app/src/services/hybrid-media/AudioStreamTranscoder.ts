/**
 * AudioStreamTranscoder - Parallel Download + FFmpeg WASM Transcoding
 *
 * Downloads source file in chunks while transcoding in parallel:
 * 1. Start downloading in 50MB chunks
 * 2. After initial buffer (500MB or 10%), start first transcode
 * 3. Continue downloading while transcoding runs
 * 4. Final transcode with complete file when download finishes
 *
 * IMPORTANT: This service is NOT supported in Tauri apps.
 * Tauri uses native system decoders which support more codecs than browsers.
 *
 * Video is NOT transcoded - handled separately by VideoRemuxer.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('AudioStream')

/**
 * Check if running in Tauri environment
 */
function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' &&
         ((window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined)
}

export interface AudioTranscoderConfig {
  /** Chunk size for downloads (default: 50MB) */
  chunkSize?: number
  /** Audio bitrate (default: 192k) */
  bitrate?: string
  /** Initial buffer before first transcode (default: 50MB = 1 chunk) */
  initialBufferSize?: number
}

export class AudioStreamTranscoder extends EventTarget {
  private ffmpeg: FFmpeg | null = null
  private ffmpegLoaded = false
  private abortController: AbortController | null = null
  
  private sourceUrl: string = ''
  private audioStreamIndex: number = 0
  private totalSize: number = 0
  private downloadedSize: number = 0
  
  private config: Required<AudioTranscoderConfig>
  
  // Download state
  private chunks: Uint8Array[] = []
  private isDownloading = false
  private downloadComplete = false
  
  // Transcode state
  private isTranscoding = false
  private transcodeComplete = false
  private hasInitialTranscode = false
  private firstDataAppended = false
  
  // MediaSource for audio output
  private mediaSource: MediaSource | null = null
  private sourceBuffer: SourceBuffer | null = null
  private audioElement: HTMLAudioElement | null = null
  private pendingSegments: Uint8Array[] = []
  private isAppending = false

  constructor(config: AudioTranscoderConfig = {}) {
    super()
    
    // Guard: Hybrid playback is not supported in Tauri
    if (isTauriEnvironment()) {
      throw new Error('AudioStreamTranscoder is not supported in Tauri apps. Use native playback instead.')
    }
    
    this.config = {
      chunkSize: config.chunkSize ?? 50 * 1024 * 1024, // 50MB
      bitrate: config.bitrate ?? '192k',
      // Start transcoding after very small buffer to avoid FFmpeg WASM memory issues
      // 2MB is more reliably supported by FFmpeg WASM virtual filesystem
      initialBufferSize: config.initialBufferSize ?? 2 * 1024 * 1024 // 2MB
    }
  }

  /**
   * Load FFmpeg WASM
   */
  private async loadFFmpeg(): Promise<void> {
    if (this.ffmpegLoaded) return

    this.ffmpeg = new FFmpeg()

    this.ffmpeg.on('log', ({ message }) => {
      // Only log important messages
      if (message.includes('Error') || message.includes('failed') || 
          message.includes('Stream mapping') || message.includes('Output #0')) {
        log.debug('', message)
      }
    })

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    
    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    this.ffmpegLoaded = true
    log.debug('FFmpeg WASM loaded')
  }

  /**
   * Initialize transcoding for a media file
   */
  async initialize(
    url: string, 
    audioStreamIndex: number = 0
  ): Promise<HTMLAudioElement> {
    this.sourceUrl = url
    this.audioStreamIndex = audioStreamIndex
    this.abortController = new AbortController()

    // Load FFmpeg
    await this.loadFFmpeg()

    // Get file size via HEAD request
    const headResp = await fetch(url, { method: 'HEAD' })
    this.totalSize = parseInt(headResp.headers.get('content-length') || '0')
    
    if (this.totalSize === 0) {
      throw new Error('Cannot determine file size')
    }

    log.debug(`File size: ${(this.totalSize / 1024 / 1024).toFixed(1)}MB`)

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
    
    this.sourceBuffer.addEventListener('updateend', () => {
      this.isAppending = false
      this.appendNextSegment()
    })

    this.dispatchEvent(new CustomEvent('ready'))
    
    return this.audioElement
  }

  /**
   * Start parallel download and transcoding
   */
  async start(): Promise<void> {
    if (!this.ffmpeg || !this.sourceUrl) {
      throw new Error('Not initialized')
    }

    try {
      // Start download in background
      this.downloadChunks()
      
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        log.error('Error:', error)
        this.dispatchEvent(new CustomEvent('error', { detail: { error } }))
      }
    }
  }

  /**
   * Download file in chunks, triggering transcode when buffer is ready
   */
  private async downloadChunks(): Promise<void> {
    const chunkSize = this.config.chunkSize
    let offset = 0
    let chunkCount = 0
    const totalChunks = Math.ceil(this.totalSize / chunkSize)

    log.debug(`Starting download (${totalChunks} chunks of ${(chunkSize / 1024 / 1024).toFixed(0)}MB)`)
    this.isDownloading = true

    while (offset < this.totalSize) {
      const end = Math.min(offset + chunkSize - 1, this.totalSize - 1)
      
      const response = await fetch(this.sourceUrl, {
        headers: { 'Range': `bytes=${offset}-${end}` },
        signal: this.abortController?.signal
      })

      if (!response.ok && response.status !== 206) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`)
      }

      const chunk = new Uint8Array(await response.arrayBuffer())
      this.chunks.push(chunk)
      chunkCount++
      
      this.downloadedSize = offset + chunk.length
      const percent = Math.round((this.downloadedSize / this.totalSize) * 100)
      
      log.debug(`Downloaded chunk ${chunkCount}/${totalChunks} (${percent}%)`)
      
      this.dispatchEvent(new CustomEvent('progress', { 
        detail: { 
          downloaded: this.downloadedSize, 
          total: this.totalSize,
          phase: 'downloading',
          percent
        }
      }))

      // Check if we should start initial transcode
      if (!this.hasInitialTranscode && !this.isTranscoding) {
        const bufferReady = this.downloadedSize >= this.config.initialBufferSize || 
                           this.downloadedSize >= this.totalSize * 0.15 // 15% of file
        
        if (bufferReady) {
          log.debug(`Buffer ready (${(this.downloadedSize / 1024 / 1024).toFixed(0)}MB), starting initial transcode...`)
          this.hasInitialTranscode = true
          // Start transcode in parallel (don't await)
          this.transcodeCurrentBuffer(false)
        }
      }

      offset += chunkSize
    }

    log.debug('Download complete')
    this.isDownloading = false
    this.downloadComplete = true

    // Wait for any ongoing transcode to finish
    while (this.isTranscoding) {
      await new Promise(r => setTimeout(r, 100))
    }

    // Final transcode with complete file
    log.debug('Starting final transcode with complete file...')
    await this.transcodeCurrentBuffer(true)
  }

  /**
   * Transcode current buffer
   */
  private async transcodeCurrentBuffer(isFinal: boolean): Promise<void> {
    if (!this.ffmpeg || this.isTranscoding) return
    
    this.isTranscoding = true

    // Generate unique filenames to avoid conflicts
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const inputFilename = `audio_input_${timestamp}_${random}.mkv`
    const outputFilename = `audio_output_${timestamp}_${random}.m4a`

    try {
      // Combine downloaded chunks and write to FFmpeg FS
      log.debug(`Combining ${this.chunks.length} chunks...`)
      
      this.dispatchEvent(new CustomEvent('progress', {
        detail: {
          downloaded: this.downloadedSize,
          total: this.totalSize,
          phase: 'transcoding',
          percent: Math.round((this.downloadedSize / this.totalSize) * 100)
        }
      }))

      // Calculate total size of downloaded chunks
      let totalSize = 0
      for (const chunk of this.chunks) {
        totalSize += chunk.length
      }

      // Combine all chunks into a single buffer
      const combinedBuffer = new Uint8Array(totalSize)
      let offset = 0
      for (const chunk of this.chunks) {
        combinedBuffer.set(chunk, offset)
        offset += chunk.length
      }

      log.debug(`Writing input file to FFmpeg FS (${(totalSize / 1024 / 1024).toFixed(2)}MB)...`)
      await this.ffmpeg.writeFile(inputFilename, combinedBuffer)

      // Try to delete output file first if it exists (avoid conflicts)
      try {
        await this.ffmpeg.deleteFile(outputFilename)
      } catch (e) {
        // File doesn't exist, that's fine
      }

      // Transcode audio from the file in FFmpeg FS to fragmented MP4
      const args = [
        '-i', inputFilename,
        '-map', `0:a:${this.audioStreamIndex}`,
        '-c:a', 'aac',
        '-b:a', this.config.bitrate,
        '-vn',
        '-f', 'mp4',
        '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
        '-y',
        outputFilename
      ]

      log.debug('Executing FFmpeg:', args.join(' '))
      log.debug('Audio stream index:', this.audioStreamIndex)
      log.debug('Source URL:', this.sourceUrl)
      
      // Setup custom error handler
      let ffmpegError: any = null
      let ffmpegOutput = ''
      
      const logHandler = ({ message }: { message: string }) => {
        ffmpegOutput += message + '\n'
        log.debug('FFmpeg:', message)
      }
      
      this.ffmpeg.on('log', logHandler)
      
      try {
        const result = await this.ffmpeg.exec(args)
        log.debug('FFmpeg exec completed, result:', result)
      } catch (execError: any) {
        log.error('FFmpeg exec failed:', execError)
        log.error('FFmpeg output captured:', ffmpegOutput)
        log.error('Exec error type:', typeof execError)
        log.error('Exec error constructor:', execError?.constructor?.name)
        
        // Try to get more error details
        try {
          log.error('Exec error keys:', Object.keys(execError))
          for (const key of Object.keys(execError)) {
            log.error(`Exec error.${key}:`, (execError as any)[key])
          }
        } catch (e) {}
        
        ffmpegError = execError
        throw execError
      } finally {
        // Remove log handler
        this.ffmpeg.off('log', logHandler)
      }

      // Read output
      log.debug('Reading output file...')
      const output = await this.ffmpeg.readFile(outputFilename)
      const outputData = typeof output === 'string'
        ? new TextEncoder().encode(output)
        : new Uint8Array(output)
      log.debug('Output file read successfully')

      if (outputData.length > 0) {
        log.debug(`Transcoded ${(outputData.length / 1024).toFixed(0)}KB of audio`)
        // Queue for MSE
        this.queueSegment(outputData)
        
        // Notify that audio is ready to play
        if (!this.firstDataAppended) {
          this.firstDataAppended = true
          // Wait a moment for append to complete, then dispatch ready event
          setTimeout(() => {
            log.debug('Audio ready to play')
            this.dispatchEvent(new CustomEvent('audioready'))
          }, 100)
        }
      }

      // Cleanup FFmpeg files
      try {
        await this.ffmpeg.deleteFile(inputFilename)
        await this.ffmpeg.deleteFile(outputFilename)
      } catch (e) {
        log.warn('Cleanup error:', e)
      }

      if (isFinal) {
        this.transcodeComplete = true
        // Wait for segments to be appended, then end stream
        await this.waitForAppendComplete()
        if (this.mediaSource?.readyState === 'open') {
          this.mediaSource.endOfStream()
        }
        log.debug('Transcoding complete')
        this.dispatchEvent(new CustomEvent('complete'))
      }

    } catch (error) {
      log.error('Transcode error:', error)
      log.error('Error type:', typeof error)
      log.error('Error constructor:', error?.constructor?.name)
      
      // Try to extract more details from the error
      if (error) {
        try {
          const errorStr = String(error)
          log.error('Error string:', errorStr)
        } catch (e) {}
        
        try {
          const keys = Object.keys(error)
          if (keys.length > 0) {
            log.error('Error keys:', keys)
            for (const key of keys) {
              try {
                log.error(`Error.${key}:`, (error as any)[key])
              } catch (e) {}
            }
          }
        } catch (e) {}
      }
      
      // Cleanup files on error - use a more aggressive cleanup
      log.debug('Attempting cleanup after error...')
      const filesToDelete = [inputFilename, outputFilename]
      for (const filename of filesToDelete) {
        try {
          await this.ffmpeg!.deleteFile(filename)
          log.debug(`Deleted ${filename}`)
        } catch (e) {
          log.warn(`Could not delete ${filename}:`, e)
        }
      }
      
      // Don't fail on intermediate transcodes, but log the error
      if (!isFinal) {
        log.warn('Intermediate transcode failed, continuing...')
      } else {
        // Final transcode failed - this is a critical error
        log.error('Final transcode failed - audio cannot be played')
        this.dispatchEvent(new CustomEvent('error', { detail: { error } }))
      }
    } finally {
      this.isTranscoding = false
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

    const segment = this.pendingSegments.shift()!
    this.isAppending = true
    
    try {
      this.sourceBuffer.appendBuffer(segment.buffer.slice(
        segment.byteOffset,
        segment.byteOffset + segment.byteLength
      ) as ArrayBuffer)
    } catch (error) {
      log.error('Append error:', error)
      this.isAppending = false
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
   */
  seek(time: number): void {
    if (this.audioElement) {
      this.audioElement.currentTime = time
    }
  }

  play(): void {
    this.audioElement?.play().catch(e => 
      log.warn('Play failed:', e)
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
    this.chunks = []

    if (this.ffmpeg) {
      this.ffmpeg.terminate()
      this.ffmpeg = null
      this.ffmpegLoaded = false
    }

    log.debug('Destroyed')
  }
}
