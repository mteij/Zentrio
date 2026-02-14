
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { apiFetch } from '../lib/apiFetch'
import { List, ListItem } from '../services/database'
import { 
  type SharedList, 
  type PendingInvite, 
  type AvailableSharedList, 
  type ProfileSharedList, 
} from '../components/library/LibrarySidebar'

export function useLibraryData(profileId: string | undefined, listId: string | undefined) {
  const navigate = useNavigate()
  
  // Lists state
  const [myLists, setMyLists] = useState<List[]>([])
  const [accountSharedLists, setAccountSharedLists] = useState<SharedList[]>([])
  const [profileSharedLists, setProfileSharedLists] = useState<ProfileSharedList[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [availableFromOtherProfiles, setAvailableFromOtherProfiles] = useState<AvailableSharedList[]>([])
  
  // Current list state
  const [activeList, setActiveList] = useState<List | SharedList | ProfileSharedList | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  
  // UI state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadItems = useCallback(async (lid: number, signal?: AbortSignal) => {
    try {
      const itemsRes = await apiFetch(`/api/lists/${lid}/items?profileId=${profileId}`, { signal })
      const itemsData = await itemsRes.json()
      if (!signal?.aborted) {
        setItems(itemsData.items || [])
      }
    } catch (err: any) {
      if (err.name !== 'AbortError' && err.message !== 'Request cancelled' && !signal?.aborted) {
          console.error(err)
          setItems([])
      }
    }
  }, [profileId])

  const loadLibrary = useCallback(async (signal?: AbortSignal) => {
    if (!profileId) return
    setLoading(true)
    try {
      const [listsRes, sharedRes, profileSharedRes, pendingRes, availableRes] = await Promise.all([
          apiFetch(`/api/lists?profileId=${profileId}`, { signal }),
          apiFetch(`/api/lists/shared-for-profile/${profileId}`, { signal }),
          apiFetch(`/api/lists/profile-shared/${profileId}`, { signal }),
          apiFetch('/api/lists/pending-invites', { signal }),
          apiFetch(`/api/lists/available-from-other-profiles/${profileId}`, { signal })
      ])
      
      const [listsData, sharedData, profileSharedData, pendingData, availableData] = await Promise.all([
          listsRes.json(),
          sharedRes.json(),
          profileSharedRes.json(),
          pendingRes.json(),
          availableRes.json()
      ])
      
      if (signal?.aborted) return

      let ownLists = listsData.lists || []
      
      if (ownLists.length === 0) {
        // Create default list if none exist
        const createRes = await apiFetch('/api/lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId, name: 'My Library' }),
            signal
        })
        const createData = await createRes.json()
        if (createData.list) {
            ownLists = [createData.list]
        }
      }
      
      const newAccountSharedLists = (sharedData.lists || []).filter((l: SharedList) => l.isLinkedToThisProfile);
      const newProfileSharedLists = profileSharedData.lists || [];
      
      setPendingInvites(pendingData.invites || [])
      setAvailableFromOtherProfiles(availableData.lists || [])
      setMyLists(ownLists)
      setAccountSharedLists(newAccountSharedLists)
      setProfileSharedLists(newProfileSharedLists)
      
      // Determine active list from URL or default
      let currentList: List | SharedList | ProfileSharedList | null = null
      
      if (listId) {
        const id = parseInt(listId)
        currentList = ownLists.find((l: List) => l.id === id) ||
          newAccountSharedLists.find((l: SharedList) => l.id === id) ||
          newProfileSharedLists.find((l: ProfileSharedList) => l.id === id) ||
          null
      }
      
      if (!currentList && ownLists.length > 0) {
        currentList = ownLists[0]
      }
      
      if (currentList) {
          setActiveList(currentList)
          // Only load items here if we don't have a listId in URL (default list case)
          // If we DO have listId, the useEffect will handle it when loading becomes false
          if (!listId && currentList.id) {
            loadItems(currentList.id, signal)
          } else if (!currentList.id) {
            setItems([])
          }
      }
      
    } catch (err: any) {
      if (err.name !== 'AbortError' && err.message !== 'Request cancelled' && !signal?.aborted) {
          console.error(err)
          setError('Failed to load library')
      }
    } finally {
      if (!signal?.aborted) {
          setLoading(false)
      }
    }
  }, [profileId, listId, loadItems])

  // Initial load
  useEffect(() => {
    if (!profileId) return
    const controller = new AbortController()
    loadLibrary(controller.signal)
    return () => controller.abort()
  }, [profileId, loadLibrary])

  // Handle URL listId changes
  useEffect(() => {
    let controller: AbortController | null = null
    if (listId && !loading) {
      const id = parseInt(listId)
      const found = myLists.find(l => l.id === id) ||
        accountSharedLists.find(l => l.id === id) ||
        profileSharedLists.find(l => l.id === id)
      
      if (found) {
        if (activeList?.id !== found.id) {
            setActiveList(found)
        }
        controller = new AbortController()
        loadItems(id, controller.signal)
      }
    }
    return () => controller?.abort()
  }, [listId, myLists, accountSharedLists, profileSharedLists, loading, activeList, loadItems])

  // Actions
  const createList = async (name: string) => {
    try {
      const res = await apiFetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, name })
      })
      const data = await res.json()
      if (data.list) {
        setMyLists(prev => [...prev, data.list])
        toast.success('List created!')
        return true
      }
      return false
    } catch (e) {
      console.error(e)
      toast.error('Failed to create list')
      return false
    }
  }

  const deleteList = async (listId: number) => {
    try {
      await apiFetch(`/api/lists/${listId}`, { method: 'DELETE' })
      setMyLists(prev => prev.filter(l => l.id !== listId))
      if (activeList?.id === listId) {
        // If deleted list was active, switch to first available
        const nextList = myLists.find(l => l.id !== listId)
        if (nextList) {
           navigate(`/streaming/${profileId}/library/${nextList.id}`, { replace: true })
        }
      }
      toast.success('List deleted')
    } catch (e) {
      toast.error('Failed to delete list')
    }
  }

  const selectList = (list: List | SharedList | ProfileSharedList) => {
      if (activeList?.id !== list.id) {
          navigate(`/streaming/${profileId}/library/${list.id}`, { replace: true })
      }
  }

  return {
    state: {
      myLists,
      accountSharedLists,
      profileSharedLists,
      pendingInvites,
      availableFromOtherProfiles,
      activeList,
      items,
      loading,
      error
    },
    setters: {
      setMyLists,
      setAccountSharedLists,
      setProfileSharedLists,
      setPendingInvites,
      setAvailableFromOtherProfiles,
      setActiveList,
      setItems
    },
    actions: {
      refreshLibrary: () => loadLibrary(),
      loadItems,
      createList,
      deleteList,
      selectList
    }
  }
}
