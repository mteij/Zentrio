import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Play, Plus, Check, ArrowLeft, Box, VolumeX, Filter, Zap, HardDrive, Wifi } from 'lucide-react'

import { Layout, LazyImage, RatingBadge, SkeletonDetails, SkeletonStreamList } from '../../components'
import { MetaDetail, Stream, Manifest } from '../../services/addons/types'
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings'
import { toast } from 'sonner'
import styles from '../../styles/Streaming.module.css'

interface StreamingDetailsData {
  meta: MetaDetail
  inLibrary: boolean
}

export const StreamingDetails = () => {
  const { profileId, type, id } = useParams<{ profileId: string, type: string, id: string }>()
  const navigate = useNavigate()
  const { showImdbRatings, showAgeRatings } = useAppearanceSettings()
  const [data, setData] = useState<StreamingDetailsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [streams, setStreams] = useState<{ addon: Manifest, streams: Stream[] }[]>([])
  const [streamsLoading, setStreamsLoading] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [episodes, setEpisodes] = useState<any[]>([])
  const [view, setView] = useState<'details' | 'episodes' | 'streams'>('details')
  const [selectedEpisode, setSelectedEpisode] = useState<{ season: number, number: number, title: string } | null>(null)
  const [selectedAddon, setSelectedAddon] = useState<string | null>(null)


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
        const seasons = Array.from(new Set(detailsData.meta.videos.map((v: any) => v.season || 0))).sort((a: any, b: any) => a - b)
        const initialSeason = seasons.length > 1 ? seasons.filter((s: any) => s !== 0)[0] : seasons[0]
        setSelectedSeason(initialSeason as number)
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

  const loadStreams = async (season?: number, episode?: number, overrideId?: string, autoPlay: boolean = false) => {
    setStreamsLoading(true)
    setSelectedAddon(null) // Reset addon filter when loading new streams
    try {
      const fetchId = overrideId || data?.meta.imdb_id || id
      let url = `/api/streaming/streams/${type}/${fetchId}?profileId=${profileId}`
      if (type === 'series' && season && episode) {
        url += `&season=${season}&episode=${episode}`
      }
      const res = await fetch(url)
      const streamData = await res.json()
      setStreams(streamData.streams || [])
      
      // Auto-play best source if requested
      if (autoPlay && streamData.streams?.length > 0) {
        const firstGroup = streamData.streams[0]
        if (firstGroup?.streams?.length > 0) {
          handlePlay(firstGroup.streams[0])
          return { success: true } // Signal success for toast
        }
        throw new Error('No streams available')
      }
      return { success: true }
    } catch (e) {
      console.error('Failed to load streams', e)
      throw e
    } finally {
      setStreamsLoading(false)
    }
  }

  // Flatten all streams when "All Sources" is selected
  // Preserves the backend's sort order which respects user's custom sorting config
  const flattenedStreams = useMemo(() => {
    if (selectedAddon) return null // Not needed when specific addon is selected
    
    // Flatten all streams with addon info
    const allStreams: { stream: Stream, addon: Manifest }[] = []
    streams.forEach(group => {
      group.streams.forEach(stream => {
        allStreams.push({ stream, addon: group.addon })
      })
    })
    
    // Sort by the backend's sortIndex which respects user's custom sorting config
    return allStreams.sort((a, b) => {
      const indexA = (a.stream.behaviorHints as any)?.sortIndex ?? Infinity
      const indexB = (b.stream.behaviorHints as any)?.sortIndex ?? Infinity
      return indexA - indexB
    })
  }, [streams, selectedAddon])

  // Filter streams by selected addon (for grouped view)
  const filteredStreams = useMemo(() => {
    if (!selectedAddon) return streams
    return streams.filter(group => group.addon.id === selectedAddon)
  }, [streams, selectedAddon])

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

  // Count total streams
  const totalStreamCount = useMemo(() => {
    return streams.reduce((acc, group) => acc + group.streams.length, 0)
  }, [streams])


  const handleQuickPlay = (season: number, number: number, title: string) => {
    setSelectedEpisode({ season, number, title })
    toast.promise(
      loadStreams(season, number, undefined, true),
      {
        loading: `Loading S${season}:E${number}...`,
        success: 'Starting playback...',
        error: 'No streams found'
      }
    )
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
                <div className="season-selector">
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
                </div>
                <div className={styles.episodeList}>
                  {meta.videos.filter((v: any) => v.season === selectedSeason).map((ep: any) => (
                    <div
                        key={ep.id || `${ep.season}-${ep.number}`}
                        className={styles.episodeItem}
                        onClick={() => handleEpisodeSelect(ep.season, ep.number, ep.title || ep.name || `Episode ${ep.number}`, false)}
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
                        </div>
                        <div className={styles.episodeContent}>
                          <div className={styles.episodeHeader}>
                            <span className={styles.episodeTitle}>{ep.title || ep.name || `Episode ${ep.number}`}</span>
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
                          </div>
                          {ep.overview && (
                            <p className={styles.episodeDescription}>{ep.overview}</p>
                          )}
                        </div>
                    </div>
                  ))}
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

                    {/* Stream Controls: Filter and Play Best */}
                    {!streamsLoading && streams.length > 0 && (
                        <div className={styles.addonFilter} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                            {/* Play Best Button */}
                            <button 
                                className={`${styles.actionBtn} ${styles.btnPrimaryGlass}`}
                                style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
                                onClick={() => {
                                    // Get the best stream (first from flattened sorted list)
                                    if (flattenedStreams && flattenedStreams.length > 0) {
                                        handlePlay(flattenedStreams[0].stream)
                                    } else if (streams.length > 0 && streams[0].streams.length > 0) {
                                        handlePlay(streams[0].streams[0])
                                    }
                                }}
                            >
                                <Play size={16} fill="currentColor" />
                                Play Best
                            </button>
                            
                            {/* Addon Filter */}
                            {streams.length > 1 && (
                                <>
                                    <Filter size={16} />
                                    <select
                                        value={selectedAddon || ''}
                                        onChange={(e) => setSelectedAddon(e.target.value || null)}
                                        className={styles.addonFilterSelect}
                                    >
                                        <option value="">All Sources ({totalStreamCount})</option>
                                        {streams.map((group) => (
                                            <option key={group.addon.id} value={group.addon.id}>
                                                {group.addon.name} ({group.streams.length})
                                            </option>
                                        ))}
                                    </select>
                                </>
                            )}
                        </div>
                    )}

                    {streamsLoading ? (
                        <SkeletonStreamList />
                    ) : !selectedAddon && flattenedStreams && flattenedStreams.length > 0 ? (
                        /* Flat sorted list when "All Sources" is selected */
                        <div className="streams-list-wrapper">
                            <div className={styles.streamList}>
                                {flattenedStreams.map(({ stream, addon }, idx) => {
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
                                                    {stream.behaviorHints?.notWebReady && (
                                                        <span className={`${styles.streamBadge} ${styles.badgeWarning}`} title="Audio may not be supported in browser">
                                                            <VolumeX size={12} />
                                                        </span>
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
                    ) : filteredStreams.length > 0 ? (
                        /* Grouped view when a specific addon is selected */
                        <div className="streams-list-wrapper">
                            {filteredStreams.map((group, idx) => (
                                <div key={idx} className={styles.addonGroup}>
                                    <div className={styles.addonTitle}>
                                        {group.addon.logo_url ? (
                                            <img src={group.addon.logo_url} alt={group.addon.name} style={{ width: '16px', height: '16px', marginRight: '8px', verticalAlign: 'middle' }} />
                                        ) : (
                                            <Box size={16} />
                                        )}
                                        {group.addon.name}
                                        <span className={styles.addonCount}>{group.streams.length}</span>
                                    </div>
                                    <div className={styles.streamList}>
                                        {group.streams.map((stream, sIdx) => {
                                            const info = parseStreamInfo(stream)
                                            return (
                                                <div
                                                    key={sIdx}
                                                    className={`${styles.streamItem} ${info.isCached ? styles.streamCached : ''}`}
                                                    onClick={() => handlePlay(stream)}
                                                >
                                                    <div className={styles.streamHeader}>
                                                        <div className={styles.streamName}>
                                                            {stream.title || stream.name || `Stream ${sIdx + 1}`}
                                                        </div>
                                                        <div className={styles.streamBadges}>
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
                                                            {stream.behaviorHints?.notWebReady && (
                                                                <span className={`${styles.streamBadge} ${styles.badgeWarning}`} title="Audio may not be supported in browser">
                                                                    <VolumeX size={12} />
                                                                </span>
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
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white/5 rounded-xl border border-white/5 text-center">
                            <div className="bg-white/10 p-4 rounded-full mb-4">
                                <Wifi size={32} className="text-gray-400 opacity-50" />
                            </div>
                            <h3 className="text-lg font-medium text-white mb-2">No streams found</h3>
                            <p className="text-sm text-gray-400 max-w-md">
                                We couldn't find any streams for this content. Try adjusting your filters or checking your installed addons.
                            </p>
                        </div>
                    )}
                </div>
            )}

          </div>
        </div>
      </div>
    </Layout>
  )
}