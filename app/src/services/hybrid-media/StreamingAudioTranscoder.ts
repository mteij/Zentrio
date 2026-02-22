/**
 * StreamingAudioTranscoder - Progressive audio transcoding
 *
 * Downloads file progressively and transcodes audio as data arrives,
 * enabling playback to start quickly without waiting for full download.
 *
 * Unlike chunked processing, this uses a single FFmpeg instance with
 * streaming input for seamless transcoding.
 *
 * IMPORTANT: This service is NOT supported in Tauri apps.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

function isTauriEnvironment(): boolean {
  return typeof window !== 'undefined' &&
         ((window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined)
}

export interface StreamingTranscoderConfig {
  /** Audio bitrate (default: 192k) */
  bitrate?: string
  /** Initial buffer size before starting playback (default: 5MB) */
  initialBufferSize?: number
  /** Max file size for full download (default: 200MB) */
  maxFullDownloadSize?: number
  /** Optional shared FFmpeg instance to avoid memory conflicts */
  ffmpegInstance?: FFmpeg
}

export class StreamingAudioTranscoder extends EventTarget {
  private ffmpeg: FFmpeg | null = null
  private ffmpegLoaded = false
  private abortController: AbortController | null = null
  private sharedFFmpeg: FFmpeg | null = null  // Shared instance from HybridEngine

  private sourceUrl: string = ''
  private audioStreamIndex: number = 0
  private totalSize: number = 0
  private duration: number = 0
  
  // Seek convergence
  private pendingSeekCheck: { targetTime: number, startByteOffset: number } | null = null
  private seekAttemptCount: number = 0

  private config: Omit<Required<StreamingTranscoderConfig>, 'ffmpegInstance'>

  // MediaSource for audio output
  private mediaSource: MediaSource | null = null
  private sourceBuffer: SourceBuffer | null = null
  private audioElement: HTMLAudioElement | null = null
  private pendingSegments: Uint8Array[] = []
  private isAppending = false

  // Download state
  private downloadedBytes = 0
  private isComplete = false
  private audioReadyDispatched = false
  private supportsRanges = true  // updated by probeFileSize()

  // Cache probeFileSize() results across initialize() calls for the same URL
  private static probeCache = new Map<string, { size: number; supportsRanges: boolean }>()
  
  // Container header for chunked transcoding (experimental)
  // MKV files need headers prepended to each chunk for FFmpeg to understand the format
  private containerHeader: Uint8Array | null = null
  // Reduced to 512KB to fit in WASM memory - should still capture essential MKV headers
  private readonly HEADER_SIZE = 8 * 1024 // 8KB to capture main header but avoid first cluster media

  constructor(config: StreamingTranscoderConfig = {}) {
    super()

    if (isTauriEnvironment()) {
      throw new Error('StreamingAudioTranscoder is not supported in Tauri apps.')
    }

    // Store shared FFmpeg instance if provided
    this.sharedFFmpeg = config.ffmpegInstance || null

    this.config = {
      bitrate: config.bitrate ?? '192k',
      initialBufferSize: config.initialBufferSize ?? 5 * 1024 * 1024, // 5MB
      maxFullDownloadSize: config.maxFullDownloadSize ?? 200 * 1024 * 1024 // 200MB
    }
  }

  /**
   * Load FFmpeg WASM - or use shared instance if provided
   */
  private async loadFFmpeg(): Promise<void> {
    if (this.ffmpegLoaded) return

    // Use shared instance if provided (avoids memory conflicts)
    if (this.sharedFFmpeg) {
      this.ffmpeg = this.sharedFFmpeg
      this.ffmpegLoaded = true
      console.log('[StreamingAudioTranscoder] Using shared FFmpeg instance')
      return
    }

    // Create new instance (fallback)
    this.ffmpeg = new FFmpeg()

    this.ffmpeg.on('log', ({ message }) => {
      // Only log important messages
      if (message.includes('Error') || message.includes('failed') ||
          message.includes('Stream mapping') || message.includes('Output #0')) {
        console.log('[StreamingAudioTranscoder]', message)
      }
    })

    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

    await this.ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

    this.ffmpegLoaded = true
    console.log('[StreamingAudioTranscoder] FFmpeg WASM loaded (own instance)')
  }

  /**
   * Initialize transcoding for a media file
   */
  async initialize(url: string, audioStreamIndex: number = 0, duration: number = 0): Promise<HTMLAudioElement> {
    this.sourceUrl = url
    this.audioStreamIndex = audioStreamIndex
    this.duration = duration
    this.abortController = new AbortController()
    this.downloadedBytes = 0
    this.isComplete = false
    this.audioReadyDispatched = false
    this.pendingSegments = []
    this.pendingSeekCheck = null
    this.seekAttemptCount = 0

    // Load FFmpeg
    await this.loadFFmpeg()

    const { size, supportsRanges } = await this.probeFileSize(url)
    this.totalSize = size
    this.supportsRanges = supportsRanges

    console.log(`[StreamingAudioTranscoder] File size: ${(this.totalSize / 1024 / 1024).toFixed(1)}MB, ranges: ${supportsRanges}`)

    // Create MediaSource for audio output
    this.mediaSource = new MediaSource()
    this.audioElement = document.createElement('audio')
    
    // Ensure audio element is properly configured for playback
    this.audioElement.volume = 1.0
    this.audioElement.muted = false
    this.audioElement.preload = 'auto'
    
    this.audioElement.src = URL.createObjectURL(this.mediaSource)

    // Wait for MediaSource to open
    await new Promise<void>((resolve) => {
      this.mediaSource!.addEventListener('sourceopen', () => resolve(), { once: true })
    })

    // Create SourceBuffer for AAC audio in fMP4 container.
    // Use 'segments' mode so we can control timestampOffset for seeking.
    this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mp4; codecs="mp4a.40.2"')
    this.sourceBuffer.mode = 'segments'

    this.sourceBuffer.addEventListener('updateend', () => {
      this.isAppending = false
      
      // Check for seek convergence logic
      if (this.pendingSeekCheck && this.sourceBuffer) {
         try {
             if (this.sourceBuffer.buffered.length > 0) {
                 this.checkSeekConvergence()
             }
         } catch (e) {
             console.warn('[StreamingAudioTranscoder] Error checking seek convergence:', e)
         }
      }

      this.appendNextSegment()
      
      // Dispatch audioready when first audio data is actually appended
      // Guard against MediaSource being closed/removed
      if (!this.audioReadyDispatched && 
          this.sourceBuffer && 
          this.mediaSource?.readyState === 'open') {
        try {
          if (this.sourceBuffer.buffered.length > 0) {
            this.audioReadyDispatched = true
            console.log('[StreamingAudioTranscoder] Audio data appended, dispatching audioready')
            this.dispatchEvent(new CustomEvent('audioready'))
          }
        } catch (e) {
          // SourceBuffer was removed from MediaSource
          console.warn('[StreamingAudioTranscoder] SourceBuffer no longer valid:', e)
        }
      }
    })

    this.dispatchEvent(new CustomEvent('ready'))

    return this.audioElement
  }

  /**
   * Start progressive download and transcoding
   */
  async start(): Promise<void> {
    if (!this.ffmpeg || !this.sourceUrl) {
      throw new Error('Not initialized')
    }

    try {
      // For files under maxFullDownloadSize, download whole file and transcode
      // For larger files, use progressive download with streaming transcoding
      if (this.totalSize <= this.config.maxFullDownloadSize) {
        await this.downloadAndTranscodeFull()
      } else {
        await this.downloadAndTranscodeProgressive()
      }

      // Signal completion
      await this.waitForAppendComplete()
      if (this.mediaSource?.readyState === 'open') {
        this.mediaSource.endOfStream()
      }

      this.dispatchEvent(new CustomEvent('complete'))
      console.log('[StreamingAudioTranscoder] Transcoding complete')

    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('[StreamingAudioTranscoder] Error:', error)
        this.dispatchEvent(new CustomEvent('error', { detail: { error } }))
      }
    }
  }

  /**
   * Sync audio playback with a video element
   * Handles seeking and drift correction
   */
  syncWithVideo(video: HTMLVideoElement): void {
    console.log('[StreamingAudioTranscoder] Syncing with video element')

    // Handle seeking
    video.addEventListener('seeking', async () => {
      console.log('[StreamingAudioTranscoder] Video seeking to:', video.currentTime)
      
      if (this.audioElement) {
        // Sync audio time immediately
        this.audioElement.currentTime = video.currentTime
        
        // Check if we have buffered data for this time
        const buffered = this.sourceBuffer?.buffered
        let isBuffered = false
        if (buffered) {
          for (let i = 0; i < buffered.length; i++) {
            if (video.currentTime >= buffered.start(i) && video.currentTime <= buffered.end(i)) {
              isBuffered = true
              break
            }
          }
        }

        if (!isBuffered && this.totalSize > 0 && this.duration > 0) {
          console.log('[StreamingAudioTranscoder] Seek target not buffered, restarting transcoding...')
          
          // Calculate approx byte offset
          const ratio = video.currentTime / this.duration
          
          // Conservative estimation: seek back significantly to ensure we capture the target time
          // VBR variance means we might overestimate position. It's safer to download extra data from before
          // than to start AFTER the target time (which causes silence).
          // We subtract 5MB or 5% of file, whichever is smaller/safer? No, fixed 5-10MB is good.
          const SAFETY_MARGIN = 5 * 1024 * 1024 // 5MB cushion
          let targetByteOffset = (ratio * this.totalSize) - SAFETY_MARGIN
          targetByteOffset = Math.max(0, targetByteOffset)
          
          // Align to 4KB blocks
          targetByteOffset = Math.floor(targetByteOffset / 4096) * 4096
          
          console.log(`[StreamingAudioTranscoder] Seek target: ${video.currentTime}s, Ratio: ${ratio.toFixed(3)}, Offset: ${targetByteOffset} (with safety margin)`)
          
          await this.restartFromOffset(targetByteOffset, video.currentTime)
        }
      }
    })
    
    // State flags for sync
    let audioWaiting = false
    let videoWaiting = false

    // Initial check
    if (this.audioElement && this.audioElement.readyState < 3) {
       console.log('[StreamingAudioTranscoder] Initial audio wait -> holding video')
       audioWaiting = true
       video.pause()
    }
    
    // Handle playback drift (tight loop)
    video.addEventListener('timeupdate', () => {
      if (this.audioElement && !this.audioElement.paused) {
        const diff = Math.abs(this.audioElement.currentTime - video.currentTime)
        if (diff > 0.3) {
           console.log(`[StreamingAudioTranscoder] A/V Sync drift: ${diff.toFixed(2)}s, correcting...`)
           this.audioElement.currentTime = video.currentTime
        }
      }
    })

    // --- Audio -> Video Sync ---
    if (this.audioElement) {
      this.audioElement.addEventListener('waiting', () => {
         console.log('[StreamingAudioTranscoder] Audio buffering -> pausing video')
         audioWaiting = true
         video.pause() 
      })
      
      this.audioElement.addEventListener('playing', () => {
         // Also handle case where we were waiting initially
         if (audioWaiting) {
            console.log('[StreamingAudioTranscoder] Audio resumed -> resuming video')
            audioWaiting = false
            if (video.paused) video.play().catch(()=>{})
         }
      })
      
      this.audioElement.addEventListener('pause', () => {
         // If audio pauses (e.g. by script or user), pause video?
         // Usually video is the master for user interaction.
         // If audio pauses because of waiting, we already handled it. 
      })
    }
    
    // --- Video -> Audio Sync ---
    video.addEventListener('waiting', () => {
       console.log('[StreamingAudioTranscoder] Video buffering -> pausing audio')
       videoWaiting = true
       this.audioElement?.pause()
    })
    
    video.addEventListener('playing', () => {
       if (videoWaiting) {
          console.log('[StreamingAudioTranscoder] Video resumed -> resuming audio')
          videoWaiting = false
          if (this.audioElement?.paused) this.audioElement.play().catch(()=>{})
       }
    })
    
    // --- User/System Pause Sync ---
    video.addEventListener('pause', () => {
       // Only pause audio if this wasn't caused by audio waiting
       if (!audioWaiting && this.audioElement) {
          this.audioElement.pause()
       }
    })
    
    video.addEventListener('play', () => {
       // If user clicks play, try to play audio
       if (this.audioElement && this.audioElement.paused && !videoWaiting) {
          this.audioElement.play().catch(()=>{})
       }
    })
  }
  
  /**
   * Restart transcoding from a specific byte offset
   */
  private async restartFromOffset(byteOffset: number, timeOffset: number): Promise<void> {
     // Cancel current work
     if (this.abortController) {
       this.abortController.abort()
     }
     this.abortController = new AbortController()

     // Track seek attempt for convergence
     this.pendingSeekCheck = { targetTime: timeOffset, startByteOffset: byteOffset }
     this.seekAttemptCount++
     
     if (this.seekAttemptCount > 3) {
        console.warn(`[StreamingAudioTranscoder] Seek correction failed max times (${this.seekAttemptCount}). Giving up on convergence.`)
        this.pendingSeekCheck = null
        this.seekAttemptCount = 0
     }
     
     // Clear buffer and position SourceBuffer at the target time.
     // CRITICAL: In 'segments' mode we must set timestampOffset to tell the browser
     // where on the media timeline the incoming fMP4 data should be placed.
     // Without this the audio will be placed right after the previous content.
     if (this.sourceBuffer && !this.sourceBuffer.updating) {
        try {
           if (this.sourceBuffer.buffered.length > 0) {
              this.sourceBuffer.remove(0, Infinity)
              // Wait for remove to complete before changing timestampOffset
              await new Promise<void>(resolve => {
                const onUpdateEnd = () => {
                  this.sourceBuffer!.removeEventListener('updateend', onUpdateEnd)
                  resolve()
                }
                this.sourceBuffer!.addEventListener('updateend', onUpdateEnd)
              })
           }
           // Set the timestamp offset so decoded audio lands at the right position
           this.sourceBuffer.timestampOffset = timeOffset
           console.log(`[StreamingAudioTranscoder] timestampOffset set to ${timeOffset.toFixed(2)}s`)
        } catch (e) {
           console.warn('[StreamingAudioTranscoder] Failed to reset buffer for seek:', e)
        }
     }
     
     // Reset state
     this.pendingSegments = []
     this.isAppending = false
     
     // Restart progressive download from new offset
     this.downloadAndTranscodeProgressive(byteOffset).catch(e => {
       if ((e as Error).name !== 'AbortError') {
          console.error('[StreamingAudioTranscoder] Restart error:', e)
       }
     })
  }

  /**
   * Check if the seek landed in the correct place and correct if necessary
   */
  private checkSeekConvergence(): void {
      if (!this.pendingSeekCheck || !this.sourceBuffer || this.sourceBuffer.buffered.length === 0) return
      
      const { targetTime, startByteOffset } = this.pendingSeekCheck
      
      // Find the range that is closest to our target
      // Since we cleared buffer in restartFromOffset, there's usually just one range.
      let closestRange = { start: 0, end: 0, diff: Infinity }
      const buffered = this.sourceBuffer.buffered
      
      for(let i=0; i<buffered.length; i++) {
         const start = buffered.start(i)
         const end = buffered.end(i)
         
         // If targetTime is INSIDE the range, we are good!
         if (targetTime >= start && targetTime <= end) {
             closestRange = { start, end, diff: 0 }
             break
         }
         
         const diffStart = start - targetTime
         
         if (Math.abs(start - targetTime) < Math.abs(closestRange.diff)) {
            closestRange = { start, end, diff: start - targetTime }
         }
      }
      
      const isLate = closestRange.diff > 1.0 // Stricter tolerance
      // If end < target, we have a gap BEFORE the new segment? No, we cleared.
      // It means the new segment is entirely before the target.
      const isTooEarly = closestRange.end < targetTime 
      
      if (isLate || isTooEarly) {
          console.log(`[StreamingAudioTranscoder] Convergence: Target ${targetTime.toFixed(2)}s outside range ${closestRange.start.toFixed(2)}-${closestRange.end.toFixed(2)}s`)
          
          let byteCorrection = 0
          const bytesPerSec = this.totalSize / this.duration
          
          if (isLate) {
              // Missed start. Go back.
              byteCorrection = closestRange.diff * bytesPerSec
              console.log(`[StreamingAudioTranscoder] Late by ${closestRange.diff.toFixed(2)}s. Go back ~${(byteCorrection/1024).toFixed(0)}KB`)
          } else if (isTooEarly) {
              // Too early, go forward
              // We need to cover the gap from End to Target
              const gap = targetTime - closestRange.end
              console.log(`[StreamingAudioTranscoder] Too early by ${gap.toFixed(2)}s. Go forward.`)
              byteCorrection = -(gap * bytesPerSec)
          }
          
          // Apply Safety
          const SAFETY_PAD = 1 * 1024 * 1024 // 1MB
          
          let newOffset = startByteOffset - byteCorrection 
          if (isLate) newOffset -= SAFETY_PAD // Extra safety when going back
          
          newOffset = Math.max(0, newOffset)
          newOffset = Math.floor(newOffset / 4096) * 4096
          
          console.log(`[StreamingAudioTranscoder] Retrying seek at offset ${newOffset}`)
          this.restartFromOffset(newOffset, targetTime)
      } else {
         console.log(`[StreamingAudioTranscoder] Seek Converged! Range [${closestRange.start.toFixed(2)}, ${closestRange.end.toFixed(2)}] covers ${targetTime.toFixed(2)}`)
         this.pendingSeekCheck = null
         this.seekAttemptCount = 0
      }
  }
  /**
   * Probe the server to determine total file size and range support.
   *
   * Strategy (in order, stops at first success):
   *  1. HEAD — zero bytes downloaded; check Content-Length + Accept-Ranges.
   *     Skipped if the server is known to misreport via HEAD (detected from previous 416 on same URL).
   *  2. GET bytes=0-0 — downloads exactly 1 byte; Content-Range tells us the real total.
   *     This is the authoritative source for proxies (Stremthru, Debrid, etc.) that return
   *     a wrong Content-Length via HEAD.
   *  3. Full GET Content-Length fallback — for servers that don't support ranges at all.
   *
   * Results are cached per URL so calling initialize() multiple times doesn't re-probe.
   */
  private async probeFileSize(url: string): Promise<{ size: number; supportsRanges: boolean }> {
    // Cache hit
    const cached = StreamingAudioTranscoder.probeCache.get(url)
    if (cached) {
      console.log(`[StreamingAudioTranscoder] Probe cache hit: ${(cached.size / 1024 / 1024).toFixed(1)}MB, ranges: ${cached.supportsRanges}`)
      return cached
    }

    const signal = this.abortController?.signal

    // ── Strategy 1: HEAD ─────────────────────────────────────────────────────
    try {
      const head = await fetch(url, { method: 'HEAD', signal })
      if (head.ok || head.status === 200) {
        const cl = parseInt(head.headers.get('content-length') || '0')
        const ar = head.headers.get('accept-ranges')
        const ranges = ar === 'bytes'

        if (cl > 0 && ranges) {
          // HEAD is reliable: server both reports a size and supports range requests.
          console.log(`[StreamingAudioTranscoder] Probe via HEAD: ${(cl / 1024 / 1024).toFixed(1)}MB, Accept-Ranges: bytes`)
          const result = { size: cl, supportsRanges: true }
          StreamingAudioTranscoder.probeCache.set(url, result)
          return result
        }

        if (cl > 0 && !ranges) {
          // Server gave us Content-Length but explicitly says no ranges (or omitted header).
          // Return size but mark ranges unsupported — the download loop will use a single fetch.
          console.log(`[StreamingAudioTranscoder] Probe via HEAD: ${(cl / 1024 / 1024).toFixed(1)}MB, no range support`)
          const result = { size: cl, supportsRanges: false }
          StreamingAudioTranscoder.probeCache.set(url, result)
          return result
        }

        // cl === 0 (chunked/unknown length) — fall through to range probe
        console.log('[StreamingAudioTranscoder] HEAD gave no Content-Length, trying range probe...')
      }
    } catch (e) {
      // HEAD failed (network error, CORS) — proceed to range probe
      console.log('[StreamingAudioTranscoder] HEAD failed, falling back to range probe:', (e as Error).message)
    }

    // ── Strategy 2: GET bytes=0-0 range probe ────────────────────────────────
    // Downloads exactly one byte; the server MUST include Content-Range: bytes 0-0/TOTAL
    // in a 206 response, giving us the authoritative total size.
    try {
      const probe = await fetch(url, {
        method: 'GET',
        headers: { 'Range': 'bytes=0-0' },
        signal
      })

      if (probe.status === 206) {
        const cr = probe.headers.get('content-range') // "bytes 0-0/12345678"
        // Content-Range can be "bytes 0-0/TOTAL" or "bytes */TOTAL" (rare)
        const match = cr?.match(/\/([0-9]+)$/)  // capture /TOTAL
        const size = match ? parseInt(match[1]) : 0
        await probe.body?.cancel()  // discard the 1-byte body

        if (size > 0) {
          console.log(`[StreamingAudioTranscoder] Probe via GET range: ${(size / 1024 / 1024).toFixed(1)}MB`)
          const result = { size, supportsRanges: true }
          StreamingAudioTranscoder.probeCache.set(url, result)
          return result
        }
      } else if (probe.status === 200) {
        // Server ignored the Range header and returned 200 — read Content-Length from it
        const cl = parseInt(probe.headers.get('content-length') || '0')
        await probe.body?.cancel()
        if (cl > 0) {
          console.log(`[StreamingAudioTranscoder] Probe via GET 200 (no range support): ${(cl / 1024 / 1024).toFixed(1)}MB`)
          const result = { size: cl, supportsRanges: false }
          StreamingAudioTranscoder.probeCache.set(url, result)
          return result
        }
      }
    } catch (e) {
      console.log('[StreamingAudioTranscoder] Range probe failed:', (e as Error).message)
    }

    // ── Strategy 3: Full GET — read Content-Length from streaming response ───
    // Last resort for servers that only speak plain HTTP/1.0-style.
    try {
      const resp = await fetch(url, { signal })
      const cl = parseInt(resp.headers.get('content-length') || '0')
      await resp.body?.cancel()
      if (cl > 0) {
        console.log(`[StreamingAudioTranscoder] Probe via full GET: ${(cl / 1024 / 1024).toFixed(1)}MB (no ranges)`)
        const result = { size: cl, supportsRanges: false }
        StreamingAudioTranscoder.probeCache.set(url, result)
        return result
      }
    } catch (e) {
      console.log('[StreamingAudioTranscoder] Full GET probe failed:', (e as Error).message)
    }

    throw new Error('Cannot determine file size: all probe strategies failed')
  }

  private async downloadAndTranscodeFull(): Promise<void> {
    console.log('[StreamingAudioTranscoder] Downloading full file...')

    // Download with progress tracking
    const response = await fetch(this.sourceUrl, {
      signal: this.abortController?.signal
    })

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('Response body not available')
    }

    const chunks: Uint8Array[] = []
    let receivedLength = 0

    // Read chunks
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      receivedLength += value.length

      // Dispatch progress
      const percent = Math.round((receivedLength / this.totalSize) * 100)
      if (percent % 10 === 0) {
        console.log(`[StreamingAudioTranscoder] Downloaded: ${percent}%`)
        this.dispatchEvent(new CustomEvent('progress', {
          detail: { percent, phase: 'downloading' }
        }))
      }

      // Progress notification during download
      // audioready will be dispatched when data is actually appended to SourceBuffer
    }

    // Combine chunks
    const combined = new Uint8Array(receivedLength)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    console.log(`[StreamingAudioTranscoder] Downloaded ${(receivedLength / 1024 / 1024).toFixed(1)}MB, transcoding...`)

    // Transcode full file
    await this.transcodeData(combined)
  }

  /**
   * Progressive download and transcode (for files > 200MB)
   * 
   * Downloads initial segment for quick start, then continues
   * downloading and transcoding in the background.
   */
  private async downloadAndTranscodeProgressive(startOffset: number = 0): Promise<void> {
    console.log(`[StreamingAudioTranscoder] Progressive mode: starting background download from ${startOffset}...`)

    // Capture the signal for this specific operation
    // This ensures we check the correct signal even if this.abortController is replaced by restartFromOffset
    const signal = this.abortController?.signal

    // Smaller segment size to avoid FFmpeg WASM memory issues
    // 20MB is safer for browser memory constraints
    const SEGMENT_SIZE = 20 * 1024 * 1024 // 20MB per segment
    let currentOffset = startOffset

    // If starting from middle and we don't have headers, we must fetch them first
    if (currentOffset > 0 && !this.containerHeader) {
      console.log('[StreamingAudioTranscoder] Seeking to middle but missing headers - fetching first segment first...')
      try {
        const headerData = await this.downloadRange(0, this.HEADER_SIZE + 1024, signal) // Fetch enough for headers
        this.containerHeader = headerData.slice(0, this.HEADER_SIZE)
        console.log('[StreamingAudioTranscoder] Headers recovered')
      } catch (e) {
        console.error('[StreamingAudioTranscoder] Failed to recover headers:', e)
        return
      }
    }

    // Download and transcode segments continuously
    while (currentOffset < this.totalSize && !signal?.aborted) {
      // Smart Buffering (Time-Based)
      // Check if we have enough buffered content ahead
      if (this.audioElement && this.sourceBuffer && this.sourceBuffer.buffered.length > 0) {
         try {
             const currentTime = this.audioElement.currentTime
             const buffered = this.sourceBuffer.buffered
             
             // Check buffer health
             for(let i=0; i<buffered.length; i++) {
                 // Check if currentTime is within (or just before) this range
                 if (currentTime >= buffered.start(i) - 0.5 && currentTime <= buffered.end(i) + 0.5) {
                     const secondsAhead = buffered.end(i) - currentTime
                     
                     // Throttle if we have > 300s (5 mins) buffered ahead
                     if (secondsAhead > 300) {
                         console.log(`[StreamingAudioTranscoder] Buffer sufficient (${secondsAhead.toFixed(0)}s ahead). Pausing download...`)
                         
                         const checkInterval = 2000
                         const RESUME_THRESHOLD = 120 // Resume when drop below 2 mins
                         
                         while (this.audioElement && !signal?.aborted) {
                             // Re-check
                             const now = this.audioElement.currentTime
                             let currentAhead = 0
                             if (this.sourceBuffer && this.sourceBuffer.buffered.length > 0) {
                                 // Quick scan for current range
                                 for(let j=0; j<this.sourceBuffer.buffered.length; j++) {
                                     if (now >= this.sourceBuffer.buffered.start(j) - 2 && now <= this.sourceBuffer.buffered.end(j) + 2) {
                                         currentAhead = this.sourceBuffer.buffered.end(j) - now
                                         break
                                     }
                                 }
                             }
                             
                             if (currentAhead < RESUME_THRESHOLD) break
                             await new Promise(r => setTimeout(r, checkInterval))
                         }
                         
                         if (signal?.aborted) return
                         console.log('[StreamingAudioTranscoder] Resuming download...')
                     }
                     break // Found our range
                 }
             }
         } catch(e) { 
             // Ignore errors (SourceBuffer might be invalid temporarily)
         }
      }

      const segmentStart = currentOffset
      const segmentEnd = Math.min(currentOffset + SEGMENT_SIZE - 1, this.totalSize - 1)
      const isFirstSegment = currentOffset === 0

      console.log(`[StreamingAudioTranscoder] Downloading segment ${(segmentStart / 1024 / 1024).toFixed(0)}MB - ${(segmentEnd / 1024 / 1024).toFixed(0)}MB...`)
      
      this.dispatchEvent(new CustomEvent('progress', {
        detail: { 
          percent: Math.round((currentOffset / this.totalSize) * 100), 
          phase: 'downloading' 
        }
      }))

      try {
        const segmentData = await this.downloadRange(segmentStart, segmentEnd, signal)
        
        if (signal?.aborted) {
          console.log('[StreamingAudioTranscoder] Aborted during download')
          return
        }

        console.log(`[StreamingAudioTranscoder] Segment downloaded: ${(segmentData.length / 1024 / 1024).toFixed(1)}MB`)
        
        this.dispatchEvent(new CustomEvent('progress', {
          detail: { 
            percent: Math.round((currentOffset / this.totalSize) * 100), 
            phase: 'transcoding' 
          }
        }))

        // Transcode this segment
        if (isFirstSegment) {
          // Store container header from first segment for subsequent segments BEFORE processing
          // heavily important to do this before passing segmentData to FFmpeg as it might become detached
          if (!this.containerHeader) {
            this.containerHeader = segmentData.slice(0, this.HEADER_SIZE)
          }

          // First segment has container headers, transcode as complete file
          await this.transcodeInitialSegment(segmentData)
        } else {
          // Subsequent segments need headers prepended
          // Create combined data with container headers
          if (this.containerHeader) {
            const combinedData = new Uint8Array(this.containerHeader.length + segmentData.length)
            combinedData.set(this.containerHeader, 0)
            combinedData.set(segmentData, this.containerHeader.length)
            await this.transcodeInitialSegment(combinedData)
          } else {
            console.warn('[StreamingAudioTranscoder] No container header available for subsequent segment')
            break
          }
        }

        currentOffset = segmentEnd + 1
        
        console.log(`[StreamingAudioTranscoder] Segment complete, next offset: ${(currentOffset / 1024 / 1024).toFixed(0)}MB`)

      } catch (error) {
        if ((error as any).isRangeExceeded) {
          // 416 = the server has no more data at this offset. Treat as EOF.
          const actualSize = (error as any).actualSize
          if (typeof actualSize === 'number' && actualSize > 0 && actualSize < this.totalSize) {
            console.log(`[StreamingAudioTranscoder] Server reports actual size ${(actualSize / 1024 / 1024).toFixed(1)}MB (was ${(this.totalSize / 1024 / 1024).toFixed(1)}MB). Stopping.`)
            this.totalSize = actualSize  // update so future seeks also respect this
          } else {
            console.log('[StreamingAudioTranscoder] 416 received — reached end of ranged content, stopping.')
          }
          break  // Clean EOF — stop the loop
        }

        console.error('[StreamingAudioTranscoder] Segment error:', error)
        // For non-range errors: if we already have some audio, skip this segment and continue.
        // If this is the very first segment, re-throw so we fail loudly.
        if (currentOffset > 0) {
          currentOffset = segmentEnd + 1
        } else {
          throw error
        }
      }
    }

    this.dispatchEvent(new CustomEvent('progress', {
      detail: { percent: 100, phase: 'complete' }
    }))

    console.log('[StreamingAudioTranscoder] All segments processed')
    this.isComplete = true
  }

  /**
   * Clean up FFmpeg virtual filesystem to prevent memory issues
   * FFmpeg WASM has limited FS space, so we need to aggressively clean up
   */
  private async cleanupFFmpegFS(): Promise<void> {
    if (!this.ffmpeg) return

    try {
      // List all files in FFmpeg FS root
      const files = await this.ffmpeg.listDir('/')
      
      for (const file of files) {
        // Skip special directories
        if (file.name === '.' || file.name === '..' || file.isDir) continue
        
        // Delete any leftover media files
        if (file.name.endsWith('.mkv') || file.name.endsWith('.m4a') || 
            file.name.endsWith('.mp4') || file.name.endsWith('.aac')) {
          try {
            await this.ffmpeg.deleteFile(`/${file.name}`)
            console.log(`[StreamingAudioTranscoder] Cleaned up: ${file.name}`)
          } catch {
            // Ignore errors
          }
        }
      }
    } catch (error) {
      // listDir might not be available in all FFmpeg builds
      console.warn('[StreamingAudioTranscoder] Could not list FS:', error)
    }
  }

  /**
   * Transcode an initial segment that contains complete container structure
   */
  private async transcodeInitialSegment(data: Uint8Array): Promise<void> {
    if (!this.ffmpeg) return

    // Clean up FS before each transcode to prevent memory issues
    await this.cleanupFFmpegFS()

    const timestamp = Date.now()
    const inputFilename = `initial_${timestamp}.mkv`
    const outputFilename = `audio_${timestamp}.m4a`

    try {
      console.log(`[StreamingAudioTranscoder] Writing ${(data.length / 1024 / 1024).toFixed(1)}MB to FFmpeg FS...`)
      await this.ffmpeg.writeFile(inputFilename, data)

      // Transcode to stereo AAC for browser compatibility
      const args = [
        '-i', inputFilename,
        '-copyts', // Preserve timestamps so seeking works
        '-map', `0:${this.audioStreamIndex}`,
        '-c:a', 'aac',
        '-b:a', this.config.bitrate,
        '-ac', '2',  // Stereo for MSE compatibility
        '-ar', '48000',
        '-vn',
        '-f', 'mp4',
        '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
        '-y',
        outputFilename
      ]

      console.log('[StreamingAudioTranscoder] Transcoding initial segment...')
      await this.ffmpeg.exec(args)

      const output = await this.ffmpeg.readFile(outputFilename)
      const outputData = typeof output === 'string'
        ? new TextEncoder().encode(output)
        : new Uint8Array(output)

      if (outputData.length > 0) {
        console.log(`[StreamingAudioTranscoder] Initial segment transcoded: ${(outputData.length / 1024).toFixed(0)}KB`)
        this.queueSegment(outputData)
      } else {
        console.warn('[StreamingAudioTranscoder] Initial segment produced empty output')
      }

      // Cleanup
      await this.ffmpeg.deleteFile(inputFilename)
      await this.ffmpeg.deleteFile(outputFilename)

    } catch (error) {
      console.error('[StreamingAudioTranscoder] Initial segment transcode error:', error)
      
      try { await this.ffmpeg.deleteFile(inputFilename) } catch {}
      try { await this.ffmpeg.deleteFile(outputFilename) } catch {}

      throw error
    }
  }

  /**
   * Transcode a chunk that has container headers prepended
   * This is the experimental method that processes header+data combined
   */
  private async transcodeChunkWithHeader(data: Uint8Array, chunkIndex: number): Promise<void> {
    if (!this.ffmpeg) return

    // Clean up FS before each transcode to prevent memory issues
    await this.cleanupFFmpegFS()

    const timestamp = Date.now()
    const inputFilename = `chunk_${chunkIndex}_${timestamp}.mkv`
    const outputFilename = `audio_${chunkIndex}_${timestamp}.m4a`

    try {
      // Write combined data (headers + chunk) to FFmpeg FS
      await this.ffmpeg.writeFile(inputFilename, data)

      // Build FFmpeg args - extract audio and transcode to AAC
      // Use absolute stream index (0:N) not relative audio index (0:a:N)
      // audioStreamIndex is the absolute stream number in the container
      // Downmix to stereo for browser MSE compatibility (5.1 AAC with PCE may not work)
      const args = [
        '-i', inputFilename,
        '-map', `0:${this.audioStreamIndex}`,  // Absolute stream index
        '-c:a', 'aac',
        '-b:a', this.config.bitrate,
        '-ac', '2',  // Downmix to stereo for MSE compatibility
        '-ar', '48000',  // Ensure 48kHz sample rate
        '-vn', // No video
        '-f', 'mp4',
        '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
        '-y',
        outputFilename
      ]

      // Execute FFmpeg
      await this.ffmpeg.exec(args)

      // Read output
      const output = await this.ffmpeg.readFile(outputFilename)
      const outputData = typeof output === 'string'
        ? new TextEncoder().encode(output)
        : new Uint8Array(output)

      if (outputData.length > 0) {
        console.log(`[StreamingAudioTranscoder] Chunk ${chunkIndex} transcoded: ${(outputData.length / 1024).toFixed(0)}KB`)
        this.queueSegment(outputData)
      } else {
        console.warn(`[StreamingAudioTranscoder] Chunk ${chunkIndex} produced empty output`)
      }

      // Cleanup FFmpeg FS
      await this.ffmpeg.deleteFile(inputFilename)
      await this.ffmpeg.deleteFile(outputFilename)

    } catch (error) {
      console.error(`[StreamingAudioTranscoder] Chunk ${chunkIndex} transcode error:`, error)
      
      // Cleanup on error
      try { await this.ffmpeg.deleteFile(inputFilename) } catch {}
      try { await this.ffmpeg.deleteFile(outputFilename) } catch {}

      throw error
    }
  }

  /**
   * Transcode a single chunk of audio data
   * For the first chunk, we need to generate a proper fMP4 init segment
   * For subsequent chunks, we generate continuation segments
   */
  private async transcodeChunk(data: Uint8Array, chunkIndex: number, isFirst: boolean): Promise<void> {
    if (!this.ffmpeg) return

    // Clean up FS before each transcode to prevent memory issues
    await this.cleanupFFmpegFS()

    const timestamp = Date.now()
    const inputFilename = `chunk_${chunkIndex}_${timestamp}.mkv`
    const outputFilename = `audio_${chunkIndex}_${timestamp}.m4a`

    try {
      // Write chunk to FFmpeg FS
      await this.ffmpeg.writeFile(inputFilename, data)

      // Build FFmpeg args
      // For fMP4 streaming, we use fragmented output that MSE can handle
      const args = [
        '-i', inputFilename,
        '-map', `0:a:${this.audioStreamIndex}`,
        '-c:a', 'aac',
        '-b:a', this.config.bitrate,
        '-vn', // No video
        '-f', 'mp4',
        // Fragmented MP4 flags for MSE compatibility
        '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
        '-y',
        outputFilename
      ]

      // Execute FFmpeg
      await this.ffmpeg.exec(args)

      // Read output
      const output = await this.ffmpeg.readFile(outputFilename)
      const outputData = typeof output === 'string'
        ? new TextEncoder().encode(output)
        : new Uint8Array(output)

      if (outputData.length > 0) {
        console.log(`[StreamingAudioTranscoder] Chunk ${chunkIndex} transcoded: ${(outputData.length / 1024).toFixed(0)}KB`)
        
        // Append to MSE
        this.queueSegment(outputData)
      } else {
        console.warn(`[StreamingAudioTranscoder] Chunk ${chunkIndex} produced empty output`)
      }

      // Cleanup
      await this.ffmpeg.deleteFile(inputFilename)
      await this.ffmpeg.deleteFile(outputFilename)

    } catch (error) {
      console.error(`[StreamingAudioTranscoder] Chunk ${chunkIndex} transcode error:`, error)

      // Cleanup on error
      try { await this.ffmpeg.deleteFile(inputFilename) } catch {}
      try { await this.ffmpeg.deleteFile(outputFilename) } catch {}

      throw error
    }
  }

  /**
   * Download a byte range.
   * Returns the data, or throws RangeExceededError if the server returns 416
   * (meaning the requested start is past the actual rangeable end of the file).
   */
  private async downloadRange(start: number, end: number, signal?: AbortSignal): Promise<Uint8Array> {
    const response = await fetch(this.sourceUrl, {
      headers: { 'Range': `bytes=${start}-${end}` },
      signal: signal || this.abortController?.signal
    })

    // 416 Range Not Satisfiable — the server has no data at this offset.
    // Extract the actual rangeable size from Content-Range: bytes */ACTUAL_SIZE
    if (response.status === 416) {
      const cr = response.headers.get('content-range')
      const match = cr?.match(/\/([0-9]+)$/)
      const actualSize = match ? parseInt(match[1]) : start  // best guess: start is past EOF
      const err = new Error(`416: Range Not Satisfiable (actual size: ${actualSize})`)
      ;(err as any).isRangeExceeded = true
      ;(err as any).actualSize = actualSize
      throw err
    }

    if (!response.ok && response.status !== 206) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`)
    }

    return new Uint8Array(await response.arrayBuffer())
  }

  /**
   * Transcode data using FFmpeg
   */
  private async transcodeData(data: Uint8Array, inputOffset: number = 0): Promise<void> {
    if (!this.ffmpeg) return

    // Clean up FS before transcoding to prevent memory issues
    await this.cleanupFFmpegFS()

    const timestamp = Date.now()
    const inputFilename = `input_${timestamp}.mkv`
    const outputFilename = `output_${timestamp}.m4a`

    try {
      // Prepend header if we are not at start, to preserve timestamp context
      let inputData = data
      if (inputOffset > 0 && this.containerHeader) {
          const merged = new Uint8Array(this.containerHeader.length + data.length)
          merged.set(this.containerHeader)
          merged.set(data, this.containerHeader.length)
          inputData = merged
          // console.log('[StreamingAudioTranscoder] Prepended header to chunk')
      }

      // Write input to FFmpeg FS
      await this.ffmpeg.writeFile(inputFilename, inputData)

      // Build FFmpeg args
      const args = [
        '-i', inputFilename,
        '-copyts',
        '-map', `0:a:${this.audioStreamIndex}`,
        '-c:a', 'aac',
        '-b:a', this.config.bitrate,
        '-vn',
        '-f', 'mp4',
        '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
        '-y',
        outputFilename
      ]

      console.log('[StreamingAudioTranscoder] Starting FFmpeg transcoding...')

      // Execute FFmpeg
      await this.ffmpeg.exec(args)

      // Read output
      const output = await this.ffmpeg.readFile(outputFilename)
      const outputData = typeof output === 'string'
        ? new TextEncoder().encode(output)
        : new Uint8Array(output)

      console.log(`[StreamingAudioTranscoder] Transcoded: ${(outputData.length / 1024).toFixed(0)}KB`)

      // Append to MSE
      this.queueSegment(outputData)

      // Cleanup
      await this.ffmpeg.deleteFile(inputFilename)
      await this.ffmpeg.deleteFile(outputFilename)

    } catch (error) {
      console.error('[StreamingAudioTranscoder] Transcode error:', error)

      // Cleanup on error
      try { await this.ffmpeg.deleteFile(inputFilename) } catch {}
      try { await this.ffmpeg.deleteFile(outputFilename) } catch {}

      throw error
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
      console.error('[StreamingAudioTranscoder] Append error:', error)
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
  /**
   * Handle quota exceeded by removing old buffer
   */
  private handleQuotaExceeded(segment: Uint8Array): void {
    if (!this.sourceBuffer || !this.audioElement) return

    console.warn('[StreamingAudioTranscoder] Quota exceeded, evicting buffer...')
    
    // Always re-queue the segment so we don't lose it
    this.pendingSegments.unshift(segment)

    if (this.sourceBuffer.updating) return

    try {
      const currentTime = this.audioElement.currentTime
      const buffered = this.sourceBuffer.buffered
      let removed = false

      // 1. Evict played content (keep last 30s)
      if (currentTime > 30) {
        const removeEnd = currentTime - 30
        if (buffered.length > 0 && buffered.start(0) < removeEnd) {
             console.log(`[StreamingAudioTranscoder] Evicting played range: ${buffered.start(0).toFixed(2)} - ${removeEnd.toFixed(2)}`)
             this.sourceBuffer.remove(0, removeEnd)
             removed = true
        }
      } 
      
      // 2. If we couldn't evict behind (e.g. near start), look for disconnected future ranges
      // This happens if we seeked back and forth a lot
      if (!removed && buffered.length > 0) {
        for (let i = 0; i < buffered.length; i++) {
          const start = buffered.start(i)
          const end = buffered.end(i)
          
          // If range is completely in the future (far ahead) or completely in past
          if (start > currentTime + 300) { // 5 mins ahead
             console.log(`[StreamingAudioTranscoder] Evicting future range: ${start.toFixed(2)} - ${end.toFixed(2)}`)
             this.sourceBuffer.remove(start, end)
             removed = true
             break
          }
        }
      }
      
      // 3. Panic mode: evict everything up to 5s behind current
      if (!removed && currentTime > 5) {
         console.log(`[StreamingAudioTranscoder] Panic eviction: 0 - ${(currentTime - 5).toFixed(2)}`)
         this.sourceBuffer.remove(0, currentTime - 5)
         removed = true
      }

      if (!removed) {
        console.warn('[StreamingAudioTranscoder] Could not find buffer to evict! Retrying in 1s...')
        this.isAppending = false
        setTimeout(() => this.appendNextSegment(), 1000)
      }

    } catch (e) {
      console.error('[StreamingAudioTranscoder] Error handling quota exceeded:', e)
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
  async seek(time: number): Promise<void> {
    if (this.audioElement) {
      this.audioElement.currentTime = time
    }
  }

  play(): void {
    this.audioElement?.play().catch(e =>
      console.warn('[StreamingAudioTranscoder] Play failed:', e)
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

    if (this.ffmpeg) {
      this.ffmpeg.terminate()
      this.ffmpeg = null
      this.ffmpegLoaded = false
    }

    console.log('[StreamingAudioTranscoder] Destroyed')
  }
}
