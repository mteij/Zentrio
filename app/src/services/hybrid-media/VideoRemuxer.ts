/**
 * VideoRemuxer - fMP4 Remuxer for MSE
 * 
 * Takes raw H.264/HEVC packets from the demuxer and wraps them in
 * fMP4 segments for Media Source Extensions playback.
 * 
 * Handles Annex-B to AVCC conversion for compatibility.
 */

import type { VideoPacket, CodecInfo, VideoRemuxerConfig } from './types'

// NAL unit type constants
const NAL_TYPE_SPS = 7
const NAL_TYPE_PPS = 8
const NAL_TYPE_IDR = 5
const NAL_TYPE_SLICE = 1

// Start code patterns
const START_CODE_3 = new Uint8Array([0x00, 0x00, 0x01])
const START_CODE_4 = new Uint8Array([0x00, 0x00, 0x00, 0x01])

interface NALUnit {
  type: number
  data: Uint8Array
}

export class VideoRemuxer extends EventTarget {
  private mediaSource: MediaSource | null = null
  private sourceBuffer: SourceBuffer | null = null
  private videoElement: HTMLVideoElement | null = null
  private codecInfo: CodecInfo | null = null
  private isAnnexB: boolean = false
  private sps: Uint8Array | null = null

  private pps: Uint8Array | null = null
  private vps: Uint8Array | null = null
  private hvcC: Uint8Array | null = null
  private isInitialized: boolean = false
  private pendingSegments: ArrayBuffer[] = []
  private isAppending: boolean = false
  private segmentDuration: number
  private mp4box: any | null = null
  private initSegmentGenerated: boolean = false
  private baseMediaDecodeTime: number = 0

  private sequenceNumber: number = 0
  private width: number = 0
  private height: number = 0
  private nalLengthSize: number = 4

  constructor(config: VideoRemuxerConfig = {}) {
    super()
    this.segmentDuration = config.segmentDuration ?? 1
  }

  /**
   * Attach to a video element and set up MSE
   */
  async attach(video: HTMLVideoElement, codecInfo: CodecInfo, width?: number, height?: number): Promise<void> {
    this.videoElement = video
    this.codecInfo = codecInfo
    if (width) this.width = width
    if (height) this.height = height

    // Import mp4box.js dynamically
    try {
      const MP4Box = await import('mp4box')
      this.mp4box = MP4Box.default || MP4Box
    } catch (error) {
      console.warn('[VideoRemuxer] mp4box.js not available, using fallback', error)
    }

    // Create MediaSource
    this.mediaSource = new MediaSource()
    
    return new Promise((resolve, reject) => {
      const handleSourceOpen = async () => {
        try {
          this.mediaSource!.removeEventListener('sourceopen', handleSourceOpen)
          
          // Create SourceBuffer with codec string
          const mimeType = `video/mp4; codecs="${codecInfo.codecString}"`
          
          if (!MediaSource.isTypeSupported(mimeType)) {
            throw new Error(`MIME type not supported: ${mimeType}`)
          }

          this.sourceBuffer = this.mediaSource!.addSourceBuffer(mimeType)
          this.sourceBuffer.mode = 'segments'
          
          this.sourceBuffer.addEventListener('updateend', () => {
            this.isAppending = false
            this.flushPendingSegments()
          })

          this.sourceBuffer.addEventListener('error', (e: Event) => {
            const sb = e.target as SourceBuffer
            console.error('[VideoRemuxer] SourceBuffer error event:', e)
            console.error('[VideoRemuxer] SourceBuffer error object:', (sb as any)?.error)
            console.error('[VideoRemuxer] MediaSource readyState:', this.mediaSource?.readyState)
            this.dispatchEvent(new CustomEvent('error', { detail: { error: e } }))
          })

          this.isInitialized = true
          console.log(`[VideoRemuxer] Initialized with codec: ${codecInfo.codecString}`)
          
          // Process extradata immediately if available
          if (codecInfo.extradata && codecInfo.extradata.length > 0) {
            console.log('[VideoRemuxer] Processing extradata for SPS/PPS')
            try {
              // Try to detect format of extradata
              const isAnnexB = this.detectAnnexB(codecInfo.extradata)
              
              if (isAnnexB) {
                const nalUnits = this.parseAnnexB(codecInfo.extradata)
                for (const nal of nalUnits) {
                  if (nal.type === NAL_TYPE_SPS) this.sps = nal.data
                  if (nal.type === NAL_TYPE_PPS) this.pps = nal.data
                }
              } else {
                // AVCC (H.264) or HVCC (H.265) parsing
                console.log('[VideoRemuxer] Extradata is not Annex-B, attempting configuration record parsing')
                
                if (codecInfo.codecId === 173) { // HEVC
                   // Parse hvcC
                   try {
                     this.hvcC = codecInfo.extradata // Store raw hvcC
                     const parser = new DataView(codecInfo.extradata.buffer, codecInfo.extradata.byteOffset, codecInfo.extradata.byteLength)
                     // Skip header (22 bytes for hvcC)
                     if (codecInfo.extradata.length > 22) {
                       // Parse NAL unit length size (minus one) from hvcC header (byte 21, last 2 bits)
                       // format: [ver][profile_space...][...][lengthSizeMinusOne]
                       // actually it's byte 21 (0-indexed) & 0x03
                       this.nalLengthSize = (codecInfo.extradata[21] & 0x03) + 1
                       console.log(`[VideoRemuxer] HEVC NAL length size: ${this.nalLengthSize}`)

                       const numOfArrays = parser.getUint8(22)
                       let offset = 23
                       
                       for (let i = 0; i < numOfArrays; i++) {
                         if (offset >= codecInfo.extradata.length) break
                         const type = parser.getUint8(offset) & 0x3f
                         const numNalus = parser.getUint16(offset + 1)
                         offset += 3
                         
                         for (let j = 0; j < numNalus; j++) {
                           if (offset + 2 > codecInfo.extradata.length) break
                           const len = parser.getUint16(offset)
                           offset += 2
                           if (offset + len > codecInfo.extradata.length) break
                           
                           const nalData = codecInfo.extradata.slice(offset, offset + len)
                           
                           if (type === 32) this.vps = nalData // VPS
                           if (type === 33) this.sps = nalData // SPS
                           if (type === 34) this.pps = nalData // PPS
                           
                           offset += len
                         }
                       }
                     }
                   } catch (e) {
                     console.warn('[VideoRemuxer] Failed to parse hvcC extradata:', e)
                   }
                } else if (codecInfo.codecId === 27) { // H.264
                   // Parse avcC
                   try {
                     const parser = new DataView(codecInfo.extradata.buffer, codecInfo.extradata.byteOffset, codecInfo.extradata.byteLength)
                     // Skip version, profile, etc. (5 bytes)
                     // byte 4 is lengthSizeMinusOne & 0x3
                     // byte 5 is (sps_count & 0x1f)
                     if (codecInfo.extradata.length > 6) {
                        const spsCount = parser.getUint8(5) & 0x1f
                        let offset = 6
                        
                        for (let i = 0; i < spsCount; i++) {
                           const len = parser.getUint16(offset)
                           offset += 2
                           this.sps = codecInfo.extradata.slice(offset, offset + len)
                           offset += len
                        }
                        
                        const ppsCount = parser.getUint8(offset)
                        offset++
                        for (let i = 0; i < ppsCount; i++) {
                           const len = parser.getUint16(offset)
                           offset += 2
                           this.pps = codecInfo.extradata.slice(offset, offset + len)
                           offset += len
                        }
                     }
                   } catch (e) {
                     console.warn('[VideoRemuxer] Failed to parse avcC extradata:', e)
                   }
                }
              }
              
              if (this.sps && this.pps) {
                console.log('[VideoRemuxer] SPS/PPS extracted from extradata')
              }
              
              // If we have VPS (HEVC), we're good
              if (this.vps) {
                 console.log('[VideoRemuxer] VPS extracted properly')
              }
            } catch (e) {
              console.error('[VideoRemuxer] Failed to parse extradata:', e)
            }
          } else {
             console.warn('[VideoRemuxer] No extradata available during attach.')
          }

          // If pixel format is missing/unspecified, warn but proceed. 
          // MediaMetadata often doesn't need it for basic playback if container is right.
          // If pixel format is missing/unspecified, warn but proceed. 
          // MediaMetadata often doesn't need it for basic playback if container is right.
          if (!this.width || !this.height) {
              console.warn('[VideoRemuxer] Video dimensions missing, might cause playback issues.')
          }
          
          resolve()
        } catch (error) {
          reject(error)
        }
      }

      this.mediaSource!.addEventListener('sourceopen', handleSourceOpen)
      video.src = URL.createObjectURL(this.mediaSource!)
    })
  }

  /**
   * Process a video packet from the demuxer
   */
  async push(packet: VideoPacket): Promise<void> {
    // Silently drop packets if not properly initialized or MediaSource is closed
    if (!this.isInitialized || !this.mediaSource || this.mediaSource.readyState !== 'open') {
      return
    }

    // Detect Annex-B format on first packet if not already known/decided
    // If we already have SPS/PPS from extradata, we might still need to know packet format
    // to strip start codes if necessary
    if (!this.initSegmentGenerated || this.isAnnexB === undefined) {
      const packetIsAnnexB = this.detectAnnexB(packet.data)
      
      // Only log if it changes or is first detection
      if (this.isAnnexB !== packetIsAnnexB) {
         this.isAnnexB = packetIsAnnexB
         console.log(`[VideoRemuxer] Packet format detected: ${this.isAnnexB ? 'Annex-B' : 'AVCC'}`)
      }
    }

    let naluData: Uint8Array

    if (this.isAnnexB) {
      // Parse NAL units and extract SPS/PPS
      const nalUnits = this.parseAnnexB(packet.data)
      
      for (const nal of nalUnits) {
        if (nal.type === NAL_TYPE_SPS) {
          this.sps = nal.data
        } else if (nal.type === NAL_TYPE_PPS) {
          this.pps = nal.data
        }
      }

      // Convert to AVCC format
      naluData = this.convertToAVCC(nalUnits)
    } else {
      // If it's already AVCC/HVCC, ensure it uses 4-byte length prefixes
      // This is crucial because some containers/streams use 2-byte prefixes
      // but our generated config (hvcC/avcC) says 4 bytes.
      if (this.codecInfo?.codecId === 173 && this.nalLengthSize !== 4) {
         naluData = this.ensureFourBytePrefix(packet.data, this.nalLengthSize)
      } else {
         naluData = packet.data
      }
    }

    // Generate init segment on first keyframe
    if (!this.initSegmentGenerated && packet.isKeyframe) {
      if (this.sps && this.pps) {
        const initSegment = this.generateInitSegment()
        this.appendSegment(initSegment)
        this.initSegmentGenerated = true
        this.baseMediaDecodeTime = Math.round(packet.pts * 90000) // Convert to 90kHz
      } else {
        // Wait for SPS/PPS
        console.log('[VideoRemuxer] Waiting for SPS/PPS...')
        return
      }
    }

    if (!this.initSegmentGenerated) {
      // Still waiting for init segment
      return
    }

    // Generate moof/mdat segment
    const segment = this.generateMediaSegment(naluData, packet)

    // DEBUG LOGGING (Reduced frequency or disabled)
    // if (this.sequenceNumber % 30 === 0) {
    //   console.log(`[VideoRemuxer] Pushing segment #${this.sequenceNumber}`, {
    //      pts: packet.pts,
    //      dts: packet.dts,
    //      baseMediaDecodeTime: this.baseMediaDecodeTime,
    //      segmentSize: segment.byteLength
    //   })
    // }
    
    this.appendSegment(segment)
  }

  /**
   * Detect if data is in Annex-B format
   */
  private detectAnnexB(data: Uint8Array): boolean {
    // Check for start codes
    if (data.length >= 4) {
      if (data[0] === 0 && data[1] === 0 && data[2] === 0 && data[3] === 1) {
        return true
      }
      if (data[0] === 0 && data[1] === 0 && data[2] === 1) {
        return true
      }
    }
    return false
  }

  /**
   * Parse Annex-B format into NAL units
   */
  private parseAnnexB(data: Uint8Array): NALUnit[] {
    const nalUnits: NALUnit[] = []
    let offset = 0

    while (offset < data.length) {
      // Find start code
      let startCodeLength = 0
      if (offset + 4 <= data.length && 
          data[offset] === 0 && data[offset + 1] === 0 && 
          data[offset + 2] === 0 && data[offset + 3] === 1) {
        startCodeLength = 4
      } else if (offset + 3 <= data.length && 
                 data[offset] === 0 && data[offset + 1] === 0 && data[offset + 2] === 1) {
        startCodeLength = 3
      } else {
        offset++
        continue
      }

      // Find next start code or end of data
      let nextStart = data.length
      for (let i = offset + startCodeLength; i < data.length - 2; i++) {
        if ((data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) ||
            (i < data.length - 3 && data[i] === 0 && data[i + 1] === 0 && 
             data[i + 2] === 0 && data[i + 3] === 1)) {
          nextStart = i
          break
        }
      }

      // Extract NAL unit
      const nalData = data.slice(offset + startCodeLength, nextStart)
      if (nalData.length > 0) {
        const nalType = nalData[0] & 0x1f
        nalUnits.push({ type: nalType, data: nalData })
      }

      offset = nextStart
    }

    return nalUnits
  }

  /**
   * Convert NAL units from Annex-B to AVCC format
   */
  private convertToAVCC(nalUnits: NALUnit[]): Uint8Array {
    // Calculate total size
    let totalSize = 0
    for (const nal of nalUnits) {
      totalSize += 4 + nal.data.length // 4-byte length prefix
    }

    const result = new Uint8Array(totalSize)
    let offset = 0

    for (const nal of nalUnits) {
      // Write 4-byte length prefix (big-endian)
      const length = nal.data.length
      result[offset] = (length >> 24) & 0xff
      result[offset + 1] = (length >> 16) & 0xff
      result[offset + 2] = (length >> 8) & 0xff
      result[offset + 3] = length & 0xff
      offset += 4

      // Write NAL data
      result.set(nal.data, offset)
      offset += nal.data.length
    }

    return result
  }

  /**
   * Generate fMP4 init segment (ftyp + moov)
   */
  private generateInitSegment(): ArrayBuffer {
    if (!this.sps || !this.pps || !this.codecInfo) {
      throw new Error('Cannot generate init segment without SPS/PPS')
    }

    // Parse SPS for dimensions
    const spsInfo = this.parseSPS(this.sps)
    
    // Build the init segment manually
    const ftyp = this.buildFtyp()
    const moov = this.buildMoov(spsInfo)
    
    // Combine
    const result = new Uint8Array(ftyp.byteLength + moov.byteLength)
    result.set(new Uint8Array(ftyp), 0)
    result.set(new Uint8Array(moov), ftyp.byteLength)
    
    return result.buffer
  }

  /**
   * Build ftyp box
   */
  private buildFtyp(): ArrayBuffer {
    // ftyp: isom + iso5, isom, iso5, dash, mp41
    const brands = ['isom', 'iso5', 'dash', 'mp41']
    const size = 8 + 8 + brands.length * 4
    const buffer = new ArrayBuffer(size)
    const view = new DataView(buffer)
    
    let offset = 0
    view.setUint32(offset, size); offset += 4
    view.setUint32(offset, 0x66747970); offset += 4 // 'ftyp'
    view.setUint32(offset, 0x69736F6D); offset += 4 // 'isom' major brand
    view.setUint32(offset, 0x00000001); offset += 4 // minor version
    
    for (const brand of brands) {
      for (let i = 0; i < 4; i++) {
        view.setUint8(offset + i, brand.charCodeAt(i))
      }
      offset += 4
    }
    
    return buffer
  }

  /**
   * Build moov box (simplified)
   */
  private buildMoov(spsInfo: { width: number; height: number }): ArrayBuffer {
    // This is a simplified moov builder
    // For production, use mp4box.js or a proper muxer library
    
    const { width, height } = spsInfo
    const timescale = 90000
    const duration = 0 // Unknown

    // Build codec configuration
    let codecConfig: ArrayBuffer
    let sampleEntry: ArrayBuffer

    if (this.codecInfo?.codecId === 173) { // HEVC
      // Prefer the original hvcC from extradata as it's authoritative
      // Only rebuild if missing
      if (this.hvcC) {
        codecConfig = this.box('hvcC', this.hvcC)
      } else {
        codecConfig = this.buildHvcC()
      }
      sampleEntry = this.buildHev1(width, height, codecConfig)
    } else { // Default to H.264
      codecConfig = this.buildAvcC()
      sampleEntry = this.buildAvc1(width, height, codecConfig)
    }
    
    // Build stsd
    const stsd = this.box('stsd', this.concat([
      new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]), // version, flags, entry_count
      new Uint8Array(sampleEntry)
    ]))
    
    // Empty stts, stsc, stsz, stco
    const stts = this.box('stts', new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]))
    const stsc = this.box('stsc', new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]))
    const stsz = this.box('stsz', new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))
    const stco = this.box('stco', new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]))
    
    // stbl
    const stbl = this.box('stbl', this.concat([
      new Uint8Array(stsd),
      new Uint8Array(stts),
      new Uint8Array(stsc),
      new Uint8Array(stsz),
      new Uint8Array(stco)
    ]))
    
    // dinf with dref
    const url = this.box('url ', new Uint8Array([0, 0, 0, 1])) // self-contained
    const dref = this.box('dref', this.concat([
      new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]),
      new Uint8Array(url)
    ]))
    const dinf = this.box('dinf', new Uint8Array(dref))
    
    // vmhd
    const vmhd = this.box('vmhd', new Uint8Array([
      0, 0, 0, 1, // version, flags (self-contained)
      0, 0, 0, 0, 0, 0, 0, 0 // graphics mode, opcolor
    ]))
    
    // minf
    const minf = this.box('minf', this.concat([
      new Uint8Array(vmhd),
      new Uint8Array(dinf),
      new Uint8Array(stbl)
    ]))
    
    // hdlr for video
    const hdlr = this.box('hdlr', this.concat([
      new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0]), // version, flags, pre_defined
      this.str('vide'),
      new Uint8Array(12), // reserved
      this.str('VideoHandler'), new Uint8Array([0])
    ]))
    
    // mdhd
    const mdhd = new ArrayBuffer(32)
    const mdhdView = new DataView(mdhd)
    mdhdView.setUint32(0, 32) // size
    mdhdView.setUint32(4, 0x6D646864) // 'mdhd'
    mdhdView.setUint32(8, 0) // version, flags
    mdhdView.setUint32(12, 0) // creation_time
    mdhdView.setUint32(16, 0) // modification_time
    mdhdView.setUint32(20, timescale)
    mdhdView.setUint32(24, duration)
    mdhdView.setUint32(28, 0x55C40000) // language 'und', pre_defined

    // mdia
    const mdia = this.box('mdia', this.concat([
      new Uint8Array(mdhd),
      new Uint8Array(hdlr),
      new Uint8Array(minf)
    ]))
    
    // tkhd
    const tkhd = new ArrayBuffer(92)
    const tkhdView = new DataView(tkhd)
    tkhdView.setUint32(0, 92) // size
    tkhdView.setUint32(4, 0x746B6864) // 'tkhd'
    tkhdView.setUint32(8, 0x00000003) // version 0, flags (enabled + in movie)
    tkhdView.setUint32(12, 0) // creation_time
    tkhdView.setUint32(16, 0) // modification_time
    tkhdView.setUint32(20, 1) // track_id
    tkhdView.setUint32(24, 0) // reserved
    tkhdView.setUint32(28, duration)
    // reserved (8 bytes), then layer, alternate_group, volume
    tkhdView.setUint16(80, 0) // layer
    tkhdView.setUint16(82, 0) // alternate_group
    tkhdView.setUint16(84, 0) // volume
    // Matrix (36 bytes at offset 48)
    // Identity matrix for video
    tkhdView.setUint32(48, 0x00010000)
    tkhdView.setUint32(64, 0x00010000)
    tkhdView.setUint32(76, 0x40000000)
    // Width and height (16.16 fixed point)
    tkhdView.setUint32(84, width << 16)
    tkhdView.setUint32(88, height << 16)
    
    // trak
    const trak = this.box('trak', this.concat([
      new Uint8Array(tkhd),
      new Uint8Array(mdia)
    ]))
    
    // mvhd
    const mvhd = new ArrayBuffer(108)
    const mvhdView = new DataView(mvhd)
    mvhdView.setUint32(0, 108) // size
    mvhdView.setUint32(4, 0x6D766864) // 'mvhd'
    mvhdView.setUint32(8, 0) // version, flags
    mvhdView.setUint32(12, 0) // creation_time
    mvhdView.setUint32(16, 0) // modification_time
    mvhdView.setUint32(20, timescale)
    mvhdView.setUint32(24, duration)
    mvhdView.setUint32(28, 0x00010000) // rate (1.0)
    mvhdView.setUint16(32, 0x0100) // volume (1.0)
    // reserved + matrix + pre_defined
    mvhdView.setUint32(48, 0x00010000) // matrix[0]
    mvhdView.setUint32(64, 0x00010000) // matrix[4]
    mvhdView.setUint32(80, 0x40000000) // matrix[8]
    mvhdView.setUint32(104, 2) // next_track_id
    
    // mvex with trex
    const trex = this.box('trex', new Uint8Array([
      0, 0, 0, 0, // version, flags
      0, 0, 0, 1, // track_id
      0, 0, 0, 1, // default_sample_description_index
      0, 0, 0, 0, // default_sample_duration
      0, 0, 0, 0, // default_sample_size
      0, 0, 0, 0  // default_sample_flags
    ]))
    const mvex = this.box('mvex', new Uint8Array(trex))
    
    // moov
    return this.box('moov', this.concat([
      new Uint8Array(mvhd),
      new Uint8Array(trak),
      new Uint8Array(mvex)
    ]))
  }

  /**
   * Build avcC box
   */
  private buildAvcC(): ArrayBuffer {
    if (!this.sps || !this.pps) {
      throw new Error('SPS/PPS required for avcC')
    }

    if (this.sps.length < 4) {
      throw new Error(`Invalid SPS length: ${this.sps.length}`)
    }

    // Check for start code prefix in SPS/PPS and strip it if necessary
    // Some demuxers might leave 00 00 00 01 in the data
    let sps = this.sps
    if (sps[0] === 0 && sps[1] === 0 && sps[2] === 0 && sps[3] === 1) {
      sps = sps.subarray(4)
    } else if (sps[0] === 0 && sps[1] === 0 && sps[2] === 1) {
      sps = sps.subarray(3)
    }

    let pps = this.pps
    if (pps[0] === 0 && pps[1] === 0 && pps[2] === 0 && pps[3] === 1) {
      pps = pps.subarray(4)
    } else if (pps[0] === 0 && pps[1] === 0 && pps[2] === 1) {
      pps = pps.subarray(3)
    }

    const size = 8 + 7 + 2 + sps.length + 1 + 2 + pps.length
    const buffer = new ArrayBuffer(size)
    const view = new DataView(buffer)
    const arr = new Uint8Array(buffer)
    
    let offset = 0
    view.setUint32(offset, size); offset += 4
    view.setUint32(offset, 0x61766343); offset += 4 // 'avcC'
    
    view.setUint8(offset++, 1) // configurationVersion
    view.setUint8(offset++, sps[1]) // AVCProfileIndication
    view.setUint8(offset++, sps[2]) // profile_compatibility
    view.setUint8(offset++, sps[3]) // AVCLevelIndication
    view.setUint8(offset++, 0xff) // lengthSizeMinusOne (3 = 4 bytes)
    view.setUint8(offset++, 0xe1) // numOfSequenceParameterSets
    view.setUint16(offset, sps.length); offset += 2
    arr.set(sps, offset); offset += sps.length
    view.setUint8(offset++, 1) // numOfPictureParameterSets
    view.setUint16(offset, pps.length); offset += 2
    arr.set(pps, offset)
    
    return buffer
  }

  /**
   * Build avc1 sample entry
   */
  private buildAvc1(width: number, height: number, avcC: ArrayBuffer): ArrayBuffer {
    const size = 8 + 78 + avcC.byteLength
    const buffer = new ArrayBuffer(size)
    const view = new DataView(buffer)
    const arr = new Uint8Array(buffer)
    
    let offset = 0
    view.setUint32(offset, size); offset += 4
    view.setUint32(offset, 0x61766331); offset += 4 // 'avc1'
    
    offset += 6 // reserved
    view.setUint16(offset, 1); offset += 2 // data_reference_index
    offset += 16 // pre_defined, reserved
    view.setUint16(offset, width); offset += 2
    view.setUint16(offset, height); offset += 2
    view.setUint32(offset, 0x00480000); offset += 4 // horizresolution (72 dpi)
    view.setUint32(offset, 0x00480000); offset += 4 // vertresolution (72 dpi)
    offset += 4 // reserved
    view.setUint16(offset, 1); offset += 2 // frame_count
    offset += 32 // compressorname
    view.setUint16(offset, 0x0018); offset += 2 // depth
    view.setInt16(offset, -1); offset += 2 // pre_defined
    
    arr.set(new Uint8Array(avcC), offset)
    
    return buffer
  }

  /**
   * Build hvcC box (HEVC)
   */
  private buildHvcC(): ArrayBuffer {
    if (!this.sps || !this.pps || !this.vps) {
      throw new Error('VPS/SPS/PPS required for hvcC')
    }

    // Simplified hvcC builder
    // Ref: ISO/IEC 14496-15

    const vps = this.stripStartCode(this.vps)
    const sps = this.stripStartCode(this.sps)
    const pps = this.stripStartCode(this.pps)

    // Calculate size
    // Header (23 bytes) + Arrays
    // Each array: 3 bytes header + (2 bytes len + data len) per NAL
    const size = 23 + 
                 3 + 2 + vps.length + 
                 3 + 2 + sps.length + 
                 3 + 2 + pps.length

    const buffer = new ArrayBuffer(size + 8) // +8 for box header
    const view = new DataView(buffer)
    const arr = new Uint8Array(buffer)
    
    let offset = 0
    view.setUint32(offset, size + 8); offset += 4
    view.setUint32(offset, 0x68766343); offset += 4 // 'hvcC'
    
    // Configuration Version
    view.setUint8(offset++, 1)
    
    // Profile/Tier/Level
    // Use values from CodecInfo if available, otherwise defaults
    const profileIdc = this.codecInfo?.profileId ?? 1 // Default Main
    const levelIdc = this.codecInfo?.level ?? 120 // Default 4.0
    const bitDepth = this.codecInfo?.bitDepth ?? 8
    
    view.setUint8(offset++, 1) // general_profile_space=0, tier=0, profile=profileIdc
    // Overwrite the profile_idc (lower 5 bits of first byte)
    // Actually the first byte is: [space:2][tier:1][profile:5]
    // space=0, tier=0.
    arr[offset - 1] = profileIdc & 0x1F

    view.setUint32(offset, 0x60000000); offset += 4 // general_profile_compatibility_flags
    view.setUint8(offset++, 0) // general_constraint_indicator_flags (48 bits)
    view.setUint8(offset++, 0)
    view.setUint8(offset++, 0)
    view.setUint8(offset++, 0)
    view.setUint8(offset++, 0)
    view.setUint8(offset++, 0)
    view.setUint8(offset++, levelIdc) // general_level_idc
    
    view.setUint16(offset, 0xF000); offset += 2 // min_spatial_segmentation_idc (0)
    view.setUint8(offset++, 0xFC) // parallelismType (0)
    view.setUint8(offset++, 0xFC) // chromaFormat (1=4:2:0 is typical)
    
    // bitDepthLumaMinus8
    view.setUint8(offset++, 0xF8 | (bitDepth - 8)) 
    // bitDepthChromaMinus8
    view.setUint8(offset++, 0xF8 | (bitDepth - 8)) 
    
    view.setUint16(offset, 0); offset += 2 // avgFrameRate (0)
    
    view.setUint8(offset++, 0x0F) // constantFrameRate(0), numTemporalLayers(0), temporalIdNested(0), lengthSizeMinusOne(3)
    view.setUint8(offset++, 3) // numOfArrays (VPS, SPS, PPS)
    
    // VPS Array
    view.setUint8(offset++, 0x20) // array_completeness(0) + reserved(0) + NAL_unit_type(32=VPS)
    view.setUint16(offset, 1); offset += 2 // numNalus
    view.setUint16(offset, vps.length); offset += 2
    arr.set(vps, offset); offset += vps.length
    
    // SPS Array
    view.setUint8(offset++, 0x21) // type(33=SPS)
    view.setUint16(offset, 1); offset += 2
    view.setUint16(offset, sps.length); offset += 2
    arr.set(sps, offset); offset += sps.length
    
    // PPS Array
    view.setUint8(offset++, 0x22) // type(34=PPS)
    view.setUint16(offset, 1); offset += 2
    view.setUint16(offset, pps.length); offset += 2
    arr.set(pps, offset); offset += pps.length
    
    return buffer
  }

  /**
   * Build hev1 sample entry (HEVC)
   */
  private buildHev1(width: number, height: number, hvcC: ArrayBuffer): ArrayBuffer {
    const size = 8 + 78 + hvcC.byteLength
    const buffer = new ArrayBuffer(size)
    const view = new DataView(buffer)
    const arr = new Uint8Array(buffer)
    
    let offset = 0
    view.setUint32(offset, size); offset += 4
    view.setUint32(offset, 0x68766331); offset += 4 // 'hvc1'
    
    offset += 6 // reserved
    view.setUint16(offset, 1); offset += 2 // data_reference_index
    offset += 16 // pre_defined, reserved
    view.setUint16(offset, width); offset += 2
    view.setUint16(offset, height); offset += 2
    view.setUint32(offset, 0x00480000); offset += 4 // horizresolution
    view.setUint32(offset, 0x00480000); offset += 4 // vertresolution
    offset += 4 // reserved
    view.setUint16(offset, 1); offset += 2 // frame_count
    offset += 32 // compressorname
    view.setUint16(offset, 0x0018); offset += 2 // depth
    view.setInt16(offset, -1); offset += 2 // pre_defined
    
    arr.set(new Uint8Array(hvcC), offset)
    
    return buffer
  }

  private stripStartCode(nal: Uint8Array): Uint8Array {
    if (nal.length >= 4 && nal[0] === 0 && nal[1] === 0 && nal[2] === 0 && nal[3] === 1) {
      return nal.subarray(4)
    } else if (nal.length >= 3 && nal[0] === 0 && nal[1] === 0 && nal[2] === 1) {
      return nal.subarray(3)
    }
    return nal
  }

  /**
   * Ensure NAL units have 4-byte length prefixes
   */
  private ensureFourBytePrefix(data: Uint8Array, currentLengthSize: number): Uint8Array {
    if (currentLengthSize === 4) return data

    // Calculate new size
    let newSize = 0
    let offset = 0
    const nalCount = 0
    
    // First pass to calculate size
    while (offset < data.length) {
      if (offset + currentLengthSize > data.length) break
      
      let len = 0
      if (currentLengthSize === 2) {
        len = (data[offset] << 8) | data[offset + 1]
      } else if (currentLengthSize === 1) {
        len = data[offset]
      } else if (currentLengthSize === 3) { // Very rare
        len = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2]
      }
      
      offset += currentLengthSize
      offset += len
      newSize += 4 + len
    }

    const result = new Uint8Array(newSize)
    const view = new DataView(result.buffer)
    
    offset = 0
    let writeOffset = 0
    
    // Second pass to copy data
    while (offset < data.length) {
      if (offset + currentLengthSize > data.length) break
      
      let len = 0
      if (currentLengthSize === 2) {
        len = (data[offset] << 8) | data[offset + 1]
      } else if (currentLengthSize === 1) {
        len = data[offset]
      } else if (currentLengthSize === 3) {
        len = (data[offset] << 16) | (data[offset + 1] << 8) | data[offset + 2]
      }
      
      offset += currentLengthSize
      
      // Write 4-byte length
      view.setUint32(writeOffset, len)
      writeOffset += 4
      
      // Copy data
      if (offset + len <= data.length) {
          result.set(data.subarray(offset, offset + len), writeOffset)
          writeOffset += len
          offset += len
      } else {
          break
      }
    }
    
    return result
  }


  /**
   * Generate moof + mdat segment
   */
  private generateMediaSegment(data: Uint8Array, packet: VideoPacket): ArrayBuffer {
    const pts90k = Math.round(packet.pts * 90000)
    const dts90k = Math.round(packet.dts * 90000)
    const duration = packet.duration ? Math.round(packet.duration * 90000) : 3000
    
    // tfhd
    const tfhd = this.box('tfhd', new Uint8Array([
      0, 0, 0, 0, // version, flags (no defaults)
      0, 0, 0, 1  // track_id
    ]))
    
    // tfdt (decode time)
    const tfdt = new ArrayBuffer(20)
    const tfdtView = new DataView(tfdt)
    tfdtView.setUint32(0, 20)
    tfdtView.setUint32(4, 0x74666474) // 'tfdt'
    tfdtView.setUint32(8, 0x01000000) // version 1
    tfdtView.setUint32(8, 0x01000000) // version 1
    // Use BigInt for 64-bit baseMediaDecodeTime
    // FIX: The tfdt should be the decode time of the first sample in the fragment.
    // We can just use the packet's DTS converted to timescale.
    const bmdt = BigInt(dts90k) 
    this.baseMediaDecodeTime = dts90k // Update our tracker (though using dts90k directly is safer for tfdt)
    tfdtView.setBigUint64(12, bmdt)
    
    // trun
    const sampleFlags = packet.isKeyframe ? 0x02000000 : 0x00010000
    const compositionOffset = pts90k - dts90k
    
    // 8 (header) + 4 (flags) + 4 (count) + 4 (offset) + 4 (first_flags) + 4 (duration) + 4 (size) + 4 (composition)
    const trun = new ArrayBuffer(36)
    const trunView = new DataView(trun)
    let trunOffset = 0
    trunView.setUint32(trunOffset, trun.byteLength); trunOffset += 4
    trunView.setUint32(trunOffset, 0x7472756E); trunOffset += 4 // 'trun'
    // flags: 0x000f01 = data offset, first sample flags, sample duration, sample size, sample composition time
    trunView.setUint32(trunOffset, 0x00000f01); trunOffset += 4
    trunView.setUint32(trunOffset, 1); trunOffset += 4 // sample_count
    // data_offset will be patched after we know moof size
    trunView.setUint32(trunOffset, 0); trunOffset += 4 // data_offset (placeholder)
    trunView.setUint32(trunOffset, sampleFlags); trunOffset += 4 // first_sample_flags
    trunView.setUint32(trunOffset, duration); trunOffset += 4 // sample_duration
    trunView.setUint32(trunOffset, data.length); trunOffset += 4 // sample_size
    trunView.setInt32(trunOffset, compositionOffset) // sample_composition_time_offset
    
    // traf
    const traf = this.box('traf', this.concat([
      new Uint8Array(tfhd),
      new Uint8Array(tfdt),
      new Uint8Array(trun)
    ]))
    
    // mfhd
    const mfhd = new ArrayBuffer(16)
    const mfhdView = new DataView(mfhd)
    mfhdView.setUint32(0, 16)
    mfhdView.setUint32(4, 0x6D666864) // 'mfhd'
    mfhdView.setUint32(8, 0) // version, flags
    mfhdView.setUint32(12, ++this.sequenceNumber)
    
    // moof (without knowing final size yet)
    const moof = this.box('moof', this.concat([
      new Uint8Array(mfhd),
      new Uint8Array(traf)
    ]))
    
    // mdat
    const mdat = new ArrayBuffer(8 + data.length)
    const mdatView = new DataView(mdat)
    mdatView.setUint32(0, 8 + data.length)
    mdatView.setUint32(4, 0x6D646174) // 'mdat'
    new Uint8Array(mdat).set(data, 8)
    
    // Patch data_offset in trun (offset from moof start to mdat data)
    const moofArr = new Uint8Array(moof)
    const dataOffset = moof.byteLength + 8 // moof size + mdat header
    
    // Find trun in moof and patch data_offset
    // trun data_offset is at offset 12 from trun start
    // We need to find the trun box in the moof
    // Find trun in moof and patch data_offset
    // Scan for 'trun' signature (0x7472756E) to locate the box
    // This is safer than traversing nested boxes manually
    for (let i = 0; i < moofArr.length - 8; i++) {
        if (moofArr[i] === 0x74 && 
            moofArr[i+1] === 0x72 && 
            moofArr[i+2] === 0x75 && 
            moofArr[i+3] === 0x6E) { // 'trun'
            
            // Found trun, check if it looks like a box header
            // The size bytes are at i-4
            
            // Patch data_offset. struct: size(4) type(4) flags(4) count(4) offset(4)
            // 'trun' starts at i. Offset field is at i + 4 (type end) + 4 (flags) + 4 (count) = i + 12
            
            const dv = new DataView(moofArr.buffer, moofArr.byteOffset + i + 12, 4)
            dv.setUint32(0, dataOffset)
            break
        }
    }
    
    // Combine moof + mdat
    const result = new Uint8Array(moof.byteLength + mdat.byteLength)
    result.set(moofArr, 0)
    result.set(new Uint8Array(mdat), moof.byteLength)
    
    return result.buffer
  }

  /**
   * Parse SPS for video dimensions
   */
  private parseSPS(sps: Uint8Array): { width: number; height: number } {
    // Simplified SPS parsing - extract width/height
    // For a proper implementation, use a full H.264 bitstream parser
    
    // Skip NAL header (1 byte) and profile_idc, constraint flags, level_idc (3 bytes)
    // Then parse the rest using Exp-Golomb coding
    
    // For now, return codec extradata dimensions if available
    if (this.codecInfo?.extradata) {
      // Try to extract from extradata
    }
    

    // Fallback: use stored dimensions or common default
    if (this.width && this.height) {
      return { width: this.width, height: this.height }
    }
    return { width: 1920, height: 1080 }
  }

  /**
   * Helper: Create a box with type and payload
   */
  private box(type: string, payload: Uint8Array): ArrayBuffer {
    const size = 8 + payload.length
    const buffer = new ArrayBuffer(size)
    const view = new DataView(buffer)
    const arr = new Uint8Array(buffer)
    
    view.setUint32(0, size)
    for (let i = 0; i < 4; i++) {
      view.setUint8(4 + i, type.charCodeAt(i))
    }
    arr.set(payload, 8)
    
    return buffer
  }

  /**
   * Helper: Concatenate Uint8Arrays
   */
  private concat(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const arr of arrays) {
      result.set(arr, offset)
      offset += arr.length
    }
    return result
  }

  /**
   * Helper: Convert string to Uint8Array
   */
  private str(s: string): Uint8Array {
    const arr = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) {
      arr[i] = s.charCodeAt(i)
    }
    return arr
  }

  /**
   * Append segment to SourceBuffer
   */
  private appendSegment(data: ArrayBuffer): void {
    if (!this.sourceBuffer || !this.mediaSource) return

    if (this.mediaSource.readyState !== 'open') {
        // MediaSource closed or ended, stop appending
        this.pendingSegments = []
        return
    }

    if (this.isAppending || this.sourceBuffer.updating) {
      this.pendingSegments.push(data)
      return
    }

    try {
      this.isAppending = true
      this.sourceBuffer.appendBuffer(data)
    } catch (error: any) {
      this.isAppending = false
      if (error.name === 'InvalidStateError') {
          console.warn('[VideoRemuxer] InvalidStateError during append - SourceBuffer removed or TS closed?', error)
          // Don't throw, just drop the segment as the buffer is likely dead
          this.pendingSegments = [] 
      } else {
          console.error('[VideoRemuxer] Error appending segment:', error)
          throw error // Re-throw other errors
      }
    }
  }

  /**
   * Flush pending segments
   */
  private flushPendingSegments(): void {
    // Don't attempt to flush if MediaSource is not open
    if (!this.mediaSource || this.mediaSource.readyState !== 'open') {
      this.pendingSegments = []
      return
    }
    
    if (this.pendingSegments.length > 0 && this.sourceBuffer && !this.sourceBuffer.updating) {
      const segment = this.pendingSegments.shift()!
      console.log(`[VideoRemuxer] Appending buffered segment: ${segment.byteLength} bytes`)
      this.appendSegment(segment)
    }
  }

  /**
   * Flush for seeking
   */
  async flush(): Promise<void> {
    this.pendingSegments = []
    this.initSegmentGenerated = false
    this.sps = null
    this.pps = null
    this.sequenceNumber = 0

    if (this.sourceBuffer && this.mediaSource?.readyState === 'open') {
      try {
        // Wait for any pending updates
        if (this.sourceBuffer.updating) {
          await new Promise<void>(resolve => {
            const handler = () => {
              this.sourceBuffer?.removeEventListener('updateend', handler)
              resolve()
            }
            this.sourceBuffer!.addEventListener('updateend', handler)
          })
        }

        // Remove all buffered data
        const buffered = this.sourceBuffer.buffered
        if (buffered.length > 0) {
          this.sourceBuffer.remove(0, buffered.end(buffered.length - 1))
          
          await new Promise<void>(resolve => {
            const handler = () => {
              this.sourceBuffer?.removeEventListener('updateend', handler)
              resolve()
            }
            this.sourceBuffer!.addEventListener('updateend', handler)
          })
        }
      } catch (error) {
        console.error('[VideoRemuxer] Error flushing:', error)
      }
    }
  }

  /**
   * Destroy and cleanup
   */
  async destroy(): Promise<void> {
    // Mark as not initialized immediately to stop incoming segments
    this.isInitialized = false
    this.pendingSegments = []
    
    if (this.sourceBuffer) {
      try {
        // Wait for any pending updates before removing
        if (this.sourceBuffer.updating) {
          await new Promise<void>(resolve => {
            const handler = () => {
              this.sourceBuffer?.removeEventListener('updateend', handler)
              resolve()
            }
            this.sourceBuffer!.addEventListener('updateend', handler)
          })
        }
        
        if (this.mediaSource?.readyState === 'open') {
          this.mediaSource.removeSourceBuffer(this.sourceBuffer)
        }
      } catch (e) {
        // Ignore errors during cleanup
      }
      this.sourceBuffer = null
    }

    if (this.mediaSource) {
      if (this.mediaSource.readyState === 'open') {
        try {
          this.mediaSource.endOfStream()
        } catch (e) {
          // Ignore
        }
      }
      this.mediaSource = null
    }

    if (this.videoElement?.src) {
      URL.revokeObjectURL(this.videoElement.src)
      this.videoElement.src = ''
      this.videoElement = null
    }
  }

  get initialized(): boolean {
    return this.isInitialized
  }
}
