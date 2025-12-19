import { FFmpeg } from '@ffmpeg/ffmpeg';

export interface TranscodeCallbacks {
  onData: (data: Uint8Array) => void;
  onProgress?: (progress: number, stage: 'downloading' | 'transcoding') => void;
  onError?: (error: Error) => void;
}

export interface TranscodeOptions {
  /** If true, copy video stream as-is (fast). If false, re-encode to H.264 */
  copyVideo?: boolean;
}

// Header size to capture container metadata (MKV/MP4 headers, track info, etc.)
const HEADER_SIZE = 2 * 1024 * 1024; // 2MB
// Chunk size for streaming - 20MB chunks
const CHUNK_SIZE = 20 * 1024 * 1024;

export class TranscoderService {
  private ffmpeg: FFmpeg;
  private isLoaded = false;
  private terminateReq = false;
  private headerData: Uint8Array | null = null;
  private copyVideo = true;

  constructor() {
    this.ffmpeg = new FFmpeg();
    this.ffmpeg.on('log', ({ message }) => {
      console.log('[FFMPEG]', message);
    });
  }

  private progressCallback: ((progress: number, stage: 'downloading' | 'transcoding') => void) | null = null;

  async load() {
    if (this.isLoaded) return;
    
    console.log("Transcoder: Loading ffmpeg-core...");
    
    try {
      const coreURL = '/ffmpeg/ffmpeg-core.js';
      const wasmURL = '/ffmpeg/ffmpeg-core.wasm';
      
      await this.ffmpeg.load({
        coreURL: await this.toBlobURL(coreURL, 'text/javascript'),
        wasmURL: await this.toBlobURL(wasmURL, 'application/wasm'),
      });
      console.log("Transcoder: ffmpeg-core loaded successfully");
      this.isLoaded = true;
    } catch (e) {
      console.error("Transcoder: Failed to load local ffmpeg-core", e);
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      try {
        await this.ffmpeg.load({
          coreURL: await this.toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await this.toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        console.log("Transcoder: CDN Fallback success");
        this.isLoaded = true;
      } catch (e2) {
        throw e2;
      }
    }
  }

  private async toBlobURL(url: string, mimeType: string) {
    const buf = await (await fetch(url)).arrayBuffer();
    return URL.createObjectURL(new Blob([buf], { type: mimeType }));
  }

  /**
   * Transcode video using chunked streaming with header prepending.
   * Each chunk gets the file header prepended so FFmpeg can demux it properly.
   * @param options.copyVideo If true, copy video as-is (fast). If false, re-encode to H.264.
   */
  async transcode(inputUrl: string, callbacks: TranscodeCallbacks, options: TranscodeOptions = {}): Promise<void> {
    const { copyVideo = true } = options;
    console.log(`Transcoder: Starting chunked transcoding for ${inputUrl} (copyVideo: ${copyVideo})`);
    
    if (!this.isLoaded) await this.load();
    this.terminateReq = false;
    this.headerData = null;
    this.progressCallback = callbacks.onProgress || null;
    this.copyVideo = copyVideo;

    // Setup FFmpeg progress
    this.ffmpeg.on('progress', ({ progress }) => {
      if (this.progressCallback) {
        this.progressCallback(Math.round(progress * 100), 'transcoding');
      }
    });

    try {
      // Step 1: Fetch and store the header (first 2MB)
      console.log("Transcoder: Fetching file header...");
      const headerResponse = await fetch(inputUrl, {
        headers: { 'Range': `bytes=0-${HEADER_SIZE - 1}` }
      });
      
      if (!headerResponse.ok && headerResponse.status !== 206) {
        throw new Error(`Failed to fetch header: ${headerResponse.status}`);
      }
      
      this.headerData = new Uint8Array(await headerResponse.arrayBuffer());
      console.log(`Transcoder: Header stored (${(this.headerData.byteLength / 1024 / 1024).toFixed(2)}MB)`);
      
      // Get total size from Content-Range if available
      let totalSize = 0;
      const contentRange = headerResponse.headers.get('content-range');
      if (contentRange) {
        const match = contentRange.match(/\/(\d+)$/);
        if (match) {
          totalSize = parseInt(match[1], 10);
          console.log(`Transcoder: Total file size: ${(totalSize / 1024 / 1024).toFixed(1)}MB`);
        }
      }
      
      // Step 2: Process the header as chunk 0 (contains initial video data)
      console.log("Transcoder: Processing header as chunk 0...");
      await this.transcodeChunk(this.headerData, 0, callbacks);
      
      // Step 3: Continue fetching chunks, prepending header to each
      let offset = HEADER_SIZE;
      let chunkIndex = 1;
      
      while (!this.terminateReq) {
        const end = offset + CHUNK_SIZE - 1;
        
        // Report progress
        if (this.progressCallback && totalSize > 0) {
          const progress = Math.min(100, Math.round((offset / totalSize) * 100));
          this.progressCallback(progress, 'downloading');
        }
        
        console.log(`Transcoder: Fetching chunk ${chunkIndex} (bytes ${offset}-${end})`);
        
        const response = await fetch(inputUrl, {
          headers: { 'Range': `bytes=${offset}-${end}` }
        });
        
        if (response.status === 416) {
          console.log("Transcoder: Reached end of file (416)");
          break;
        }
        
        if (!response.ok && response.status !== 206) {
          throw new Error(`Fetch failed: ${response.status}`);
        }
        
        const chunkData = new Uint8Array(await response.arrayBuffer());
        const receivedBytes = chunkData.byteLength;
        
        console.log(`Transcoder: Received ${(receivedBytes / 1024 / 1024).toFixed(2)}MB`);
        
        if (receivedBytes === 0) {
          console.log("Transcoder: Empty chunk, stopping");
          break;
        }
        
        // Prepend header to chunk so FFmpeg can demux it
        const chunkWithHeader = new Uint8Array(this.headerData.byteLength + chunkData.byteLength);
        chunkWithHeader.set(this.headerData, 0);
        chunkWithHeader.set(chunkData, this.headerData.byteLength);
        
        console.log(`Transcoder: Processing chunk ${chunkIndex} (header + ${(receivedBytes / 1024 / 1024).toFixed(2)}MB = ${(chunkWithHeader.byteLength / 1024 / 1024).toFixed(2)}MB)`);
        
        // Transcode chunk with header
        await this.transcodeChunk(chunkWithHeader, chunkIndex, callbacks);
        
        // Check if we've reached the end
        if (totalSize > 0 && offset + receivedBytes >= totalSize) {
          console.log("Transcoder: Reached total size");
          break;
        }
        
        if (receivedBytes < CHUNK_SIZE) {
          console.log("Transcoder: Partial chunk received (EOF)");
          break;
        }
        
        offset += receivedBytes;
        chunkIndex++;
      }
      
      console.log("Transcoder: All chunks processed");
      
    } catch (e) {
      console.error("Transcoder: Error during transcoding", e);
      callbacks.onError?.(e instanceof Error ? e : new Error(String(e)));
      throw e;
    }
  }

  /**
   * Transcode a single chunk to browser-compatible fMP4
   */
  private async transcodeChunk(
    data: Uint8Array, 
    chunkIndex: number, 
    callbacks: TranscodeCallbacks
  ): Promise<void> {
    if (this.terminateReq) return;
    
    if (data.byteLength < 1024) {
      console.warn(`Transcoder: Chunk ${chunkIndex} too small, skipping`);
      return;
    }
    
    const inputName = `input_${chunkIndex}.mkv`;
    const outputName = `output_${chunkIndex}.mp4`;
    
    try {
      // Make a copy of the data to avoid detachment issues
      const dataCopy = new Uint8Array(data);
      await this.ffmpeg.writeFile(inputName, dataCopy);
      
      // Build FFmpeg arguments based on copyVideo setting
      const ffmpegArgs: string[] = [
        '-i', inputName,
        // Generate silent audio as fallback if input has no audio
        '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      ];
      
      // Video handling
      if (this.copyVideo) {
        // Copy video stream without re-encoding (fast, preserves quality)
        ffmpegArgs.push('-c:v', 'copy');
      } else {
        // Re-encode to H.264 for browsers without HEVC support
        ffmpegArgs.push(
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-crf', '28',
          '-pix_fmt', 'yuv420p',
          '-profile:v', 'baseline',
          '-level', '3.1'
        );
      }
      
      // Stream mapping and audio settings
      ffmpegArgs.push(
        // Map video from input
        '-map', '0:v:0',
        // Try to use audio from input, fall back to silent audio
        '-map', '0:a:0?',        // ? = optional, won't fail if no audio
        '-map', '1:a:0',         // Silent audio fallback
        // Transcode audio to AAC (browser compatible)
        '-c:a', 'aac',
        '-ac', '2',              // Stereo
        '-b:a', '192k',          // Good quality audio
        '-ar', '48000',          // Standard sample rate
        '-shortest',             // End when video ends
        // fMP4 output for MSE
        '-movflags', '+frag_keyframe+empty_moov+default_base_moof',
        '-f', 'mp4',
        outputName
      );
      
      await this.ffmpeg.exec(ffmpegArgs);

      if (this.terminateReq) return;

      const outputData = await this.ffmpeg.readFile(outputName);
      
      if (!outputData || !(outputData instanceof Uint8Array) || outputData.byteLength === 0) {
        console.warn(`Transcoder: Chunk ${chunkIndex} produced no output`);
        return;
      }
      
      console.log(`Transcoder: Chunk ${chunkIndex} → ${(outputData.byteLength / 1024 / 1024).toFixed(2)}MB`);
      callbacks.onData(new Uint8Array(outputData));
      
    } catch (e) {
      console.error(`Transcoder: Error on chunk ${chunkIndex}`, e);
      if (chunkIndex === 0) throw e;
    } finally {
      try { await this.ffmpeg.deleteFile(inputName); } catch {}
      try { await this.ffmpeg.deleteFile(outputName); } catch {}
    }
  }

  terminate() {
    this.terminateReq = true;
    this.progressCallback = null;
    this.headerData = null;
    try {
      this.ffmpeg.terminate();
      this.isLoaded = false;
    } catch (e) {
      console.error("Transcoder: Error during termination", e);
    }
  }
}

export const transcoder = new TranscoderService();
