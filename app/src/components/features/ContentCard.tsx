import { useState, useEffect, memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MetaPreview } from '../../services/addons/types'
import { LazyImage } from '../ui/LazyImage'
import { RatingBadge } from '../ui/RatingBadge'
import { ContextMenu } from '../ui/ContextMenu'
import { ListSelectionModal } from './ListSelectionModal'
import { Plus, Play, Trash2, Eye, Check, X } from 'lucide-react'
import { useAutoPlay } from '../../hooks/useAutoPlay'
import { getPackId } from '../../services/addons/stream-service'
import { apiFetch } from '../../lib/apiFetch'
import styles from '../../styles/Streaming.module.css'

/**
 * Extended MetaPreview with watch history properties
 */
export interface ContentItem extends MetaPreview {
  progressPercent?: number
  episodeDisplay?: string
  lastStream?: any
  isWatched?: boolean
  season?: number
  episode?: number
  // Allow for additional metadata properties
  certification?: string
  rating?: string
  contentRating?: string
}

export interface ContentCardProps {
  item: ContentItem
  profileId: string
  showImdbRatings?: boolean
  showAgeRatings?: boolean
  isContinueWatching?: boolean
  isRanked?: boolean
  rank?: number
  /** Called when item is removed (for continue watching) */
  onRemove?: (item: ContentItem) => void
  /** Called when drag starts (for parent scroll handling) */
  onDragStart?: (e: React.DragEvent) => void
  /** Called on click - return false to prevent navigation */
  onClick?: (e: React.MouseEvent, item: ContentItem) => void | boolean
}

/**
 * Unified media card component for streaming rows.
 * Handles poster display, badges, progress bars, context menus, and watched state.
 * Memoized to prevent unnecessary re-renders.
 */
export const ContentCard = memo(function ContentCard({
  item,
  profileId,
  showImdbRatings = true,
  showAgeRatings = true,
  isContinueWatching = false,
  isRanked = false,
  rank,
  onRemove,
  onDragStart,
  onClick
}: ContentCardProps) {
  const navigate = useNavigate()
  const { startAutoPlay } = useAutoPlay()
  const [showListModal, setShowListModal] = useState(false)
  
  // Local state for optimistic updates
  const [isWatched, setIsWatched] = useState(item.isWatched)

  // Sync with prop changes
  useEffect(() => {
    setIsWatched(item.isWatched)
  }, [item.isWatched])

  // Generate URL with fallback metadata
  const getItemUrl = useCallback(() => {
    const baseUrl = `/streaming/${profileId}/${item.type}/${item.id}`
    const fallback = {
      id: item.id,
      type: item.type,
      name: item.name,
      poster: item.poster,
      background: item.background,
      description: item.description,
      releaseInfo: item.releaseInfo,
      imdbRating: item.imdbRating,
    }
    const fallbackParam = encodeURIComponent(JSON.stringify(fallback))
    return `${baseUrl}?metaFallback=${fallbackParam}`
  }, [profileId, item.id, item.type, item.name, item.poster, item.background, item.description, item.releaseInfo, item.imdbRating])

  // Handle play action
  const handlePlay = useCallback(async () => {
    // Parse season/episode from item or episodeDisplay
    let season = item.season
    let episode = item.episode
    
    if (!season && item.episodeDisplay) {
        const match = item.episodeDisplay.match(/S(\d+):E(\d+)/)
        if (match) {
            season = parseInt(match[1])
            episode = parseInt(match[2])
        }
    }

    // Use unified auto-play hook with pack matching
    startAutoPlay({
      profileId,
      meta: {
        id: item.id,
        type: item.type,
        name: item.name,
        poster: item.poster
      },
      season,
      episode,
      lastStream: item.lastStream,
      preferredPackId: item.lastStream ? getPackId(item.lastStream) : null
    })
  }, [profileId, item.id, item.type, item.name, item.poster, item.season, item.episode, item.episodeDisplay, item.lastStream, startAutoPlay])

  // Toggle watched state
  const toggleWatched = useCallback(async () => {
    const newWatchedState = !isWatched
    setIsWatched(newWatchedState)
    
    try {
      await apiFetch(newWatchedState ? '/api/streaming/mark-series-watched' : '/api/streaming/mark-watched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: parseInt(profileId),
          metaId: item.id,
          metaType: item.type,
          watched: newWatchedState,
          season: item.type === 'series' ? -1 : undefined,
          episode: item.type === 'series' ? -1 : undefined
        })
      })
      window.dispatchEvent(new CustomEvent('history-updated'))
    } catch (e) {
      console.error('Failed to mark as watched', e)
      setIsWatched(!newWatchedState)
    }
  }, [isWatched, profileId, item.id, item.type])

  // Mark specific episode watched
  const markEpisodeWatched = useCallback(async () => {
    if (!item.episodeDisplay) return
    const match = item.episodeDisplay.match(/S(\d+):E(\d+)/)
    if (!match) return
    
    const season = parseInt(match[1])
    const episode = parseInt(match[2])

    try {
      await apiFetch('/api/streaming/mark-watched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: parseInt(profileId),
          metaId: item.id,
          metaType: item.type,
          watched: true,
          season,
          episode
        })
      })
      window.dispatchEvent(new CustomEvent('history-updated'))
    } catch (e) {
      console.error('Failed to mark episode watched', e)
    }
  }, [item.episodeDisplay, profileId, item.id, item.type])

  // Remove from continue watching
  const removeFromContinueWatching = useCallback(() => {
    onRemove?.(item)
  }, [onRemove, item])

  // Build context menu items
  const contextItems = [
    {
      label: 'Play',
      icon: Play,
      onClick: handlePlay
    },
    {
      label: 'View Details',
      icon: Eye,
      onClick: () => {
        window.location.href = getItemUrl()
      }
    },
    { type: 'separator' } as any,
    isContinueWatching ? {
      label: 'Remove from Continue Watching',
      icon: Trash2,
      variant: 'danger',
      onClick: removeFromContinueWatching
    } : (
      item.type === 'series' && item.episodeDisplay ? [
        {
          label: `Mark ${item.episodeDisplay} Watched`,
          icon: Check,
          onClick: markEpisodeWatched
        },
        {
          label: isWatched ? 'Mark Series Unwatched' : 'Mark Series Watched',
          icon: isWatched ? X : Check,
          onClick: toggleWatched
        }
      ] : {
        label: isWatched ? 'Mark as Unwatched' : 'Mark as Watched',
        icon: isWatched ? X : Check,
        onClick: toggleWatched
      }
    ),
    { type: 'separator' } as any,
    {
      label: 'Add to List...',
      icon: Plus,
      onClick: () => setShowListModal(true)
    }
  ].flat()

  // Get age rating from various possible properties
  const ageRating = item.ageRating || item.certification || item.rating || item.contentRating

  // Handle link click
  const handleClick = useCallback((e: React.MouseEvent) => {
    if (onClick) {
      const result = onClick(e, item)
      if (result === false) {
        e.preventDefault()
        return
      }
    }
  }, [onClick, item])


  return (
    <>
      <ContextMenu items={contextItems}>
        <a 
          href={getItemUrl()} 
          className={`${styles.mediaCard} ${isRanked ? styles.rankedCard : ''}`}
          onClick={handleClick}
          onDragStart={onDragStart}
          draggable={false}
        >
          {isRanked && rank && (
            <span className={`${styles.rankNumber} ${rank === 10 ? styles.rankNumber10 : ''}`}>
              {rank}
            </span>
          )}
          
          <div className={styles.posterContainer}>
            {item.poster ? (
              <LazyImage src={item.poster} alt={item.name} className={styles.posterImage} />
            ) : (
              <div className={styles.noPoster}>{item.name}</div>
            )}
            
            {/* Watched Indicator */}
            {isWatched && (
              <div style={{
                position: 'absolute',
                top: '8px',
                left: '8px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#4ade80',
                padding: '4px',
                borderRadius: '50%',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}>
                <Check size={14} strokeWidth={3} />
              </div>
            )}

            {/* Badges Container */}
            <div className={styles.badgesContainer}>
              {showImdbRatings && item.imdbRating && (
                <RatingBadge 
                  rating={parseFloat(item.imdbRating)} 
                  style={{ position: 'relative', top: 'auto', right: 'auto', marginBottom: '0' }}
                />
              )}
              {showAgeRatings && ageRating && (
                <span className={styles.ageRatingBadge}>
                  {ageRating}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {(isContinueWatching || (item.progressPercent !== undefined && item.progressPercent > 0)) && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'rgba(0, 0, 0, 0.6)',
                borderBottomLeftRadius: '8px',
                borderBottomRightRadius: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${item.progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #8b5cf6, #a855f7)',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            )}

            {/* Episode badge */}
            {item.episodeDisplay && (
              <div style={{
                position: 'absolute',
                top: '8px',
                left: '8px',
                background: 'rgba(0, 0, 0, 0.7)',
                color: '#fff',
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: '4px',
                backdropFilter: 'blur(4px)'
              }}>
                {item.episodeDisplay}
              </div>
            )}

            <div className={styles.cardOverlay}>
              <div className={styles.cardTitle}>{item.name}</div>
            </div>
          </div>
        </a>
      </ContextMenu>
      
      <ListSelectionModal
        isOpen={showListModal}
        onClose={() => setShowListModal(false)}
        profileId={parseInt(profileId)}
        item={item}
      />
    </>
  )
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if item or key props change
  return (
    prevProps.item === nextProps.item &&
    prevProps.profileId === nextProps.profileId &&
    prevProps.showImdbRatings === nextProps.showImdbRatings &&
    prevProps.showAgeRatings === nextProps.showAgeRatings &&
    prevProps.isContinueWatching === nextProps.isContinueWatching &&
    prevProps.isRanked === nextProps.isRanked &&
    prevProps.rank === nextProps.rank &&
    prevProps.onRemove === nextProps.onRemove &&
    prevProps.onClick === nextProps.onClick
  )
})
