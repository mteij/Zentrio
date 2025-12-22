# Custom libav.js Build

This directory contains scripts to build a custom libav.js variant (`zentrio`) with AC3 and E-AC3 decoder support.

## Build Options

### Option 1: GitHub Actions (Recommended)

1. Push to the repository (or manually trigger the workflow)
2. Go to **Actions** → **Build Custom libav.js**
3. Download the `libav-zentrio` artifact
4. Extract to `app/public/libav.js-zentrio/`

### Option 2: Local Docker Build

```powershell
# Requires Docker Desktop
.\build-libav.ps1
```

Build takes ~15-20 minutes. Output goes to `public/libav.js-zentrio/`.

## What's Included

The `zentrio` variant extends `variant-webcodecs` with:

| Codec                      | Support        |
| -------------------------- | -------------- |
| AC3 (Dolby Digital)        | ✅ Decoder     |
| E-AC3 (Dolby Digital Plus) | ✅ Decoder     |
| Opus                       | ✅ Codec       |
| FLAC                       | ✅ Codec       |
| AAC                        | 🔍 Parser only |
| VP8/VP9/AV1                | 🔍 Parser only |
| H.264/H.265                | 🔍 Parser only |

## File Structure

```
public/libav.js-zentrio/
├── libav-6.8-zentrio.js       # Main loader
├── libav-6.8-zentrio.wasm     # WASM binary (~3-5MB)
└── libav-6.8-zentrio.asm.js   # asm.js fallback
```

## Rebuilding

To rebuild after libav.js updates:

1. Update `LIBAV_VERSION` in `Dockerfile.libav`
2. Run `.\build-libav.ps1`
3. Test playback with AC3/E-AC3 content

## Patent Notice

- **AC3**: Patents expired (~2017)
- **E-AC3**: Some patents active until ~2024-2028
