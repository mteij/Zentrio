import { useState } from 'react'
import { Eye, FolderInput, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { ListItem, List, ListShare } from '../../services/database'
import { apiFetch } from '../../lib/apiFetch'
import { LazyImage, RatingBadge } from '../index'
import { ContextMenu, ContextMenuItem } from '../ui/ContextMenu'
import { useContextMenu } from '../../hooks/useContextMenu'
import styles from '../../styles/Streaming.module.css'

interface SharedList extends List {
  share: ListShare
  sharedByName?: string
  isLinkedToThisProfile?: boolean
}

interface LibraryItemCardProps {
  item: ListItem
  profileId: string
  currentListId: number
  lists: List[]
  sharedLists: SharedList[]
  isOwner: boolean
  canRemove: boolean
  canAdd: boolean
  showImdbRatings: boolean
  onRemove: () => void
}

export function LibraryItemCard({
  item,
  profileId,
  currentListId,
  lists,
  sharedLists,
  isOwner,
  canRemove,
  canAdd,
  showImdbRatings,
  onRemove
}: LibraryItemCardProps) {
  const { isOpen, position, closeMenu, triggerProps } = useContextMenu()
  const [showMoveMenu, setShowMoveMenu] = useState(false)
  const [movePosition, setMovePosition] = useState({ x: 0, y: 0 })

  const handleRemove = async () => {
    try {
      await apiFetch(`/api/lists/${currentListId}/items/${item.meta_id}`, {
        method: 'DELETE'
      })
      toast.success('Removed from list')
      onRemove()
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
      onRemove()
      setShowMoveMenu(false)
    } catch (e) {
      console.error('Failed to move item:', e)
      toast.error('Failed to move item')
    }
  }

  // Build context menu items
  const contextItems: ContextMenuItem[] = [
    {
      label: 'View Details',
      icon: <Eye size={16} />,
      action: () => {
        window.location.href = `/streaming/${profileId}/${item.type}/${item.meta_id}`
      }
    }
  ]

  // Get lists that user can add to (excluding current)
  const moveTargetLists = [
    ...lists.filter(l => l.id !== currentListId),
    ...sharedLists.filter(l => 
      l.id !== currentListId && 
      (l.share.permission === 'add' || l.share.permission === 'full')
    )
  ]

  if (moveTargetLists.length > 0 && canRemove) {
    contextItems.push({
      label: 'Move to List...',
      icon: <FolderInput size={16} />,
      action: () => {
        setMovePosition(position)
        setShowMoveMenu(true)
      }
    })
  }

  if (canRemove) {
    contextItems.push({
      label: 'Remove from List',
      icon: <Trash2 size={16} />,
      danger: true,
      action: handleRemove
    })
  }

  return (
    <>
      <a 
        href={`/streaming/${profileId}/${item.type}/${item.meta_id}`} 
        className={styles.mediaCard}
        {...triggerProps}
      >
        <div className={styles.posterContainer}>
          {item.poster ? (
            <LazyImage src={item.poster || ''} alt={item.title || ''} className={styles.posterImage} />
          ) : (
            <div className="flex items-center justify-center bg-gray-800 text-gray-400 w-full h-full p-2 text-center text-sm">{item.title}</div>
          )}
          {showImdbRatings && item.imdb_rating && (
            <RatingBadge rating={item.imdb_rating} />
          )}
          <div className={styles.cardOverlay}>
            <div className={styles.cardTitle}>{item.title}</div>
          </div>
        </div>
      </a>

      <ContextMenu
        isOpen={isOpen}
        onClose={closeMenu}
        position={position}
        items={contextItems}
        title={item.title || 'Item'}
      />

      {/* Move to list submenu */}
      <ContextMenu
        isOpen={showMoveMenu}
        onClose={() => setShowMoveMenu(false)}
        position={movePosition}
        title="Move to"
        items={moveTargetLists.map(list => ({
          label: 'sharedByName' in list ? `${list.name} (shared)` : list.name,
          action: () => handleMove(list.id)
        }))}
      />
    </>
  )
}
