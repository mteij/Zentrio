/**
 * HybridAudioProcessor - AudioWorklet for synchronized audio playback
 * 
 * Reads decoded PCM audio from SharedArrayBuffer ring buffer
 * and outputs to speakers with drift correction.
 * 
 * This file must be loaded as a separate module by AudioWorklet.
 */

// Constants matching AudioRingBuffer
const HEADER_SIZE = 16
const READ_POS_OFFSET = 0
const WRITE_POS_OFFSET = 1

// Drift correction thresholds
const DRIFT_THRESHOLD_MS = 50     // Start correcting at 50ms drift
const MAX_DRIFT_MS = 500          // Force resync at 500ms drift
const CORRECTION_RATE = 0.02      // 2% speed adjustment

interface ProcessorOptions {
  capacity: number
  channels: number
  sampleRate: number
}

/**
 * Ring buffer reader for Worklet context
 */
class WorkletRingBufferReader {
  private positions: Int32Array
  private ptsView: Float64Array
  private samples: Float32Array
  private capacity: number

  constructor(buffer: SharedArrayBuffer, capacity: number) {
    this.capacity = capacity
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
    for (let i = 0; i < firstPart; i++) {
      output[i] = this.samples[readPos + i]
    }
    
    if (firstPart < toRead) {
      for (let i = 0; i < toRead - firstPart; i++) {
        output[firstPart + i] = this.samples[i]
      }
    }

    if (toRead < output.length) {
      for (let i = toRead; i < output.length; i++) {
        output[i] = 0
      }
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

  reset(): void {
    Atomics.store(this.positions, READ_POS_OFFSET, 0)
    Atomics.store(this.positions, WRITE_POS_OFFSET, 0)
  }
}

class HybridAudioProcessor extends AudioWorkletProcessor {
  private reader: WorkletRingBufferReader | null = null
  private channels: number = 2
  private videoClock: number = 0
  private isPlaying: boolean = false
  private lastAudioPts: number = 0
  private driftCorrection: number = 1.0
  private underrunCount: number = 0
  private totalSamplesOutput: number = 0

  constructor(options?: AudioWorkletNodeOptions) {
    super()
    
    const processorOptions = options?.processorOptions as ProcessorOptions | undefined
    if (processorOptions) {
      this.channels = processorOptions.channels
    }

    // Handle messages from main thread
    this.port.onmessage = (event) => {
      const { type, data } = event.data

      switch (type) {
        case 'init':
          // Initialize ring buffer reader with SharedArrayBuffer
          this.reader = new WorkletRingBufferReader(
            data.buffer,
            data.capacity
          )
          this.channels = data.channels
          this.port.postMessage({ type: 'ready' })
          break

        case 'play':
          this.isPlaying = true
          break

        case 'pause':
          this.isPlaying = false
          break

        case 'videoClock':
          // Update video clock for sync
          this.videoClock = data.time
          break

        case 'reset':
          // Reset for seeking
          this.reader?.reset()
          this.lastAudioPts = 0
          this.driftCorrection = 1.0
          this.underrunCount = 0
          break

        case 'destroy':
          this.reader = null
          this.isPlaying = false
          break
      }
    }
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    const output = outputs[0]
    
    // If not initialized or paused, output silence
    if (!this.reader || !this.isPlaying) {
      for (let channel = 0; channel < output.length; channel++) {
        output[channel].fill(0)
      }
      return true
    }

    // Read interleaved samples for all channels
    const frameCount = output[0].length
    const interleavedLength = frameCount * this.channels
    const interleaved = new Float32Array(interleavedLength)
    
    const { samplesRead, pts } = this.reader.read(interleaved)
    
    // Check for buffer underrun
    if (samplesRead === 0) {
      this.underrunCount++
      for (let channel = 0; channel < output.length; channel++) {
        output[channel].fill(0)
      }
      
      // Report underrun every 10 occurrences to avoid spam
      if (this.underrunCount % 10 === 1) {
        this.port.postMessage({
          type: 'underrun',
          data: { count: this.underrunCount }
        })
      }
      return true
    }

    this.lastAudioPts = pts
    this.totalSamplesOutput += samplesRead / this.channels

    // Deinterleave samples to output channels
    for (let frame = 0; frame < frameCount; frame++) {
      for (let channel = 0; channel < Math.min(output.length, this.channels); channel++) {
        const interleavedIndex = frame * this.channels + channel
        if (interleavedIndex < samplesRead) {
          output[channel][frame] = interleaved[interleavedIndex]
        } else {
          output[channel][frame] = 0
        }
      }
    }

    // Fill any extra output channels with silence
    for (let channel = this.channels; channel < output.length; channel++) {
      output[channel].fill(0)
    }

    // Calculate drift between audio and video
    const driftMs = (pts - this.videoClock) * 1000

    if (Math.abs(driftMs) > MAX_DRIFT_MS) {
      // Large drift: report to main thread for hard resync
      this.port.postMessage({
        type: 'drift',
        data: { driftMs, audioTime: pts, videoTime: this.videoClock }
      })
    } else if (driftMs > DRIFT_THRESHOLD_MS) {
      // Audio ahead: slow down slightly
      this.driftCorrection = 1.0 - CORRECTION_RATE
    } else if (driftMs < -DRIFT_THRESHOLD_MS) {
      // Audio behind: speed up slightly
      this.driftCorrection = 1.0 + CORRECTION_RATE
    } else {
      // Within tolerance
      this.driftCorrection = 1.0
    }

    // Report status periodically (every ~1 second at 48kHz with 128-sample frames)
    if (this.totalSamplesOutput % (48000 / 128 * 128) < frameCount) {
      this.port.postMessage({
        type: 'status',
        data: {
          audioTime: pts,
          videoTime: this.videoClock,
          driftMs,
          fillLevel: this.reader.fillLevel,
          underruns: this.underrunCount
        }
      })
    }

    return true
  }
}

registerProcessor('hybrid-audio-processor', HybridAudioProcessor)
