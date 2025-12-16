import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Play, Pause, VolumeX, Volume2, Maximize, Minimize } from 'lucide-react'
import { Layout, LoadingSpinner } from '../../components'
import { Stream } from '../../services/addons/types'
import { usePlayer } from '../../hooks/usePlayer'


export const StreamingPlayer = () => {
  const { profileId } = useParams<{ profileId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [stream, setStream] = useState<Stream | null>(null)
  const [meta, setMeta] = useState<{ id: string, type: string, name: string, poster?: string, season?: number, episode?: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const streamParam = searchParams.get('stream')
    const metaParam = searchParams.get('meta')

    if (!streamParam || !metaParam) {
      navigate(`/streaming/${profileId}`)
      return
    }

    try {
      setStream(JSON.parse(streamParam))
      setMeta(JSON.parse(metaParam))
    } catch (e) {
      console.error('Failed to parse params', e)
      setError('Invalid player parameters')
    } finally {
      setLoading(false)
    }
  }, [searchParams, profileId])

  const { isPlaying, currentTime, duration, volume, isMuted, isBuffering, error: playerError, togglePlay, seek, changeVolume, toggleMute } = usePlayer({
    url: stream?.url || '',
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    autoPlay: true
  })

  // Gesture handling
  const lastTapRef = useRef(0)
  const handleVideoClick = (e: React.MouseEvent) => {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300
    
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      
      if (x < rect.width / 3) {
        // Left side: seek back 10s
        seek(currentTime - 10)
      } else if (x > (rect.width * 2) / 3) {
        // Right side: seek forward 10s
        seek(currentTime + 10)
      } else {
        // Center: toggle play/pause
        togglePlay()
      }
    } else {
      // Single tap: toggle play/pause (or show controls)
      // For now, just toggle play/pause on single click if not double tap
      // But we need to wait to see if it's a double tap
      // A simple timeout can work, but might feel laggy.
      // Standard behavior: single tap toggles controls, double tap seeks.
      // Let's implement: click toggles play/pause immediately for responsiveness,
      // but double tap overrides it (might cause a quick pause/play glitch but acceptable for MVP)
      togglePlay()
    }
    lastTapRef.current = now
  }

  if (loading) return <LoadingSpinner />
  if (error || playerError) return <div className="flex items-center justify-center h-screen text-red-500">{error || playerError}</div>
  if (!stream || !meta) return null

  return (
    <Layout title={`Playing: ${meta.name}`}>
      <div className="relative w-full h-screen bg-black overflow-hidden group" id="playerWrapper">
        <video
          ref={videoRef}
          id="videoPlayer"
          className="w-full h-full object-contain"
          autoPlay
          playsInline
          poster={meta.poster}
          crossOrigin="anonymous"
          onClick={handleVideoClick}
        >
          Your browser does not support the video tag.
        </video>

        {/* Overlay - visible when paused or hovering */}
        <div
          className={`absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/70 transition-opacity duration-300 flex flex-col justify-between p-6 ${!isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          id="playerOverlay"
        >
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="text-white hover:text-purple-400 transition-colors">
              <ArrowLeft size={28} />
            </button>
            <div className="flex flex-col">
              <div className="text-white font-bold text-lg flex items-center gap-2">
                {meta.name}
                {meta.season && meta.episode && <span className="bg-white/20 px-2 py-0.5 rounded text-xs">S{meta.season}:E{meta.episode}</span>}
              </div>
              <div className="text-gray-400 text-sm">{stream.title || stream.name || 'Playing'}</div>
            </div>
            <button
                className="ml-auto text-white hover:text-purple-400 transition-colors"
                onClick={() => window.open(`vlc://${stream.url}`, '_blank')}
                title="Open in External Player"
            >
                <ExternalLink size={24} />
            </button>
          </div>

          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent">
            {/* Progress Bar */}
            <div
              className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-4 relative group/progress"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const pos = (e.clientX - rect.left) / rect.width
                seek(pos * duration)
              }}
            >
                <div
                  className="h-full bg-purple-500 rounded-full relative"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg"></div>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button className="text-white hover:text-purple-400 transition-colors" onClick={togglePlay}>
                        {isPlaying ? <Pause size={32} /> : <Play size={32} />}
                    </button>
                    
                    <div className="flex items-center gap-2 group/volume">
                        <button className="text-white hover:text-purple-400 transition-colors" onClick={toggleMute}>
                            {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
                        </button>
                        <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300">
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={isMuted ? 0 : volume}
                                onChange={(e) => changeVolume(parseFloat(e.target.value))}
                                className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                        </div>
                    </div>

                    <div className="text-white font-mono text-sm">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button className="text-white hover:text-purple-400 transition-colors" onClick={() => {
                        if (document.fullscreenElement) {
                            document.exitFullscreen()
                        } else {
                            document.getElementById('playerWrapper')?.requestFullscreen()
                        }
                    }}>
                        {document.fullscreenElement ? <Minimize size={24} /> : <Maximize size={24} />}
                    </button>
                </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

function formatTime(seconds: number) {
    if (!seconds || isNaN(seconds)) return "0:00"
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    
    if (h > 0) {
        return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m}:${s.toString().padStart(2, '0')}`
}