import { useState, useEffect, useRef, useCallback } from 'react'
import Hls from 'hls.js'

interface UsePlayerProps {
  url: string
  videoRef: React.RefObject<HTMLVideoElement>
  autoPlay?: boolean
}

export function usePlayer({ url, videoRef, autoPlay = true }: UsePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isBuffering, setIsBuffering] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const hlsRef = useRef<Hls | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !url) return

    const isNative = !!(window as any).__TAURI__
    const isHls = url.includes('.m3u8')

    const handleError = (e: Event | string) => {
      console.error('Player error:', e)
      setError('Playback error occurred')
      setIsBuffering(false)
    }

    const handleWaiting = () => setIsBuffering(true)
    const handlePlaying = () => {
      setIsBuffering(false)
      setIsPlaying(true)
    }
    const handlePause = () => setIsPlaying(false)
    const handleTimeUpdate = () => setCurrentTime(video.currentTime)
    const handleDurationChange = () => setDuration(video.duration)
    const handleVolumeChange = () => {
      setVolume(video.volume)
      setIsMuted(video.muted)
    }

    video.addEventListener('error', handleError)
    video.addEventListener('waiting', handleWaiting)
    video.addEventListener('playing', handlePlaying)
    video.addEventListener('pause', handlePause)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('durationchange', handleDurationChange)
    video.addEventListener('volumechange', handleVolumeChange)

    if (isNative) {
      video.src = url
    } else if (isHls && Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy()
      }
      const hls = new Hls()
      hlsRef.current = hls
      hls.loadSource(url)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (autoPlay) {
          video.play().catch(e => console.log('Autoplay blocked', e))
        }
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
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
      video.src = url
      if (autoPlay) {
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(e => console.log('Autoplay blocked', e))
        })
      }
    } else {
      video.src = url
    }

    return () => {
      video.removeEventListener('error', handleError)
      video.removeEventListener('waiting', handleWaiting)
      video.removeEventListener('playing', handlePlaying)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('durationchange', handleDurationChange)
      video.removeEventListener('volumechange', handleVolumeChange)
      
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [url, videoRef, autoPlay])

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return
    if (videoRef.current.paused) {
      videoRef.current.play()
    } else {
      videoRef.current.pause()
    }
  }, [videoRef])

  const seek = useCallback((time: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = Math.max(0, Math.min(time, duration))
  }, [videoRef, duration])

  const changeVolume = useCallback((newVolume: number) => {
    if (!videoRef.current) return
    videoRef.current.volume = Math.max(0, Math.min(newVolume, 1))
    videoRef.current.muted = newVolume === 0
  }, [videoRef])

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return
    videoRef.current.muted = !videoRef.current.muted
  }, [videoRef])

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isBuffering,
    error,
    togglePlay,
    seek,
    changeVolume,
    toggleMute
  }
}