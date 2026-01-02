import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { Play, Plus, Check, ArrowLeft, Zap, HardDrive, Wifi, Eye, EyeOff, MoreVertical, ChevronUp, Youtube, Info, List } from 'lucide-react'

import { Layout, LazyImage, RatingBadge, SkeletonDetails, SkeletonStreamList } from '../../components'
import { DropdownMenu } from '../../components/ui/DropdownMenu'
import { ContextMenu } from '../../components/ui/ContextMenu'
import { StreamRefreshButton } from '../../components/features/StreamRefreshButton'
import { CompactStreamItem } from '../../components/features/CompactStreamItem'
import { CastCard } from '../../components/features/CastCard'
import { InfoModal } from '../../components/features/InfoModal'
import { ListSelectionModal } from '../../components/features/ListSelectionModal'
import { MetaDetail, Stream, Manifest } from '../../services/addons/types'
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings'
import { useStreamLoader, FlatStream, AddonLoadingState } from '../../hooks/useStreamLoader'
import { useStreamDisplaySettings } from '../../hooks/useStreamDisplaySettings'
import { useAutoPlay } from '../../hooks/useAutoPlay'
import { toast } from 'sonner'
import styles from '../../styles/Streaming.module.css'
import { apiFetch } from '../../lib/apiFetch'

interface StreamingDetailsData {
  meta: MetaDetail
  inLibrary: boolean
  watchProgress?: {
    position: number
    duration: number
    progressPercent: number
    isWatched: boolean
  }
  seriesProgress?: Record<string, {
    position: number
    duration: number
    progressPercent: number
    isWatched: boolean
  }>
  lastWatchedEpisode?: {
    season: number
    episode: number
  }
}

export const StreamingDetails = () => {
  const { profileId, type, id } = useParams<{ profileId: string, type: string, id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { showImdbRatings, showAgeRatings } = useAppearanceSettings()
  const streamDisplaySettings = useStreamDisplaySettings(profileId)
  const [data, setData] = useState<StreamingDetailsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [episodes, setEpisodes] = useState<any[]>([])
  const [view, setView] = useState<'details' | 'episodes' | 'streams'>('details')
  const [selectedEpisode, setSelectedEpisode] = useState<{ season: number, number: number, title: string } | null>(null)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [showListModal, setShowListModal] = useState(false)
  const [inList, setInList] = useState(false)
  
  // Progressive stream loading hook
  const {
    streams,
    filteredStreams,
    addonStatuses,
    selectedAddon,
    setSelectedAddon,
    isLoading: streamsLoading,
    isComplete: streamsComplete,
    totalCount,
    cacheStatus,
    loadStreams: loadStreamsProgressive,
    refreshStreams,
    reset: resetStreams
  } = useStreamLoader()


  useEffect(() => {
    if (!profileId || !type || !id) {
      navigate('/profiles')
      return
    }
    loadDetails()
    checkListStatus()
  }, [profileId, type, id])

  const checkListStatus = async () => {
    // Prefer using loaded data meta.id, fallback to params id
    const checkId = data?.meta?.id || id
    if (!profileId || !checkId) return
    
    try {
      const res = await apiFetch(`/api/lists/check/${encodeURIComponent(checkId)}?profileId=${profileId}&t=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        setInList(data.listIds.length > 0)
      }
    } catch (e) {
      console.error("Failed to check list status", e)
    }
  }

  const loadDetails = async () => {
    try {
      // Get metaFallback from URL if present (for addons without meta resource)
      const searchParams = new URLSearchParams(window.location.search)
      const metaFallback = searchParams.get('metaFallback')
      
      let url = `/api/streaming/details/${type}/${id}?profileId=${profileId}`
      if (metaFallback) {
        url += `&metaFallback=${metaFallback}`
      }
      
      const res = await apiFetch(url)
      if (!res.ok) throw new Error('Failed to load content')
      const detailsData = await res.json()
      setData(detailsData)
      
        if (detailsData.meta.type === 'series' && detailsData.meta.videos) {
        const seasons = Array.from(new Set(detailsData.meta.videos.map((v: any) => v.season || 0))).sort((a: any, b: any) => a - b) as number[]
        const filteredSeasons = seasons.length > 1 ? seasons.filter((s: number) => s !== 0) : seasons
        
        // Auto-select season based on last watched episode if available
        let initialSeason = filteredSeasons[0]
        if (detailsData.lastWatchedEpisode && detailsData.lastWatchedEpisode.season) {
          const lastSeason = detailsData.lastWatchedEpisode.season
          if (filteredSeasons.includes(lastSeason)) {
            initialSeason = lastSeason
          }
        }
        
        // Check for auto-play intent
        const shouldAutoPlay = location.state?.autoPlay
        
        if (shouldAutoPlay) {
            // Clear autoPlay intent to prevent loop on back navigation
            navigate('.', { replace: true, state: { ...location.state, autoPlay: false } })

            // Determine episode to play
            let targetSeason = location.state?.season || initialSeason
            let targetEpisode = location.state?.episode
            
            // If explicit episode not provided, try to find next to watch or first
            if (!targetEpisode) {
                if (detailsData.lastWatchedEpisode) {
                     // TODO: Logic to Increment? For now rely on state or default 1
                     targetEpisode = detailsData.lastWatchedEpisode.episode
                } else {
                    targetEpisode = 1
                }
            }

            toast.loading(`Finding best stream for S${targetSeason}:E${targetEpisode}...`, { id: 'autoplay-loading' })
            setSelectedSeason(targetSeason)
            setSelectedEpisode({ season: targetSeason, number: targetEpisode, title: location.state?.title || `Episode ${targetEpisode}` })
            loadStreams(targetSeason, targetEpisode, undefined, true)
            // Keep view on details (background loading)
        } else {
            setSelectedSeason(initialSeason)
            setView('episodes')
        }

      } else {
        // Movie
        const shouldAutoPlay = location.state?.autoPlay
        
        if (shouldAutoPlay) {
            navigate('.', { replace: true, state: { ...location.state, autoPlay: false } })
            toast.loading(`Finding best stream...`, { id: 'autoplay-loading' })
            loadStreams(undefined, undefined, undefined, true)
            // Keep view on details
        } else {
            loadStreams(undefined, undefined, undefined)
            setView('streams')
        }
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load content')
    } finally {
      setLoading(false)
    }
  }

  // State for auto-play tracking
  const autoPlayRef = useRef<boolean>(false)
  
  const loadStreams = (season?: number, episode?: number, overrideId?: string, autoPlay: boolean = false) => {
    autoPlayRef.current = autoPlay
    
    // Do not force imdb_id here; addons may require custom IDs.
    // Backend will resolve the best addon-compatible ID (custom vs imdb_id) per addon.
    const fetchId = overrideId || id
    if (!fetchId || !profileId) return
    
    loadStreamsProgressive(
      type || '',
      fetchId,
      profileId,
      season,
      episode
    )
  }
  
  // Handle auto-play when streams arrive
  // Handle auto-play when streams arrive
  useEffect(() => {
    if (autoPlayRef.current && streams.length > 0) {
      toast.dismiss('autoplay-loading')
      // streams is now a flat sorted list (FlatStream[])
      // Pass true to replace history (skip details page on back)
      handlePlay(streams[0].stream, true)
      autoPlayRef.current = false
    } else if (autoPlayRef.current && streamsComplete && streams.length === 0) {
        // Fallback if no streams found
        toast.dismiss('autoplay-loading')
        toast.error('No auto-play streams found. Please select manually.')
        setView('streams')
        autoPlayRef.current = false
    }
  }, [streams, streamsComplete])

  // filteredStreams comes from hook - already sorted by backend sortIndex
  // totalStreamCount is now based on totalCount from hook


  // Helper to parse stream information
  const parseStreamInfo = (stream: Stream) => {
    const name = stream.name || ''
    const title = stream.title || ''
    const desc = stream.description || ''
    const combined = `${name} ${title} ${desc}`.toLowerCase()
    
    // Resolution
    let resolution = ''
    if (combined.includes('4k') || combined.includes('2160p')) resolution = '4K'
    else if (combined.includes('1080p')) resolution = '1080p'
    else if (combined.includes('720p')) resolution = '720p'
    else if (combined.includes('480p')) resolution = '480p'
    
    // Size
    const sizeMatch = combined.match(/(\d+(?:\.\d+)?)\s*(gb|mb)/i)
    let size = ''
    if (sizeMatch) {
      const val = parseFloat(sizeMatch[1])
      const unit = sizeMatch[2].toUpperCase()
      size = `${val} ${unit}`
    }
    
    // Cached status
    const cachedIndicators = ['cached', '⚡', '+', '✓', 'instant', 'your media', '[tb+]']
    const uncachedIndicators = ['⬇️', '⬇', '⏳', 'uncached', 'download']
    
    const isExplicitlyUncached = uncachedIndicators.some(indicator => 
      combined.includes(indicator.toLowerCase()) || name.includes(indicator) || title.includes(indicator)
    )
    
    const isCached = !isExplicitlyUncached && cachedIndicators.some(indicator => 
      combined.includes(indicator.toLowerCase()) || name.includes(indicator) || title.includes(indicator)
    )
    
    // HDR/DV
    const hasHDR = combined.includes('hdr')
    const hasDV = combined.includes('dv') || combined.includes('dolby vision')
    
    return { resolution, size, isCached, hasHDR, hasDV }
  }

  // Count total streams - use totalCount from hook (which tracks unfiltered count)
  const totalStreamCount = totalCount


  // Quick play for episodes - uses unified auto-play hook
  const { startAutoPlay } = useAutoPlay()
  
  const handleQuickPlay = (season: number, number: number, title: string) => {
    if (!data) return
    
    // Use unified auto-play hook for background stream fetching
    startAutoPlay({
      profileId: profileId || '',
      meta: {
        id: data.meta.id,
        type: data.meta.type,
        name: data.meta.name,
        poster: data.meta.poster
      },
      season,
      episode: number
    })
  }
  
  // Movie auto-play handler
  const handleMoviePlay = () => {
    if (!data || !profileId) return
    
    startAutoPlay({
      profileId,
      meta: {
        id: data.meta.id,
        type: data.meta.type,
        name: data.meta.name,
        poster: data.meta.poster
      }
    })
  }

  const handlePlay = (stream: Stream, replaceHistory = false) => {
    const meta = {
      id: data!.meta.id,
      type: data!.meta.type,
      name: data!.meta.name,
      poster: data!.meta.poster,
      season: selectedEpisode?.season,
      episode: selectedEpisode?.number
    }
    navigate(`/streaming/${profileId}/player?stream=${encodeURIComponent(JSON.stringify(stream))}&meta=${encodeURIComponent(JSON.stringify(meta))}`, { replace: replaceHistory })
  }

  const handleEpisodeSelect = (season: number, number: number, title: string, autoPlay: boolean = false) => {
    setSelectedEpisode({ season, number, title })
    setView('streams')
    loadStreams(season, number, undefined, autoPlay)
  }

  const toggleLibrary = async () => {
    // Implement library toggle logic here
    // For now just toggle local state
    if (data) {
        setData({ ...data, inLibrary: !data.inLibrary })
    }
  }

  // Mark movie or episode as watched/unwatched
  const toggleWatched = async (season?: number, episode?: number) => {
    if (!data || !profileId) return
    
    const isMovie = data.meta.type === 'movie'
    const currentlyWatched = isMovie 
      ? data.watchProgress?.isWatched 
      : (season !== undefined && episode !== undefined 
          ? data.seriesProgress?.[`${season}-${episode}`]?.isWatched 
          : false)
    
    const newWatched = !currentlyWatched
    
    // Optimistically update local state
    const updateLocalState = (watched: boolean) => {
      if (isMovie) {
        setData(prev => prev ? {
          ...prev,
          watchProgress: {
            ...(prev.watchProgress || { position: 0, duration: 0, progressPercent: 0, isWatched: false }),
            isWatched: watched
          }
        } : prev)
      } else if (season !== undefined && episode !== undefined) {
        const key = `${season}-${episode}`
        setData(prev => prev ? {
          ...prev,
          seriesProgress: {
            ...(prev.seriesProgress || {}),
            [key]: {
              ...(prev.seriesProgress?.[key] || { position: 0, duration: 0, progressPercent: 0, isWatched: false }),
              isWatched: watched
            }
          }
        } : prev)
      }
    }

    // Update UI immediately
    updateLocalState(newWatched)
    
    try {
      const res = await apiFetch('/api/streaming/mark-watched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: parseInt(profileId),
          metaId: id,
          metaType: data.meta.type,
          season,
          episode,
          watched: newWatched
        })
      })
      
      const result = await res.json()
      const traktSynced = result.traktSynced
      
      // Show toast with undo option
      const episodeLabel = season !== undefined && episode !== undefined 
        ? `S${season}:E${episode}` 
        : data.meta.name
      
      if (newWatched) {
        toast.success(
          traktSynced ? `Marked ${episodeLabel} as watched (synced to Trakt)` : `Marked ${episodeLabel} as watched`,
          {
            duration: 5000,
            action: {
              label: 'Undo',
              onClick: () => {
                // Undo - mark as unwatched
                toggleWatched(season, episode)
              }
            }
          }
        )
      } else {
        toast.success(
          traktSynced ? `Marked ${episodeLabel} as unwatched (removed from Trakt)` : `Marked ${episodeLabel} as unwatched`,
          { duration: 3000 }
        )
      }
    } catch (e) {
      console.error('Failed to toggle watched status', e)
      // Revert on error
      updateLocalState(!newWatched)
      toast.error('Failed to update watched status')
    }
  }

  // Mark entire season as watched
  const toggleSeasonWatched = async (season: number, watched: boolean) => {
    if (!data || !profileId || !data.meta.videos) return
    
    const episodes = data.meta.videos
      .filter((v: any) => v.season === season)
      .map((v: any) => v.number || v.episode)
    
    try {
      const res = await apiFetch('/api/streaming/mark-season-watched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: parseInt(profileId),
          metaId: id,
          metaType: 'series',
          season,
          watched,
          episodes
        })
      })
      
      const result = await res.json()
      
      // Update local state for all episodes in the season
      const updatedProgress = { ...(data.seriesProgress || {}) }
      episodes.forEach((ep: number) => {
        const key = `${season}-${ep}`
        updatedProgress[key] = {
          ...(updatedProgress[key] || { position: 0, duration: 0, progressPercent: 0, isWatched: false }),
          isWatched: watched
        }
      })
      
      setData({ ...data, seriesProgress: updatedProgress })
      toast.success(
        result.traktSynced
          ? `Season ${season} ${watched ? 'marked as watched' : 'unmarked'} (synced to Trakt)`
          : `Season ${season} ${watched ? 'marked as watched' : 'unmarked'}`
      )
    } catch (e) {
      console.error('Failed to toggle season watched', e)
      toast.error('Failed to update season watched status')
    }
  }

  // Mark entire series as watched
  const markSeriesWatched = async (watched: boolean) => {
    if (!data || !profileId || !data.meta.videos) return
    
    const allEpisodes = data.meta.videos.map((v: any) => ({
      season: v.season,
      episode: v.number || v.episode
    }))
    
    try {
      const res = await apiFetch('/api/streaming/mark-series-watched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: parseInt(profileId),
          metaId: id,
          watched,
          allEpisodes
        })
      })
      
      const result = await res.json()
      
      // Update local state for all episodes
      const updatedProgress = { ...(data.seriesProgress || {}) }
      allEpisodes.forEach((ep: { season: number; episode: number }) => {
        const key = `${ep.season}-${ep.episode}`
        updatedProgress[key] = {
          ...(updatedProgress[key] || { position: 0, duration: 0, progressPercent: 0, isWatched: false }),
          isWatched: watched
        }
      })
      
      setData({ ...data, seriesProgress: updatedProgress })
      toast.success(
        result.traktSynced
          ? `Series ${watched ? 'marked as watched' : 'unmarked'} (${result.episodesUpdated} episodes, synced to Trakt)`
          : `Series ${watched ? 'marked as watched' : 'unmarked'} (${result.episodesUpdated} episodes)`
      )
    } catch (e) {
      console.error('Failed to mark series as watched', e)
      toast.error('Failed to update series watched status')
    }
  }

  // Mark all episodes before a specific one as watched
  const markEpisodesBefore = async (season: number, episode: number, watched: boolean) => {
    if (!data || !profileId || !data.meta.videos) return
    
    const allEpisodes = data.meta.videos.map((v: any) => ({
      season: v.season,
      episode: v.number || v.episode
    }))
    
    try {
      const res = await apiFetch('/api/streaming/mark-episodes-before', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: parseInt(profileId),
          metaId: id,
          season,
          episode,
          watched,
          allEpisodes
        })
      })
      
      const result = await res.json()
      
      // Update local state for marked episodes
      const updatedProgress = { ...(data.seriesProgress || {}) }
      allEpisodes.forEach((ep: { season: number; episode: number }) => {
        if (ep.season < season || (ep.season === season && ep.episode < episode)) {
          const key = `${ep.season}-${ep.episode}`
          updatedProgress[key] = {
            ...(updatedProgress[key] || { position: 0, duration: 0, progressPercent: 0, isWatched: false }),
            isWatched: watched
          }
        }
      })
      
      setData({ ...data, seriesProgress: updatedProgress })
      toast.success(
        result.traktSynced
          ? `Marked ${result.episodesUpdated} episodes before S${season}E${episode} (synced to Trakt)`
          : `Marked ${result.episodesUpdated} episodes before S${season}E${episode}`
      )
    } catch (e) {
      console.error('Failed to mark episodes before', e)
      toast.error('Failed to update watched status')
    }
  }


  if (loading) {
    return (
      <Layout title="Loading..." showHeader={false} showFooter={false}>
        <button onClick={() => navigate(-1)} className={styles.backBtn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Back
        </button>
        <SkeletonDetails />
      </Layout>
    )
  }

  if (error || !data) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#141414', color: 'white' }}>
        {error || 'Content not found'}
      </div>
    )
  }

  const { meta, inLibrary } = data

  return (
    <Layout title={meta.name} showHeader={false} showFooter={false}>
      <button onClick={() => navigate(-1)} className={styles.backBtn}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
        </svg>
        Back
      </button>

      <div className={styles.detailsContainer}>
        <div className={styles.pageAmbientBackground} style={{
          backgroundImage: `url(${meta.background || meta.poster})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}></div>



        <div className={styles.detailsContent}>
          <div className={styles.detailsPoster}>
            {meta.poster ? (
              <img src={meta.poster} alt={meta.name} />
            ) : (
              <div style={{ width: '100%', height: '100%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {meta.name}
              </div>
            )}
          </div>

          <div className={styles.detailsInfo}>
            {/* Hide metadata only for series when viewing streams (since movies show streams as main page) */}
            {!(meta.type === 'series' && view === 'streams') && (
              <>
                {/* TMDB styled title banner (logo) when available, otherwise text title */}
                {meta.logo ? (
                  <img 
                    src={meta.logo} 
                    alt={meta.name} 
                    className={styles.detailsLogo}
                  />
                ) : (
                  <h1 className={styles.detailsTitle}>{meta.name}</h1>
                )}
                
                <div className={styles.detailsMetaRow}>
                  {meta.released && <span className={styles.metaBadge}>{String(meta.released).split('-')[0]}</span>}
                  {meta.runtime && <span className={styles.metaBadge}>{meta.runtime}</span>}
                  {showImdbRatings && meta.imdbRating && <span className={styles.metaBadge} style={{ background: '#f5c518', color: '#000' }}>IMDb {meta.imdbRating}</span>}
                  {/* @ts-ignore */}
                  {showAgeRatings && (meta.certification || meta.rating || meta.contentRating) && <span className={styles.metaBadge} style={{ border: '1px solid #fff' }}>{(meta.certification || meta.rating || meta.contentRating)}</span>}
                </div>

                <div className={styles.detailsActions}>
                  {/* Primary Play button */}
                  {meta.type === 'movie' && (
                      <button className={`${styles.actionBtn} ${styles.btnPrimaryGlass}`} onClick={handleMoviePlay}>
                        <Play size={20} fill="currentColor" />
                        Play
                      </button>
                  )}
                  
                  {/* Icon buttons for secondary actions */}
                  {meta.trailerStreams && meta.trailerStreams.length > 0 && (
                    <button 
                      className={styles.iconBtn}
                      onClick={() => {
                        const trailer = meta.trailerStreams![0]
                        const stream = { ytId: trailer.ytId }
                        const trailerMeta = {
                          id: meta.id,
                          type: meta.type,
                          name: `${meta.name} - Trailer`,
                          poster: meta.poster
                        }
                        navigate(`/streaming/${profileId}/player?stream=${encodeURIComponent(JSON.stringify(stream))}&meta=${encodeURIComponent(JSON.stringify(trailerMeta))}`)
                      }}
                      title="Watch Trailer"
                    >
                      <Youtube size={20} />
                    </button>
                  )}
                  
                  <button
                    className={styles.iconBtn}
                    onClick={() => setShowListModal(true)}
                    title={inList ? "Manage Lists (Added)" : "Add to List"}
                  >
                    {inList ? <Check size={20} className="text-green-500" /> : <List size={20} />}
                  </button>
                  
                  {/* Three-dot menu for additional actions */}
                  <DropdownMenu
                    items={[
                      // Cast & Crew option (if available)
                      ...(meta.app_extras?.cast || meta.director ? [{
                        label: 'Cast & Crew',
                        icon: Info,
                        onClick: () => setShowInfoModal(true)
                      }] : []),
                      // Watch status options
                      ...(meta.type === 'movie' ? [
                        {
                          label: data.watchProgress?.isWatched ? 'Mark as unwatched' : 'Mark as watched',
                          icon: data.watchProgress?.isWatched ? EyeOff : Eye,
                          onClick: () => toggleWatched()
                        }
                      ] : [
                        {
                          label: 'Mark series as watched',
                          icon: Eye,
                          onClick: () => markSeriesWatched(true)
                        },
                        {
                          label: 'Mark series as unwatched',
                          icon: EyeOff,
                          onClick: () => markSeriesWatched(false)
                        }
                      ])
                    ]}
                  />
                </div>

                {/* Genres inline with description */}
                {meta.genres && meta.genres.length > 0 && (
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem', marginBottom: '12px' }}>
                    {meta.genres
                      .filter(genre => !['PG', 'PG-13', 'R', 'NC-17', 'G', 'TV-Y', 'TV-Y7', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA', 'NR', 'UR', '12', '12A', '15', '18', 'U', 'R13', 'R16', 'R18', 'M', 'MA15+', 'R18+', '6', '9', '16'].includes(genre))
                      .slice(0, 4)
                      .join(' • ')}
                  </p>
                )}

                <p className={styles.detailsDescription}>{meta.description}</p>
              </>
            )}

            {meta.type === 'series' && view === 'episodes' && meta.videos && (
              <div className="series-episodes-container">
                <div className="season-selector" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <select 
                    value={selectedSeason || ''} 
                    onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
                    style={{ color: '#fff', background: 'rgba(255, 255, 255, 0.1)', border: '1px solid rgba(255, 255, 255, 0.2)', padding: '8px 16px', borderRadius: '8px', outline: 'none' }}
                  >
                    {(() => {
                      const seasons = Array.from(new Set(meta.videos.map((v: any) => v.season || 0))).sort((a: any, b: any) => a - b);
                      const filteredSeasons = seasons.length > 1 ? seasons.filter((s: any) => s !== 0) : seasons;
                      return filteredSeasons.map((season: any) => (
                        <option key={season} value={season} style={{ color: '#000' }}>Season {season}</option>
                      ));
                    })()}
                  </select>
                  {/* Mark Season Watched Button */}
                  {selectedSeason && (() => {
                    const seasonEps = meta.videos.filter((v: any) => v.season === selectedSeason)
                    const allWatched = seasonEps.every((ep: any) => {
                      const epNum = ep.episode ?? ep.number
                      return data.seriesProgress?.[`${ep.season}-${epNum}`]?.isWatched
                    })
                    return (
                      <button
                        onClick={() => toggleSeasonWatched(selectedSeason, !allWatched)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 12px',
                          background: allWatched ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                          border: `1px solid ${allWatched ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255, 255, 255, 0.2)'}`,
                          borderRadius: '8px',
                          color: allWatched ? '#22c55e' : '#fff',
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                        title={allWatched ? 'Mark season as unwatched' : 'Mark season as watched'}
                      >
                        {allWatched ? <EyeOff size={16} /> : <Eye size={16} />}
                        {allWatched ? 'Unwatch Season' : 'Watch Season'}
                      </button>
                    )
                  })()}
                </div>
                <div className={styles.episodeList}>
                  {meta.videos.filter((v: any) => v.season === selectedSeason).map((ep: any) => {
                    const epNum = ep.episode ?? ep.number
                    const epProgress = data.seriesProgress?.[`${ep.season}-${epNum}`]
                    const isWatched = epProgress?.isWatched ?? false
                    const progressPercent = epProgress?.progressPercent ?? 0
                    
                    return (
                      <ContextMenu
                        key={ep.id || `${ep.season}-${epNum}`}
                        items={[
                          {
                            label: 'Play',
                            icon: Play,
                            onClick: () => handleQuickPlay(ep.season, epNum, ep.title || ep.name || `Episode ${epNum}`)
                          },
                          { type: 'separator' },
                          {
                            label: isWatched ? 'Mark as unwatched' : 'Mark as watched',
                            icon: isWatched ? EyeOff : Eye,
                            onClick: () => toggleWatched(ep.season, epNum)
                          },
                          {
                            label: 'Mark all before this as watched',
                            icon: ChevronUp,
                            onClick: () => markEpisodesBefore(ep.season, epNum, true)
                          }
                        ]}
                      >
                        <div
                          className={styles.episodeItem}
                          onClick={() => handleEpisodeSelect(ep.season, epNum, ep.title || ep.name || `Episode ${epNum}`, false)}
                          style={{ position: 'relative' }}
                        >
                          <div className={styles.episodeThumbnail}>
                            {ep.thumbnail ? (
                              <LazyImage src={ep.thumbnail} alt={ep.title || ep.name || `Episode ${epNum}`} />
                            ) : (
                              <div className={styles.episodeThumbnailPlaceholder}>
                                <Play size={24} />
                              </div>
                            )}
                            <span className={styles.episodeNumber}>{epNum}</span>
                            {/* Watched badge on thumbnail */}
                            {isWatched && (
                              <div style={{
                                position: 'absolute',
                                top: '6px',
                                right: '6px',
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: 'rgba(34, 197, 94, 0.9)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <Check size={12} color="#fff" />
                              </div>
                            )}
                            {/* Progress bar on thumbnail */}
                            {progressPercent > 0 && !isWatched && (
                              <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                height: '3px',
                                background: 'rgba(0, 0, 0, 0.6)'
                              }}>
                                <div style={{
                                  width: `${progressPercent}%`,
                                  height: '100%',
                                  background: 'linear-gradient(90deg, #8b5cf6, #a855f7)'
                                }} />
                              </div>
                            )}
                          </div>
                          <div className={styles.episodeContent}>
                            <div className={styles.episodeHeader}>
                              <span className={styles.episodeTitle} style={{ opacity: isWatched ? 0.7 : 1 }}>
                                {ep.title || ep.name || `Episode ${epNum}`}
                              </span>
                              <button 
                                  className={styles.episodePlayBtn}
                                  onClick={(e) => {
                                      e.stopPropagation()
                                      handleQuickPlay(ep.season, epNum, ep.title || ep.name || `Episode ${epNum}`)
                                  }}
                                  title="Quick play"
                              >
                                  <Play size={22} fill="currentColor" />
                              </button>
                            </div>
                            <div className={styles.episodeMeta}>
                              {showImdbRatings && ep.rating && (
                                <span className={styles.episodeRating}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#f5c518"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                                  {Number(ep.rating).toFixed(1)}
                                </span>
                              )}
                              {showAgeRatings && (ep.certification || ep.contentRating) && (
                                <span className={styles.episodeAge}>{ep.certification || ep.contentRating}</span>
                              )}
                              {ep.runtime && <span className={styles.episodeRuntime}>{ep.runtime}</span>}
                              {progressPercent > 0 && !isWatched && (
                                <span style={{ fontSize: '0.75rem', color: '#a855f7' }}>{progressPercent}% watched</span>
                              )}
                            </div>
                            {ep.overview && (
                              <p className={styles.episodeDescription}>{ep.overview}</p>
                            )}
                          </div>
                        </div>
                      </ContextMenu>
                    )
                  })}
                </div>
              </div>
            )}

            {view === 'streams' && (
                <div className={styles.streamsContainer}>
                    {meta.type === 'series' && (
                        <div className="flex items-center gap-4 mb-5">
                            <button onClick={() => setView('episodes')} className={`${styles.actionBtn} ${styles.btnSecondaryGlass}`} style={{ padding: '8px 16px' }}>
                                <ArrowLeft size={16} />
                                Back
                            </button>
                            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>
                                {selectedEpisode ? `S${selectedEpisode.season}:E${selectedEpisode.number} - ${selectedEpisode.title}` : 'Streams'}
                            </h2>
                        </div>
                    )}

                    {/* Unified Addon Status + Controls Bar */}
                    {(addonStatuses.size > 0 || streams.length > 0) && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                            marginBottom: '20px',
                            flexWrap: 'wrap'
                        }}>
                            {/* Left side: Source count + addon chips */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                {/* Play Best button for series */}
                                {meta.type === 'series' && filteredStreams && filteredStreams.length > 0 && (
                                    <button 
                                        className={`${styles.actionBtn} ${styles.btnPrimaryGlass}`}
                                        style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                        onClick={() => handlePlay(filteredStreams[0].stream)}
                                    >
                                        <Play size={16} fill="currentColor" />
                                        Play Best
                                    </button>
                                )}
                                
                                {/* Source count */}
                                <span style={{ 
                                    fontSize: '0.85rem', 
                                    color: '#9ca3af',
                                    fontWeight: 500
                                }}>
                                    {totalStreamCount > 0 ? `${totalStreamCount} sources` : streamsLoading ? 'Loading...' : 'No sources'}
                                </span>

                                {/* Subtle separator */}
                                {addonStatuses.size > 0 && (
                                    <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
                                )}

                                {/* Addon chips - subtle inline pills */}
                                {Array.from(addonStatuses.values()).map((addon) => (
                                    <button
                                        key={addon.id}
                                        onClick={() => {
                                            if (addon.status === 'done') {
                                                setSelectedAddon(selectedAddon === addon.id ? null : addon.id)
                                            }
                                        }}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            border: 'none',
                                            cursor: addon.status === 'done' ? 'pointer' : 'default',
                                            background: selectedAddon === addon.id
                                                ? 'rgba(139, 92, 246, 0.25)'
                                                : 'rgba(255, 255, 255, 0.06)',
                                            fontSize: '0.75rem',
                                            fontWeight: 500,
                                            color: selectedAddon === addon.id
                                                ? '#c4b5fd'
                                                : addon.status === 'done' 
                                                    ? 'rgba(255, 255, 255, 0.7)' 
                                                    : addon.status === 'error' 
                                                        ? '#f87171' 
                                                        : 'rgba(255, 255, 255, 0.5)',
                                            transition: 'all 0.15s ease',
                                            outline: selectedAddon === addon.id ? '1px solid rgba(139, 92, 246, 0.5)' : 'none'
                                        }}
                                    >
                                        {addon.status === 'loading' && (
                                            <span style={{
                                                width: '10px',
                                                height: '10px',
                                                border: '1.5px solid currentColor',
                                                borderTopColor: 'transparent',
                                                borderRadius: '50%',
                                                animation: 'spin 1s linear infinite',
                                                display: 'inline-block'
                                            }} />
                                        )}
                                        {addon.status === 'done' && <Check size={10} strokeWidth={3} />}
                                        {addon.status === 'error' && <span style={{ fontSize: '0.6rem' }}>✕</span>}
                                        <span>{addon.name}</span>
                                        {addon.status === 'done' && addon.streamCount !== undefined && (
                                            <span style={{ opacity: 0.6 }}>{addon.streamCount}</span>
                                        )}
                                    </button>
                                ))}
                            </div>

                            {/* Right side: Refresh button */}
                            <StreamRefreshButton
                                onRefresh={refreshStreams}
                                isLoading={streamsLoading}
                                cacheAgeMs={cacheStatus?.cacheAgeMs}
                            />
                        </div>
                    )}

                    {streamsLoading && streams.length === 0 ? (
                        <SkeletonStreamList />
                    ) : filteredStreams && filteredStreams.length > 0 ? (
                        /* Render based on displayMode setting */
                        <div className="streams-list-wrapper">
                            <div className={styles.streamList} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: streamDisplaySettings.streamDisplayMode === 'classic' ? '12px' : '6px'
                            }}>
                                {streamDisplaySettings.streamDisplayMode !== 'classic' ? (
                                    /* Compact modes - tag-based display */
                                    filteredStreams.map((item, idx) => (
                                        <CompactStreamItem
                                            key={idx}
                                            item={item}
                                            onClick={() => handlePlay(item.stream)}
                                            index={idx}
                                            showAddonName={streamDisplaySettings.showAddonName}
                                            mode={streamDisplaySettings.streamDisplayMode === 'compact-advanced' ? 'advanced' : 'simple'}
                                        />
                                    ))
                                ) : (
                                    /* Classic mode - addon title + description */
                                    filteredStreams.map(({ stream, addon }, idx) => {
                                        const info = parseStreamInfo(stream)
                                        return (
                                            <div
                                                key={idx}
                                                className={`${styles.streamItem} ${info.isCached ? styles.streamCached : ''}`}
                                                onClick={() => handlePlay(stream)}
                                            >
                                                <div className={styles.streamHeader}>
                                                    <div className={styles.streamName}>
                                                        {stream.title || stream.name || `Stream ${idx + 1}`}
                                                    </div>
                                                    <div className={styles.streamBadges}>
                                                        {streamDisplaySettings.showAddonName && (
                                                            <span className={styles.streamBadge} style={{ background: 'rgba(255,255,255,0.1)', fontSize: '0.7rem' }}>
                                                                {addon.name}
                                                            </span>
                                                        )}
                                                        {info.isCached && (
                                                            <span className={`${styles.streamBadge} ${styles.badgeCached}`} title="Cached">
                                                                <Zap size={12} />
                                                            </span>
                                                        )}
                                                        {info.resolution && (
                                                            <span className={`${styles.streamBadge} ${styles.badgeResolution}`}>
                                                                {info.resolution}
                                                            </span>
                                                        )}
                                                        {info.size && (
                                                            <span className={`${styles.streamBadge} ${styles.badgeSize}`}>
                                                                <HardDrive size={10} />
                                                                {info.size}
                                                            </span>
                                                        )}
                                                        {info.hasHDR && (
                                                            <span className={`${styles.streamBadge} ${styles.badgeHDR}`}>HDR</span>
                                                        )}
                                                        {info.hasDV && (
                                                            <span className={`${styles.streamBadge} ${styles.badgeDV}`}>DV</span>
                                                        )}
                                                    </div>
                                                </div>
                                                {streamDisplaySettings.showDescription && stream.description && (
                                                    <div className={styles.streamDetails}>{stream.description}</div>
                                                )}
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    ) : !streamsLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/5 rounded-xl border border-white/5 text-center">
                            <div className="bg-white/10 p-4 rounded-full mb-4">
                                <Wifi size={32} className="text-gray-400 opacity-50" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">No streams found</h3>
                            <p className="text-sm text-gray-400 max-w-md">
                                We couldn't find any streams for this content. Try adjusting your filters or checking your installed addons.
                            </p>
                        </div>
                    ) : null}
                </div>
            )}

          </div>
        </div>
      </div>

      {/* Info Modal for cast, director, etc. */}
      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title={meta.name}
        director={meta.director}
        cast={meta.app_extras?.cast}
        country={meta.country}
        runtime={meta.runtime}
        released={meta.released}
      />

      {/* List Selection Modal */}
      <ListSelectionModal
        isOpen={showListModal}
        onClose={() => setShowListModal(false)}
        profileId={parseInt(profileId!)}
        item={{
          id: meta.id,
          type: meta.type,
          name: meta.name,
          poster: meta.poster,
          imdbRating: meta.imdbRating
        }}
        onChange={checkListStatus}
      />
    </Layout>
  )
}