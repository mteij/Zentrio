/**
 * TranscoderService - FFmpeg WASM Audio Transcoder
 *
 * Transcodes unsupported audio codecs (DTS, TrueHD, etc.) to AAC
 * using FFmpeg WASM, enabling playback in any browser.
 *
 * Architecture:
 * 1. Receives audio stream URL + codec info
 * 2. Downloads audio data in chunks
 * 3. Transcodes to AAC using FFmpeg WASM
 * 4. Returns transcoded audio as Blob URL or MediaSource
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { MediaMetadata, MediaStream, MediaFormat } from './types'

// Codec ID constants matching HybridEngine
const CODEC_ID_DTS = 86020
const CODEC_ID_TRUEHD = 86019
const CODEC_ID_AC3 = 86017
const CODEC_ID_EAC3 = 86018
const CODEC_ID_FLAC = 86028
const CODEC_ID_VORBIS = 86021
const CODEC_ID_OPUS = 86076

// Codecs that require transcoding to AAC for browser compatibility
const TRANSCODE_REQUIRED_CODECS = new Set([
  CODEC_ID_DTS,
  CODEC_ID_TRUEHD,
  CODEC_ID_FLAC,
  CODEC_ID_VORBIS,
  CODEC_ID_AC3,
  CODEC_ID_EAC3,
])

export interface TranscodeOptions {
  /** Source URL of the media file */
  sourceUrl: string
  /** Audio codec ID */
  codecId: number
  /** Audio stream index in the container */
  audioStreamIndex?: number
  /** Target bitrate (default: 192k) */
  bitrate?: string
  /** Progress callback (0-100) */
  onProgress?: (progress: number) => void
}

export interface TranscodeResult {
  /** Blob URL for the transcoded audio */
  audioUrl: string
  /** Duration in seconds */
  duration: number
  /** Cleanup function to revoke blob URL */
  cleanup: () => void
}

class TranscoderServiceClass {
  private ffmpeg: FFmpeg | null = null
  private isLoading = false
  private isLoaded = false
  private loadPromise: Promise<void> | null = null

  /**
   * Check if a codec requires FFmpeg transcoding
   */
  requiresTranscoding(codecId: number): boolean {
    return TRANSCODE_REQUIRED_CODECS.has(codecId)
  }

  /**
   * Get human-readable name for codec
   */
  getCodecName(codecId: number): string {
    const names: Record<number, string> = {
      [CODEC_ID_DTS]: 'DTS',
      [CODEC_ID_TRUEHD]: 'TrueHD',
      [CODEC_ID_AC3]: 'AC3',
      [CODEC_ID_EAC3]: 'E-AC3',
      [CODEC_ID_FLAC]: 'FLAC',
      [CODEC_ID_VORBIS]: 'Vorbis',
      [CODEC_ID_OPUS]: 'Opus',
    }
    return names[codecId] || `Unknown (${codecId})`
  }

  /**
   * Load FFmpeg WASM module
   */
  async load(): Promise<void> {
    if (this.isLoaded) return
    if (this.loadPromise) return this.loadPromise

    this.isLoading = true
    
    this.loadPromise = (async () => {
      try {
        this.ffmpeg = new FFmpeg()

        // Set up logging
        this.ffmpeg.on('log', ({ message }) => {
          console.log('[FFmpeg]', message)
        })

        // Load from CDN with proper CORS headers
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
        
        await this.ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        })

        this.isLoaded = true
        console.log('[TranscoderService] FFmpeg WASM loaded successfully')
      } catch (error) {
        console.error('[TranscoderService] Failed to load FFmpeg:', error)
        throw error
      } finally {
        this.isLoading = false
      }
    })()

    return this.loadPromise
  }

  /**
   * Transcode audio from a media file to AAC
   */
  async transcodeAudio(options: TranscodeOptions): Promise<TranscodeResult> {
    const {
      sourceUrl,
      codecId,
      audioStreamIndex = 0,
      bitrate = '192k',
      onProgress,
    } = options

    // Ensure FFmpeg is loaded
    await this.load()

    if (!this.ffmpeg) {
      throw new Error('FFmpeg not initialized')
    }

    const codecName = this.getCodecName(codecId)
    console.log(`[TranscoderService] Transcoding ${codecName} audio to AAC...`)

    // Generate unique filenames to avoid conflicts with concurrent operations
    const transcodeId = `transcode_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const inputFilename = `${transcodeId}_input`
    const outputFilename = `${transcodeId}_output.m4a`

    try {
      // Set up progress tracking
      this.ffmpeg.on('progress', ({ progress }) => {
        const percent = Math.round(progress * 100)
        onProgress?.(percent)
      })

      // Fetch the source file
      console.log('[TranscoderService] Fetching source file...')
      const sourceData = await fetchFile(sourceUrl)
      
      // Write input file to virtual filesystem
      await this.ffmpeg.writeFile(inputFilename, sourceData)

      // Build FFmpeg command for audio extraction + transcoding
      // -map 0:a:{index} selects specific audio stream
      // -c:a aac transcodes to AAC
      // -b:a sets bitrate
      // -vn skips video
      const ffmpegArgs = [
        '-i', inputFilename,
        '-map', `0:a:${audioStreamIndex}`,
        '-c:a', 'aac',
        '-b:a', bitrate,
        '-vn',
        '-y',
        outputFilename
      ]

      console.log('[TranscoderService] Running FFmpeg:', ffmpegArgs.join(' '))
      await this.ffmpeg.exec(ffmpegArgs)

      // Read output file
      const outputData = await this.ffmpeg.readFile(outputFilename)
      
      // Create blob URL - handle both string and Uint8Array return types
      // Use type assertion as FFmpeg WASM returns regular ArrayBuffer (not SharedArrayBuffer)
      let blobData: ArrayBuffer
      if (typeof outputData === 'string') {
        blobData = new TextEncoder().encode(outputData).buffer as ArrayBuffer
      } else {
        blobData = outputData.buffer as ArrayBuffer
      }
      const blob = new Blob([blobData], { type: 'audio/mp4' })
      const audioUrl = URL.createObjectURL(blob)

      // Get duration from the transcoded file
      // For now, return 0 - the player will get it from the audio element
      const duration = 0

      // Cleanup input and output files from virtual FS
      try {
        await this.ffmpeg.deleteFile(inputFilename)
      } catch (err) {
        console.warn('[TranscoderService] Failed to delete input file:', err)
      }
      try {
        await this.ffmpeg.deleteFile(outputFilename)
      } catch (err) {
        console.warn('[TranscoderService] Failed to delete output file:', err)
      }

      console.log(`[TranscoderService] Transcoding complete: ${audioUrl}`)

      return {
        audioUrl,
        duration,
        cleanup: () => {
          URL.revokeObjectURL(audioUrl)
        }
      }
    } catch (error) {
      console.error('[TranscoderService] Transcoding failed:', error)
      
      // Cleanup files on error
      try {
        await this.ffmpeg.deleteFile(inputFilename)
      } catch (err) {
        // Ignore cleanup errors
      }
      try {
        await this.ffmpeg.deleteFile(outputFilename)
      } catch (err) {
        // Ignore cleanup errors
      }
      
      throw error
    }
  }

  /**
   * Extract audio stream info using FFprobe
   * (FFprobe is included in @ffmpeg/ffmpeg)
   */
  async probeAudioCodec(sourceUrl: string): Promise<{ codecId: number; codecName: string } | null> {
    await this.load()
    
    if (!this.ffmpeg) {
      throw new Error('FFmpeg not initialized')
    }

    // Generate unique filename to avoid conflicts with concurrent/cancelled probes
    const probeId = `probe_audio_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const inputFilename = `${probeId}_input`

    try {
      const sourceData = await fetchFile(sourceUrl)
      await this.ffmpeg.writeFile(inputFilename, sourceData)

      // Use FFmpeg to probe - capture output
      let probeOutput = ''
      const logHandler = ({ message }: { message: string }) => {
        probeOutput += message + '\n'
      }
      this.ffmpeg.on('log', logHandler)

      // Run with -hide_banner to reduce noise
      await this.ffmpeg.exec([
        '-hide_banner',
        '-i', inputFilename,
        '-f', 'null',
        '-'
      ]).catch(() => {
        // FFmpeg returns error code when -f null but we have the probe output
      })

      // Parse codec from output
      const audioMatch = probeOutput.match(/Audio:\s+(\w+)/i)
      
      // Cleanup input file - use try/catch to handle case where file might not exist
      try {
        await this.ffmpeg.deleteFile(inputFilename)
      } catch (err) {
        console.warn('[TranscoderService] Failed to delete probe input file:', err)
      }

      if (audioMatch) {
        const codecStr = audioMatch[1].toLowerCase()
        const codecMap: Record<string, number> = {
          'dts': CODEC_ID_DTS,
          'truehd': CODEC_ID_TRUEHD,
          'ac3': CODEC_ID_AC3,
          'eac3': CODEC_ID_EAC3,
          'flac': CODEC_ID_FLAC,
          'vorbis': CODEC_ID_VORBIS,
          'opus': CODEC_ID_OPUS,
        }
        
        return {
          codecId: codecMap[codecStr] || 0,
          codecName: codecStr.toUpperCase()
        }
      }

      return null
    } catch (error) {
      console.warn('[TranscoderService] Probe failed:', error)
      
      // Cleanup input file on error - use try/catch to handle case where file might not exist
      try {
        await this.ffmpeg.deleteFile(inputFilename)
      } catch (err) {
        // Ignore cleanup errors
      }
      
      return null
    }
  }

  /**
   * Probe media file to get full metadata (streams, format, duration)
   * Returns MediaMetadata compatible with HybridEngine
   *
   * Uses Range requests to only download the first few MB (where metadata lives)
   */
  async probe(sourceUrl: string): Promise<MediaMetadata | null> {
    console.log('[TranscoderService] Starting lightweight probe for:', sourceUrl)
    
    await this.load()
    
    if (!this.ffmpeg) {
      console.error('[TranscoderService] FFmpeg not initialized')
      return null
    }

    // Generate unique filename to avoid conflicts with concurrent/cancelled probes
    const probeId = `probe_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const inputFilename = `${probeId}_input`

    try {
      // Use Range request to fetch only first 5MB (metadata is at the beginning)
      console.log('[TranscoderService] Fetching first 5MB for probing...')
      
      // Add timeout using AbortController
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      const response = await fetch(sourceUrl, {
        headers: { 'Range': 'bytes=0-5242879' }, // First 5MB
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId))
      
      if (!response.ok && response.status !== 206 && response.status !== 200) {
        console.error('[TranscoderService] HTTP error:', response.status, response.statusText)
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      // Check if server returned full file despite Range request
      if (response.status === 200 && response.headers.get('content-length')) {
        const contentLength = parseInt(response.headers.get('content-length') || '0', 10)
        if (contentLength > 6 * 1024 * 1024) { // If > 6MB, server sent full file
          console.warn('[TranscoderService] Server returned full file instead of range, aborting')
          throw new Error('Server does not support Range requests')
        }
      }
      
      const sourceData = await response.arrayBuffer()
      console.log('[TranscoderService] Source data fetched, size:', sourceData.byteLength)
      
      // Validate we got enough data
      if (sourceData.byteLength < 1000) {
        console.warn('[TranscoderService] Received insufficient data, may not be valid media')
        return null
      }
      
      await this.ffmpeg.writeFile(inputFilename, new Uint8Array(sourceData))

      // Use FFprobe to get JSON output
      let probeOutput = ''
      const logHandler = ({ message }: { message: string }) => {
        probeOutput += message + '\n'
      }
      this.ffmpeg.on('log', logHandler)

      console.log('[TranscoderService] Running FFmpeg probe...')
      // Run FFprobe with JSON output
      await this.ffmpeg.exec([
        '-hide_banner',
        '-i', inputFilename,
        '-f', 'null',
        '-'
      ]).catch((err) => {
        // FFmpeg returns error code when -f null but we have the probe output
        console.log('[TranscoderService] FFmpeg probe completed (expected error for -f null):', err)
      })

      console.log('[TranscoderService] Probe output length:', probeOutput.length)
      console.log('[TranscoderService] Probe output preview:', probeOutput.substring(0, 500))

      // Parse streams from output - improved regex to handle more formats
      const streams: MediaStream[] = []
      // Match: Stream #0:0(eng): Video: wrapped_avframe, yuv420p10le...
      // OR: Stream #0:0[eng]: Video: h264, yuv420p...
      const streamRegex = /Stream\s+#\d+:(\d+)(?:\(([^\)]+)\)|\[([^\]]+)\])?:\s+(\w+):\s+([^\s,]+)/g
      let match

      while ((match = streamRegex.exec(probeOutput)) !== null) {
        const [, index, languageParen, languageBracket, codecType, codecName] = match
        const language = languageParen || languageBracket
        streams.push({
          index: parseInt(index, 10),
          codec_type: codecType.toLowerCase() as any,
          codec_name: codecName.toLowerCase(),
          tags: language ? { language } : undefined
        })
      }

      console.log('[TranscoderService] Parsed streams:', streams)

      // Parse format name from output (e.g., "Input #0, matroska,webm, from '...'")
      const formatMatch = probeOutput.match(/Input\s+#\d+,\s+([^,]+)/)
      const formatName = formatMatch ? formatMatch[1] : 'unknown'
      
      // Parse duration from output
      const durationMatch = probeOutput.match(/Duration:\s+(\d+):(\d+):(\d+)\.(\d+)/)
      let duration = 0
      if (durationMatch) {
        const [, hours, minutes, seconds, centiseconds] = durationMatch
        duration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100
      }

      // Parse bitrate from output
      const bitrateMatch = probeOutput.match(/bitrate:\s+(\d+)\s+kb\/s/)
      const bitrate = bitrateMatch ? parseInt(bitrateMatch[1]) * 1000 : undefined

      // Cleanup input file - use try/catch to handle case where file might not exist
      try {
        await this.ffmpeg.deleteFile(inputFilename)
      } catch (err) {
        console.warn('[TranscoderService] Failed to delete probe input file:', err)
      }

      const format: MediaFormat = {
        duration,
        bit_rate: bitrate,
        format_name: formatName,
        format_long_name: formatName.charAt(0).toUpperCase() + formatName.slice(1)
      }

      console.log('[TranscoderService] Probe result:', { streams, format })

      if (streams.length === 0) {
        console.warn('[TranscoderService] No streams found in probe output')
        return null
      }

      return {
        streams,
        format
      }
    } catch (error) {
      console.error('[TranscoderService] Probe failed with error:', error)
      
      // Cleanup input file on error - use try/catch to handle case where file might not exist
      try {
        await this.ffmpeg.deleteFile(inputFilename)
      } catch (err) {
        // Ignore cleanup errors
      }
      
      return null
    }
  }

  /**
   * Check if transcoding is supported in this browser
   */
  isSupported(): boolean {
    // Check for SharedArrayBuffer (required for FFmpeg WASM)
    return typeof SharedArrayBuffer !== 'undefined'
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.ffmpeg) {
      this.ffmpeg.terminate()
      this.ffmpeg = null
    }
    this.isLoaded = false
    this.loadPromise = null
  }
}

// Export singleton instance
export const TranscoderService = new TranscoderServiceClass()

// Also export class for testing
export { TranscoderServiceClass }
