import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Play, Plus, Check, ArrowLeft, Box, VolumeX } from 'lucide-react'
import { Layout, LazyImage, RatingBadge, LoadingSpinner } from '../../components'
import { MetaDetail, Stream, Manifest } from '../../services/addons/types'
import { useAppearanceSettings } from '../../hooks/useAppearanceSettings'
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

  const loadStreams = async (season?: number, episode?: number, overrideId?: string) => {
    setStreamsLoading(true)
    try {
      const fetchId = overrideId || data?.meta.imdb_id || id
      let url = `/api/streaming/streams/${type}/${fetchId}?profileId=${profileId}`
      if (type === 'series' && season && episode) {
        url += `&season=${season}&episode=${episode}`
      }
      const res = await fetch(url)
      const streamData = await res.json()
      setStreams(streamData.streams || [])
    } catch (e) {
      console.error('Failed to load streams', e)
    } finally {
      setStreamsLoading(false)
    }
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

  const handleEpisodeSelect = (season: number, number: number, title: string) => {
    setSelectedEpisode({ season, number, title })
    setView('streams')
    loadStreams(season, number)
  }

  const toggleLibrary = async () => {
    // Implement library toggle logic here
    // For now just toggle local state
    if (data) {
        setData({ ...data, inLibrary: !data.inLibrary })
    }
  }

  if (loading) {
    return <LoadingSpinner />
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
                  <button className={`${styles.actionBtn} ${styles.btnPrimaryGlass}`} onClick={() => loadStreams()}>
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
                <div className="episode-list">
                  {meta.videos.filter((v: any) => v.season === selectedSeason).map((ep: any) => (
                    <div
                        key={ep.id || `${ep.season}-${ep.number}`}
                        className="episode-item"
                        onClick={() => handleEpisodeSelect(ep.season, ep.number, ep.title || ep.name || `Episode ${ep.number}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '16px',
                          background: 'rgba(255, 255, 255, 0.05)',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          cursor: 'pointer',
                          transition: 'background 0.2s'
                        }}
                    >
                        <div className="episode-info" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <span className="episode-number" style={{ fontWeight: 'bold', color: '#aaa', minWidth: '24px' }}>{ep.number}.</span>
                            <span className="episode-title" style={{ fontWeight: 500 }}>{ep.title || ep.name || `Episode ${ep.number}`}</span>
                        </div>
                        <button className="action-btn btn-primary-glass" style={{ padding: '8px' }}>
                            <Play size={16} />
                        </button>
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

                    {streamsLoading ? (
                        <div className="flex flex-col items-center p-5">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500 mb-2"></div>
                            <p className="text-gray-400">Loading streams...</p>
                        </div>
                    ) : streams.length > 0 ? (
                        <div className="streams-list-wrapper">
                            {streams.map((group, idx) => (
                                <div key={idx} className={styles.addonGroup}>
                                    <div className={styles.addonTitle}>
                                        {group.addon.logo_url ? (
                                            <img src={group.addon.logo_url} alt={group.addon.name} style={{ width: '16px', height: '16px', marginRight: '8px', verticalAlign: 'middle' }} />
                                        ) : (
                                            <Box size={16} />
                                        )}
                                        {group.addon.name}
                                    </div>
                                    <div className={styles.streamList}>
                                        {group.streams.map((stream, sIdx) => (
                                            <div
                                                key={sIdx}
                                                className={styles.streamItem}
                                                onClick={() => handlePlay(stream)}
                                            >
                                                <div className={styles.streamName}>
                                                    {stream.title || stream.name || `Stream ${sIdx + 1}`}
                                                    {stream.behaviorHints?.notWebReady && (
                                                        <span
                                                            style={{ color: '#ff4444', marginLeft: '8px', verticalAlign: 'middle', display: 'inline-flex' }}
                                                            title="Audio format may not be supported in browser"
                                                        >
                                                            <VolumeX size={16} />
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={styles.streamDetails}>{stream.description || ''}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-5 text-center text-gray-400">
                            No streams found.
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