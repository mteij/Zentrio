# Hybrid Media Service Analysis

## Summary

This document analyzes the hybrid media service implementation, focusing on platform compatibility (Tauri vs. Web) and streaming functionality.

## 1. Tauri Detection - ✅ CORRECTLY IMPLEMENTED

The hybrid media service **is correctly configured** to only work on the web, not in Tauri apps.

### Evidence from [`VidstackPlayer.tsx`](app/src/components/player/VidstackPlayer.tsx:243-246):

```typescript
// Force native playback in Tauri
if (window.__TAURI__) {
    console.log('[VidstackPlayer] Tauri environment detected - forcing native playback')
    return 'native'
}
```

Additional Tauri checks:
- Line 271: Skip probing in Tauri (`if (window.__TAURI__) return`)
- Line 574: Skip hybrid fallback on error in Tauri

### Why This is Correct

Tauri has native video decoding capabilities via the underlying system's media frameworks:
- **Desktop (Windows/macOS/Linux)**: Direct access to system codecs
- **Mobile (Android/iOS)**: Native player with hardware acceleration

The hybrid media service is unnecessary in Tauri because:
1. Native players support far more codecs than browsers
2. No need for FFmpeg WASM transcoding (which has overhead)
3. Better performance and battery life

---

## 2. Architecture Overview

### Component Breakdown

| Component | Purpose | Status |
|-----------|---------|--------|
| [`HybridEngine`](app/src/services/hybrid-media/HybridEngine.ts) | Orchestrates video remuxing + audio transcoding | ⚠️ Incomplete |
| [`VideoRemuxer`](app/src/services/hybrid-media/VideoRemuxer.ts) | Remuxes video to fMP4 for MSE | ⚠️ Not connected |
| [`AudioStreamTranscoder`](app/src/services/hybrid-media/AudioStreamTranscoder.ts) | Transcodes audio to AAC via FFmpeg WASM | ⚠️ Design issues |
| [`NetworkReader`](app/src/services/hybrid-media/NetworkReader.ts) | HTTP range requests with caching | ✅ Functional |
| [`TranscoderService`](app/src/services/hybrid-media/TranscoderService.ts) | Single-file transcoder (fallback) | ✅ Functional |

### Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    VidstackPlayer                            │
│  (Checks Tauri → Native, Else → Probing)                  │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
   No (Tauri)              Yes (Web)
        │                         │
        ▼                         ▼
┌──────────────┐        ┌────────────────────────┐
│ Native Mode  │        │ Probe Media File     │
│ (Vidstack)  │        │ with FFmpeg WASM     │
└──────────────┘        └──────────┬───────────┘
                                   │
                          ┌────────┴────────┐
                          │                 │
                    Rare Audio         Native Audio
                    Codec Needed         Supported
                          │                 │
                          ▼                 ▼
                  ┌──────────────┐  ┌──────────────┐
                  │ Hybrid Mode  │  │ Native Mode  │
                  │              │  │              │
                  │ VideoRemuxer │  │ Vidstack    │
                  │ + AudioTrans │  │              │
                  └──────────────┘  └──────────────┘
```

---

## 3. Issues with Streaming Implementation

### ⚠️ Critical Issue #1: Video Path Not Connected

**Problem**: The video remuxing pipeline is not actually implemented.

**Location**: [`HybridEngine.processVideo()`](app/src/services/hybrid-media/HybridEngine.ts:544-583)

```typescript
private async processVideo(): Promise<void> {
    if (this.isProcessing) return
    this.isProcessing = true

    try {
      // The actual video processing is handled by VideoRemuxer
      // which receives video data and remuxes to fMP4
      // For FFmpeg-only approach, we'd need to stream demux here
      // but that's complex - for now, VideoRemuxer handles it
      
      // Periodic sync between video and audio
      while (!this.shouldStop) {
        await new Promise(r => setTimeout(r, 100))
        // ... sync logic ...
      }
    }
    // ...
}
```

**The Problem**:
- VideoRemuxer has a `push(packet)` method that expects `VideoPacket` objects
- HybridEngine never calls `videoRemuxer.push()`
- There's no video demuxing code to extract packets from the source file
- The video element receives MSE video, but there's no data being fed to it

**Impact**: Video playback cannot work in hybrid mode - the MSE source buffer will never receive any data.

---

### ⚠️ Critical Issue #2: Audio Streaming is Not Actually Streaming

**Problem**: [`AudioStreamTranscoder`](app/src/services/hybrid-media/AudioStreamTranscoder.ts) downloads the entire file before final transcoding.

**Location**: Lines 162-229

```typescript
private async downloadChunks(): Promise<void> {
    // ... download chunks ...
    
    while (offset < this.totalSize) {
        // Download chunk, add to array
        this.chunks.push(chunk)
        // ...
    }
    
    // Wait for any ongoing transcode to finish
    while (this.isTranscoding) {
        await new Promise(r => setTimeout(r, 100))
    }

    // Final transcode with COMPLETE FILE
    console.log('[AudioTranscoder] Starting final transcode with complete file...')
    await this.transcodeCurrentBuffer(true)
}
```

**The Problem**:
1. Downloads are done in chunks (50MB by default)
2. After initial buffer (~50MB), a partial transcode runs
3. But the **final** transcode requires the **entire** file
4. This means users must wait for full download before audio can play fully

**Impact**:
- Not true streaming - it's "chunked download then transcode"
- Large files (e.g., 10GB movie) will take a long time before full audio is available
- Seeks beyond transcoded region will fail

---

### ⚠️ Critical Issue #3: FFprobe Parsing is Fragile

**Problem**: FFmpeg output parsing relies on regex that may fail on different formats.

**Location**: [`HybridEngine.parseFFmpegOutput()`](app/src/services/hybrid-media/HybridEngine.ts:240-307)

```typescript
private parseFFmpegOutput(output: string): StreamInfo[] {
    const streams: StreamInfo[] = []
    
    // Match stream lines like: Stream #0:0(eng): Video: hevc (Main 10)...
    const streamRegex = /Stream #0:(\d+)(?:\([^)]*\))?:\s*(Video|Audio):\s*(\w+)/g
    // ...
}
```

**The Problem**:
- Assumes a specific output format
- Doesn't handle multi-line stream info
- May miss codec profiles/levels
- No fallback for malformed output

---

### ⚠️ Medium Issue #4: Audio Sync Drift

**Problem**: Audio-video sync uses a simple threshold that may cause visible issues.

**Location**: [`HybridEngine.processVideo()`](app/src/services/hybrid-media/HybridEngine.ts:559-565)

```typescript
const drift = Math.abs(this.transcodedAudioElement.currentTime - this.videoElement.currentTime)
if (drift > 0.3) {
    console.log(`[HybridEngine] Audio drift: ${drift.toFixed(2)}s, resyncing`)
    this.transcodedAudioElement.currentTime = this.videoElement.currentTime
}
```

**The Problem**:
- 0.3 second threshold is quite large
- No rate adjustment - just jumps to new time
- Could cause "stuttering" if drift oscillates
- Audio doesn't smoothly catch up to video

---

### ⚠️ Medium Issue #5: Limited Hybrid Mode UI

**Problem**: Hybrid mode doesn't use Vidstack's controls - only basic custom UI.

**Location**: [`VidstackPlayer.tsx`](app/src/components/player/VidstackPlayer.tsx:661-830)

**Impact**:
- No volume control in hybrid mode
- No playback speed control
- No keyboard shortcuts
- No settings menu
- Different UX between native and hybrid modes

---

### ⚠️ Medium Issue #6: Error Handling is Incomplete

**Problem**: No clear fallback when MSE/FFmpeg WASM fails.

**Location**: [`VidstackPlayer.tsx`](app/src/components/player/VidstackPlayer.tsx:410-424)

```typescript
try {
    await engine.attachAudio()
} catch (audioError) {
    // Transcoding failed or codec not supported
    // Fall back to native playback (video will play, audio may not work)
    console.warn('[VidstackPlayer] Audio setup failed, falling back to native playback:', audioError)
    // ...
    setPlaybackMode('native')
}
```

**The Problem**:
- Fallback to native won't help if audio codec is unsupported
- User sees video with no audio and no clear error message
- No option to download or use external player

---

### ⚠️ Minor Issue #7: Heuristic Codec Detection

**Problem**: [`mightNeedHybridPlayback()`](app/src/services/hybrid-media/index.ts:44-51) uses only file extension.

```typescript
export function mightNeedHybridPlayback(url: string): boolean {
  const ext = url.split('.').pop()?.toLowerCase()
  const containerExts = ['mkv', 'webm', 'avi', 'mov', 'wmv', 'flv']
  return containerExts.includes(ext || '')
}
```

**The Problem**:
- MP4 can also have unsupported audio (DTS, FLAC)
- WebM with AAC audio doesn't need transcoding
- Creates false positives/negatives

---

## 4. Root Cause Analysis

### Why Streaming Isn't Working

1. **Video Path**: No demuxer to extract video packets from MKV/WebM/AVI containers
   - VideoRemuxer expects packets but never receives them
   - MSE video source buffer remains empty

2. **Audio Path**: Downloads entire file before final transcode
   - Not true streaming despite chunked download
   - Audio won't be available until download completes

3. **Architecture Gap**: HybridEngine assumes video packets will appear magically
   - No integration between NetworkReader, FFmpeg, and VideoRemuxer
   - The "demuxing" step is missing entirely

---

## 5. Recommendations

### Priority 1: Fix Video Path (Critical)

To make hybrid playback actually work:

**Option A: Full FFmpeg Streaming**
```
1. Use FFmpeg WASM to demux video packets
2. Feed H.264/HEVC packets to VideoRemuxer
3. Use VideoRemuxer.push() to queue segments to MSE
```

**Option B: Use mp4box.js Properly**
```
1. Download entire file to ArrayBuffer
2. Use mp4box.js to extract video track
3. Remux with mp4box.js instead of custom VideoRemuxer
4. Feed to MSE
```

**Option C: Simplified Approach (Recommended for MVP)**
```
1. Download file chunks
2. On first chunk, transcode entire audio to AAC
3. For video, extract track using mp4box.js
4. Create fMP4 segments from video packets
5. Use native video element with blob URL
```

### Priority 2: Fix Audio Streaming (High)

Implement true streaming transcoding:

```typescript
// Instead of downloading entire file then transcoding:
1. Download first N MB (e.g., 10MB)
2. Transcode first 10MB to AAC fragmented MP4
3. Start playback while downloading rest
4. As new chunks arrive, append to transcoded output
5. Use MediaSource to append segments as they become available
```

### Priority 3: Improve UX (Medium)

1. Add volume control to hybrid mode UI
2. Show progress during audio transcoding
3. Better error messages with actionable suggestions
4. Keyboard shortcuts for hybrid mode

### Priority 4: Robustness (Low)

1. Better codec detection (probe actual codec, not just extension)
2. Graceful fallback options (download, external player)
3. Reduce audio sync threshold (e.g., 0.1s)
4. Rate-based audio sync instead of jumping

---

## 6. Testing Recommendations

Before implementing fixes, test with:

1. **Small MKV file** (100MB) with DTS audio
   - Verify video appears
   - Verify audio plays
   - Check seek functionality

2. **Large MKV file** (5GB) with FLAC audio
   - Monitor time to first frame
   - Check if audio starts before full download
   - Test seeking to different positions

3. **MP4 with unsupported audio**
   - Verify heuristic catches this case
   - Ensure hybrid mode activates correctly

4. **Tauri vs Web**
   - Confirm hybrid never activates in Tauri
   - Verify native player works in Tauri

---

## 7. Conclusion

### What's Working ✅

1. **Tauri detection** - correctly prevents hybrid mode in Tauri
2. **NetworkReader** - properly handles range requests and caching
3. **Error detection** - identifies when transcoding is needed
4. **Basic infrastructure** - components exist and have correct interfaces

### What's Not Working ⚠️

1. **Video playback in hybrid mode** - no video packets are being fed to VideoRemuxer
2. **True streaming** - audio requires full download before final transcode
3. **Complete UX** - hybrid mode lacks many player features
4. **Robust error handling** - unclear fallback paths

### Recommended Path Forward

1. **Phase 1 (Fix basic playback)**: Implement video packet extraction and feeding to VideoRemuxer
2. **Phase 2 (Improve streaming)**: Implement segmented audio transcoding with progressive MSE append
3. **Phase 3 (Polish)**: Add missing controls, improve UX, better error handling

The core issue is that **the video demuxing/packet extraction step is missing**. Without this, the VideoRemuxer never receives data to remux, and MSE has no video to play.