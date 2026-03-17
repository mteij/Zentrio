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
  profileId: string
  errorMessage?: string
  activeList: AnyLibraryList | null
  myLists: List[]
  sharedLists: AnyLibraryList[]
  pendingInvites: PendingInvite[]
  availableFromOtherProfiles: AvailableSharedList[]
  items: ListItem[]
  navigation: {
    goBack: () => void
    openItem: (item: ListItem) => void
  }
  actions: {
    retry: () => void
    selectList: (list: AnyLibraryList) => void
    acceptInvite: (invite: PendingInvite) => Promise<void>
    declineInvite: (invite: PendingInvite) => Promise<void>
    linkShareToProfile: (list: AvailableSharedList) => Promise<void>
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
      setPendingInvites,
    },
    actions: {
      refreshLibrary,
      selectList,
    },
  } = useLibraryData(profileId, listId)

  const sharedLists = useMemo<AnyLibraryList[]>(
    () => [...profileSharedLists, ...accountSharedLists],
    [accountSharedLists, profileSharedLists],
  )

  const acceptInvite = async (invite: PendingInvite) => {
    try {
      const response = await apiFetch(`/api/lists/share/${invite.share_token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      })

      if (!response.ok) {
        const body = await response.json()
        throw new Error(body.error || 'Failed to accept invite')
      }

      toast.success(`Accepted "${invite.listName}"`)
      refreshLibrary()
    } catch (error) {
      log.error('accept invite error', error)
      toast.error(error instanceof Error ? error.message : 'Failed to accept invite')
    }
  }

  const declineInvite = async (invite: PendingInvite) => {
    try {
      const response = await apiFetch(`/api/lists/share/${invite.share_token}/decline`, { method: 'POST' })
      if (!response.ok) {
        throw new Error('Failed to decline invite')
      }
      setPendingInvites(pendingInvites.filter((candidate) => candidate.id !== invite.id))
      toast.success('Invitation declined')
    } catch (error) {
      log.error('decline invite error', error)
      toast.error('Failed to decline invite')
    }
  }

  const linkShareToProfile = async (list: AvailableSharedList) => {
    try {
      const response = await apiFetch(`/api/lists/shares/${list.share.id}/link/${profileId}`, { method: 'POST' })
      if (!response.ok) {
        throw new Error('Failed to add list to this profile')
      }
      toast.success(`Added "${list.name}" to this profile`)
      refreshLibrary()
    } catch (error) {
      log.error('link share error', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add list')
    }
  }

  const status = error ? 'error' : listsLoading || itemsLoading ? 'loading' : 'ready'

  return {
    status,
    profileId: profileId || '',
    errorMessage: error || undefined,
    activeList,
    myLists,
    sharedLists,
    pendingInvites,
    availableFromOtherProfiles,
    items,
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
      acceptInvite,
      declineInvite,
      linkShareToProfile,
    },
  }
}
