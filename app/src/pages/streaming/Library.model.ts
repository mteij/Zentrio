import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { useLibraryData } from '../../hooks/useLibraryData'
import { apiFetch } from '../../lib/apiFetch'
import type { List, ListItem } from '../../services/database'
import type {
  AvailableSharedList,
  PendingInvite,
  ProfileSharedList,
  SharedList,
} from '../../components/library/LibrarySidebar'
import { createLogger } from '../../utils/client-logger'

const log = createLogger('LibraryScreenModel')

type AnyLibraryList = List | SharedList | ProfileSharedList

export interface LibraryScreenModel {
  status: 'loading' | 'ready' | 'error'
  listsLoading: boolean
  itemsLoading: boolean
  profileId: string
  errorMessage?: string
  activeList: AnyLibraryList | null
  myLists: List[]
  accountSharedLists: SharedList[]
  profileSharedLists: ProfileSharedList[]
  /** Combined shared lists (profile + account) — kept for TV view compat */
  sharedLists: AnyLibraryList[]
  pendingInvites: PendingInvite[]
  availableFromOtherProfiles: AvailableSharedList[]
  items: ListItem[]
  isOwner: boolean
  canRemove: boolean
  canAdd: boolean
  moveTargetLists: (List | SharedList)[]
  backgroundPoster: string | null
  navigation: {
    goBack: () => void
    openItem: (item: ListItem) => void
  }
  actions: {
    retry: () => void
    selectList: (list: AnyLibraryList) => void
    createList: (name: string) => Promise<boolean>
    deleteList: (id: number) => Promise<void>
    leaveSharedList: (shareId: number) => Promise<void>
    leaveProfileSharedList: (shareId: number) => Promise<void>
    acceptInvite: (invite: PendingInvite) => Promise<void>
    declineInvite: (invite: PendingInvite) => Promise<void>
    linkShareToProfile: (list: AvailableSharedList) => Promise<void>
  }
  setters: {
    setItems: (updater: (items: ListItem[]) => ListItem[]) => void
  }
}

export function useLibraryScreenModel(): LibraryScreenModel {
  const { profileId, listId } = useParams<{ profileId: string; listId?: string }>()
  const navigate = useNavigate()

  const {
    state: {
      myLists,
      accountSharedLists,
      profileSharedLists,
      pendingInvites,
      availableFromOtherProfiles,
      activeList,
      items,
      listsLoading,
      itemsLoading,
      error,
    },
    setters: {
      setAccountSharedLists,
      setProfileSharedLists,
      setPendingInvites,
      setActiveList,
      setItems,
    },
    actions: {
      refreshLibrary,
      createList,
      deleteList,
      selectList,
    },
  } = useLibraryData(profileId, listId)

  const sharedLists = useMemo<AnyLibraryList[]>(
    () => [...profileSharedLists, ...accountSharedLists],
    [accountSharedLists, profileSharedLists],
  )

  const isOwner = useMemo(
    () => !!activeList && myLists.some((l) => l.id === activeList.id),
    [activeList, myLists],
  )

  const canRemove = useMemo(() => {
    if (!activeList) return false
    if (isOwner) return true
    if ('share' in activeList) return (activeList as SharedList).share.permission === 'full'
    if ('profileShare' in activeList)
      return (activeList as ProfileSharedList).profileShare.permission === 'full'
    return false
  }, [activeList, isOwner])

  const canAdd = useMemo(() => {
    if (!activeList) return false
    if (isOwner) return true
    if ('share' in activeList) {
      const p = (activeList as SharedList).share.permission
      return p === 'add' || p === 'full'
    }
    if ('profileShare' in activeList) {
      const p = (activeList as ProfileSharedList).profileShare.permission
      return p === 'add' || p === 'full'
    }
    return false
  }, [activeList, isOwner])

  const moveTargetLists = useMemo<(List | SharedList)[]>(() => {
    if (!activeList) return []
    return [
      ...myLists.filter((l) => l.id !== activeList.id),
      ...accountSharedLists.filter(
        (l) =>
          l.id !== activeList.id &&
          (l.share.permission === 'add' || l.share.permission === 'full'),
      ),
    ]
  }, [activeList, myLists, accountSharedLists])

  const backgroundPoster = useMemo(() => items[0]?.poster ?? null, [items])

  const acceptInvite = async (invite: PendingInvite) => {
    try {
      const res = await apiFetch(`/api/lists/share/${invite.share_token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Failed to accept invite')
      }
      toast.success(`Accepted "${invite.listName}"`)
      refreshLibrary()
    } catch (err) {
      log.error('accept invite error', err)
      toast.error(err instanceof Error ? err.message : 'Failed to accept invite')
    }
  }

  const declineInvite = async (invite: PendingInvite) => {
    try {
      const res = await apiFetch(`/api/lists/share/${invite.share_token}/decline`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to decline invite')
      setPendingInvites((prev) => prev.filter((c) => c.id !== invite.id))
      toast.success('Invitation declined')
    } catch (err) {
      log.error('decline invite error', err)
      toast.error('Failed to decline invite')
    }
  }

  const leaveSharedList = async (shareId: number) => {
    try {
      const res = await apiFetch(`/api/lists/shares/${shareId}/leave`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to leave list')
      setAccountSharedLists((prev) => prev.filter((l) => l.share.id !== shareId))
      if (activeList && 'share' in activeList && (activeList as SharedList).share.id === shareId) {
        setActiveList(myLists[0] ?? null)
      }
      toast.success('Left shared list')
    } catch (err) {
      log.error('leave shared list error', err)
      toast.error('Failed to leave list')
    }
  }

  const leaveProfileSharedList = async (shareId: number) => {
    try {
      const res = await apiFetch(`/api/lists/profile-shares/${shareId}/leave/${profileId}`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to leave list')
      setProfileSharedLists((prev) => prev.filter((l) => l.profileShare.id !== shareId))
      if (
        activeList &&
        'profileShare' in activeList &&
        (activeList as ProfileSharedList).profileShare.id === shareId
      ) {
        setActiveList(myLists[0] ?? null)
      }
      toast.success('Left shared list')
    } catch (err) {
      log.error('leave profile shared list error', err)
      toast.error('Failed to leave list')
    }
  }

  const linkShareToProfile = async (list: AvailableSharedList) => {
    try {
      const res = await apiFetch(`/api/lists/shares/${list.share.id}/link/${profileId}`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to add list to this profile')
      toast.success(`Added "${list.name}" to this profile`)
      refreshLibrary()
    } catch (err) {
      log.error('link share error', err)
      toast.error(err instanceof Error ? err.message : 'Failed to add list')
    }
  }

  const status = error ? 'error' : listsLoading || itemsLoading ? 'loading' : 'ready'

  return {
    status,
    listsLoading,
    itemsLoading,
    profileId: profileId ?? '',
    errorMessage: error || undefined,
    activeList,
    myLists,
    accountSharedLists,
    profileSharedLists,
    sharedLists,
    pendingInvites,
    availableFromOtherProfiles,
    items,
    isOwner,
    canRemove,
    canAdd,
    moveTargetLists,
    backgroundPoster,
    navigation: {
      goBack: () => {
        if (window.history.length > 1) {
          navigate(-1)
          return
        }
        navigate(profileId ? `/streaming/${profileId}` : '/profiles')
      },
      openItem: (item) => navigate(`/streaming/${profileId}/${item.type}/${item.meta_id}`),
    },
    actions: {
      retry: refreshLibrary,
      selectList,
      createList,
      deleteList,
      leaveSharedList,
      leaveProfileSharedList,
      acceptInvite,
      declineInvite,
      linkShareToProfile,
    },
    setters: {
      setItems,
    },
  }
}
