import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ExternalLink,
  Play,
  Pause,
  VolumeX,
  Volume2,
  Volume1,
  Maximize,
  Minimize,
  SkipBack,
  SkipForward,
  Settings,
  Subtitles,
  PictureInPicture2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  X,
  Monitor
} from 'lucide-react'
import { Layout, SkeletonPlayer } from '../../components'
import { Stream } from '../../services/addons/types'
import { usePlayer } from '../../hooks/usePlayer'
import { useSubtitles } from '../../hooks/useSubtitles'
import { useExternalPlayer } from '../../hooks/useExternalPlayer'
import { toast } from 'sonner'
import styles from '../../styles/Player.module.css'

interface EpisodeInfo {
  season: number
  number: number
  title: string
}

interface MetaInfo {
  id: string
  type: string
  name: string
  poster?: string
  season?: number
  episode?: number
  videos?: { season: number; number: number; id: string; title?: string }[]
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const SEEK_SECONDS = 10
const CONTROLS_HIDE_DELAY = 3000

export const StreamingPlayer = () => {
  const { profileId } = useParams<{ profileId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerWrapperRef = useRef<HTMLDivElement | null>(null)
  const controlsTimeoutRef = useRef<number | null>(null)

  // Parsed data from URL
  const [stream, setStream] = useState<Stream | null>(null)
  const [meta, setMeta] = useState<MetaInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // UI State
  const [showControls, setShowControls] = useState(true)
  const [showExternalPlayerMenu, setShowExternalPlayerMenu] = useState(false)
  const [showSettingsPanel, setShowSettingsPanel] = useState(false)
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)
  const [showQualityMenu, setShowQualityMenu] = useState(false)
  const [seekIndicator, setSeekIndicator] = useState<'left' | 'right' | null>(null)
  const [showNextEpisode, setShowNextEpisode] = useState(false)
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(10)
  const [previewTime, setPreviewTime] = useState<number | null>(null)
  const [previewPosition, setPreviewPosition] = useState(0)

  // Double-tap detection
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 })

  // Episode navigation
  const [prevEpisode, setPrevEpisode] = useState<EpisodeInfo | null>(null)
  const [nextEpisode, setNextEpisode] = useState<EpisodeInfo | null>(null)

  // Player hook
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isBuffering,
    error: playerError,
    playbackSpeed,
    bufferedProgress,
    isPiPActive,
    qualityLevels,
    currentQuality,
    isFullscreen,
    isMetadataLoaded,
    togglePlay,
    seek,
    seekRelative,
    changeVolume,
    toggleMute,
    setPlaybackSpeed,
    togglePiP,
    setQuality,
    toggleFullscreen
  } = usePlayer({
    url: stream?.url || '',
    videoRef: videoRef as React.RefObject<HTMLVideoElement>,
    autoPlay: true,
    onEnded: handleVideoEnded,
    behaviorHints: stream?.behaviorHints
  })

  // Subtitle hook
  const {
    tracks: subtitleTracks,
    activeTrack,
    currentSubtitle,
    isEnabled: subtitlesEnabled,
    loadSubtitles,
    setActiveTrack,
    toggleSubtitles
  } = useSubtitles({ videoRef: videoRef as React.RefObject<HTMLVideoElement> })

  // External player hook
  const { openInPlayer, getAvailablePlayers } = useExternalPlayer()

  // Parse URL params
  useEffect(() => {
    const streamParam = searchParams.get('stream')
    const metaParam = searchParams.get('meta')

    if (!streamParam || !metaParam) {
      navigate(`/streaming/${profileId}`)
      return
    }

    try {
      const parsedStream = JSON.parse(streamParam)
      const parsedMeta = JSON.parse(metaParam)
      setStream(parsedStream)
      setMeta(parsedMeta)

      // Load subtitles if available in stream
      if (parsedStream.subtitles) {
        parsedStream.subtitles.forEach((sub: { url: string; lang: string }) => {
          loadSubtitles(sub.url, sub.lang, sub.lang)
        })
      }

      // Fetch subtitles from addon services
      const fetchAddonSubtitles = async () => {
        try {
          const contentId = parsedMeta.id
          const contentType = parsedMeta.type
          const res = await fetch(`/api/streaming/subtitles/${contentType}/${contentId}?profileId=${profileId}`)
          if (res.ok) {
            const data = await res.json()
            if (data.subtitles && data.subtitles.length > 0) {
              data.subtitles.forEach((sub: { id: string; url: string; lang: string; addonName?: string }) => {
                const label = sub.addonName ? `${sub.lang} (${sub.addonName})` : sub.lang
                loadSubtitles(sub.url, label, sub.lang)
              })
            }
          }
        } catch (e) {
          console.warn('Failed to fetch addon subtitles', e)
        }
      }
      fetchAddonSubtitles()
    } catch (e) {
      console.error('Failed to parse params', e)
      setError('Invalid player parameters')
    } finally {
      setLoading(false)
    }
  }, [searchParams, profileId, loadSubtitles])

  // Calculate episode navigation
  useEffect(() => {
    if (!meta || meta.type !== 'series' || !meta.videos || !meta.season || !meta.episode) return

    const episodes = meta.videos
      .filter(v => v.season === meta.season)
      .sort((a, b) => a.number - b.number)

    const currentIndex = episodes.findIndex(e => e.number === meta.episode)

    if (currentIndex > 0) {
      const prev = episodes[currentIndex - 1]
      setPrevEpisode({ season: prev.season, number: prev.number, title: prev.title || `Episode ${prev.number}` })
    } else {
      setPrevEpisode(null)
    }

    if (currentIndex < episodes.length - 1) {
      const next = episodes[currentIndex + 1]
      setNextEpisode({ season: next.season, number: next.number, title: next.title || `Episode ${next.number}` })
    } else {
      setNextEpisode(null)
    }
  }, [meta])

  // Show next episode overlay near end
  useEffect(() => {
    if (!nextEpisode || !duration) return

    const timeRemaining = duration - currentTime
    if (timeRemaining <= 30 && timeRemaining > 0 && !showNextEpisode) {
      setShowNextEpisode(true)
      setNextEpisodeCountdown(Math.floor(timeRemaining))
    } else if (timeRemaining > 30) {
      setShowNextEpisode(false)
    }

    if (showNextEpisode) {
      setNextEpisodeCountdown(Math.max(0, Math.floor(timeRemaining)))
    }
  }, [currentTime, duration, nextEpisode, showNextEpisode])

  // Auto-hide controls
  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true)
      return
    }

    const hideControls = () => {
      if (isPlaying && !showExternalPlayerMenu && !showSettingsPanel && !showSubtitleMenu && !showSpeedMenu && !showQualityMenu) {
        setShowControls(false)
      }
    }

    controlsTimeoutRef.current = window.setTimeout(hideControls, CONTROLS_HIDE_DELAY)

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [isPlaying, showControls, showExternalPlayerMenu, showSettingsPanel, showSubtitleMenu, showSpeedMenu, showQualityMenu])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault()
          togglePlay()
          break
        case 'arrowleft':
        case 'j':
          e.preventDefault()
          seekRelative(-SEEK_SECONDS)
          showSeekIndicator('left')
          break
        case 'arrowright':
        case 'l':
          e.preventDefault()
          seekRelative(SEEK_SECONDS)
          showSeekIndicator('right')
          break
        case 'arrowup':
          e.preventDefault()
          changeVolume(volume + 0.1)
          break
        case 'arrowdown':
          e.preventDefault()
          changeVolume(volume - 0.1)
          break
        case 'f':
          e.preventDefault()
          handleFullscreen()
          break
        case 'm':
          e.preventDefault()
          toggleMute()
          break
        case 'p':
          e.preventDefault()
          if (isMetadataLoaded) togglePiP()
          break
        case 's':
          e.preventDefault()
          setShowSubtitleMenu(prev => !prev)
          break
        case '[':
          e.preventDefault()
          cyclePlaybackSpeed(-1)
          break
        case ']':
          e.preventDefault()
          cyclePlaybackSpeed(1)
          break
        case 'escape':
          if (isFullscreen) {
            toggleFullscreen()
          }
          break
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault()
          const percent = parseInt(e.key) / 10
          seek(duration * percent)
          break
      }

      // Show controls on any keypress
      handleMouseMove()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, seekRelative, changeVolume, volume, toggleMute, togglePiP, toggleSubtitles, seek, duration, isFullscreen, toggleFullscreen, isMetadataLoaded])

  function handleVideoEnded() {
    if (nextEpisode && showNextEpisode) {
      goToEpisode(nextEpisode)
    }
  }

  function showSeekIndicator(direction: 'left' | 'right') {
    setSeekIndicator(direction)
    setTimeout(() => setSeekIndicator(null), 500)
  }

  function cyclePlaybackSpeed(direction: number) {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed)
    const newIndex = Math.max(0, Math.min(PLAYBACK_SPEEDS.length - 1, currentIndex + direction))
    setPlaybackSpeed(PLAYBACK_SPEEDS[newIndex])
  }

  function handleMouseMove() {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
  }

  function handleVideoClick(e: React.MouseEvent) {
    const now = Date.now()
    const DOUBLE_TAP_DELAY = 300
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const relativeX = x / rect.width

    if (now - lastTapRef.current.time < DOUBLE_TAP_DELAY) {
      // Double tap detected
      if (relativeX < 0.33) {
        // Left side: seek back
        seekRelative(-SEEK_SECONDS)
        showSeekIndicator('left')
      } else if (relativeX > 0.66) {
        // Right side: seek forward
        seekRelative(SEEK_SECONDS)
        showSeekIndicator('right')
      } else {
        // Center: toggle fullscreen
        handleFullscreen()
      }
    } else {
      // Single tap - toggle play after a brief delay (to check for double tap)
      setTimeout(() => {
        if (Date.now() - lastTapRef.current.time >= DOUBLE_TAP_DELAY) {
          togglePlay()
        }
      }, DOUBLE_TAP_DELAY)
    }

    lastTapRef.current = { time: now, x }
  }

  function handleProgressClick(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    seek(pos * duration)
  }

  function handleProgressHover(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    setPreviewTime(pos * duration)
    setPreviewPosition(e.clientX - rect.left)
  }

  function handleFullscreen() {
    toggleFullscreen(playerWrapperRef.current || undefined)
  }

  async function handleExternalPlayer(player: string) {
    if (!stream?.url) return

    const result = await openInPlayer(player as any, {
      url: stream.url,
      title: meta?.name
    })

    if (result.success) {
      toast.success(result.message)
    } else {
      toast.error(result.message)
    }

    setShowExternalPlayerMenu(false)
  }

  function goToEpisode(episode: EpisodeInfo) {
    if (!meta) return

    // Navigate to fetch streams for the new episode
    navigate(`/streaming/${profileId}/details/${meta.type}/${meta.id}?autoPlayEpisode=${episode.season}-${episode.number}`)
  }

  function formatTime(seconds: number): string {
    if (!seconds || isNaN(seconds)) return '0:00'
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function getVolumeIcon() {
    if (isMuted || volume === 0) return <VolumeX size={20} />
    if (volume < 0.5) return <Volume1 size={20} />
    return <Volume2 size={20} />
  }

  if (loading) return <SkeletonPlayer />
  if (error || playerError) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-red-500">
        {error || playerError}
      </div>
    )
  }
  if (!stream || !meta) return null

  return (
    <Layout title={`Playing: ${meta.name}`} showHeader={false} showFooter={false}>
      <div
        ref={playerWrapperRef}
        className={`${styles.playerWrapper} ${isFullscreen ? styles.fullscreen : ''} ${!showControls && isPlaying ? styles.hideCursor : ''}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        {/* Video Element */}
        <video
          ref={videoRef}
          className={styles.video}
          autoPlay
          playsInline
          poster={meta.poster}
          crossOrigin="anonymous"
          onClick={handleVideoClick}
        >
          Your browser does not support the video tag.
        </video>

        {/* Subtitles Display */}
        {subtitlesEnabled && currentSubtitle && (
          <div className={styles.subtitleContainer}>
            <span className={styles.subtitleText}>{currentSubtitle}</span>
          </div>
        )}

        {/* Controls Overlay */}
        <div className={`${styles.controlsContainer} ${showControls ? styles.visible : ''} ${!isPlaying ? styles.paused : ''}`}>
          {/* Top Bar */}
          <div className={styles.topBar}>
            <div className={styles.topBarLeft}>
              <button className={styles.backButton} onClick={() => navigate(-1)}>
                <ArrowLeft size={20} />
              </button>
              <div className={styles.titleInfo}>
                <div className={styles.title}>
                  {meta.name}
                  {meta.season && meta.episode && (
                    <span className={styles.episodeBadge}>S{meta.season}:E{meta.episode}</span>
                  )}
                </div>
                <div className={styles.streamInfo}>
                    {stream.title || stream.name || 'Playing'}
                    {/* Placeholder for transcoding state if exposed from usePlayer */}
                </div>
              </div>
            </div>

            <div className={styles.topBarRight}>
              {/* External Player Dropdown */}
              <div className={styles.externalPlayerDropdown}>
                <button
                  className={styles.controlButton}
                  onClick={() => setShowExternalPlayerMenu(!showExternalPlayerMenu)}
                  title="Open in External Player"
                >
                  <ExternalLink size={20} />
                </button>
                <div className={`${styles.dropdownMenu} ${showExternalPlayerMenu ? styles.open : ''}`}>
                  {getAvailablePlayers().map(player => (
                    <button
                      key={player.id}
                      className={styles.dropdownItem}
                      onClick={() => handleExternalPlayer(player.id)}
                    >
                      {player.id === 'copy' ? <Copy size={16} /> : <Monitor size={16} />}
                      {player.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Center Controls */}
          <div className={styles.centerControls}>
            {/* Previous Episode */}
            {prevEpisode && (
              <button
                className={styles.episodeNavButton}
                onClick={() => goToEpisode(prevEpisode)}
              >
                <SkipBack size={24} />
                <span className={styles.episodeNavLabel}>Previous</span>
              </button>
            )}

            {/* Play/Pause Large */}
            <button className={styles.playPauseLarge} onClick={togglePlay}>
              {isPlaying ? <Pause size={36} /> : <Play size={36} fill="white" />}
            </button>

            {/* Next Episode */}
            {nextEpisode && (
              <button
                className={styles.episodeNavButton}
                onClick={() => goToEpisode(nextEpisode)}
              >
                <SkipForward size={24} />
                <span className={styles.episodeNavLabel}>Next</span>
              </button>
            )}

            {/* Seek Indicators */}
            <div className={`${styles.seekIndicator} ${styles.left} ${seekIndicator === 'left' ? styles.visible : ''}`}>
              <ChevronLeft size={32} />
              <ChevronLeft size={32} style={{ marginLeft: -20 }} />
              <span className={styles.seekText}>-{SEEK_SECONDS}s</span>
            </div>
            <div className={`${styles.seekIndicator} ${styles.right} ${seekIndicator === 'right' ? styles.visible : ''}`}>
              <ChevronRight size={32} />
              <ChevronRight size={32} style={{ marginLeft: -20 }} />
              <span className={styles.seekText}>+{SEEK_SECONDS}s</span>
            </div>
          </div>

          {/* Buffering Spinner */}
          {isBuffering && (
            <div className={styles.bufferingSpinner}>
              <div className={styles.spinner}></div>
            </div>
          )}

          {/* Bottom Controls */}
          <div className={styles.bottomBar}>
            {/* Progress Bar */}
            <div
              className={styles.progressContainer}
              onClick={handleProgressClick}
              onMouseMove={handleProgressHover}
              onMouseLeave={() => setPreviewTime(null)}
            >
              <div className={styles.progressBar}>
                <div className={styles.progressBuffered} style={{ width: `${bufferedProgress}%` }} />
                <div className={styles.progressFilled} style={{ width: `${(currentTime / duration) * 100}%` }} />
                <div
                  className={styles.progressThumb}
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                />
              </div>
              {previewTime !== null && (
                <div className={styles.timePreview} style={{ left: previewPosition }}>
                  {formatTime(previewTime)}
                </div>
              )}
            </div>

            {/* Controls Row */}
            <div className={styles.controlsRow}>
              <div className={styles.controlsLeft}>
                {/* Play/Pause */}
                <button className={styles.controlButtonSm} onClick={togglePlay}>
                  {isPlaying ? <Pause size={20} /> : <Play size={20} fill="white" />}
                </button>

                {/* Skip Back/Forward */}
                <button className={styles.controlButtonSm} onClick={() => { seekRelative(-SEEK_SECONDS); showSeekIndicator('left') }}>
                  <SkipBack size={18} />
                </button>
                <button className={styles.controlButtonSm} onClick={() => { seekRelative(SEEK_SECONDS); showSeekIndicator('right') }}>
                  <SkipForward size={18} />
                </button>

                {/* Volume */}
                <div className={styles.volumeControl}>
                  <button className={styles.controlButtonSm} onClick={toggleMute}>
                    {getVolumeIcon()}
                  </button>
                  <div className={styles.volumeSliderWrapper}>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => changeVolume(parseFloat(e.target.value))}
                      className={styles.volumeSlider}
                    />
                  </div>
                </div>

                {/* Time Display */}
                <span className={styles.timeDisplay}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>

              <div className={styles.controlsRight}>
                {/* Playback Speed */}
                <button
                  className={styles.speedButton}
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                >
                  {playbackSpeed}x
                </button>
                {showSpeedMenu && (
                  <div className={`${styles.settingsPanel} ${styles.open}`} style={{ bottom: '60px' }}>
                    {PLAYBACK_SPEEDS.map(speed => (
                      <button
                        key={speed}
                        className={styles.settingsItem}
                        onClick={() => { setPlaybackSpeed(speed); setShowSpeedMenu(false) }}
                      >
                        {speed}x
                        {playbackSpeed === speed && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Subtitles */}
                <button
                  className={`${styles.controlButtonSm} ${subtitlesEnabled && activeTrack ? styles.active : ''}`}
                  onClick={() => setShowSubtitleMenu(!showSubtitleMenu)}
                  title="Subtitles (S)"
                >
                  <Subtitles size={20} />
                </button>
                {showSubtitleMenu && (
                  <div className={`${styles.settingsPanel} ${styles.open}`} style={{ bottom: '60px', right: '140px' }}>
                    <div style={{ padding: '8px 12px', fontSize: '12px', color: '#888', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '4px' }}>
                      Subtitles
                    </div>
                    <button
                      className={styles.settingsItem}
                      onClick={() => { setActiveTrack(null); setShowSubtitleMenu(false) }}
                    >
                      Off
                      {(!activeTrack || !subtitlesEnabled) && <Check size={16} />}
                    </button>
                    {subtitleTracks.length > 0 ? (
                      subtitleTracks.map(track => (
                        <button
                          key={track.id}
                          className={styles.settingsItem}
                          onClick={() => { 
                            setActiveTrack(track.id)
                            if (!subtitlesEnabled) toggleSubtitles()
                            setShowSubtitleMenu(false) 
                          }}
                        >
                          {track.label} ({track.language})
                          {activeTrack === track.id && subtitlesEnabled && <Check size={16} />}
                        </button>
                      ))
                    ) : (
                      <div style={{ padding: '12px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
                        No subtitles available
                      </div>
                    )}
                  </div>
                )}

                {/* Quality (if multiple levels available) */}
                {qualityLevels.length > 1 && (
                  <button
                    className={styles.controlButtonSm}
                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                    title="Quality"
                  >
                    <Settings size={20} />
                  </button>
                )}
                {showQualityMenu && qualityLevels.length > 1 && (
                  <div className={`${styles.settingsPanel} ${styles.open}`} style={{ bottom: '60px', right: '100px' }}>
                    <button
                      className={styles.settingsItem}
                      onClick={() => { setQuality(-1); setShowQualityMenu(false) }}
                    >
                      Auto
                      {currentQuality === -1 && <Check size={16} />}
                    </button>
                    {qualityLevels.map(level => (
                      <button
                        key={level.index}
                        className={styles.settingsItem}
                        onClick={() => { setQuality(level.index); setShowQualityMenu(false) }}
                      >
                        {level.label}
                        {currentQuality === level.index && <Check size={16} />}
                      </button>
                    ))}
                  </div>
                )}

                {/* Picture-in-Picture */}
                <button
                  className={`${styles.controlButtonSm} ${isPiPActive ? styles.active : ''}`}
                  onClick={togglePiP}
                  disabled={!isMetadataLoaded}
                  title={isMetadataLoaded ? "Picture-in-Picture (P)" : "Loading..."}
                  style={{ opacity: isMetadataLoaded ? 1 : 0.5 }}
                >
                  <PictureInPicture2 size={20} />
                </button>

                {/* Fullscreen */}
                <button
                  className={styles.controlButtonSm}
                  onClick={handleFullscreen}
                  title="Fullscreen (F)"
                >
                  {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Next Episode Overlay */}
        {showNextEpisode && nextEpisode && (
          <div className={`${styles.nextEpisodeOverlay} ${styles.visible}`}>
            <span className={styles.nextEpisodeTitle}>Up Next</span>
            <span className={styles.nextEpisodeName}>
              S{nextEpisode.season}:E{nextEpisode.number} - {nextEpisode.title}
            </span>
            <div className={styles.nextEpisodeActions}>
              <button
                className={`${styles.nextEpisodeButton} ${styles.primary}`}
                onClick={() => goToEpisode(nextEpisode)}
              >
                Play Now
              </button>
              <button
                className={`${styles.nextEpisodeButton} ${styles.secondary}`}
                onClick={() => setShowNextEpisode(false)}
              >
                <X size={16} />
              </button>
            </div>
            <span className={styles.countdown}>Auto-play in {nextEpisodeCountdown}s</span>
          </div>
        )}
      </div>
    </Layout>
  )
}