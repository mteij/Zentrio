import { useState, useEffect } from 'react'
import { Plus, Check, Film, Tv, List as ListIcon, Sparkles, FolderPlus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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

  const TypeIcon = item.type === 'movie' ? Film : Tv

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add to List">
      <div className="flex flex-col gap-4 w-full sm:min-w-[340px]">
        
        {/* Item Preview Header */}
        <div className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/[0.06]">
          {item.poster ? (
            <img 
              src={item.poster} 
              alt={item.name}
              className="w-12 h-[72px] rounded-lg object-cover flex-shrink-0 shadow-lg"
            />
          ) : (
            <div className="w-12 h-[72px] rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <TypeIcon size={20} className="text-zinc-500" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-white truncate">{item.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] text-[11px] font-medium text-zinc-400 uppercase tracking-wide">
                <TypeIcon size={10} />
                {item.type}
              </span>
              {item.imdbRating && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold" style={{ background: '#f5c518', color: '#000' }}>
                  ★ {item.imdbRating}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Lists Section */}
        {loading ? (
          /* Skeleton Loading */
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-between p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="h-4 rounded bg-zinc-800 animate-pulse" style={{ width: `${60 + i * 20}px` }} />
                <div className="w-10 h-3 rounded bg-zinc-800/50 animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
            {lists.length === 0 && !showNewList && (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/10 flex items-center justify-center mb-4">
                  <Sparkles size={24} className="text-purple-400" />
                </div>
                <p className="text-sm font-medium text-white/70 mb-1">No lists yet</p>
                <p className="text-xs text-zinc-500 mb-4">Create your first list to start organizing</p>
                <Button
                  variant="primary"
                  size="small"
                  onClick={() => setShowNewList(true)}
                >
                  <FolderPlus size={14} className="mr-1.5" />
                  Create List
                </Button>
              </div>
            )}
            
            {lists.map(list => {
              const isInList = selectedLists.includes(list.id)
              return (
                <motion.button
                  key={list.id}
                  onClick={() => handleToggleList(list.id)}
                  className={`
                    flex items-center justify-between p-3.5 rounded-xl transition-all duration-200 text-left group w-full
                    ${isInList 
                      ? 'bg-green-500/[0.08] border border-green-500/20 hover:bg-green-500/[0.12]' 
                      : 'bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/10'
                    }
                  `}
                  whileTap={{ scale: 0.98 }}
                  layout
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-sm font-medium truncate transition-colors duration-200 ${isInList ? 'text-white' : 'text-zinc-300 group-hover:text-white'}`}>
                      {list.name}
                    </span>
                  </div>
                  
                  {isInList && (
                    <motion.span 
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-[10px] font-semibold text-green-400/80 uppercase tracking-wider flex-shrink-0 ml-2"
                    >
                      Added
                    </motion.span>
                  )}
                </motion.button>
              )
            })}
          </div>
        )}

        {/* New List Form / Button */}
        <AnimatePresence mode="wait">
          {showNewList ? (
            <motion.form
              key="form"
              onSubmit={handleCreateList}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-3 p-3.5 bg-white/[0.03] rounded-xl border border-purple-500/15">
                <Input 
                  placeholder="List name (e.g. Watch Later)" 
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="small" 
                    onClick={() => { setShowNewList(false); setNewListName('') }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    size="small" 
                    disabled={!newListName.trim() || submitting}
                  >
                    {submitting ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
            </motion.form>
          ) : lists.length > 0 && (
            <motion.div
              key="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Button 
                variant="secondary" 
                size="small"
                className="w-full"
                onClick={() => setShowNewList(true)}
              >
                <Plus size={14} className="mr-1.5" />
                New List
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  )
}
