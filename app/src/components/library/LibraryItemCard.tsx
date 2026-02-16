import { useState, useEffect, memo } from 'react'
import { Eye, FolderInput, Trash2, X, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { ListItem, List, ListShare } from '../../services/database'
import { apiFetch } from '../../lib/apiFetch'
import { LazyImage, RatingBadge } from '../index'
import { ContextMenu, ContextMenuItemOrSeparator } from '../ui/ContextMenu'
import styles from '../../styles/Streaming.module.css'

interface SharedList extends List {
  share: ListShare
  sharedByName?: string
  isLinkedToThisProfile?: boolean
}

export interface LibraryItemCardProps {
  item: ListItem
  profileId: string
  currentListId: number
  // Pass available lists for moving instead of raw lists to avoid calc in every child
  moveTargetLists: Array<List | SharedList> 
  isOwner: boolean
  canRemove: boolean
  canAdd: boolean
  showImdbRatings: boolean
  onRemove: (metaId: string) => void
}

export const LibraryItemCard = memo(function LibraryItemCard({
  item,
  profileId,
  currentListId,
  moveTargetLists,
  isOwner,
  canRemove,
  canAdd,
  showImdbRatings,
  onRemove
}: LibraryItemCardProps) {
  const navigate = useNavigate()
  const [showMoveModal, setShowMoveModal] = useState(false)

  const handleRemove = async () => {
    try {
      await apiFetch(`/api/lists/${currentListId}/items/${item.meta_id}`, {
        method: 'DELETE'
      })
      toast.success('Removed from list')
      onRemove(item.meta_id)
    } catch (e) {
      console.error('Failed to remove item:', e)
      toast.error('Failed to remove item')
    }
  }

  const handleMove = async (targetListId: number) => {
    try {
      // Add to target list
      await apiFetch(`/api/lists/${targetListId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metaId: item.meta_id,
          type: item.type,
          title: item.title,
          poster: item.poster,
          imdbRating: item.imdb_rating
        })
      })
      // Remove from current list
      await apiFetch(`/api/lists/${currentListId}/items/${item.meta_id}`, {
        method: 'DELETE'
      })
      toast.success('Moved to list')
      onRemove(item.meta_id)
      setShowMoveModal(false)
    } catch (e) {
      console.error('Failed to move item:', e)
      toast.error('Failed to move item')
    }
  }

  const contextItems: ContextMenuItemOrSeparator[] = [
    {
      label: 'View Details',
      icon: Eye,
      onClick: () => {
        navigate(`/streaming/${profileId}/${item.type}/${item.meta_id}`)
      }
    }
  ]

  if (moveTargetLists.length > 0 && canRemove) {
    contextItems.push({
      label: 'Move to List...',
      icon: FolderInput,
      onClick: () => {
        setShowMoveModal(true)
      }
    })
  }

  if (canRemove) {
    contextItems.push({
      label: 'Remove from List',
      icon: Trash2,
      variant: 'danger', 
      onClick: handleRemove
    })
  }
  
  // Local state for optimistic updates
  // @ts-expect-error
  const [isWatched, setIsWatched] = useState(item.is_watched);

  useEffect(() => {
    // @ts-expect-error
    setIsWatched(item.is_watched);
  }, [item]); // simplified dependency

  const toggleWatched = async () => {
    const newWatchedState = !isWatched;
    setIsWatched(newWatchedState);
    // @ts-expect-error
    item.is_watched = newWatchedState;

    try {
      await apiFetch(newWatchedState ? '/api/streaming/mark-series-watched' : '/api/streaming/mark-watched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: parseInt(profileId),
          metaId: item.meta_id,
          metaType: item.type,
          watched: newWatchedState,
          season: item.type === 'series' ? -1 : undefined,
          episode: item.type === 'series' ? -1 : undefined
        })
      })
      window.dispatchEvent(new CustomEvent('history-updated'))
    } catch (e) {
      console.error('Failed to mark as watched', e)
      setIsWatched(!newWatchedState) // Revert
    }
  }
  
  const markEpisodeWatched = async () => {
         // @ts-expect-error
         if (!item.episodeDisplay) return;
         // @ts-expect-error
         const match = item.episodeDisplay.match(/S(\d+):E(\d+)/);
         if (!match) return;
         
         const season = parseInt(match[1]);
         const episode = parseInt(match[2]);

         try {
             await apiFetch('/api/streaming/mark-watched', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({
                     profileId: parseInt(profileId),
                     metaId: item.meta_id,
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
    }

  // Prepend Watch action
  // If it's a series and has an active episode, show "Mark Episode" option too
  // @ts-expect-error
  if (item.type === 'series' && item.episodeDisplay) {
    contextItems.unshift({
        // @ts-expect-error
        label: `Mark ${item.episodeDisplay} Watched`,
        icon: Check,
        onClick: markEpisodeWatched
    })
    contextItems.unshift({
        label: isWatched ? 'Mark Series Unwatched' : 'Mark Series Watched',
        icon: isWatched ? X : Check,
        onClick: toggleWatched
    })
  } else {
    contextItems.unshift({
        label: isWatched ? 'Mark as Unwatched' : 'Mark as Watched',
        icon: isWatched ? X : Check,
        onClick: toggleWatched
    })
  }

  // Handle main card click
  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(`/streaming/${profileId}/${item.type}/${item.meta_id}`);
  }

  return (
    <>
      <ContextMenu items={contextItems}>
        <a 
          href={`/streaming/${profileId}/${item.type}/${item.meta_id}`} 
          onClick={handleCardClick}
          className={styles.mediaCard}
        >
          <div className={styles.posterContainer}>
            {item.poster ? (
              <LazyImage src={item.poster || ''} alt={item.title || ''} className={styles.posterImage} />
            ) : (
              <div className="flex items-center justify-center bg-gray-800 text-gray-400 w-full h-full p-2 text-center text-sm">{item.title}</div>
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

            {showImdbRatings && item.imdb_rating && (
              <RatingBadge rating={item.imdb_rating} />
            )}

            {/* Progress Bar */}
            {/* @ts-expect-error */}
            {(item as any).progress_percent > 0 && (
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
                        width: `${(item as any).progress_percent}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #8b5cf6, #a855f7)',
                        transition: 'width 0.3s ease'
                    }} />
                </div>
            )}

            <div className={styles.cardOverlay}>
              <div className={styles.cardTitle}>{item.title}</div>
            </div>
          </div>
        </a>
      </ContextMenu>

      {/* Move to list Modal */}
      {showMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-[#1a1a1a] rounded-xl border border-white/10 w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="font-semibold text-white">Move to...</h3>
              <button 
                onClick={() => setShowMoveModal(false)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {moveTargetLists.map(list => (
                <button
                  key={list.id}
                  onClick={() => handleMove(list.id)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-3 text-gray-200"
                >
                  <FolderInput size={18} className="text-purple-400" />
                  <span className="flex-1 truncate">
                    {'sharedByName' in list ? `${list.name} (shared)` : list.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
})
