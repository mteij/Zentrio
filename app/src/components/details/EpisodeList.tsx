// Episode List Component
// Extracted from Details.tsx
import { useState } from 'react'
import { Play, Eye, EyeOff, ChevronUp, Check } from 'lucide-react'
import { LazyImage } from '../../components'
import { ContextMenu } from '../../components/ui/ContextMenu'
import styles from '../../styles/Streaming.module.css'
import type { MetaDetail } from '../../services/addons/types'

interface EpisodeListProps {
  meta: MetaDetail
  seriesProgress?: Record<string, { isWatched: boolean; progressPercent: number }>
  selectedSeason: number
  setSelectedSeason: (season: number) => void
  onToggleWatched: (season: number, episode: number) => void
  onToggleSeasonWatched: (season: number, watched: boolean) => void
  onMarkEpisodesBefore: (season: number, episode: number, watched: boolean) => void
  onPlay: (season: number, episode: number, title: string) => void
  onSelect: (season: number, episode: number, title: string, autoPlay: boolean) => void
  showImdbRatings: boolean
  showAgeRatings: boolean
}

export function EpisodeList({
  meta,
  seriesProgress,
  selectedSeason,
  setSelectedSeason,
  onToggleWatched,
  onToggleSeasonWatched,
  onMarkEpisodesBefore,
  onPlay,
  onSelect,
  showImdbRatings,
  showAgeRatings
}: EpisodeListProps) {
  
  if (!meta.videos) return null

  return (
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
            return seriesProgress?.[`${ep.season}-${epNum}`]?.isWatched
          })
          return (
            <button
              onClick={() => onToggleSeasonWatched(selectedSeason, !allWatched)}
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
          const epProgress = seriesProgress?.[`${ep.season}-${epNum}`]
          const isWatched = epProgress?.isWatched ?? false
          const progressPercent = epProgress?.progressPercent ?? 0
          
          return (
            <ContextMenu
              key={ep.id || `${ep.season}-${epNum}`}
              items={[
                {
                  label: 'Play',
                  icon: Play,
                  onClick: () => onPlay(ep.season, epNum, ep.title || ep.name || `Episode ${epNum}`)
                },
                { type: 'separator' },
                {
                  label: isWatched ? 'Mark as unwatched' : 'Mark as watched',
                  icon: isWatched ? EyeOff : Eye,
                  onClick: () => onToggleWatched(ep.season, epNum)
                },
                {
                  label: 'Mark all before this as watched',
                  icon: ChevronUp,
                  onClick: () => onMarkEpisodesBefore(ep.season, epNum, true)
                }
              ]}
            >
              <div
                className={styles.episodeItem}
                onClick={() => onSelect(ep.season, epNum, ep.title || ep.name || `Episode ${epNum}`, false)}
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
                            onPlay(ep.season, epNum, ep.title || ep.name || `Episode ${epNum}`)
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
  )
}
