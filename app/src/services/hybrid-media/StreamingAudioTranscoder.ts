/**
 * StreamingAudioTranscoder - Progressive audio transcoding
 *
 * Strategy:
 *  - Small files (<= maxFullDownloadSize): download whole file, transcode once.
 *  - Large files: download progressively to JS memory, transcode in one pass
 *    using continuous data written to FFmpeg FS. Periodic re-transcodes
 *    with -ss skip produce additional audio segments appended to MSE.
 *
 * Previous segment-based approach (8KB header + 20MB mid-file chunks fed
 * to FFmpeg independently) was fundamentally broken for MKV containers and
 * caused "RuntimeError: memory access out of bounds".  This version
 * always writes a **continuous file from offset 0** into FFmpeg FS.
 *
 * IMPORTANT: This service is NOT supported in Tauri apps.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'
import { isTauriRuntime } from '../../lib/runtime-env'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('AudioTranscoder')

function isTauriEnvironment(): boolean {
  return isTauriRuntime()
}

export interface StreamingTranscoderConfig {
  bitrate?: string
  initialBufferSize?: number
  maxFullDownloadSize?: number
  ffmpegInstance?: FFmpeg
}

export class StreamingAudioTranscoder extends EventTarget {
  private ffmpeg: FFmpeg | null = null
  private ffmpegLoaded = false
  private abortController: AbortController | null = null
  private sharedFFmpeg: FFmpeg | null = null

  private sourceUrl: string = ''
  private audioStreamIndex: number = 0
  private totalSize: number = 0
  private duration: number = 0

  private pendingSeekCheck: { targetTime: number; startByteOffset: number } | null = null
  private seekAttemptCount: number = 0

  private config: Omit<Required<StreamingTranscoderConfig>, 'ffmpegInstance'>

  private mediaSource: MediaSource | null = null
  private sourceBuffer: SourceBuffer | null = null
  private audioElement: HTMLAudioElement | null = null
  private pendingSegments: Uint8Array[] = []
  private isAppending = false

  private audioReadyDispatched = false
  private supportsRanges = true

  private static probeCache = new Map<string, { size: number; supportsRanges: boolean }>()

  private lastTranscodedDuration: number = 0
  private transcodeGeneration: number = 0

  // Set to true by restartFromOffset so the next successful append dispatches 'seekready'
  private seekReadyPending = false

  // Observed bytes-per-second ratio learned during the initial download.
  // More accurate than (totalSize / duration) for VBR content.
  private observedBytesPerSecond = 0

  // True while seek transcoding is in progress (restartFromOffset started, seekready not yet fired)
  private isSeekTranscoding = false

  // The first downloaded chunk (from byte 0) of the container file.
  // Prepended to seek-restart data so FFmpeg can parse the MKV Tracks element
  // and resolve stream indices like `0:3` even when the seek data starts mid-file.
  private containerHeader: Uint8Array | null = null

  private static readonly MAX_WASM_FILE_SIZE = 1400 * 1024 * 1024

  /**
   * Returns the URL to use for fetch() calls.
   * External URLs (non-localhost, non-relative) are routed through the server's
   * range proxy so the browser never makes a direct cross-origin fetch and CORS
   * is avoided. Localhost and relative paths are used as-is.
   */
  private proxiedUrl(url: string): string {
    try {
      const { hostname } = new URL(url)
      const isLocal =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '[::1]'
      if (isLocal) return url
    } catch {
      return url // relative path — already same-origin
    }
    return `/api/streaming/stream-range-proxy?url=${encodeURIComponent(url)}`
  }

  constructor(config: StreamingTranscoderConfig = {}) {
    super()

    if (isTauriEnvironment()) {
      throw new Error('StreamingAudioTranscoder is not supported in Tauri apps.')
    }

    this.sharedFFmpeg = config.ffmpegInstance || null

    this.config = {
      bitrate: config.bitrate ?? '192k',
      initialBufferSize: config.initialBufferSize ?? 50 * 1024 * 1024,
      maxFullDownloadSize: config.maxFullDownloadSize ?? 150 * 1024 * 1024,
    }
  }

  private async loadFFmpeg(): Promise<void> {
    if (this.ffmpegLoaded) return

    if (this.sharedFFmpeg) {
      this.ffmpeg = this.sharedFFmpeg
      this.ffmpegLoaded = true
      log.debug('Using shared FFmpeg instance')
      return
    }

    this.ffmpeg = new FFmpeg()

    this.ffmpeg.on('log', ({ message }) => {
      if (
        message.includes('Error') ||
        message.includes('failed') ||
        message.includes('Stream mapping') ||
        message.includes('Output #0')
      ) {
        log.debug('', message)
      }
    })

    const appBasePath = import.meta.env.BASE_URL.endsWith('/')
      ? import.meta.env.BASE_URL.slice(0, -1)
      : import.meta.env.BASE_URL
    const coreURL = `${appBasePath}/ffmpeg/ffmpeg-core.js`
    const wasmURL = `${appBasePath}/ffmpeg/ffmpeg-core.wasm`

    await this.ffmpeg.load({
      coreURL: await toBlobURL(coreURL, 'text/javascript'),
      wasmURL: await toBlobURL(wasmURL, 'application/wasm'),
    })

    this.ffmpegLoaded = true
    log.debug('FFmpeg WASM loaded (own instance)')
  }

  async initialize(
    url: string,
    audioStreamIndex: number = 0,
    duration: number = 0
  ): Promise<HTMLAudioElement> {
    this.sourceUrl = url
    this.audioStreamIndex = audioStreamIndex
    this.duration = duration
    this.abortController = new AbortController()
    this.audioReadyDispatched = false
    this.pendingSegments = []
    this.pendingSeekCheck = null
    this.seekAttemptCount = 0
    this.lastTranscodedDuration = 0
    this.transcodeGeneration = 0
    this.containerHeader = null
    this.seekReadyPending = false
    this.observedBytesPerSecond = 0
    this.isSeekTranscoding = false

    await this.loadFFmpeg()

    const { size, supportsRanges } = await this.probeFileSize(url)
    this.totalSize = size
    this.supportsRanges = supportsRanges

    log.debug(
      `File size: ${(this.totalSize / 1024 / 1024).toFixed(1)}MB, ranges: ${supportsRanges}`
    )

    this.mediaSource = new MediaSource()
    this.audioElement = document.createElement('audio')

    this.audioElement.volume = 1.0
    this.audioElement.muted = false
    this.audioElement.preload = 'auto'

    this.audioElement.src = URL.createObjectURL(this.mediaSource)

    await new Promise<void>((resolve) => {
      this.mediaSource!.addEventListener('sourceopen', () => resolve(), { once: true })
    })

    this.sourceBuffer = this.mediaSource.addSourceBuffer('audio/mp4; codecs="mp4a.40.2"')
    this.sourceBuffer.mode = 'segments'

    this.sourceBuffer.addEventListener('updateend', () => {
      this.isAppending = false

      if (this.pendingSeekCheck && this.sourceBuffer) {
        try {
          if (this.sourceBuffer.buffered.length > 0) {
            this.checkSeekConvergence()
          }
        } catch (e) {
          log.warn('Error checking seek convergence:', e)
        }
      }

      this.appendNextSegment()

      if (this.sourceBuffer && this.mediaSource?.readyState === 'open') {
        try {
          if (this.sourceBuffer.buffered.length > 0) {
            if (!this.audioReadyDispatched) {
              this.audioReadyDispatched = true
              log.debug('Audio data appended, dispatching audioready')
              this.dispatchEvent(new CustomEvent('audioready'))
            }

            // seekready is dispatched from checkSeekConvergence once the
            // buffered range actually covers the seek target, not here.
          }
        } catch (e) {
          log.warn('SourceBuffer no longer valid:', e)
        }
      }
    })

    this.dispatchEvent(new CustomEvent('ready'))

    return this.audioElement
  }

  async start(): Promise<void> {
    if (!this.ffmpeg || !this.sourceUrl) {
      throw new Error('Not initialized')
    }

    try {
      if (this.totalSize <= this.config.maxFullDownloadSize || !this.supportsRanges) {
        await this.downloadAndTranscodeFull()
      } else {
        await this.downloadAndTranscodeProgressive()
      }

      await this.waitForAppendComplete()
      if (this.mediaSource?.readyState === 'open') {
        this.mediaSource.endOfStream()
      }

      this.dispatchEvent(new CustomEvent('complete'))
      log.debug('Transcoding complete')
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        log.error('Error:', error)
        this.dispatchEvent(new CustomEvent('error', { detail: { error } }))
      }
    }
  }

  syncWithVideo(video: HTMLVideoElement): void {
    log.debug('Syncing with video element')

    video.addEventListener('seeking', async () => {
      log.debug('Video seeking to:', video.currentTime)

      if (this.audioElement) {
        this.audioElement.currentTime = video.currentTime

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
          log.debug('Seek target not buffered, restarting transcoding...')

          const SAFETY_MARGIN = 5 * 1024 * 1024
          const bps =
            this.observedBytesPerSecond > 0
              ? this.observedBytesPerSecond
              : this.totalSize / this.duration
          let targetByteOffset = video.currentTime * bps - SAFETY_MARGIN
          targetByteOffset = Math.max(0, targetByteOffset)
          targetByteOffset = Math.floor(targetByteOffset / 4096) * 4096

          log.debug(
            `Seek target: ${video.currentTime.toFixed(2)}s, bps: ${(bps / 1024 / 1024).toFixed(1)}MB/s, offset: ${(targetByteOffset / 1024 / 1024).toFixed(0)}MB`
          )
          await this.restartFromOffset(targetByteOffset, video.currentTime)
        }
      }
    })

    let audioWaiting = false
    let videoWaiting = false

    if (this.audioElement && this.audioElement.readyState < 3) {
      log.debug('Initial audio wait -> holding video')
      audioWaiting = true
      video.pause()
    }

    video.addEventListener('timeupdate', () => {
      if (this.audioElement && !this.audioElement.paused) {
        const diff = Math.abs(this.audioElement.currentTime - video.currentTime)
        if (diff > 0.3) {
          this.audioElement.currentTime = video.currentTime
        }
      }
    })

    if (this.audioElement) {
      this.audioElement.addEventListener('waiting', () => {
        // Don't pause video while seek transcoding is active — the UI overlay
        // covers the loading state and the video needs to stay at the seek position.
        if (this.isSeekTranscoding) return
        audioWaiting = true
        video.pause()
      })

      this.audioElement.addEventListener('playing', () => {
        if (audioWaiting) {
          audioWaiting = false
          if (video.paused) video.play().catch(() => {})
        }
      })
    }

    video.addEventListener('waiting', () => {
      videoWaiting = true
      this.audioElement?.pause()
    })

    video.addEventListener('playing', () => {
      if (videoWaiting) {
        videoWaiting = false
        if (this.audioElement?.paused) this.audioElement.play().catch(() => {})
      }
    })

    video.addEventListener('pause', () => {
      if (!audioWaiting && this.audioElement) {
        this.audioElement.pause()
      }
    })

    video.addEventListener('play', () => {
      if (this.audioElement && this.audioElement.paused && !videoWaiting) {
        this.audioElement.play().catch(() => {})
      }
    })
  }

  private async restartFromOffset(byteOffset: number, timeOffset: number): Promise<void> {
    if (this.abortController) {
      this.abortController.abort()
    }
    this.abortController = new AbortController()

    this.pendingSeekCheck = { targetTime: timeOffset, startByteOffset: byteOffset }
    this.seekAttemptCount++

    if (this.seekAttemptCount > 3) {
      log.warn(
        `Seek correction failed max times (${this.seekAttemptCount}). Giving up on convergence.`
      )
      this.pendingSeekCheck = null
      this.seekAttemptCount = 0
      this.seekReadyPending = false
      this.isSeekTranscoding = false
      return
    }

    this.isSeekTranscoding = true
    this.seekReadyPending = true
    this.pendingSegments = []
    this.isAppending = false
    this.lastTranscodedDuration = timeOffset
    this.transcodeGeneration++

    if (this.sourceBuffer) {
      try {
        // Wait for any in-progress append/remove before touching the buffer
        if (this.sourceBuffer.updating) {
          log.debug('SourceBuffer busy — waiting before seek reset')
          await new Promise<void>((resolve) => {
            const onEnd = () => {
              this.sourceBuffer!.removeEventListener('updateend', onEnd)
              resolve()
            }
            this.sourceBuffer!.addEventListener('updateend', onEnd)
          })
        }
        if (this.sourceBuffer.buffered.length > 0) {
          this.sourceBuffer.remove(0, Infinity)
          await new Promise<void>((resolve) => {
            const onUpdateEnd = () => {
              this.sourceBuffer!.removeEventListener('updateend', onUpdateEnd)
              resolve()
            }
            this.sourceBuffer!.addEventListener('updateend', onUpdateEnd)
          })
        }
        this.sourceBuffer.timestampOffset = timeOffset
        log.debug(`timestampOffset set to ${timeOffset.toFixed(2)}s`)
      } catch (e) {
        log.warn('Failed to reset buffer for seek:', e)
      }
    }

    this.downloadAndTranscodeProgressive(byteOffset).catch((e) => {
      if ((e as Error).name !== 'AbortError') {
        log.error('Restart error:', e)
      }
    })
  }

  private checkSeekConvergence(): void {
    if (!this.pendingSeekCheck || !this.sourceBuffer || this.sourceBuffer.buffered.length === 0)
      return

    const { targetTime, startByteOffset } = this.pendingSeekCheck

    let closestRange = { start: 0, end: 0, diff: Infinity }
    const buffered = this.sourceBuffer.buffered

    for (let i = 0; i < buffered.length; i++) {
      const start = buffered.start(i)
      const end = buffered.end(i)

      if (targetTime >= start && targetTime <= end) {
        closestRange = { start, end, diff: 0 }
        break
      }

      if (Math.abs(start - targetTime) < Math.abs(closestRange.diff)) {
        closestRange = { start, end, diff: start - targetTime }
      }
    }

    const isLate = closestRange.diff > 1.0
    const isTooEarly = closestRange.end < targetTime

    if (isLate || isTooEarly) {
      log.debug(
        `Convergence: Target ${targetTime.toFixed(2)}s outside range ${closestRange.start.toFixed(2)}-${closestRange.end.toFixed(2)}s`
      )

      const bytesPerSec =
        this.observedBytesPerSecond > 0
          ? this.observedBytesPerSecond
          : this.totalSize / this.duration
      let byteCorrection = 0

      if (isLate) {
        byteCorrection = closestRange.diff * bytesPerSec
      } else if (isTooEarly) {
        const gap = targetTime - closestRange.end
        byteCorrection = -(gap * bytesPerSec)
      }

      const SAFETY_PAD = 1 * 1024 * 1024
      let newOffset = startByteOffset - byteCorrection
      if (isLate) newOffset -= SAFETY_PAD
      newOffset = Math.max(0, newOffset)
      newOffset = Math.floor(newOffset / 4096) * 4096

      log.debug(`Retrying seek at offset ${newOffset}`)
      this.restartFromOffset(newOffset, targetTime).catch((e) => {
        if ((e as Error).name !== 'AbortError') log.error('Seek retry error:', e)
      })
    } else {
      log.debug(
        `Seek converged! Range [${closestRange.start.toFixed(2)}, ${closestRange.end.toFixed(2)}] covers ${targetTime.toFixed(2)}`
      )
      this.pendingSeekCheck = null
      this.seekAttemptCount = 0
      if (this.seekReadyPending) {
        this.seekReadyPending = false
        this.isSeekTranscoding = false
        log.debug('Seek converged — dispatching seekready')
        this.dispatchEvent(new CustomEvent('seekready'))
      }
    }
  }

  private async probeFileSize(url: string): Promise<{ size: number; supportsRanges: boolean }> {
    const cached = StreamingAudioTranscoder.probeCache.get(url)
    if (cached) {
      log.debug(
        `Probe cache hit: ${(cached.size / 1024 / 1024).toFixed(1)}MB, ranges: ${cached.supportsRanges}`
      )
      return cached
    }

    const signal = this.abortController?.signal
    // Size learned from HEAD — used as fallback when Content-Range is absent in the 206 response
    let headContentLength = 0

    try {
      const head = await fetch(url, { method: 'HEAD', signal })
      if (head.ok || head.status === 200) {
        const cl = parseInt(head.headers.get('content-length') || '0')
        const ar = head.headers.get('accept-ranges')
        const ranges = ar === 'bytes'

        if (cl > 0 && ranges) {
          log.debug(`Probe via HEAD: ${(cl / 1024 / 1024).toFixed(1)}MB, Accept-Ranges: bytes`)
          const result = { size: cl, supportsRanges: true }
          StreamingAudioTranscoder.probeCache.set(url, result)
          return result
        }

        if (cl > 0) {
          // Many streaming proxies/CDNs omit Accept-Ranges in HEAD responses but still
          // honour Range requests. Store the size and fall through to verify with a real
          // range request rather than concluding "no range support" prematurely.
          log.debug(
            `Probe via HEAD: ${(cl / 1024 / 1024).toFixed(1)}MB, no Accept-Ranges — verifying range support`
          )
          headContentLength = cl
        } else {
          log.debug('HEAD gave no Content-Length, trying range probe...')
        }
      }
    } catch (e) {
      log.debug('HEAD failed, falling back to range probe:', (e as Error).message)
    }

    try {
      const probe = await fetch(this.proxiedUrl(url), {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal,
      })

      if (probe.status === 206) {
        const cr = probe.headers.get('content-range')
        const match = cr?.match(/\/([0-9]+)$/)
        // Prefer the total size from Content-Range; fall back to the HEAD Content-Length
        const size = (match ? parseInt(match[1]) : 0) || headContentLength
        await probe.body?.cancel()

        if (size > 0) {
          log.debug(`Probe via GET range: ${(size / 1024 / 1024).toFixed(1)}MB, ranges confirmed`)
          const result = { size, supportsRanges: true }
          StreamingAudioTranscoder.probeCache.set(url, result)
          return result
        }
      } else if (probe.status === 200) {
        const cl = parseInt(probe.headers.get('content-length') || '0') || headContentLength
        await probe.body?.cancel()
        if (cl > 0) {
          log.debug(`Probe via GET 200 (no range support): ${(cl / 1024 / 1024).toFixed(1)}MB`)
          const result = { size: cl, supportsRanges: false }
          StreamingAudioTranscoder.probeCache.set(url, result)
          return result
        }
      }
    } catch (e) {
      log.debug('Range probe failed:', (e as Error).message)
      // Range request failed but HEAD gave us a size — fall back to full download
      if (headContentLength > 0) {
        log.debug(
          `Using HEAD size as fallback: ${(headContentLength / 1024 / 1024).toFixed(1)}MB (no ranges)`
        )
        const result = { size: headContentLength, supportsRanges: false }
        StreamingAudioTranscoder.probeCache.set(url, result)
        return result
      }
    }

    try {
      const resp = await fetch(this.proxiedUrl(url), { signal })
      const cl = parseInt(resp.headers.get('content-length') || '0')
      await resp.body?.cancel()
      if (cl > 0) {
        log.debug(`Probe via full GET: ${(cl / 1024 / 1024).toFixed(1)}MB (no ranges)`)
        const result = { size: cl, supportsRanges: false }
        StreamingAudioTranscoder.probeCache.set(url, result)
        return result
      }
    } catch (e) {
      log.debug('Full GET probe failed:', (e as Error).message)
    }

    throw new Error('Cannot determine file size: all probe strategies failed')
  }

  private async downloadAndTranscodeFull(): Promise<void> {
    log.debug('Downloading full file...')

    const response = await fetch(this.proxiedUrl(this.sourceUrl), {
      signal: this.abortController?.signal,
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

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      chunks.push(value)
      receivedLength += value.length

      const percent = Math.round((receivedLength / this.totalSize) * 100)
      if (percent % 10 === 0) {
        log.debug(`Downloaded: ${percent}%`)
        this.dispatchEvent(
          new CustomEvent('progress', {
            detail: { percent, phase: 'downloading' },
          })
        )
      }
    }

    const combined = new Uint8Array(receivedLength)
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.length
    }

    log.debug(`Downloaded ${(receivedLength / 1024 / 1024).toFixed(1)}MB, transcoding...`)

    await this.transcodeFile(combined, 0)
  }

  /**
   * Progressive download and transcode for large files.
   *
   * Downloads data continuously to JS memory, then writes the accumulated
   * continuous buffer to FFmpeg FS and transcodes in one pass.
   * Periodic re-transcodes with -ss skip produce additional audio appended
   * to MSE for ongoing playback.
   *
   * Key difference from old approach: we NEVER split the file into
   * mid-file segments with tiny headers. We always write a continuous
   * file from offset 0 so FFmpeg can parse the container correctly.
   */
  private async downloadAndTranscodeProgressive(startOffset: number = 0): Promise<void> {
    log.debug(`Progressive mode: downloading continuously from byte ${startOffset}...`)

    const signal = this.abortController?.signal
    const generation = this.transcodeGeneration

    const MAX_WASM = StreamingAudioTranscoder.MAX_WASM_FILE_SIZE
    const CHUNK_SIZE = 20 * 1024 * 1024

    const effectiveTotal = Math.min(this.totalSize, MAX_WASM)
    let currentByte = startOffset

    const downloadChunks: Uint8Array[] = []
    let totalDownloaded = 0
    // Always start with the small initial-buffer threshold regardless of seek vs. initial load.
    // Setting this to `true` for seeks caused the first transcode to wait for the full
    // TRANSCODE_INCREMENT (150MB) instead of initialBufferSize (50MB), adding ~8 chunks of
    // latency before any audio was available after a seek.
    let hasDoneInitialTranscode = false
    let lastTranscodedByteOffset = startOffset
    const downloadSessionStart = Date.now()

    const TRANSCODE_INCREMENT = 150 * 1024 * 1024

    while (currentByte < effectiveTotal && !signal?.aborted) {
      // Abort if a newer generation (from restartFromOffset) was created
      if (this.transcodeGeneration !== generation) {
        log.debug('Transcode generation mismatch, aborting current download')
        return
      }

      if (this.audioElement && this.sourceBuffer && this.sourceBuffer.buffered.length > 0) {
        try {
          const currentTime = this.audioElement.currentTime
          const buffered = this.sourceBuffer.buffered

          for (let i = 0; i < buffered.length; i++) {
            if (currentTime >= buffered.start(i) - 0.5 && currentTime <= buffered.end(i) + 0.5) {
              const secondsAhead = buffered.end(i) - currentTime
              if (secondsAhead > 300) {
                log.debug(
                  `Buffer sufficient (${secondsAhead.toFixed(0)}s ahead). Pausing download...`
                )
                const RESUME_THRESHOLD = 120

                while (this.audioElement && !signal?.aborted) {
                  const now = this.audioElement.currentTime
                  let currentAhead = 0
                  if (this.sourceBuffer && this.sourceBuffer.buffered.length > 0) {
                    for (let j = 0; j < this.sourceBuffer.buffered.length; j++) {
                      if (
                        now >= this.sourceBuffer.buffered.start(j) - 2 &&
                        now <= this.sourceBuffer.buffered.end(j) + 2
                      ) {
                        currentAhead = this.sourceBuffer.buffered.end(j) - now
                        break
                      }
                    }
                  }
                  if (currentAhead < RESUME_THRESHOLD) break
                  await new Promise((r) => setTimeout(r, 2000))
                }

                if (signal?.aborted) return
                log.debug('Resuming download...')
              }
              break
            }
          }
        } catch (_e) {
          // Ignore
        }
      }

      const segmentEnd = Math.min(currentByte + CHUNK_SIZE - 1, effectiveTotal - 1)

      {
        const elapsedMs = Date.now() - downloadSessionStart
        const bytesPerMs = elapsedMs > 500 && totalDownloaded > 0 ? totalDownloaded / elapsedMs : 0
        const remaining = effectiveTotal - currentByte
        const etaSec = bytesPerMs > 0 ? Math.round(remaining / bytesPerMs / 1000) : undefined
        const transcodedPct =
          this.duration > 0 && this.sourceBuffer
            ? (() => {
                try {
                  const buf = this.sourceBuffer.buffered
                  if (buf.length > 0) return (buf.end(buf.length - 1) / this.duration) * 100
                } catch {
                  // ignore
                }
                return 0
              })()
            : 0
        this.dispatchEvent(
          new CustomEvent('progress', {
            detail: {
              percent: Math.round((currentByte / this.totalSize) * 100),
              phase: 'downloading' as const,
              etaSec,
              transcodedPct,
              isSeeking: startOffset > 0,
            },
          })
        )
      }

      log.debug(`Downloading ${currentByte}-${segmentEnd}...`)

      try {
        const chunk = await this.downloadRange(currentByte, segmentEnd, signal)

        if (signal?.aborted || this.transcodeGeneration !== generation) return

        downloadChunks.push(chunk)
        totalDownloaded += chunk.length
        currentByte = segmentEnd + 1

        // Cache the first chunk as the container header so seeks can prepend it.
        // Only do this for the initial full-file download (startOffset === 0).
        if (startOffset === 0 && this.containerHeader === null) {
          this.containerHeader = chunk
          log.debug(
            `Cached ${(chunk.length / 1024 / 1024).toFixed(1)}MB container header for seek support`
          )
        }

        log.debug(`Downloaded: ${(totalDownloaded / 1024 / 1024).toFixed(1)}MB total`)

        // Decide if we should transcode now
        const initialThreshold = hasDoneInitialTranscode
          ? TRANSCODE_INCREMENT
          : this.config.initialBufferSize

        const shouldTranscode = totalDownloaded >= initialThreshold || currentByte >= effectiveTotal

        if (shouldTranscode && totalDownloaded > 0) {
          // Build continuous data from offset 0
          const continuousData = this.buildContinuousBuffer(
            startOffset > 0,
            downloadChunks,
            startOffset
          )

          if (continuousData.length > 0) {
            log.debug(
              `Transcoding ${
                continuousData.length >= 1024 * 1024
                  ? `${(continuousData.length / 1024 / 1024).toFixed(1)}MB`
                  : `${(continuousData.length / 1024).toFixed(0)}KB`
              } of continuous data`
            )

            const seekTime =
              startOffset > 0
                ? Math.max(0, this.lastTranscodedDuration)
                : this.lastTranscodedDuration

            await this.transcodeFile(continuousData, seekTime)

            lastTranscodedByteOffset = currentByte
            hasDoneInitialTranscode = true

            // Track observed bytes-per-second from initial download for accurate seek offsets
            if (startOffset === 0 && this.lastTranscodedDuration > 1) {
              this.observedBytesPerSecond = currentByte / this.lastTranscodedDuration
              log.debug(
                `Observed bitrate: ${((this.observedBytesPerSecond * 8) / 1024 / 1024).toFixed(1)} Mbps`
              )
            }
          }
        }
      } catch (error) {
        if ((error as any).isRangeExceeded) {
          const actualSize = (error as any).actualSize
          if (typeof actualSize === 'number' && actualSize > 0 && actualSize < this.totalSize) {
            log.debug(
              `Server reports actual size ${(actualSize / 1024 / 1024).toFixed(1)}MB. Stopping.`
            )
            this.totalSize = actualSize
          } else {
            log.debug('416 received — reached end of ranged content, stopping.')
          }
          break
        }

        // AbortError means restartFromOffset cancelled this download.
        // Re-throw so start() catches it and exits without calling endOfStream().
        if ((error as Error).name === 'AbortError') {
          throw error
        }

        log.error('Download error:', error)

        if (startOffset === 0 && currentByte < CHUNK_SIZE) {
          throw error
        }

        log.debug('Skipping failed chunk and continuing...')
        currentByte = segmentEnd + 1
      }
    }

    // Final transcode with all downloaded data
    if (downloadChunks.length > 0 && !signal?.aborted && this.transcodeGeneration === generation) {
      const continuousData = this.buildContinuousBuffer(
        startOffset > 0,
        downloadChunks,
        startOffset
      )

      if (
        continuousData.length > 0 &&
        continuousData.length > lastTranscodedByteOffset - startOffset
      ) {
        const seekTime =
          startOffset > 0 ? Math.max(0, this.lastTranscodedDuration) : this.lastTranscodedDuration

        try {
          await this.transcodeFile(continuousData, seekTime)
        } catch (e) {
          if ((e as Error).name !== 'AbortError') {
            log.error('Final transcode error:', e)
          }
        }
      }
    }

    // Don't signal completion if this run was aborted by a seek restart
    if (signal?.aborted) return

    this.dispatchEvent(
      new CustomEvent('progress', {
        detail: { percent: 100, phase: 'complete' },
      })
    )

    log.debug('Progressive download complete')
  }

  /**
   * Build a continuous buffer from downloaded chunks.
   *
   * When hasOffset is true (seek-restart), the chunks start at a mid-file byte
   * offset and lack the MKV EBML/Tracks header.  We prepend the cached
   * containerHeader so FFmpeg can resolve stream indices (e.g. `0:3`) even
   * though the audio payload starts mid-file.  FFmpeg is told to ignore the
   * container's seek index (-fflags +ignidx in transcodeFile) so it doesn't
   * try to jump to SeekHead byte offsets that are invalid for this virtual file.
   */
  private buildContinuousBuffer(
    hasOffset: boolean,
    chunks: Uint8Array[],
    _startOffset: number
  ): Uint8Array {
    if (!hasOffset && chunks.length === 1) {
      return chunks[0]
    }

    const prefix = hasOffset && this.containerHeader ? this.containerHeader : null

    let totalLength = prefix ? prefix.length : 0
    for (const chunk of chunks) {
      totalLength += chunk.length
    }

    const result = new Uint8Array(totalLength)
    let pos = 0

    if (prefix) {
      result.set(prefix, pos)
      pos += prefix.length
    }

    for (const chunk of chunks) {
      result.set(chunk, pos)
      pos += chunk.length
    }

    return result
  }

  /**
   * Get the current duration of audio buffered in the SourceBuffer.
   */
  private getTranscodedDuration(): number {
    if (!this.sourceBuffer) return 0
    try {
      const buffered = this.sourceBuffer.buffered
      if (buffered.length > 0) {
        return buffered.end(buffered.length - 1)
      }
    } catch {
      // SourceBuffer may be removed
    }
    return this.lastTranscodedDuration
  }

  /**
   * Transcode a continuous file buffer through FFmpeg.
   * data must be a continuous byte range starting from the beginning of
   * the media file (or from startOffset for seek-based re-transcodes).
   * seekTime: seconds of audio to skip (already-transcoded portion).
   */
  private async transcodeFile(data: Uint8Array, seekTime: number = 0): Promise<void> {
    if (!this.ffmpeg || data.length === 0) return

    await this.cleanupFFmpegFS()

    const timestamp = Date.now()
    const inputFilename = `input_${timestamp}.mkv`
    const outputFilename = `audio_${timestamp}.m4a`

    try {
      log.debug(`Writing ${(data.length / 1024 / 1024).toFixed(1)}MB to FFmpeg FS...`)
      await this.ffmpeg.writeFile(inputFilename, data)

      const args: string[] = []

      // When seeking with a prepended container header the virtual file has:
      //   [header bytes 0..N] + [mid-file bytes seekOffset..]
      // The SeekHead in the header contains byte offsets from the *original*
      // file, so they are wrong for this virtual file.  -fflags +ignidx tells
      // FFmpeg to ignore the index and scan linearly instead.
      if (seekTime > 0 && this.containerHeader !== null) {
        args.push('-fflags', '+ignidx')
      }

      // Input seeking: skip already-transcoded portion
      if (seekTime > 0) {
        args.push('-ss', String(Math.floor(seekTime)))
      }

      args.push(
        '-i',
        inputFilename,
        '-copyts',
        '-map',
        `0:${this.audioStreamIndex}`,
        '-c:a',
        'aac',
        '-b:a',
        this.config.bitrate,
        '-ac',
        '2',
        '-ar',
        '48000',
        '-vn',
        '-f',
        'mp4',
        '-movflags',
        '+frag_keyframe+empty_moov+default_base_moof'
      )

      // Limit output duration if we're seeking: only produce audio we haven't transcoded yet
      if (seekTime > 0 && this.duration > 0) {
        // Don't limit duration for seeks; let FFmpeg produce everything from seek point
      }

      args.push('-y', outputFilename)

      log.debug(
        `Transcoding (seekTime=${seekTime.toFixed(1)}s, inputSize=${(data.length / 1024 / 1024).toFixed(1)}MB)...`
      )
      await this.ffmpeg.exec(args)

      const output = await this.ffmpeg.readFile(outputFilename)
      const outputData =
        typeof output === 'string' ? new TextEncoder().encode(output) : new Uint8Array(output)

      if (outputData.length > 0) {
        log.debug(`Transcoded output: ${(outputData.length / 1024).toFixed(0)}KB`)

        // Set timestampOffset for seeks so MSE places audio correctly
        if (seekTime > 0 && this.sourceBuffer && !this.sourceBuffer.updating) {
          try {
            if (this.sourceBuffer.buffered.length > 0) {
              // Remove old buffer and set offset for new segment
              const removeEnd = this.sourceBuffer.buffered.end(
                this.sourceBuffer.buffered.length - 1
              )
              if (removeEnd > seekTime) {
                this.sourceBuffer.remove(seekTime, removeEnd)
                await new Promise<void>((resolve) => {
                  const onEnd = () => {
                    this.sourceBuffer!.removeEventListener('updateend', onEnd)
                    resolve()
                  }
                  this.sourceBuffer!.addEventListener('updateend', onEnd)
                })
              }
            }
            this.sourceBuffer.timestampOffset = seekTime
            log.debug(`Set timestampOffset to ${seekTime.toFixed(2)}s for seek transcode`)
          } catch (e) {
            log.warn('Failed to adjust timestampOffset:', e)
          }
        }

        this.queueSegment(outputData)

        // Update lastTranscodedDuration based on what we just produced
        this.lastTranscodedDuration = this.getTranscodedDuration()
        log.debug(`Audio buffered up to ${this.lastTranscodedDuration.toFixed(1)}s`)
      } else {
        log.warn('Transcode produced empty output')
      }

      await this.ffmpeg.deleteFile(inputFilename)
      await this.ffmpeg.deleteFile(outputFilename)
    } catch (error) {
      log.error('Transcode error:', error)

      try {
        await this.ffmpeg.deleteFile(inputFilename)
      } catch {}
      try {
        await this.ffmpeg.deleteFile(outputFilename)
      } catch {}

      // Don't throw for seek-related transcodes after initial playback
      // A failed seek transcode shouldn't kill the playback
      if (seekTime === 0) {
        throw error
      } else {
        log.warn('Seek transcode failed, playback continues with existing buffer')
      }
    }
  }

  private async cleanupFFmpegFS(): Promise<void> {
    if (!this.ffmpeg) return

    try {
      const files = await this.ffmpeg.listDir('/')

      for (const file of files) {
        if (file.name === '.' || file.name === '..' || file.isDir) continue

        if (
          file.name.endsWith('.mkv') ||
          file.name.endsWith('.m4a') ||
          file.name.endsWith('.mp4') ||
          file.name.endsWith('.aac')
        ) {
          try {
            await this.ffmpeg.deleteFile(`/${file.name}`)
            log.debug(`Cleaned up: ${file.name}`)
          } catch {
            // Ignore
          }
        }
      }
    } catch (error) {
      log.warn('Could not list FS:', error)
    }
  }

  private async downloadRange(
    start: number,
    end: number,
    signal?: AbortSignal
  ): Promise<Uint8Array> {
    const response = await fetch(this.proxiedUrl(this.sourceUrl), {
      headers: { Range: `bytes=${start}-${end}` },
      signal: signal || this.abortController?.signal,
    })

    if (response.status === 416) {
      const cr = response.headers.get('content-range')
      const match = cr?.match(/\/([0-9]+)$/)
      const actualSize = match ? parseInt(match[1]) : start
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

  private queueSegment(data: Uint8Array): void {
    this.pendingSegments.push(data)
    this.appendNextSegment()
  }

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
      this.sourceBuffer.appendBuffer(
        segment.buffer.slice(
          segment.byteOffset,
          segment.byteOffset + segment.byteLength
        ) as ArrayBuffer
      )
    } catch (error) {
      log.error('Append error:', error)
      this.isAppending = false

      if ((error as Error).name === 'QuotaExceededError') {
        this.handleQuotaExceeded(segment)
      }
    }
  }

  private handleQuotaExceeded(segment: Uint8Array): void {
    if (!this.sourceBuffer || !this.audioElement) return

    log.warn('Quota exceeded, evicting buffer...')

    this.pendingSegments.unshift(segment)

    if (this.sourceBuffer.updating) return

    try {
      const currentTime = this.audioElement.currentTime
      const buffered = this.sourceBuffer.buffered
      let removed = false

      if (currentTime > 30) {
        const removeEnd = currentTime - 30
        if (buffered.length > 0 && buffered.start(0) < removeEnd) {
          this.sourceBuffer.remove(0, removeEnd)
          removed = true
        }
      }

      if (!removed && buffered.length > 0) {
        for (let i = 0; i < buffered.length; i++) {
          const start = buffered.start(i)
          const end = buffered.end(i)
          if (start > currentTime + 300) {
            this.sourceBuffer.remove(start, end)
            removed = true
            break
          }
        }
      }

      if (!removed && currentTime > 5) {
        this.sourceBuffer.remove(0, currentTime - 5)
        removed = true
      }

      if (!removed) {
        log.warn('Could not find buffer to evict! Retrying in 1s...')
        this.isAppending = false
        setTimeout(() => this.appendNextSegment(), 1000)
      }
    } catch (e) {
      log.error('Error handling quota exceeded:', e)
      this.isAppending = false
    }
  }

  private async waitForAppendComplete(): Promise<void> {
    while (this.pendingSegments.length > 0 || this.isAppending) {
      await new Promise((r) => setTimeout(r, 50))
    }
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.audioElement
  }

  async seek(time: number): Promise<void> {
    if (this.audioElement) {
      this.audioElement.currentTime = time
    }
  }

  play(): void {
    this.audioElement?.play().catch((e) => log.warn('Play failed:', e))
  }

  pause(): void {
    this.audioElement?.pause()
  }

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

    if (!this.sharedFFmpeg && this.ffmpeg) {
      try {
        this.ffmpeg.terminate()
      } catch {}
    }
    this.ffmpeg = null
    this.ffmpegLoaded = false

    log.debug('Destroyed')
  }
}
