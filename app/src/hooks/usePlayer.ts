import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import Hls from 'hls.js'
import { useCast } from '../contexts/CastContext'

interface UsePlayerProps {
  url: string
  videoRef: React.RefObject<HTMLVideoElement>
  autoPlay?: boolean
  onEnded?: () => void
  behaviorHints?: {
      notWebReady?: boolean
  }
}

interface QualityLevel {
  index: number
  height: number
  width: number
  bitrate: number
  label: string
}

export function usePlayer({ url, videoRef, autoPlay = true, onEnded, behaviorHints }: UsePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('player-volume')
    return saved ? parseFloat(saved) : 1
  })
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('player-muted') === 'true'
  })
  const [isBuffering, setIsBuffering] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [playbackSpeed, setPlaybackSpeedState] = useState(1)
  const [bufferedProgress, setBufferedProgress] = useState(0)
  const [isPiPActive, setIsPiPActive] = useState(false)
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([])
  const [currentQuality, setCurrentQualityState] = useState(-1) // -1 = auto
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false)
  
  const hlsRef = useRef<Hls | null>(null)
  const onEndedRef = useRef(onEnded)
  const initialVolumeApplied = useRef(false)
  const { isConnected: isCastConnected, castSession } = useCast()
  
  // Effect to pause local video when cast connects
  useEffect(() => {
    const video = videoRef.current
    if (isCastConnected && video && !video.paused) {
        console.log("Cast connected, pausing local video")
        video.pause() // Pause local if casting starts
    }
  }, [isCastConnected, videoRef])
  
  // Keep onEnded ref updated without causing re-renders
  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

    // Transcoder integration - simplified for proper fMP4 output
    const startTranscoding = useCallback(async () => {
        try {
            const video = videoRef.current;
            if (!video) return;

            toast.loading("Preparing to transcode...", { id: 'transcode-progress' });
            const { transcoder } = await import('../services/transcoder/TranscoderService');
            console.log('Starting transcoding for', url);
            
            // Setup MediaSource
            const mediaSource = new MediaSource();
            const originalSrc = video.src;
            video.src = URL.createObjectURL(mediaSource);
            
            mediaSource.addEventListener('sourceopen', async () => {
                try {
                    // Always use H.264 + AAC for maximum compatibility
                    // Source codec can vary (proxy streams, etc.), so we re-encode to guarantee H.264
                    const mimeType = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
                    
                    if (!MediaSource.isTypeSupported(mimeType)) {
                        throw new Error("Browser doesn't support H.264 in MSE");
                    }

                    console.log("MSE: Creating SourceBuffer with:", mimeType);
                    const sourceBuffer = mediaSource.addSourceBuffer(mimeType);
                    
                    // Track whether we've received the first chunk (init segment)
                    let isFirstChunk = true;
                    let chunksReceived = 0;
                    
                    // Helper to find MP4 box boundaries
                    const findBox = (data: Uint8Array, boxType: string, start = 0): { offset: number, size: number } | null => {
                        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
                        const typeCode = boxType.charCodeAt(0) << 24 | boxType.charCodeAt(1) << 16 | 
                                        boxType.charCodeAt(2) << 8 | boxType.charCodeAt(3);
                        let offset = start;
                        while (offset < data.byteLength - 8) {
                            const size = view.getUint32(offset, false);
                            const type = view.getUint32(offset + 4, false);
                            if (size === 0 || size > data.byteLength - offset) break;
                            if (type === typeCode) return { offset, size };
                            offset += size;
                        }
                        return null;
                    };
                    
                    // Helper to strip init segment (ftyp + moov) from data
                    const stripInitSegment = (data: Uint8Array): Uint8Array => {
                        const ftyp = findBox(data, 'ftyp');
                        const moov = findBox(data, 'moov');
                        const moof = findBox(data, 'moof');
                        
                        if (!moof) {
                            console.warn("MSE: No moof box found in chunk");
                            return data;
                        }
                        
                        // Return data starting from first moof
                        console.log(`MSE: Stripping init segment, moof starts at offset ${moof.offset}`);
                        return data.slice(moof.offset);
                    };
                    
                    // Handle transcoding - copy video if HEVC is supported, otherwise re-encode
                    await transcoder.transcode(url, {
                        onData: async (data: Uint8Array) => {
                            chunksReceived++;
                            console.log(`MSE: Received chunk ${chunksReceived} (${(data.byteLength / 1024 / 1024).toFixed(2)} MB)`);
                            
                            // Process the data
                            let dataToAppend: Uint8Array;
                            
                            if (isFirstChunk) {
                                // First chunk: append everything (ftyp + moov + moof + mdat)
                                dataToAppend = data;
                                isFirstChunk = false;
                                console.log("MSE: Appending first chunk with init segment");
                            } else {
                                // Subsequent chunks: strip ftyp and moov, keep only moof + mdat
                                dataToAppend = stripInitSegment(data);
                                console.log(`MSE: Appending chunk ${chunksReceived} (${(dataToAppend.byteLength / 1024 / 1024).toFixed(2)} MB stripped)`);
                            }
                            
                            // Wait for any pending updates
                            while (sourceBuffer.updating) {
                                await new Promise(r => setTimeout(r, 10));
                            }
                            
                            // Check MediaSource is still open
                            if (mediaSource.readyState !== 'open') {
                                console.warn("MSE: MediaSource no longer open, stopping");
                                return;
                            }
                            
                            // Append the data
                            await new Promise<void>((resolve, reject) => {
                                const onUpdateEnd = () => {
                                    sourceBuffer.removeEventListener('updateend', onUpdateEnd);
                                    sourceBuffer.removeEventListener('error', onError);
                                    console.log("MSE: Chunk appended successfully");
                                    resolve();
                                };
                                
                                const onError = (e: Event) => {
                                    sourceBuffer.removeEventListener('updateend', onUpdateEnd);
                                    sourceBuffer.removeEventListener('error', onError);
                                    console.error("MSE: SourceBuffer error", e);
                                    // Don't reject for non-first chunks, try to continue
                                    if (chunksReceived === 1) {
                                        reject(new Error('SourceBuffer append failed'));
                                    } else {
                                        console.warn("MSE: Continuing despite error on chunk", chunksReceived);
                                        resolve();
                                    }
                                };
                                
                                sourceBuffer.addEventListener('updateend', onUpdateEnd);
                                sourceBuffer.addEventListener('error', onError);
                                
                                try {
                                    const arrayBuffer = new ArrayBuffer(dataToAppend.byteLength);
                                    new Uint8Array(arrayBuffer).set(dataToAppend);
                                    sourceBuffer.appendBuffer(arrayBuffer);
                                } catch (e) {
                                    sourceBuffer.removeEventListener('updateend', onUpdateEnd);
                                    sourceBuffer.removeEventListener('error', onError);
                                    if (chunksReceived === 1) {
                                        reject(e);
                                    } else {
                                        console.warn("MSE: Error appending chunk", chunksReceived, e);
                                        resolve();
                                    }
                                }
                            });
                            
                            // Start playback once we have first chunk
                            if (chunksReceived === 1 && video.paused && video.readyState >= 2) {
                                video.play().catch(e => console.log('Autoplay blocked:', e));
                            }
                        },
                        onProgress: (progress: number, stage: 'downloading' | 'transcoding') => {
                            // Show progress toast (throttled)
                            const message = stage === 'downloading' 
                                ? `Downloading: ${progress}%`
                                : `Transcoding: ${progress}%`;
                            toast.loading(message, { id: 'transcode-progress' });
                        },
                        onError: (error: Error) => {
                            console.error("Transcoding error:", error);
                            toast.dismiss('transcode-progress');
                            setError(`Transcoding failed: ${error.message}`);
                            toast.error(error.message);
                    });
                    
                    
                    // End the stream when transcoding is complete
                    if (mediaSource.readyState === 'open') {
                        // Wait for final buffer update
                        while (sourceBuffer.updating) {
                            await new Promise(r => setTimeout(r, 10));
                        }
                        mediaSource.endOfStream();
                        console.log("MSE: Stream ended successfully");
                        toast.dismiss('transcode-progress');
                        toast.success("Video ready!");
                        setIsBuffering(false);
                    }
                    
                } catch (e) {
                    console.error("MSE/Transcoding error:", e);
                    toast.dismiss('transcode-progress');
                    toast.error("Transcoding failed: " + (e instanceof Error ? e.message : String(e)));
                    // Fallback to original source
                    video.src = originalSrc;
                    setError('Transcoding failed');
                }
            }, { once: true });
            
            mediaSource.addEventListener('error', (e) => {
                console.error('MediaSource error:', e);
                setError('MediaSource error occurred');
            });
           
        } catch (e) {
            console.error("Transcoding start failed", e);
            toast.error("Transcoding failed: " + (e instanceof Error ? e.message : String(e)));
        }
    }, [url, videoRef])

  // Detect if running in Tauri (native app) - use native video decoding
  const isTauri = useMemo(() => !!(window as any).__TAURI__, [])

  // Main effect for video setup - only depends on url and videoRef
  useEffect(() => {
    const video = videoRef.current
    if (!video || !url) return

    // Reset state for new video
    setIsMetadataLoaded(false)
    setIsBuffering(true)
    setError(null)
    setQualityLevels([])
    setCurrentQualityState(-1)
    
    // Check hints
    if (behaviorHints?.notWebReady) {
        console.warn("Stream marked as not web ready (likely unsupported audio). Readying transcoder...")
        startTranscoding()
    }

    /* ... rest of hook unchanged ... */

    const isHls = url.includes('.m3u8')

    const handleError = (e: Event | string) => {
      const video = videoRef.current
      console.error('Player error:', e)
      if (video?.error) {
        console.error('Video Error Details:', {
            code: video.error.code,
            message: video.error.message
        })
      }
      setError('Playback error occurred')
      setIsBuffering(false)
    }

    const handleLoadedMetadata = () => {
      setIsMetadataLoaded(true)
      setDuration(video.duration)
      
      // Apply initial volume settings only once
      if (!initialVolumeApplied.current) {
        const savedVolume = localStorage.getItem('player-volume')
        const savedMuted = localStorage.getItem('player-muted')
        if (savedVolume) video.volume = parseFloat(savedVolume)
        if (savedMuted) video.muted = savedMuted === 'true'
        initialVolumeApplied.current = true
      }
    }

    const handleWaiting = () => setIsBuffering(true)
    const handleCanPlay = () => setIsBuffering(false)
    const handlePlaying = () => {
      setIsBuffering(false)
      setIsPlaying(true)
    }
    const handlePause = () => setIsPlaying(false)
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      // Update buffered progress
      if (video.buffered.length > 0 && video.duration > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1)
        setBufferedProgress((bufferedEnd / video.duration) * 100)
      }
    }
    const handleDurationChange = () => setDuration(video.duration)
    const handleVolumeChange = () => {
      setVolume(video.volume)
      setIsMuted(video.muted)
      localStorage.setItem('player-volume', String(video.volume))
      localStorage.setItem('player-muted', String(video.muted))
    }
    const handleEnded = () => {
      setIsPlaying(false)
      onEndedRef.current?.()
    }
    const handleRateChange = () => {
      setPlaybackSpeedState(video.playbackRate)
    }

    // PiP events
    const handlePiPEnter = () => setIsPiPActive(true)
    const handlePiPExit = () => setIsPiPActive(false)

    // Fullscreen events
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    video.addEventListener('error', handleError)
    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('playing', handlePlaying)
    video.addEventListener('pause', handlePause)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('durationchange', handleDurationChange)
    video.addEventListener('volumechange', handleVolumeChange)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('ratechange', handleRateChange)
    video.addEventListener('enterpictureinpicture', handlePiPEnter)
    video.addEventListener('leavepictureinpicture', handlePiPExit)
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    // Cleanup previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    // In Tauri native app, always use native video decoding for better codec support
    // The native webview has access to system codecs (including HEVC, etc.)
    if (isTauri) {
      // Native Tauri: Use native video element with system decoders
      video.src = url
      if (autoPlay) {
        video.addEventListener('canplaythrough', () => {
          video.play().catch(e => console.log('Autoplay blocked:', e))
        }, { once: true })
      }
    } else if (isHls && Hls.isSupported()) {
      // Web browser with HLS.js
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false, // More stable playback
        startLevel: -1, // Auto quality
        capLevelToPlayerSize: true,
      })
      hlsRef.current = hls
      
      // Error handling for CODEC issues
      hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.details === Hls.ErrorDetails.BUFFER_ADD_CODEC_ERROR || data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
              // Potential codec issue, try transcoding?
              console.warn("HLS Error hit, checking for transcoding need...", data)
              startTranscoding()
          }
      })
      
      hls.loadSource(url)
      hls.attachMedia(video)
      
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        // Extract quality levels
        const levels: QualityLevel[] = data.levels.map((level, index) => ({
          index,
          height: level.height,
          width: level.width,
          bitrate: level.bitrate,
          label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)}kbps`
        }))
        setQualityLevels(levels)
        
        if (autoPlay) {
          video.play().catch(e => console.log('Autoplay blocked:', e))
        }
      })
      
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentQualityState(data.level)
      })
      
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, attempting to recover...')
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, attempting to recover...')
              hls.recoverMediaError()
              break
            default:
              handleError('Fatal HLS error')
              hls.destroy()
              break
          }
        }
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = url
      if (autoPlay) {
        video.addEventListener('canplaythrough', () => {
          video.play().catch(e => console.log('Autoplay blocked:', e))
        }, { once: true })
      }
    } else {
      // Regular video source
      // Check if we suspect unsupported audio? 
      // We can hook into 'error' event on video too
      
      video.src = url
      if (autoPlay) {
        video.addEventListener('canplaythrough', () => {
          video.play().catch(e => console.log('Autoplay blocked:', e))
        }, { once: true })
      }
    }

    return () => {
      video.removeEventListener('error', handleError)
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('waiting', handleWaiting)
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('playing', handlePlaying)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('durationchange', handleDurationChange)
      video.removeEventListener('volumechange', handleVolumeChange)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('ratechange', handleRateChange)
      video.removeEventListener('enterpictureinpicture', handlePiPEnter)
      video.removeEventListener('leavepictureinpicture', handlePiPExit)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [url, videoRef, autoPlay, isTauri, startTranscoding]) // Removed onEnded from deps - using ref instead

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    
    if (video.paused) {
      video.play().catch(e => console.log('Play failed:', e))
    } else {
      video.pause()
    }
  }, [videoRef])

  const seek = useCallback((time: number) => {
    const video = videoRef.current
    if (!video || !isMetadataLoaded) return
    video.currentTime = Math.max(0, Math.min(time, video.duration || duration))
  }, [videoRef, isMetadataLoaded, duration])

  const seekRelative = useCallback((delta: number) => {
    const video = videoRef.current
    if (!video || !isMetadataLoaded) return
    const newTime = video.currentTime + delta
    video.currentTime = Math.max(0, Math.min(newTime, video.duration || duration))
  }, [videoRef, isMetadataLoaded, duration])

  const changeVolume = useCallback((newVolume: number) => {
    const video = videoRef.current
    if (!video) return
    const clampedVolume = Math.max(0, Math.min(newVolume, 1))
    video.volume = clampedVolume
    video.muted = clampedVolume === 0
  }, [videoRef])

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
  }, [videoRef])

  const setPlaybackSpeed = useCallback((speed: number) => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = speed
  }, [videoRef])

  const togglePiP = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    
    // Check if metadata is loaded before requesting PiP
    if (!isMetadataLoaded) {
      console.warn('Cannot enable PiP: video metadata not loaded yet')
      return
    }
    
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture()
      } else if (document.pictureInPictureEnabled && video.readyState >= 1) {
        await video.requestPictureInPicture()
      }
    } catch (error) {
      console.error('PiP error:', error)
    }
  }, [videoRef, isMetadataLoaded])

  const setQuality = useCallback((levelIndex: number) => {
    if (!hlsRef.current) return
    hlsRef.current.currentLevel = levelIndex // -1 for auto
    setCurrentQualityState(levelIndex)
  }, [])

  const toggleFullscreen = useCallback(async (containerElement?: HTMLElement) => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        const element = containerElement || videoRef.current?.parentElement || videoRef.current
        await element?.requestFullscreen()
      }
    } catch (error) {
      console.error('Fullscreen error:', error)
    }
  }, [videoRef])

  return {
    // State
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isBuffering,
    error,
    playbackSpeed,
    bufferedProgress,
    isPiPActive,
    qualityLevels,
    currentQuality,
    isFullscreen,
    isMetadataLoaded,
    isTauri,
    
    // Actions
    togglePlay,
    seek,
    seekRelative,
    changeVolume,
    toggleMute,
    setPlaybackSpeed,
    togglePiP,
    setQuality,
    toggleFullscreen,
    
    // HLS instance for advanced control
    hls: hlsRef.current
  }
}