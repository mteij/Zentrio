
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export class TranscoderService {
  private ffmpeg: FFmpeg;
  private isLoaded = false;
  private terminateReq = false;

  private readonly HEADER_SIZE = 2 * 1024 * 1024; // 2MB Header
  private readonly CHUNK_SIZE = 30 * 1024 * 1024; // 30MB Chunks

  private currentCodec: string | null = null;
  private hasAudioStream: boolean = false;

  constructor() {
    this.ffmpeg = new FFmpeg();
    this.ffmpeg.on('log', ({ message }) => {
        // console.log('[FFMPEG]', message);
        this.parseCodec(message);
    });
  }

  private parseCodec(message: string) {
      if (message.includes("Video:") && message.includes("h264")) {
          this.currentCodec = 'avc1.42E01E';
      } else if (message.includes("Video:") && (message.includes("hevc") || message.includes("h265"))) {
          this.currentCodec = 'hev1.1.6.L93.B0'; 
      }
      
      if (message.includes("Audio:")) {
          this.hasAudioStream = true;
      }
  }

  async load() {
    if (this.isLoaded) return;
    
    console.log("Transcoder: Loading ffmpeg-core...");
    
    // Import local files (Vite will handle the URL resolution)
    try {
        const coreURL = '/ffmpeg/ffmpeg-core.js';
        const wasmURL = '/ffmpeg/ffmpeg-core.wasm';
        
        console.log(`Transcoder: Resolved coreURL: ${coreURL}`);
        
        await this.ffmpeg.load({
          coreURL: await this.toBlobURL(coreURL, 'text/javascript'),
          wasmURL: await this.toBlobURL(wasmURL, 'application/wasm'),
        });
        console.log("Transcoder: ffmpeg-core loaded successfully");
        this.isLoaded = true;
    } catch (e) {
        console.error("Transcoder: Failed to load ffmpeg-core (local)", e);
        // Fallback to CDN if local fails
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
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

  // Helper to load blob url to bypass CSP/CORS issues sometimes
  private async toBlobURL(url: string, mimeType: string) {
    console.log(`Transcoder: Fetching blob ${url}`);
    const buf = await (await fetch(url)).arrayBuffer();
    return URL.createObjectURL(new Blob([buf], { type: mimeType }));
  }

  async transcode(inputUrl: string, onData: (data: Uint8Array, codec?: string, hasAudio?: boolean) => void) {
    console.log("Transcoder: transcode stream started");
    if (!this.isLoaded) await this.load();
    this.terminateReq = false;

    try {
        // 1. Fetch Header & Determine File Size
        console.log("Transcoder: Fetching header...");
        const headerResp = await fetch(inputUrl, {
             headers: { Range: `bytes=0-${this.HEADER_SIZE - 1}` }
        });

        if (!headerResp.ok && headerResp.status !== 206) {
             throw new Error(`Failed to fetch header: ${headerResp.status} ${headerResp.statusText}`);
        }
        
        let totalLength = 0;
        const contentRange = headerResp.headers.get('Content-Range');
        const contentLength = headerResp.headers.get('Content-Length');

        if (contentRange) {
            const parts = contentRange.split('/');
            totalLength = parts[1] !== '*' ? parseInt(parts[1], 10) : 0;
        } else if (contentLength) {
            totalLength = parseInt(contentLength, 10);
        }

        const headerData = new Uint8Array(await headerResp.arrayBuffer());
        console.log(`Transcoder: File length: ${totalLength}, Header blob: ${headerData.byteLength}`);

        // If we got a 200 OK and valid data, the server might have sent the whole file or ignored range
        if (headerResp.status === 200 && totalLength > 0 && headerData.byteLength === totalLength) {
             console.log("Transcoder: Server returned full file (200 OK). Processing single chunk.");
             await this.processChunk(headerData, 0, onData);
             return;
        }

        // 2. Loop through chunks
        let offset = 0;
        let chunkIndex = 0;
        const seenOffsets = new Set<number>();
        
        while (true) {
            if (this.terminateReq) break;
            
            // Validate offset against total length (if known)
            if (totalLength > 0 && offset >= totalLength) {
                console.log("Transcoder: Reached end of file length.");
                break;
            }
            if (seenOffsets.has(offset)) {
                 // Prevent infinite loop if logic fails to advance?
                 // Or maybe valid re-try? For now, break to avoid hang.
                 console.warn("Transcoder: Loop detected at offset", offset);
                 break; 
            }
            seenOffsets.add(offset);

            // Calculate chunk range
            const end = (totalLength > 0) ? Math.min(offset + this.CHUNK_SIZE, totalLength) : offset + this.CHUNK_SIZE;
            console.log(`Transcoder: Processing chunk ${chunkIndex} (Offset: ${offset} - ${end})`);
            
            let chunkData: Uint8Array;
            
            // Simplification: Always use headerData for the first part if we are at offset 0
            if (offset === 0) {
                 chunkData = await this.prepareFirstChunk(inputUrl, headerData, totalLength);
            } else {
                const resp = await fetch(inputUrl, {
                    headers: { Range: `bytes=${offset}-${end - 1}` }
                });
                
                if (resp.status === 416) {
                    console.log("Transcoder: 416 Range Not Satisfiable (EOF), finishing.");
                    break;
                }
                
                if (!resp.ok) {
                    console.error(`Transcoder: Fetch failed with ${resp.status}, aborting stream.`);
                    break;
                }
                
                const rawChunk = new Uint8Array(await resp.arrayBuffer());
                if (rawChunk.byteLength === 0) break; // Empty body

                // Prepend header to provide context to ffmpeg (essential for 'copy' codec)
                chunkData = this.concatBuffers(headerData, rawChunk);
            }
            
            await this.processChunk(chunkData, chunkIndex, onData);
            
            offset += this.CHUNK_SIZE;
            chunkIndex++;
        }
        
    } catch (e) {
        console.error("Transcoding failed:", e);
        throw e;
    }
  }

  private async prepareFirstChunk(inputUrl: string, headerData: Uint8Array, totalLength: number): Promise<Uint8Array> {
        // We have headerData (0 to HEADER_SIZE)
        // We want 0 to CHUNK_SIZE
        const reqEnd = (totalLength > 0) ? Math.min(this.CHUNK_SIZE, totalLength) : this.CHUNK_SIZE;

        // If headerData already covers the requested size
        if (headerData.byteLength >= reqEnd) {
            return headerData.slice(0, reqEnd);
        }

        // Fetch remaining part of the first chunk
        const remainingStart = this.HEADER_SIZE;
        try {
            const remainingResp = await fetch(inputUrl, {
                headers: { Range: `bytes=${remainingStart}-${reqEnd - 1}` }
            });
            
            if (remainingResp.ok) {
                const remainingData = new Uint8Array(await remainingResp.arrayBuffer());
                return this.concatBuffers(headerData, remainingData);
            } else {
                 console.warn(`Transcoder: Could not fetch remaining chunk 0 (status ${remainingResp.status}). Using header only.`);
                 return headerData;
            }
        } catch (e) {
            console.warn(`Transcoder: Error fetching remaining chunk 0`, e);
            return headerData;
        }
  }

  private concatBuffers(a: Uint8Array, b: Uint8Array): Uint8Array {
      const c = new Uint8Array(a.byteLength + b.byteLength);
      c.set(a);
      c.set(b, a.byteLength);
      return c;
  }

  private async processChunk(chunkData: Uint8Array, chunkIndex: number, onData: (data: Uint8Array, codec?: string, hasAudio?: boolean) => void) {
        if (this.terminateReq) return;

        const inputName = `chunk_${chunkIndex}.mkv`;
        const outputName = `out_${chunkIndex}.mp4`;
        
        try {
            await this.ffmpeg.writeFile(inputName, chunkData);
            
            await this.ffmpeg.exec([
                '-i', inputName,
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-ac', '2',
                '-b:a', '192k',
                '-strict', 'experimental',
                '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
                '-f', 'mp4',
                outputName
            ]);
            
            const outData = await this.ffmpeg.readFile(outputName);
            onData(outData as Uint8Array, this.currentCodec || undefined, this.hasAudioStream);
            
        } catch (e) {
             console.warn(`Transcoder: Error processing chunk ${chunkIndex} (ffmpeg error?)`, e);
        } finally {
            // Cleanup files to free memory
            try { await this.ffmpeg.deleteFile(inputName); } catch {}
            try { await this.ffmpeg.deleteFile(outputName); } catch {}
        }
  }

  terminate() {
    this.terminateReq = true;
    try {
        this.ffmpeg.terminate();
        this.isLoaded = false;
    } catch (e) {
        console.error(e);
    }
  }
}

export const transcoder = new TranscoderService();
