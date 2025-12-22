import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Play, Plus, Check, ArrowLeft, Zap, HardDrive, Wifi, Eye, EyeOff } from 'lucide-react'

import { Layout, LazyImage, RatingBadge, SkeletonDetails, SkeletonStreamList } from '../../components'
import { MetaDetail, Stream, Manifest } from '../../services/addons/types'
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings'
import { useStreamLoader, FlatStream, AddonLoadingState } from '../../hooks/useStreamLoader'
import { toast } from 'sonner'
import styles from '../../styles/Streaming.module.css'

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
  const { showImdbRatings, showAgeRatings } = useAppearanceSettings()
  const [data, setData] = useState<StreamingDetailsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [episodes, setEpisodes] = useState<any[]>([])
  const [view, setView] = useState<'details' | 'episodes' | 'streams'>('details')
  const [selectedEpisode, setSelectedEpisode] = useState<{ season: number, number: number, title: string } | null>(null)
  
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
    loadStreams: loadStreamsProgressive,
    reset: resetStreams
  } = useStreamLoader()


  useEffect(() => {
    if (!profileId || !type || !id) {
      navigate('/profiles')
      return
    }
    loadDetails()
  }, [profileId, type, id])

  const loadDetails = async () => {
    try {
      const res = await fetch(`/api/streaming/details/${type}/${id}?profileId=${profileId}`)
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
        
        setSelectedSeason(initialSeason)
        setView('episodes')
      } else {
        loadStreams(undefined, undefined, detailsData.meta.imdb_id || id)
        setView('streams')
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
    
    const fetchId = overrideId || data?.meta.imdb_id || id
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
  useEffect(() => {
    if (autoPlayRef.current && streams.length > 0) {
      // streams is now a flat sorted list (FlatStream[])
      handlePlay(streams[0].stream)
      autoPlayRef.current = false
    }
  }, [streams])

  // filteredStreams comes from hook - already sorted by backend sortIndex
  // totalStreamCount is now based on totalCount from hook


  // Helper to parse stream information
  const parseStreamInfo = (stream: Stream) => {
    const title = stream.title || stream.name || ''
    const desc = stream.description || ''
    const combined = `${title} ${desc}`.toLowerCase()
    
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
    const isCached = combined.includes('cached') || title.includes('+') || title.includes('⚡')
    
    // HDR/DV
    const hasHDR = combined.includes('hdr')
    const hasDV = combined.includes('dv') || combined.includes('dolby vision')
    
    return { resolution, size, isCached, hasHDR, hasDV }
  }

  // Count total streams - use totalCount from hook (which tracks unfiltered count)
  const totalStreamCount = totalCount


  const handleQuickPlay = (season: number, number: number, title: string) => {
    setSelectedEpisode({ season, number, title })
    toast.loading(`Loading S${season}:E${number}...`, { id: 'stream-load' })
    loadStreams(season, number, undefined, true)
  }

  const handlePlay = (stream: Stream) => {
    const meta = {
      id: data!.meta.id,
      type: data!.meta.type,
      name: data!.meta.name,
      poster: data!.meta.poster,
      season: selectedEpisode?.season,
      episode: selectedEpisode?.number
    }
    navigate(`/streaming/${profileId}/player?stream=${encodeURIComponent(JSON.stringify(stream))}&meta=${encodeURIComponent(JSON.stringify(meta))}`)
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
    
    try {
      await fetch('/api/streaming/mark-watched', {
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
      
      // Update local state
      if (isMovie) {
        setData({
          ...data,
          watchProgress: {
            ...(data.watchProgress || { position: 0, duration: 0, progressPercent: 0, isWatched: false }),
            isWatched: newWatched
          }
        })
      } else if (season !== undefined && episode !== undefined) {
        const key = `${season}-${episode}`
        setData({
          ...data,
          seriesProgress: {
            ...(data.seriesProgress || {}),
            [key]: {
              ...(data.seriesProgress?.[key] || { position: 0, duration: 0, progressPercent: 0, isWatched: false }),
              isWatched: newWatched
            }
          }
        })
      }
    } catch (e) {
      console.error('Failed to toggle watched status', e)
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
      await fetch('/api/streaming/mark-season-watched', {
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
      toast.success(watched ? 'Season marked as watched' : 'Season marked as unwatched')
    } catch (e) {
      console.error('Failed to toggle season watched', e)
      toast.error('Failed to update season watched status')
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
          backgroundImage: `url(${meta.background || meta.poster})`
        }}></div>

        <div className={styles.detailsContent}>
          <div className={styles.detailsPoster}>
            {meta.poster ? (
              <LazyImage src={meta.poster} alt={meta.name} />
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
                <h1 className={styles.detailsTitle}>{meta.name}</h1>
                
                <div className={styles.detailsMetaRow}>
                  {meta.released && <span className={styles.metaBadge}>{String(meta.released).split('-')[0]}</span>}
                  {meta.runtime && <span className={styles.metaBadge}>{meta.runtime}</span>}
                  {showImdbRatings && meta.imdbRating && <span className={styles.metaBadge} style={{ background: '#f5c518', color: '#000' }}>IMDb {meta.imdbRating}</span>}
                  {/* @ts-ignore */}
                  {showAgeRatings && (meta.certification || meta.rating || meta.contentRating) && <span className={styles.metaBadge} style={{ border: '1px solid #fff' }}>{(meta.certification || meta.rating || meta.contentRating)}</span>}
                </div>

                <div className={styles.detailsActions}>
                  {meta.type === 'movie' && (
                      <button className={`${styles.actionBtn} ${styles.btnPrimaryGlass}`} onClick={() => loadStreams(undefined, undefined, undefined, true)}>
                        <Play size={20} fill="currentColor" />
                        Play
                      </button>
                  )}
                  <button
                    className={`${styles.actionBtn} ${styles.btnSecondaryGlass} ${inLibrary ? 'active' : ''}`}
                    onClick={toggleLibrary}
                  >
                    {inLibrary ? <Check size={20} /> : <Plus size={20} />}
                    {inLibrary ? 'In List' : 'Add to List'}
                  </button>
                </div>

                <p className={styles.detailsDescription}>{meta.description}</p>
                
                <div className="cast-info" style={{ marginBottom: '30px', color: '#ccc' }}>
                  {meta.director && <p style={{ marginBottom: '8px' }}><strong>Director:</strong> {meta.director.join(', ')}</p>}
                  {meta.cast && <p><strong>Cast:</strong> {meta.cast.join(', ')}</p>}
                </div>
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
                    const allWatched = seasonEps.every((ep: any) => 
                      data.seriesProgress?.[`${ep.season}-${ep.number}`]?.isWatched
                    )
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
                    const epProgress = data.seriesProgress?.[`${ep.season}-${ep.number}`]
                    const isWatched = epProgress?.isWatched ?? false
                    const progressPercent = epProgress?.progressPercent ?? 0
                    
                    return (
                      <div
                        key={ep.id || `${ep.season}-${ep.number}`}
                        className={styles.episodeItem}
                        onClick={() => handleEpisodeSelect(ep.season, ep.number, ep.title || ep.name || `Episode ${ep.number}`, false)}
                        style={{ position: 'relative' }}
                      >
                        <div className={styles.episodeThumbnail}>
                          {ep.thumbnail ? (
                            <LazyImage src={ep.thumbnail} alt={ep.title || ep.name || `Episode ${ep.number}`} />
                          ) : (
                            <div className={styles.episodeThumbnailPlaceholder}>
                              <Play size={24} />
                            </div>
                          )}
                          <span className={styles.episodeNumber}>{ep.number}</span>
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
                            {/* Watched indicator */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleWatched(ep.season, ep.number)
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: isWatched ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                border: `1px solid ${isWatched ? '#22c55e' : 'rgba(255, 255, 255, 0.3)'}`,
                                color: isWatched ? '#22c55e' : '#888',
                                cursor: 'pointer',
                                marginRight: '8px',
                                flexShrink: 0
                              }}
                              title={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                            >
                              {isWatched ? <Check size={14} /> : <Eye size={14} />}
                            </button>
                            <span className={styles.episodeTitle} style={{ opacity: isWatched ? 0.7 : 1 }}>
                              {ep.title || ep.name || `Episode ${ep.number}`}
                            </span>
                            <button 
                                className={styles.episodePlayBtn}
                                onClick={(e) => {
                                    e.stopPropagation()
                                    handleQuickPlay(ep.season, ep.number, ep.title || ep.name || `Episode ${ep.number}`)
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
                            flexDirection: 'column',
                            gap: '12px',
                            marginBottom: '16px',
                            padding: '12px',
                            background: 'rgba(255, 255, 255, 0.05)',
                            borderRadius: '8px'
                        }}>
                            {/* Top row: Play Best button + total count */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                                    <span style={{ fontSize: '0.9rem', color: '#9ca3af' }}>
                                        {totalStreamCount > 0 ? `${totalStreamCount} sources` : streamsLoading ? 'Loading...' : 'No sources found'}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Addon status chips - clickable to filter */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                {Array.from(addonStatuses.values()).map((addon) => (
                                    <div
                                        key={addon.id}
                                        onClick={() => {
                                            // Toggle filter: if already selected, clear; otherwise set
                                            setSelectedAddon(selectedAddon === addon.id ? null : addon.id)
                                        }}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '4px 10px',
                                            borderRadius: '16px',
                                            cursor: addon.status === 'done' ? 'pointer' : 'default',
                                            background: selectedAddon === addon.id
                                                ? 'rgba(99, 102, 241, 0.3)' // Highlight selected
                                                : addon.status === 'done' 
                                                    ? 'rgba(34, 197, 94, 0.15)' 
                                                    : addon.status === 'error' 
                                                        ? 'rgba(239, 68, 68, 0.15)' 
                                                        : 'rgba(255, 255, 255, 0.1)',
                                            fontSize: '0.8rem',
                                            color: selectedAddon === addon.id
                                                ? '#a5b4fc' // Selected color
                                                : addon.status === 'done' 
                                                    ? '#22c55e' 
                                                    : addon.status === 'error' 
                                                        ? '#ef4444' 
                                                        : '#9ca3af',
                                            border: selectedAddon === addon.id ? '1px solid #6366f1' : '1px solid transparent',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {addon.status === 'loading' && (
                                            <span style={{
                                                width: '12px',
                                                height: '12px',
                                                border: '2px solid currentColor',
                                                borderTopColor: 'transparent',
                                                borderRadius: '50%',
                                                animation: 'spin 1s linear infinite',
                                                display: 'inline-block'
                                            }} />
                                        )}
                                        {addon.status === 'done' && <Check size={12} />}
                                        {addon.status === 'error' && <span>✕</span>}
                                        <span>{addon.name}</span>
                                        {addon.status === 'done' && addon.streamCount !== undefined && (
                                            <span style={{ opacity: 0.7 }}>({addon.streamCount})</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {streamsLoading && streams.length === 0 ? (
                        <SkeletonStreamList />
                    ) : filteredStreams && filteredStreams.length > 0 ? (
                        /* Flat sorted list when "All Sources" is selected */
                        <div className="streams-list-wrapper">
                            <div className={styles.streamList}>
                                {filteredStreams.map(({ stream, addon }, idx) => {
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
                                                    {/* Addon badge */}
                                                    <span className={styles.streamBadge} style={{ background: 'rgba(255,255,255,0.1)', fontSize: '0.7rem' }}>
                                                        {addon.name}
                                                    </span>
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
                                            {stream.description && (
                                                <div className={styles.streamDetails}>{stream.description}</div>
                                            )}
                                        </div>
                                    )
                                })}
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
    </Layout>
  )
}