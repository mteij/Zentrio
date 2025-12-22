/**
 * AudioRingBuffer - Lock-free Ring Buffer using SharedArrayBuffer
 * 
 * Enables zero-copy audio sample transfer between main thread 
 * (decoder) and AudioWorklet (output).
 */

// Memory layout:
// [0-3]: Read position (atomic int32)
// [4-7]: Write position (atomic int32)
// [8-15]: Current PTS (float64)
// [16+]: Sample data (float32)

const HEADER_SIZE = 16  // bytes
const READ_POS_OFFSET = 0
const WRITE_POS_OFFSET = 1  // int32 index
const PTS_OFFSET = 0  // float64 index (separate view)

export interface AudioRingBufferConfig {
  sampleRate: number
  channels: number
  durationSeconds: number
}

export class AudioRingBuffer {
  private buffer: SharedArrayBuffer
  private positions: Int32Array
  private ptsView: Float64Array
  private samples: Float32Array
  private capacity: number  // Total samples (all channels)
  private channels: number
  private sampleRate: number

  constructor(config: AudioRingBufferConfig) {
    this.channels = config.channels
    this.sampleRate = config.sampleRate
    
    // Calculate buffer size: samples per second * channels * duration
    this.capacity = config.sampleRate * config.channels * config.durationSeconds
    
    // Allocate SharedArrayBuffer
    const totalBytes = HEADER_SIZE + (this.capacity * Float32Array.BYTES_PER_ELEMENT)
    this.buffer = new SharedArrayBuffer(totalBytes)
    
    // Create views
    this.positions = new Int32Array(this.buffer, 0, 2)
    this.ptsView = new Float64Array(this.buffer, 8, 1)
    this.samples = new Float32Array(this.buffer, HEADER_SIZE, this.capacity)
    
    // Initialize
    this.reset()
    
    console.log(`[AudioRingBuffer] Created: ${config.durationSeconds}s buffer, ${this.capacity} samples, ${(totalBytes / 1024).toFixed(1)}KB`)
  }

  /**
   * Get the underlying SharedArrayBuffer for transfer to Worklet
   */
  getBuffer(): SharedArrayBuffer {
    return this.buffer
  }

  /**
   * Reset buffer state (used for seeking)
   */
  reset(): void {
    Atomics.store(this.positions, READ_POS_OFFSET, 0)
    Atomics.store(this.positions, WRITE_POS_OFFSET, 0)
    this.ptsView[PTS_OFFSET] = 0
  }

  /**
   * Write samples to the buffer (main thread)
   * Returns true if all samples were written, false if buffer is full
   */
  write(samples: Float32Array, pts: number): boolean {
    const readPos = Atomics.load(this.positions, READ_POS_OFFSET)
    const writePos = Atomics.load(this.positions, WRITE_POS_OFFSET)
    
    const available = this.getAvailableForWrite(readPos, writePos)
    
    if (samples.length > available) {
      console.warn(`[AudioRingBuffer] Buffer full, dropping ${samples.length - available} samples`)
      return false
    }

    // Write samples with wraparound
    const firstPart = Math.min(samples.length, this.capacity - writePos)
    this.samples.set(samples.subarray(0, firstPart), writePos)
    
    if (firstPart < samples.length) {
      // Wraparound
      this.samples.set(samples.subarray(firstPart), 0)
    }

    // Update PTS
    this.ptsView[PTS_OFFSET] = pts

    // Update write position atomically
    const newWritePos = (writePos + samples.length) % this.capacity
    Atomics.store(this.positions, WRITE_POS_OFFSET, newWritePos)

    return true
  }

  /**
   * Read samples from the buffer (called from Worklet)
   * Returns number of samples read
   */
  read(output: Float32Array): { samplesRead: number; pts: number } {
    const readPos = Atomics.load(this.positions, READ_POS_OFFSET)
    const writePos = Atomics.load(this.positions, WRITE_POS_OFFSET)
    
    const available = this.getAvailableForRead(readPos, writePos)
    const toRead = Math.min(output.length, available)
    
    if (toRead === 0) {
      // Buffer empty, fill with silence
      output.fill(0)
      return { samplesRead: 0, pts: this.ptsView[PTS_OFFSET] }
    }

    // Read samples with wraparound
    const firstPart = Math.min(toRead, this.capacity - readPos)
    output.set(this.samples.subarray(readPos, readPos + firstPart))
    
    if (firstPart < toRead) {
      // Wraparound
      output.set(this.samples.subarray(0, toRead - firstPart), firstPart)
    }

    // Fill remaining with silence if needed
    if (toRead < output.length) {
      output.fill(0, toRead)
    }

    // Update read position atomically
    const newReadPos = (readPos + toRead) % this.capacity
    Atomics.store(this.positions, READ_POS_OFFSET, newReadPos)

    return {
      samplesRead: toRead,
      pts: this.ptsView[PTS_OFFSET]
    }
  }

  /**
   * Get available space for writing
   */
  private getAvailableForWrite(readPos: number, writePos: number): number {
    if (writePos >= readPos) {
      return this.capacity - (writePos - readPos) - 1
    }
    return readPos - writePos - 1
  }

  /**
   * Get available samples for reading
   */
  private getAvailableForRead(readPos: number, writePos: number): number {
    if (writePos >= readPos) {
      return writePos - readPos
    }
    return this.capacity - readPos + writePos
  }

  /**
   * Get current buffer fill level (0-1)
   */
  get fillLevel(): number {
    const readPos = Atomics.load(this.positions, READ_POS_OFFSET)
    const writePos = Atomics.load(this.positions, WRITE_POS_OFFSET)
    return this.getAvailableForRead(readPos, writePos) / this.capacity
  }

  /**
   * Get buffer duration in seconds
   */
  get bufferedSeconds(): number {
    const readPos = Atomics.load(this.positions, READ_POS_OFFSET)
    const writePos = Atomics.load(this.positions, WRITE_POS_OFFSET)
    const samples = this.getAvailableForRead(readPos, writePos)
    return samples / (this.sampleRate * this.channels)
  }
}

/**
 * Static class for Worklet-side ring buffer reading
 * (Cannot instantiate AudioRingBuffer in Worklet due to constructor limitations)
 */
export class RingBufferReader {
  private positions: Int32Array
  private ptsView: Float64Array
  private samples: Float32Array
  private capacity: number
  private channels: number
  private sampleRate: number

  constructor(
    buffer: SharedArrayBuffer,
    capacity: number,
    channels: number,
    sampleRate: number
  ) {
    this.capacity = capacity
    this.channels = channels
    this.sampleRate = sampleRate
    
    this.positions = new Int32Array(buffer, 0, 2)
    this.ptsView = new Float64Array(buffer, 8, 1)
    this.samples = new Float32Array(buffer, HEADER_SIZE, capacity)
  }

  read(output: Float32Array): { samplesRead: number; pts: number } {
    const readPos = Atomics.load(this.positions, READ_POS_OFFSET)
    const writePos = Atomics.load(this.positions, WRITE_POS_OFFSET)
    
    let available: number
    if (writePos >= readPos) {
      available = writePos - readPos
    } else {
      available = this.capacity - readPos + writePos
    }
    
    const toRead = Math.min(output.length, available)
    
    if (toRead === 0) {
      output.fill(0)
      return { samplesRead: 0, pts: this.ptsView[0] }
    }

    const firstPart = Math.min(toRead, this.capacity - readPos)
    output.set(this.samples.subarray(readPos, readPos + firstPart))
    
    if (firstPart < toRead) {
      output.set(this.samples.subarray(0, toRead - firstPart), firstPart)
    }

    if (toRead < output.length) {
      output.fill(0, toRead)
    }

    const newReadPos = (readPos + toRead) % this.capacity
    Atomics.store(this.positions, READ_POS_OFFSET, newReadPos)

    return {
      samplesRead: toRead,
      pts: this.ptsView[0]
    }
  }

  get fillLevel(): number {
    const readPos = Atomics.load(this.positions, READ_POS_OFFSET)
    const writePos = Atomics.load(this.positions, WRITE_POS_OFFSET)
    
    let available: number
    if (writePos >= readPos) {
      available = writePos - readPos
    } else {
      available = this.capacity - readPos + writePos
    }
    
    return available / this.capacity
  }
}
