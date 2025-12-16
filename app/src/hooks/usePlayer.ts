import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Hls from 'hls.js'

interface UsePlayerProps {
  url: string
  videoRef: React.RefObject<HTMLVideoElement>
  autoPlay?: boolean
  onEnded?: () => void
}

interface QualityLevel {
  index: number
  height: number
  width: number
  bitrate: number
  label: string
}

export function usePlayer({ url, videoRef, autoPlay = true, onEnded }: UsePlayerProps) {
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
  
  // Keep onEnded ref updated without causing re-renders
  useEffect(() => {
    onEndedRef.current = onEnded
  }, [onEnded])

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

    const isHls = url.includes('.m3u8')

    const handleError = (e: Event | string) => {
      console.error('Player error:', e)
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
  }, [url, videoRef, autoPlay, isTauri]) // Removed onEnded from deps - using ref instead

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