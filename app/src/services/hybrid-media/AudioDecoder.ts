/**
 * AudioDecoder - WASM Audio Decoder using libav.js
 * 
 * Decodes compressed audio packets to PCM and writes to ring buffer.
 */

import type { AudioPacket, DecodedAudioFrame, AudioDecoderConfig, CodecInfo } from './types'
import { AudioRingBuffer } from './AudioRingBuffer'

export class AudioDecoder extends EventTarget {
  private libav: any = null
  private codecCtx: number = 0
  private frame: number = 0
  private packet: number = 0
  private ringBuffer: AudioRingBuffer
  private sampleRate: number
  private channels: number
  private isInitialized: boolean = false
  private decodedFrameCount: number = 0
  private codecId: number = 0

  constructor(
    ringBuffer: AudioRingBuffer,
    config: AudioDecoderConfig = {}
  ) {
    super()
    this.ringBuffer = ringBuffer
    this.sampleRate = config.sampleRate ?? 48000
    this.channels = config.channels ?? 2
  }

  /**
   * Initialize the decoder with codec information
   */
  async initialize(libav: any, codecInfo: CodecInfo, codecParams: number): Promise<void> {
    this.libav = libav
    this.codecId = codecInfo.codecId

    // Find decoder
    const codec = await libav.avcodec_find_decoder(codecInfo.codecId)
    if (!codec) {
      throw new Error(`No decoder found for codec: ${codecInfo.codecName}`)
    }

    // Allocate context
    this.codecCtx = await libav.avcodec_alloc_context3(codec)
    if (!this.codecCtx) {
      throw new Error('Failed to allocate codec context')
    }

    // Copy parameters
    const ret = await libav.avcodec_parameters_to_context(this.codecCtx, codecParams)
    if (ret < 0) {
      throw new Error(`Failed to copy codec parameters: ${ret}`)
    }

    // Open decoder
    const openRet = await libav.avcodec_open2(this.codecCtx, codec, 0)
    if (openRet < 0) {
      throw new Error(`Failed to open decoder: ${openRet}`)
    }

    // Allocate frame and packet
    this.frame = await libav.av_frame_alloc()
    this.packet = await libav.av_packet_alloc()

    if (!this.frame || !this.packet) {
      throw new Error('Failed to allocate frame or packet')
    }

    this.isInitialized = true
    console.log(`[AudioDecoder] Initialized for codec: ${codecInfo.codecName}`)
  }

  /**
   * Decode an audio packet
   */
  async decode(audioPacket: AudioPacket): Promise<DecodedAudioFrame[]> {
    if (!this.isInitialized || !this.libav) {
      throw new Error('Decoder not initialized')
    }

    const frames: DecodedAudioFrame[] = []
    const libav = this.libav

    try {
      // Create a packet object matching what libav.js expects
      const pktData = {
        data: audioPacket.data,
        pts: Math.round(audioPacket.pts * 1000000), // Convert to microseconds
        dts: Math.round(audioPacket.dts * 1000000),
      }

      // Use ff_decode_multi which is a higher-level API
      // It handles send_packet and receive_frame internally
      const [status, decodedFrames] = await libav.ff_decode_multi(
        this.codecCtx,
        this.packet,
        this.frame,
        [pktData],
        false // not EOF
      )

      if (status < 0) {
        console.warn(`[AudioDecoder] Decode error: ${status}`)
        return frames
      }

      // Process decoded frames
      for (const frameData of decodedFrames) {
        // frameData.data is an array of Float32Arrays (one per channel)
        // frameData.sample_rate, frameData.channels, frameData.nb_samples are available
        
        const decodedFrame: DecodedAudioFrame = {
          samples: frameData.data || [],
          pts: audioPacket.pts + (this.decodedFrameCount * (frameData.nb_samples || 1024) / (frameData.sample_rate || this.sampleRate)),
          sampleRate: frameData.sample_rate || this.sampleRate,
          channels: frameData.channels || this.channels,
          samplesPerChannel: frameData.nb_samples || 1024
        }

        frames.push(decodedFrame)
        this.decodedFrameCount++

        // Write to ring buffer
        this.writeToRingBuffer(decodedFrame)
      }
    } catch (error) {
      console.warn('[AudioDecoder] Decode exception:', error)
    }

    return frames
  }

  /**
   * Write decoded frame to ring buffer (interleaved)
   */
  private writeToRingBuffer(frame: DecodedAudioFrame): void {
    if (!frame.samples || frame.samples.length === 0) {
      return
    }

    // Interleave channels
    const interleaved = new Float32Array(frame.samplesPerChannel * frame.channels)
    
    for (let sample = 0; sample < frame.samplesPerChannel; sample++) {
      for (let channel = 0; channel < frame.channels; channel++) {
        const interleavedIndex = sample * frame.channels + channel
        interleaved[interleavedIndex] = frame.samples[channel]?.[sample] ?? 0
      }
    }

    // Write to buffer
    const written = this.ringBuffer.write(interleaved, frame.pts)
    
    if (!written) {
      this.dispatchEvent(new CustomEvent('bufferFull', {
        detail: { droppedSamples: interleaved.length }
      }))
    }
  }

  /**
   * Flush decoder buffers (for seeking)
   */
  async flush(): Promise<void> {
    if (this.isInitialized && this.libav) {
      await this.libav.avcodec_flush_buffers(this.codecCtx)
      this.decodedFrameCount = 0
    }
  }

  /**
   * Destroy the decoder and free resources
   */
  async destroy(): Promise<void> {
    if (this.libav) {
      if (this.frame) {
        await this.libav.av_frame_free_js(this.frame)
        this.frame = 0
      }
      if (this.packet) {
        await this.libav.av_packet_free_js(this.packet)
        this.packet = 0
      }
      // Note: codecCtx cleanup handled by libav
      this.codecCtx = 0
    }
    this.isInitialized = false
    this.libav = null
  }

  get initialized(): boolean {
    return this.isInitialized
  }
}
