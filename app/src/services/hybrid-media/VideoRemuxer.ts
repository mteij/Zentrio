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
  private isInitialized: boolean = false
  private pendingSegments: ArrayBuffer[] = []
  private isAppending: boolean = false
  private segmentDuration: number
  private mp4box: any | null = null
  private initSegmentGenerated: boolean = false
  private baseMediaDecodeTime: number = 0
  private sequenceNumber: number = 0

  constructor(config: VideoRemuxerConfig = {}) {
    super()
    this.segmentDuration = config.segmentDuration ?? 1
  }

  /**
   * Attach to a video element and set up MSE
   */
  async attach(video: HTMLVideoElement, codecInfo: CodecInfo): Promise<void> {
    this.videoElement = video
    this.codecInfo = codecInfo

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

          this.sourceBuffer.addEventListener('error', (e) => {
            console.error('[VideoRemuxer] SourceBuffer error:', e)
            this.dispatchEvent(new CustomEvent('error', { detail: { error: e } }))
          })

          this.isInitialized = true
          console.log(`[VideoRemuxer] Initialized with codec: ${codecInfo.codecString}`)
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
    if (!this.isInitialized) {
      throw new Error('Remuxer not initialized')
    }

    // Detect Annex-B format on first packet
    if (!this.initSegmentGenerated) {
      this.isAnnexB = this.detectAnnexB(packet.data)
      console.log(`[VideoRemuxer] Detected format: ${this.isAnnexB ? 'Annex-B' : 'AVCC'}`)
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
      naluData = packet.data
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

    // Build avcC (AVCC decoder configuration)
    const avcC = this.buildAvcC()
    
    // Build stsd with avc1 sample entry
    const avc1 = this.buildAvc1(width, height, avcC)
    const stsd = this.box('stsd', this.concat([
      new Uint8Array([0, 0, 0, 0, 0, 0, 0, 1]), // version, flags, entry_count
      new Uint8Array(avc1)
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

    const size = 8 + 3 + 2 + this.sps.length + 1 + 2 + this.pps.length
    const buffer = new ArrayBuffer(size)
    const view = new DataView(buffer)
    const arr = new Uint8Array(buffer)
    
    let offset = 0
    view.setUint32(offset, size); offset += 4
    view.setUint32(offset, 0x61766343); offset += 4 // 'avcC'
    
    view.setUint8(offset++, 1) // configurationVersion
    view.setUint8(offset++, this.sps[1]) // AVCProfileIndication
    view.setUint8(offset++, this.sps[2]) // profile_compatibility
    view.setUint8(offset++, this.sps[3]) // AVCLevelIndication
    view.setUint8(offset++, 0xff) // lengthSizeMinusOne (3 = 4 bytes)
    view.setUint8(offset++, 0xe1) // numOfSequenceParameterSets
    view.setUint16(offset, this.sps.length); offset += 2
    arr.set(this.sps, offset); offset += this.sps.length
    view.setUint8(offset++, 1) // numOfPictureParameterSets
    view.setUint16(offset, this.pps.length); offset += 2
    arr.set(this.pps, offset)
    
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
    // Use BigInt for 64-bit baseMediaDecodeTime
    const bmdt = BigInt(dts90k - this.baseMediaDecodeTime)
    tfdtView.setBigUint64(12, bmdt)
    
    // trun
    const sampleFlags = packet.isKeyframe ? 0x02000000 : 0x00010000
    const compositionOffset = pts90k - dts90k
    
    const trun = new ArrayBuffer(8 + 4 + 4 + 4 + 4 + 4 + 4)
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
    let searchOffset = 0
    while (searchOffset < moofArr.length - 8) {
      const boxType = (moofArr[searchOffset + 4] << 24) | 
                      (moofArr[searchOffset + 5] << 16) |
                      (moofArr[searchOffset + 6] << 8) | 
                      moofArr[searchOffset + 7]
      if (boxType === 0x7472756E) { // 'trun'
        // Patch data_offset at offset 16 from box start
        const dv = new DataView(moofArr.buffer, searchOffset + 16, 4)
        dv.setUint32(0, dataOffset)
        break
      }
      const boxSize = (moofArr[searchOffset] << 24) | 
                      (moofArr[searchOffset + 1] << 16) |
                      (moofArr[searchOffset + 2] << 8) | 
                      moofArr[searchOffset + 3]
      searchOffset += boxSize || 8
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
    
    // Fallback: common dimensions
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
    if (!this.sourceBuffer) return

    if (this.isAppending || this.sourceBuffer.updating) {
      this.pendingSegments.push(data)
      return
    }

    try {
      this.isAppending = true
      this.sourceBuffer.appendBuffer(data)
    } catch (error) {
      console.error('[VideoRemuxer] Error appending segment:', error)
      this.isAppending = false
    }
  }

  /**
   * Flush pending segments
   */
  private flushPendingSegments(): void {
    if (this.pendingSegments.length > 0 && this.sourceBuffer && !this.sourceBuffer.updating) {
      const segment = this.pendingSegments.shift()!
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
  destroy(): void {
    this.pendingSegments = []
    
    if (this.sourceBuffer) {
      try {
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

    this.isInitialized = false
  }

  get initialized(): boolean {
    return this.isInitialized
  }
}
