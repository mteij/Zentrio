/**
 * NetworkReader - HTTP Range Request Handler for libav.js
 * 
 * Provides chunked reading with caching for streaming demuxing.
 * Implements the read callback interface expected by libav.js.
 */

import type { NetworkReaderConfig } from './types'

interface CacheEntry {
  data: ArrayBuffer
  lastAccess: number
}

export class NetworkReader {
  private url: string
  private cache: Map<number, CacheEntry> = new Map()
  private fileSize: number = 0
  private chunkSize: number
  private maxCacheSize: number
  private prefetchCount: number
  private timeout: number
  private abortController: AbortController | null = null
  private pendingRequests: Map<number, Promise<ArrayBuffer>> = new Map()

  constructor(url: string, config: NetworkReaderConfig = {}) {
    this.url = url
    this.chunkSize = config.chunkSize ?? 256 * 1024  // 256KB default
    this.maxCacheSize = config.maxCacheSize ?? 50
    this.prefetchCount = config.prefetchCount ?? 3
    this.timeout = config.timeout ?? 30000
  }

  /**
   * Probe the file to get its size via HEAD request
   */
  /**
   * Probe the file to get its size via HEAD request
   * AND verify Range request support
   */
  async probe(): Promise<number> {
    try {
      // Step 1: Get file size via HEAD
      const response = await fetch(this.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(this.timeout)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const contentLength = response.headers.get('Content-Length')
      if (!contentLength) {
        throw new Error('Server did not provide Content-Length header')
      }

      this.fileSize = parseInt(contentLength, 10)
      console.log(`[NetworkReader] File size: ${(this.fileSize / 1024 / 1024).toFixed(2)} MB`)

      // Step 2: Verify Range support with a real request (bytes=0-0)
      // Some servers don't send Accept-Ranges header but do support it.
      // Some consumers might send 200 OK for Range requests (bad).
      try {
        const rangeResponse = await fetch(this.url, {
            headers: { 'Range': 'bytes=0-0' },
            signal: AbortSignal.timeout(5000) // Short timeout for check
        })

        if (rangeResponse.status === 206) {
             console.log('[NetworkReader] Server supports Range requests (verified)')
        } else if (rangeResponse.status === 200) {
             console.warn('[NetworkReader] Server returned 200 OK for Range request. SEEKING WILL FAIL.')
             // We can't throw here because maybe linear playback would still work, 
             // but for a 1.8GB file, seeking to end for metadata will definitely crash/fail.
             // We'll let `fetchChunk` handle the error when it happens.
        } else {
             console.warn(`[NetworkReader] Range check failed with status ${rangeResponse.status}`)
        }
      } catch (e) {
          console.warn('[NetworkReader] Range check verification failed:', e)
      }
      
      return this.fileSize
    } catch (error) {
      throw new Error(`Failed to probe file: ${error}`)
    }
  }

  /**
   * Get file size (must call probe() first)
   */
  get size(): number {
    return this.fileSize
  }

  /**
   * Read bytes from the file at the specified offset
   * This is the main callback for libav.js
   */
  async read(offset: number, length: number): Promise<Uint8Array> {
    if (offset < 0 || offset >= this.fileSize) {
      throw new Error(`Invalid offset: ${offset}`)
    }

    // Clamp length to file bounds
    const actualLength = Math.min(length, this.fileSize - offset)
    
    // Determine which chunks we need
    const startChunk = Math.floor(offset / this.chunkSize)
    const endChunk = Math.floor((offset + actualLength - 1) / this.chunkSize)
    
    // Fetch all required chunks
    const chunks: ArrayBuffer[] = []
    for (let chunkIndex = startChunk; chunkIndex <= endChunk; chunkIndex++) {
      const chunk = await this.getChunk(chunkIndex)
      chunks.push(chunk)
    }

    // Combine chunks and extract requested range
    const combined = this.combineChunks(chunks)
    const startOffset = offset - (startChunk * this.chunkSize)
    const result = new Uint8Array(combined, startOffset, actualLength)

    // Log significant reads (skip small sequential ones to reduce noise if needed, but for now log all)
    // console.log(`[NetworkReader] Read ${length} bytes at ${offset} -> ${result.byteLength} (Chunks: ${startChunk}-${endChunk})`)

    // Trigger prefetch for upcoming chunks (don't await)
    this.prefetch(endChunk + 1, this.prefetchCount).catch(() => {})

    return result
  }

  /**
   * Get a specific chunk, using cache if available
   */
  private async getChunk(chunkIndex: number): Promise<ArrayBuffer> {
    // Check cache first
    const cached = this.cache.get(chunkIndex)
    if (cached) {
      cached.lastAccess = Date.now()
      return cached.data
    }

    // Check if request is already pending
    const pending = this.pendingRequests.get(chunkIndex)
    if (pending) {
      return pending
    }

    // Fetch the chunk
    const promise = this.fetchChunk(chunkIndex)
    this.pendingRequests.set(chunkIndex, promise)

    try {
      const data = await promise
      
      // Cache the result
      this.cache.set(chunkIndex, {
        data,
        lastAccess: Date.now()
      })
      
      // Evict old entries if cache is full
      this.evictCache()
      
      return data
    } finally {
      this.pendingRequests.delete(chunkIndex)
    }
  }

  /**
   * Fetch a chunk from the network
   */
  private async fetchChunk(chunkIndex: number): Promise<ArrayBuffer> {
    const start = chunkIndex * this.chunkSize
    const end = Math.min(start + this.chunkSize - 1, this.fileSize - 1)

    const response = await fetch(this.url, {
      headers: {
        'Range': `bytes=${start}-${end}`
      },
      signal: AbortSignal.timeout(this.timeout)
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // Strict enforcement of Range requests
    // If we asked for a range but got 200 OK, it means the server ignored the Range header
    // and is sending the entire file. For large files, this is catastrophic.
    if (response.status === 200) {
      throw new Error(`Server returned 200 OK (full content) for Range request bytes=${start}-${end}. Aborting to prevent full file download.`)
    }

    if (response.status !== 206) {
      throw new Error(`Unexpected HTTP status ${response.status} for Range request`)
    }

    return response.arrayBuffer()
  }

  /**
   * Prefetch upcoming chunks in the background
   */
  async prefetch(startChunk: number, count: number): Promise<void> {
    const promises: Promise<ArrayBuffer>[] = []
    
    for (let i = 0; i < count; i++) {
      const chunkIndex = startChunk + i
      const maxChunk = Math.ceil(this.fileSize / this.chunkSize)
      
      if (chunkIndex >= maxChunk) break
      if (this.cache.has(chunkIndex)) continue
      
      promises.push(this.getChunk(chunkIndex))
    }

    await Promise.allSettled(promises)
  }

  /**
   * Combine multiple ArrayBuffers into one
   */
  private combineChunks(chunks: ArrayBuffer[]): ArrayBuffer {
    if (chunks.length === 1) {
      return chunks[0]
    }

    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    const combined = new Uint8Array(totalLength)
    let offset = 0

    for (const chunk of chunks) {
      combined.set(new Uint8Array(chunk), offset)
      offset += chunk.byteLength
    }

    return combined.buffer
  }

  /**
   * Evict least recently used cache entries
   */
  private evictCache(): void {
    if (this.cache.size <= this.maxCacheSize) return

    // Sort by last access time
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess)

    // Remove oldest entries
    const toRemove = entries.slice(0, this.cache.size - this.maxCacheSize)
    for (const [key] of toRemove) {
      this.cache.delete(key)
    }
  }

  /**
   * Clear the cache and abort pending requests
   */
  clear(): void {
    this.cache.clear()
    this.pendingRequests.clear()
    this.abortController?.abort()
  }

  /**
   * Destroy the reader
   */
  destroy(): void {
    this.clear()
    this.fileSize = 0
  }

  /**
   * Seek hint - clear cache entries that are far from the new position
   */
  onSeek(newOffset: number): void {
    const newChunk = Math.floor(newOffset / this.chunkSize)
    const keepRange = 10 // Keep chunks within ±10 of seek position

    for (const [chunkIndex] of this.cache) {
      if (Math.abs(chunkIndex - newChunk) > keepRange) {
        this.cache.delete(chunkIndex)
      }
    }
  }

  /**
   * Get cache statistics for debugging
   */
  get stats(): { cacheSize: number; cacheBytes: number; pendingRequests: number } {
    let cacheBytes = 0
    for (const entry of this.cache.values()) {
      cacheBytes += entry.data.byteLength
    }

    return {
      cacheSize: this.cache.size,
      cacheBytes,
      pendingRequests: this.pendingRequests.size
    }
  }
}
