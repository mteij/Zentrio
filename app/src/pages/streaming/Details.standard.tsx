import { ChevronLeft } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Layout, LoadErrorState, SkeletonDetails } from '../../components'
import { InfoModal } from '../../components/features/InfoModal'
import { ListSelectionModal } from '../../components/features/ListSelectionModal'

import { toast } from 'sonner'
import { DetailsHeader } from '../../components/details/DetailsHeader'
import { EpisodeList } from '../../components/details/EpisodeList'
import { StreamSelector } from '../../components/details/StreamSelector'
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings'
import { useAutoPlay } from '../../hooks/useAutoPlay'
import { useOfflineDownloadCapability } from '../../hooks/useOfflineDownloadCapability'
import { useStreamDisplaySettings } from '../../hooks/useStreamDisplaySettings'
import { useStreamLoader } from '../../hooks/useStreamLoader'
import { apiFetch } from '../../lib/apiFetch'
import { isTauri } from '../../lib/auth-client'
import { downloadService, DownloadQuality } from '../../services/downloads/download-service'
import { useDownloadStore } from '../../stores/downloadStore'
import { MetaDetail, Stream } from '../../services/addons/types'
import styles from '../../styles/Streaming.module.css'
import { createLogger } from '../../utils/client-logger'
import { preloadPlayer } from '../../utils/route-preloader'

const log = createLogger('DetailsPage')

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

export function StreamingDetailsStandardView(_props: { model: import('./Details.model').DetailsScreenModel }) {
  const { profileId, type, id } = useParams<{ profileId: string, type: string, id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { showImdbRatings, showAgeRatings } = useAppearanceSettings()
  const streamDisplaySettings = useStreamDisplaySettings(profileId)
  const downloadStore = useDownloadStore()
  const { isAvailable: canDownload } = useOfflineDownloadCapability(profileId)
  const [data, setData] = useState<StreamingDetailsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [_episodes, _setEpisodes] = useState<any[]>([])
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
    reset: _resetStreams
  } = useStreamLoader()


  const loadStreams = useCallback((season?: number, episode?: number, overrideId?: string, autoPlay: boolean = false) => {
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
  }, [id, loadStreamsProgressive, profileId, type])

  const checkListStatus = useCallback(async () => {
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
      log.error("Failed to check list status", e)
    }
  }, [data?.meta?.id, id, profileId])

  const loadDetails = useCallback(async () => {
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
            const targetSeason = location.state?.season || initialSeason
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
      log.error(err)
      setError('Failed to load content')
    } finally {
      setLoading(false)
    }
  }, [id, loadStreams, location.state, navigate, profileId, type])

  useEffect(() => {
    if (!profileId || !type || !id) {
      navigate('/profiles')
      return
    }
    loadDetails()
    checkListStatus()
    
    const handleHistoryUpdate = () => {
      loadDetails()
    }
    
    window.addEventListener('history-updated', handleHistoryUpdate)
    return () => window.removeEventListener('history-updated', handleHistoryUpdate)
  }, [checkListStatus, id, loadDetails, navigate, profileId, type])

  // State for auto-play tracking
  const autoPlayRef = useRef<boolean>(false)
  
  // filteredStreams comes from hook - already sorted by backend sortIndex
  // totalStreamCount is now based on totalCount from hook




  // Count total streams - use totalCount from hook (which tracks unfiltered count)
  const totalStreamCount = totalCount


  // Quick play for episodes - uses unified auto-play hook
  const { startAutoPlay } = useAutoPlay()
  
  const handleQuickPlay = (season: number, number: number, _title: string) => {
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

  const handlePlay = useCallback((stream: Stream) => {
    const meta = {
      id: data!.meta.id,
      type: data!.meta.type,
      name: data!.meta.name,
      poster: data!.meta.poster,
      season: selectedEpisode?.season,
      episode: selectedEpisode?.number
    }
    preloadPlayer()
    navigate(`/streaming/${profileId}/player?stream=${encodeURIComponent(JSON.stringify(stream))}&meta=${encodeURIComponent(JSON.stringify(meta))}`, { replace: false })
  }, [data, navigate, profileId, selectedEpisode?.number, selectedEpisode?.season])

  // Handle auto-play when streams arrive
  useEffect(() => {
    if (autoPlayRef.current && streams.length > 0) {
      toast.dismiss('autoplay-loading')
      // streams is now a flat sorted list (FlatStream[])
      // Pass true to replace history (skip details page on back)
      handlePlay(streams[0].stream)
      autoPlayRef.current = false
    } else if (autoPlayRef.current && streamsComplete && streams.length === 0) {
        // Fallback if no streams found
        toast.dismiss('autoplay-loading')
        toast.error('No auto-play streams found. Please select manually.')
        setView('streams')
        autoPlayRef.current = false
    }
  }, [handlePlay, streams, streamsComplete])

  const handleDownloadStream = useCallback(async (stream: Stream) => {
    if (!isTauri()) return
    if (!profileId || !data?.meta) return
    const meta = data.meta
    const quality = (localStorage.getItem('download_quality_pref') || 'standard') as DownloadQuality

    const isSeries = meta.type === 'series' && selectedEpisode != null
    const existing = downloadStore.downloads.find((d) => {
      if (d.mediaId !== meta.id) return false
      if (isSeries) return d.season === selectedEpisode!.season && d.episode === selectedEpisode!.number
      return true
    })

    const doDownload = async () => {
      if (existing) {
        try {
          await downloadService.delete(existing.id)
          downloadStore.removeDownload(existing.id)
        } catch (e) {
          log.error('delete existing download failed', e)
        }
      }
      try {
        const id = await downloadService.start({
          profileId,
          mediaType: meta.type as 'movie' | 'series',
          mediaId: meta.id,
          ...(isSeries ? {
            episodeId: `${meta.id}:${selectedEpisode!.season}:${selectedEpisode!.number}`,
            episodeTitle: selectedEpisode!.title,
            season: selectedEpisode!.season,
            episode: selectedEpisode!.number,
          } : {}),
          title: meta.name,
          posterPath: meta.poster || '',
          streamUrl: stream.url || '',
          addonId: (stream as any).addonId || '',
          quality,
          subtitleUrls: (stream as any).subtitles,
        })
        downloadStore.addDownload({
          id,
          profileId,
          mediaType: meta.type as 'movie' | 'series',
          mediaId: meta.id,
          ...(isSeries ? {
            episodeId: `${meta.id}:${selectedEpisode!.season}:${selectedEpisode!.number}`,
            episodeTitle: selectedEpisode!.title,
            season: selectedEpisode!.season,
            episode: selectedEpisode!.number,
          } : {}),
          title: meta.name,
          posterPath: meta.poster || '',
          status: 'queued',
          progress: 0,
          quality,
          filePath: '',
          fileSize: 0,
          downloadedBytes: 0,
          addedAt: Date.now(),
          watchedPercent: 0,
          streamUrl: stream.url || '',
          addonId: (stream as any).addonId || '',
          smartDownload: false,
          autoDelete: false,
        })
        toast.success(`Downloading: ${isSeries ? `${meta.name} S${selectedEpisode!.season}:E${selectedEpisode!.number}` : meta.name}`)
      } catch (e) {
        log.error('stream download start failed', e)
        toast.error('Failed to start download')
      }
    }

    if (existing && ['queued', 'downloading', 'paused'].includes(existing.status)) {
      toast.info('Already downloading this item')
      return
    }

    if (existing?.status === 'completed') {
      toast(`Already downloaded. Replace with this stream?`, {
        action: { label: 'Replace', onClick: () => void doDownload() },
        duration: 6000,
      })
      return
    }

    void doDownload()
  }, [profileId, data, selectedEpisode, downloadStore])

  const handleEpisodeSelect = (season: number, number: number, title: string, autoPlay: boolean = false) => {
    setSelectedEpisode({ season, number, title })
    setView('streams')
    loadStreams(season, number, undefined, autoPlay)
  }

  const _toggleLibrary = async () => {
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
      log.error('Failed to toggle watched status', e)
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
      log.error('Failed to toggle season watched', e)
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
      log.error('Failed to mark series as watched', e)
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
      log.error('Failed to mark episodes before', e)
      toast.error('Failed to update watched status')
    }
  }


  if (loading) {
    return (
      <Layout title="Loading..." showHeader={false} showFooter={false}>
        <button onClick={() => navigate(-1)} className={styles.backBtn}>
          <ChevronLeft size={20} />
          Back
        </button>
        <SkeletonDetails />
      </Layout>
    )
  }

  if (error || !data) {
    return (
      <LoadErrorState
        message={error || 'Content not found'}
        onRetry={() => {
          setError('')
          setLoading(true)
          void loadDetails()
        }}
        onBack={() => {
          if (window.history.length > 1) {
            navigate(-1)
            return
          }
          if (profileId) {
            navigate(`/streaming/${profileId}`)
            return
          }
          navigate('/profiles')
        }}
      />
    )
  }

  const { meta } = data

  return (
    <Layout title={meta.name} showHeader={false} showFooter={false}>
      <DetailsHeader
          meta={meta}
          data={data}
          profileId={profileId!}
          view={view}
          showImdbRatings={showImdbRatings}
          showAgeRatings={showAgeRatings}
          onMoviePlay={handleMoviePlay}
          onShowListModal={() => setShowListModal(true)}
          inList={inList}
          onShowInfoModal={() => setShowInfoModal(true)}
          onToggleWatched={() => toggleWatched()}
          onMarkSeriesWatched={markSeriesWatched}
          canDownload={canDownload}
          onBackFromStreams={() => setView('episodes')}
        >
          {meta.type === 'series' && view === 'episodes' && (
            <EpisodeList
              meta={meta}
              seriesProgress={data.seriesProgress}
              selectedSeason={selectedSeason || 1} // Fallback to season 1 if undefined
              setSelectedSeason={setSelectedSeason}
              onToggleWatched={toggleWatched}
              onToggleSeasonWatched={toggleSeasonWatched}
              onMarkEpisodesBefore={markEpisodesBefore}
              onPlay={handleQuickPlay}
              onSelect={handleEpisodeSelect}
              showImdbRatings={showImdbRatings}
              showAgeRatings={showAgeRatings}
              profileId={profileId || ''}
              canDownload={canDownload}
            />
          )}

          {view === 'streams' && (
            <StreamSelector
              meta={meta}
              streams={streams}
              filteredStreams={filteredStreams}
              selectedEpisode={selectedEpisode}
              addonStatuses={addonStatuses}
              selectedAddon={selectedAddon}
              setSelectedAddon={setSelectedAddon}
              totalStreamCount={totalStreamCount}
              streamsLoading={streamsLoading}
              cacheStatus={cacheStatus}
                streamDisplaySettings={streamDisplaySettings}
                profileId={profileId || ''}
                onRefresh={refreshStreams}
                onPlay={handlePlay}
                onDownload={canDownload ? handleDownloadStream : undefined}
                onBack={() => setView('episodes')}
              />
            )}
        </DetailsHeader>

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

export default StreamingDetailsStandardView
