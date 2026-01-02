import { useState, useEffect } from 'react'
import { Plus, Check, X, Film, List as ListIcon } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { apiFetch } from '../../lib/apiFetch'
import { MetaPreview } from '../../services/addons/types'

interface ListSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  profileId: number
  item: MetaPreview
  onChange?: () => void
}

interface List {
  id: number
  name: string
}

export function ListSelectionModal({ isOpen, onClose, profileId, item, onChange }: ListSelectionModalProps) {
  const [lists, setLists] = useState<List[]>([])
  const [selectedLists, setSelectedLists] = useState<number[]>([]) // Lists the item is already in
  const [loading, setLoading] = useState(true)
  const [showNewList, setShowNewList] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadLists()
      checkInLists()
    }
  }, [isOpen, profileId, item.id])

  const loadLists = async () => {
    try {
      const res = await apiFetch(`/api/lists?profileId=${profileId}`)
      if (res.ok) {
        const data = await res.json()
        setLists(data.lists)
      }
    } catch (e) {
      console.error("Failed to load lists", e)
    } finally {
      setLoading(false)
    }
  }

  const checkInLists = async () => {
    try {
      const res = await apiFetch(`/api/lists/check/${encodeURIComponent(item.id)}?profileId=${profileId}&t=${Date.now()}`)
      if (res.ok) {
        const data = await res.json()
        setSelectedLists(data.listIds)
      }
    } catch (e) {
      console.error("Failed to check lists", e)
    }
  }

  const handleToggleList = async (listId: number) => {
    const isSelected = selectedLists.includes(listId)
    
    // Optimistic update
    if (isSelected) {
        setSelectedLists(prev => prev.filter(id => id !== listId))
    } else {
        setSelectedLists(prev => [...prev, listId])
    }
    
    try {
      if (isSelected) {
        // Remove
        await apiFetch(`/api/lists/${listId}/items/${encodeURIComponent(item.id)}`, { method: 'DELETE' })
      } else {
        // Add
        await apiFetch(`/api/lists/${listId}/items`, {
          method: 'POST',
          body: JSON.stringify({
            metaId: item.id,
            type: item.type,
            title: item.name,
            poster: item.poster,
            imdbRating: item.imdbRating
          })
        })
      }
      onChange?.()
    } catch (e) {
      // Revert on error
      console.error("Failed to toggle list item", e)
      if (isSelected) {
          setSelectedLists(prev => [...prev, listId])
      } else {
          setSelectedLists(prev => prev.filter(id => id !== listId))
      }
    }
  }

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newListName.trim()) return

    setSubmitting(true)
    try {
      const res = await apiFetch('/api/lists', {
        method: 'POST',
        body: JSON.stringify({
            profileId,
            name: newListName
        })
      })
      
      if (res.ok) {
        const data = await res.json()
        setLists([...lists, data.list])
        setNewListName('')
        setShowNewList(false)
        
        // Auto-add item to new list
        handleToggleList(data.list.id)
        onChange?.()
      }
    } catch (e) {
      console.error("Failed to create list", e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add to List">
      <div className="flex flex-col gap-4 min-w-[300px]">
        {loading ? (
           <div className="py-8 text-center text-gray-400">Loading lists...</div>
        ) : (
           <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
             {lists.length === 0 && !showNewList && (
                <div className="text-center py-4 text-gray-500">No lists found. Create one!</div>
             )}
             
             {lists.map(list => (
               <button
                 key={list.id}
                 onClick={() => handleToggleList(list.id)}
                 className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors text-left group"
               >
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:bg-purple-500/30">
                        <ListIcon size={16} />
                    </div>
                    <span>{list.name}</span>
                 </div>
                 {selectedLists.includes(list.id) && (
                    <Check className="text-green-500" size={18} />
                 )}
               </button>
             ))}
           </div>
        )}

        {showNewList ? (
            <form onSubmit={handleCreateList} className="flex flex-col gap-2 mt-2 p-3 bg-white/5 rounded-lg border border-white/10 animate-in fade-in slide-in-from-top-2">
                <Input 
                    placeholder="List Name (e.g. Watch Later)" 
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    autoFocus
                />
                <div className="flex justify-end gap-2 mt-2">
                    <Button 
                        type="button" 
                        variant="secondary" 
                        size="small" 
                        onClick={() => setShowNewList(false)}
                    >
                        Cancel
                    </Button>
                    <Button 
                        type="submit" 
                        variant="primary" 
                        size="small" 
                        disabled={!newListName.trim() || submitting}
                    >
                        {submitting ? 'Creating...' : 'Create List'}
                    </Button>
                </div>
            </form>
        ) : (
            <Button 
                variant="secondary" 
                className="w-full mt-2"
                onClick={() => setShowNewList(true)}
            >
                <Plus size={16} className="mr-2" />
                New List
            </Button>
        )}
      </div>
    </Modal>
  )
}
