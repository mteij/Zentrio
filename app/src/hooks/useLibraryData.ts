
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
    type AvailableSharedList,
    type PendingInvite,
    type ProfileSharedList,
    type SharedList,
} from '../components/library/LibrarySidebar'
import { apiFetch, apiFetchJson } from '../lib/apiFetch'
import { List, ListItem } from '../services/database'
import { createLogger } from '../utils/client-logger'

const log = createLogger('useLibraryData')

// Stale time: 60s — navigating back to Library within a minute shows cached data instantly
const LISTS_STALE_TIME = 60 * 1000
const ITEMS_STALE_TIME = 30 * 1000

interface LibraryListsData {
  myLists: List[]
  accountSharedLists: SharedList[]
  profileSharedLists: ProfileSharedList[]
  pendingInvites: PendingInvite[]
  availableFromOtherProfiles: AvailableSharedList[]
}

async function fetchLibraryLists(profileId: string): Promise<LibraryListsData> {
  const [listsRes, sharedRes, profileSharedRes, pendingRes, availableRes] = await Promise.all([
    apiFetch(`/api/lists?profileId=${profileId}`),
    apiFetch(`/api/lists/shared-for-profile/${profileId}`),
    apiFetch(`/api/lists/profile-shared/${profileId}`),
    apiFetch('/api/lists/pending-invites'),
    apiFetch(`/api/lists/available-from-other-profiles/${profileId}`)
  ])

  const [listsData, sharedData, profileSharedData, pendingData, availableData] = await Promise.all([
    listsRes.json(),
    sharedRes.json(),
    profileSharedRes.json(),
    pendingRes.json(),
    availableRes.json()
  ])

  let myLists: List[] = listsData.lists || []

  if (myLists.length === 0) {
    const createRes = await apiFetch('/api/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId, name: 'My Library' })
    })
    const createData = await createRes.json()
    if (createData.list) myLists = [createData.list]
  }

  return {
    myLists,
    accountSharedLists: (sharedData.lists || []).filter((l: SharedList) => l.isLinkedToThisProfile),
    profileSharedLists: profileSharedData.lists || [],
    pendingInvites: pendingData.invites || [],
    availableFromOtherProfiles: availableData.lists || [],
  }
}

async function fetchListItems(listId: number, profileId: string): Promise<ListItem[]> {
  const data = await apiFetchJson<{ items: ListItem[] }>(`/api/lists/${listId}/items?profileId=${profileId}`)
  return data.items || []
}

export function useLibraryData(profileId: string | undefined, listId: string | undefined) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // TanStack Query for the sidebar lists — cached for 60s so return visits are instant
  const listsQuery = useQuery({
    queryKey: ['library-lists', profileId],
    queryFn: () => fetchLibraryLists(profileId!),
    enabled: !!profileId,
    staleTime: LISTS_STALE_TIME,
    refetchOnWindowFocus: false,
  })

  // Derive the active list ID: prefer URL param, fall back to first own list
  const activeListId = listId
    ? parseInt(listId)
    : listsQuery.data?.myLists[0]?.id ?? null

  // TanStack Query for the active list's items — fires in parallel with listsQuery when listId
  // is already in the URL (both queries start at the same time on mount)
  const itemsQuery = useQuery({
    queryKey: ['library-items', profileId, activeListId],
    queryFn: () => fetchListItems(activeListId!, profileId!),
    enabled: !!profileId && !!activeListId,
    staleTime: ITEMS_STALE_TIME,
    refetchOnWindowFocus: false,
  })

  // Local state for optimistic updates (leave list, decline invite, remove item).
  // Initialised from query data and updated optimistically on user actions.
  const [myLists, setMyLists] = useState<List[]>([])
  const [accountSharedLists, setAccountSharedLists] = useState<SharedList[]>([])
  const [profileSharedLists, setProfileSharedLists] = useState<ProfileSharedList[]>([])
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([])
  const [availableFromOtherProfiles, setAvailableFromOtherProfiles] = useState<AvailableSharedList[]>([])
  const [activeList, setActiveList] = useState<List | SharedList | ProfileSharedList | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  const [error, _setError] = useState('')

  // Sync query data → local state when it (re)loads
  useEffect(() => {
    if (!listsQuery.data) return
    const { myLists: ql, accountSharedLists: qa, profileSharedLists: qp, pendingInvites: qpi, availableFromOtherProfiles: qav } = listsQuery.data
    setMyLists(ql)
    setAccountSharedLists(qa)
    setProfileSharedLists(qp)
    setPendingInvites(qpi)
    setAvailableFromOtherProfiles(qav)

    // Resolve active list
    const id = listId ? parseInt(listId) : null
    const found = id
      ? (ql.find(l => l.id === id) || qa.find(l => l.id === id) || qp.find(l => l.id === id) || null)
      : ql[0] || null
    setActiveList(found)
  }, [listsQuery.data, listId])

  // Sync items query → local items state
  useEffect(() => {
    if (itemsQuery.data) setItems(itemsQuery.data)
  }, [itemsQuery.data])

  // Expose a loadItems for cases where the page calls it directly (e.g. list selection)
  const loadItems = useCallback(async (lid: number) => {
    // Prefetch into the query cache so the result is available instantly next time
    await queryClient.fetchQuery({
      queryKey: ['library-items', profileId, lid],
      queryFn: () => fetchListItems(lid, profileId!),
      staleTime: ITEMS_STALE_TIME,
    }).then(data => setItems(data)).catch(e => {
      log.error(e)
      setItems([])
    })
  }, [profileId, queryClient])

  const refreshLibrary = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['library-lists', profileId] })
    if (activeListId) {
      queryClient.invalidateQueries({ queryKey: ['library-items', profileId, activeListId] })
    }
  }, [profileId, activeListId, queryClient])

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
        queryClient.invalidateQueries({ queryKey: ['library-lists', profileId] })
        toast.success('List created!')
        return true
      }
      return false
    } catch (e) {
      log.error(e)
      toast.error('Failed to create list')
      return false
    }
  }

  const deleteList = async (lid: number) => {
    try {
      await apiFetch(`/api/lists/${lid}`, { method: 'DELETE' })
      setMyLists(prev => prev.filter(l => l.id !== lid))
      queryClient.invalidateQueries({ queryKey: ['library-lists', profileId] })
      if (activeList?.id === lid) {
        const nextList = myLists.find(l => l.id !== lid)
        if (nextList) navigate(`/streaming/${profileId}/library/${nextList.id}`, { replace: true })
      }
      toast.success('List deleted')
    } catch {
      toast.error('Failed to delete list')
    }
  }

  const selectList = (list: List | SharedList | ProfileSharedList) => {
    if (activeList?.id !== list.id) {
      navigate(`/streaming/${profileId}/library/${list.id}`, { replace: true })
    }
  }

  const listsLoading = listsQuery.isLoading
  const itemsLoading = itemsQuery.isLoading

  return {
    state: {
      myLists,
      accountSharedLists,
      profileSharedLists,
      pendingInvites,
      availableFromOtherProfiles,
      activeList,
      items,
      loading: listsLoading,
      listsLoading,
      itemsLoading,
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
      refreshLibrary,
      loadItems,
      createList,
      deleteList,
      selectList
    }
  }
}
