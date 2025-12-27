import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Share2, Users, LogOut, Library as LibraryIcon, Trash2, Mail, Check, X as XIcon, UserPlus, ChevronDown, ChevronRight, Lock, Globe, User, MoreVertical } from 'lucide-react'
import { Layout, RatingBadge, LazyImage, SkeletonCard } from '../../components'
import { List, ListItem, ListShare, Profile } from '../../services/database'
import styles from '../../styles/Streaming.module.css'
import { apiFetch } from '../../lib/apiFetch'
import { ShareListModal } from '../../components/features/ShareListModal'

import { LibraryItemCard } from '../../components/library/LibraryItemCard'
import { toast } from 'sonner'

interface SharedList extends List {
  share: ListShare
  sharedByName?: string
  isLinkedToThisProfile?: boolean
}

interface PendingInvite extends ListShare {
  listName: string
  sharedByName?: string
}

interface AvailableSharedList extends List {
  share: ListShare
  sharedByName?: string
  linkedProfiles: number[]
}

interface ProfileShare {
  id: number
  list_id: number
  owner_profile_id: number
  shared_to_profile_id: number
  permission: 'read' | 'add' | 'full'
  profile?: Profile
}

interface ProfileSharedList extends List {
  profileShare: ProfileShare
  ownerName?: string
}

type SharingType = 'private' | 'account-shared' | 'profile-shared'

export const StreamingLibrary = () => {
  const { profileId, listId } = useParams<{ profileId: string, listId?: string }>()
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
  const [showNewListInput, setShowNewListInput] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [profileShareModalOpen, setProfileShareModalOpen] = useState(false)
  const [shareListId, setShareListId] = useState<number | null>(null)
  
  // Sidebar section collapse state
  const [sectionsOpen, setSectionsOpen] = useState({
    private: true,
    shared: true
  })
  
  // Mobile list selector state
  const [mobileListOpen, setMobileListOpen] = useState(false)

  const toggleSection = (section: keyof typeof sectionsOpen) => {
    setSectionsOpen(prev => ({ ...prev, [section]: !prev[section] }))
  }

  useEffect(() => {
    if (!profileId) {
      navigate('/profiles')
      return
    }
    loadLibrary()
  }, [profileId])

  useEffect(() => {
    // When listId changes in URL, update active list
    if (listId && !loading) {
      const id = parseInt(listId)
      const found = myLists.find(l => l.id === id) ||
        accountSharedLists.find(l => l.id === id) ||
        profileSharedLists.find(l => l.id === id)
      if (found) {
        setActiveList(found)
        loadItems(id)
      }
    }
  }, [listId, myLists, accountSharedLists, profileSharedLists, loading])

  const loadLibrary = async () => {
    setLoading(true)
    try {
      // Fetch own lists
      const listsRes = await apiFetch(`/api/lists?profileId=${profileId}`)
      const listsData = await listsRes.json()
      
      // Fetch account-shared lists for this profile
      const sharedRes = await apiFetch(`/api/lists/shared-for-profile/${profileId}`)
      const sharedData = await sharedRes.json()
      const sharedListsData = sharedData.lists || []
      
      // Fetch profile-shared lists (within same account)
      const profileSharedRes = await apiFetch(`/api/lists/profile-shared/${profileId}`)
      const profileSharedData = await profileSharedRes.json()
      const profileSharedData2 = profileSharedData.lists || []
      
      // Fetch pending invites
      const pendingRes = await apiFetch('/api/lists/pending-invites')
      const pendingData = await pendingRes.json()
      setPendingInvites(pendingData.invites || [])
      
      // Fetch available shares from other profiles
      const availableRes = await apiFetch(`/api/lists/available-from-other-profiles/${profileId}`)
      const availableData = await availableRes.json()
      setAvailableFromOtherProfiles(availableData.lists || [])
      
      let ownLists = listsData.lists || []
      
      if (ownLists.length === 0) {
        // Create default list if none exist
        const createRes = await apiFetch('/api/lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profileId, name: 'My Library' })
        })
        const createData = await createRes.json()
        if (createData.list) {
            ownLists = [createData.list]
        }
      }
      
      setMyLists(ownLists)
      setAccountSharedLists(sharedListsData.filter((l: SharedList) => l.isLinkedToThisProfile))
      setProfileSharedLists(profileSharedData2)
      
      // Determine active list from URL or default
      let currentList: List | SharedList | ProfileSharedList | null = null
      
      if (listId) {
        const id = parseInt(listId)
        currentList = ownLists.find((l: List) => l.id === id) ||
          sharedListsData.find((l: SharedList) => l.id === id) ||
          profileSharedData2.find((l: ProfileSharedList) => l.id === id) ||
          null
      }
      
      if (!currentList && ownLists.length > 0) {
        currentList = ownLists[0]
      }
      
      setActiveList(currentList)
      
      // Fetch items for active list
      if (currentList?.id) {
        loadItems(currentList.id)
      } else {
        setItems([])
      }
    } catch (err) {
      console.error(err)
      setError('Failed to load library')
    } finally {
      setLoading(false)
    }
  }

  const loadItems = async (lid: number) => {
    try {
      const itemsRes = await apiFetch(`/api/lists/${lid}/items?profileId=${profileId}`)
      const itemsData = await itemsRes.json()
      setItems(itemsData.items || [])
    } catch (err) {
      console.error(err)
      setItems([])
    }
  }

  const handleListClick = async (list: List | SharedList | ProfileSharedList) => {
    setActiveList(list)
    navigate(`/streaming/${profileId}/library/${list.id}`, { replace: true })
    await loadItems(list.id)
  }

  const handleCreateList = async () => {
    if (!newListName.trim()) return
    
    setCreatingList(true)
    try {
      const res = await apiFetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, name: newListName.trim() })
      })
      const data = await res.json()
      if (data.list) {
        setMyLists([...myLists, data.list])
        setNewListName('')
        setShowNewListInput(false)
        toast.success('List created!')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to create list')
    } finally {
      setCreatingList(false)
    }
  }

  const handleDeleteList = async (list: List, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete "${list.name}"? This cannot be undone.`)) return
    
    try {
      await apiFetch(`/api/lists/${list.id}`, { method: 'DELETE' })
      setMyLists(myLists.filter(l => l.id !== list.id))
      if (activeList?.id === list.id && myLists.length > 1) {
        const nextList = myLists.find(l => l.id !== list.id)
        if (nextList) handleListClick(nextList)
      }
      toast.success('List deleted')
    } catch (e) {
      toast.error('Failed to delete list')
    }
  }

  const handleOpenShareModal = (lid: number) => {
    setShareListId(lid)
    setShareModalOpen(true)
  }

  const handleLeaveSharedList = async (shareId: number) => {
    try {
      const res = await apiFetch(`/api/lists/shares/${shareId}/leave`, { method: 'POST' })
      if (res.ok) {
        setAccountSharedLists(accountSharedLists.filter(l => l.share.id !== shareId))
        toast.success('Left shared list')
        if (activeList && 'share' in activeList && (activeList as SharedList).share.id === shareId) {
          setActiveList(myLists[0] || null)
        }
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to leave list')
    }
  }

  const handleLeaveProfileSharedList = async (shareId: number) => {
    try {
      const res = await apiFetch(`/api/lists/profile-shares/${shareId}/leave/${profileId}`, { method: 'POST' })
      if (res.ok) {
        setProfileSharedLists(profileSharedLists.filter(l => l.profileShare.id !== shareId))
        toast.success('Left shared list')
        if (activeList && 'profileShare' in activeList && (activeList as ProfileSharedList).profileShare.id === shareId) {
          setActiveList(myLists[0] || null)
        }
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to leave list')
    }
  }

  const handleAcceptInvite = async (invite: PendingInvite) => {
    try {
      const res = await apiFetch(`/api/lists/share/${invite.share_token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId })
      })
      if (res.ok) {
        toast.success(`Accepted invitation to "${invite.listName}"`)
        loadLibrary()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to accept invitation')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to accept invitation')
    }
  }

  const handleDeclineInvite = async (invite: PendingInvite) => {
    try {
      const res = await apiFetch(`/api/lists/share/${invite.share_token}/decline`, { method: 'POST' })
      if (res.ok) {
        setPendingInvites(pendingInvites.filter(i => i.id !== invite.id))
        toast.success('Invitation declined')
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to decline invitation')
    }
  }

  const handleLinkShareToProfile = async (share: AvailableSharedList) => {
    try {
      const res = await apiFetch(`/api/lists/shares/${share.share.id}/link/${profileId}`, { method: 'POST' })
      if (res.ok) {
        toast.success(`Added "${share.name}" to this profile`)
        loadLibrary()
      }
    } catch (e) {
      console.error(e)
      toast.error('Failed to add list to profile')
    }
  }

  // Determine sharing type and permissions
  const getListSharingType = (list: List | SharedList | ProfileSharedList): SharingType => {
    if ('profileShare' in list) return 'profile-shared'
    if ('share' in list) return 'account-shared'
    return 'private'
  }

  const isOwner = useMemo(() => {
    if (!activeList) return false
    return myLists.some(l => l.id === activeList.id)
  }, [activeList, myLists])

  const canRemove = useMemo(() => {
    if (!activeList) return false
    if (isOwner) return true
    if ('share' in activeList) {
      return (activeList as SharedList).share.permission === 'full'
    }
    if ('profileShare' in activeList) {
      return (activeList as ProfileSharedList).profileShare.permission === 'full'
    }
    return false
  }, [activeList, isOwner])

  const canAdd = useMemo(() => {
    if (!activeList) return false
    if (isOwner) return true
    if ('share' in activeList) {
      const perm = (activeList as SharedList).share.permission
      return perm === 'add' || perm === 'full'
    }
    if ('profileShare' in activeList) {
      const perm = (activeList as ProfileSharedList).profileShare.permission
      return perm === 'add' || perm === 'full'
    }
    return false
  }, [activeList, isOwner])

  // Get first item's poster for background
  const backgroundPoster = useMemo(() => {
    if (items.length === 0) return null
    return items[0]?.poster || null
  }, [items])

  const showImdbRatings = true

  if (loading) {
    return (
      <Layout title="Library" showHeader={false} showFooter={false}>
        <div className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero}`}>
          <div className={styles.contentContainer} style={{ marginTop: 0 }}>
            <div style={{ padding: '0 60px', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: '180px', height: '40px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '8px', position: 'relative', overflow: 'hidden' }}>
                <div className={styles.skeletonShimmer} />
              </div>
            </div>
            <div className={styles.mediaGrid}>
              {Array.from({ length: 12 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#141414', color: 'white' }}>
        {error}
      </div>
    )
  }

  return (
    <Layout title="Library" showHeader={false} showFooter={false}>
      {/* Dynamic ambient background */}
      <AnimatePresence mode="sync">
        {backgroundPoster && (
          <motion.div 
            key={`ambient-${activeList?.id}`}
            className={styles.pageAmbientBackground}
            style={{ backgroundImage: `url(${backgroundPoster})` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      <div className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero} ${styles.libraryLayout}`}>
        {/* Sidebar */}
        <aside className={styles.librarySidebar} style={{
          width: '280px',
          flexShrink: 0,
          padding: '20px',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          height: 'calc(100vh - var(--titlebar-height, 0px) - 20px)',
          overflowY: 'auto',
          position: 'sticky',
          top: 'calc(var(--titlebar-height, 0px) + 20px)'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <LibraryIcon size={24} style={{ color: '#fff' }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff', margin: 0 }}>Library</h1>
          </div>

          {/* Create List Button */}
          {showNewListInput ? (
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
                placeholder="List name..."
                autoFocus
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  outline: 'none',
                  fontSize: '0.9rem'
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleCreateList}
                  disabled={creatingList || !newListName.trim()}
                  style={{
                    flex: 1,
                    background: '#e50914',
                    border: 'none',
                    color: '#fff',
                    padding: '8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.85rem',
                    opacity: creatingList || !newListName.trim() ? 0.5 : 1
                  }}
                >
                  {creatingList ? '...' : 'Create'}
                </button>
                <button
                  onClick={() => { setShowNewListInput(false); setNewListName('') }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#888',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewListInput(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px dashed rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.7)',
                padding: '12px',
                borderRadius: '10px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                fontWeight: '500',
                marginBottom: '20px',
                transition: 'all 0.2s'
              }}
            >
              <Plus size={18} />
              New List
            </button>
          )}

          {/* My Lists Section */}
          <SidebarSection
            title="My Lists"
            icon={<Lock size={16} />}
            count={myLists.length}
            isOpen={sectionsOpen.private}
            onToggle={() => toggleSection('private')}
          >
            {myLists.map(list => (
              <ListSidebarItem
                key={list.id}
                list={list}
                isActive={activeList?.id === list.id}
                sharingType="private"
                onClick={() => handleListClick(list)}
                onShare={() => handleOpenShareModal(list.id)}
                onDelete={(e) => handleDeleteList(list, e)}
                showActions
              />
            ))}
          </SidebarSection>

          {/* Shared Lists Section (Unified) */}
          {(accountSharedLists.length > 0 || profileSharedLists.length > 0 || pendingInvites.length > 0 || availableFromOtherProfiles.length > 0) && (
            <SidebarSection
              title="Shared Lists"
              icon={<Users size={16} />}
              count={accountSharedLists.length + profileSharedLists.length}
              badge={pendingInvites.length > 0 ? pendingInvites.length : undefined}
              isOpen={sectionsOpen.shared}
              onToggle={() => toggleSection('shared')}
            >
              {/* Pending Invites */}
              {pendingInvites.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '8px', fontWeight: '600' }}>
                    <Mail size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    Pending ({pendingInvites.length})
                  </div>
                  {pendingInvites.map(invite => (
                    <div key={invite.id} style={{
                      padding: '10px 12px',
                      background: 'rgba(251, 191, 36, 0.1)',
                      border: '1px solid rgba(251, 191, 36, 0.2)',
                      borderRadius: '8px',
                      marginBottom: '8px'
                    }}>
                      <div style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '6px' }}>
                        {invite.listName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>
                        from {invite.sharedByName || 'Someone'}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleAcceptInvite(invite)} style={{
                          flex: 1, padding: '6px', background: '#22c55e', border: 'none',
                          borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.75rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                        }}>
                          <Check size={12} /> Accept
                        </button>
                        <button onClick={() => handleDeclineInvite(invite)} style={{
                          flex: 1, padding: '6px', background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px',
                          color: '#f87171', cursor: 'pointer', fontSize: '0.75rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                        }}>
                          <XIcon size={12} /> Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Profile Shared Lists */}
              {profileSharedLists.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#a855f7', marginBottom: '8px', fontWeight: '600' }}>
                    <User size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    From Profiles
                  </div>
                  {profileSharedLists.map(list => (
                    <ListSidebarItem
                      key={list.id}
                      list={list}
                      isActive={activeList?.id === list.id}
                      sharingType="profile-shared"
                      sharedBy={list.ownerName}
                      onClick={() => handleListClick(list)}
                      onLeave={() => handleLeaveProfileSharedList(list.profileShare.id)}
                    />
                  ))}
                </div>
              )}

              {/* Account Shared Lists */}
              {accountSharedLists.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginBottom: '8px', fontWeight: '600' }}>
                    <Globe size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    From Accounts
                  </div>
                  {accountSharedLists.map(list => (
                    <ListSidebarItem
                      key={list.id}
                      list={list}
                      isActive={activeList?.id === list.id}
                      sharingType="account-shared"
                      sharedBy={list.sharedByName}
                      onClick={() => handleListClick(list)}
                      onLeave={() => handleLeaveSharedList(list.share.id)}
                    />
                  ))}
                </div>
              )}

              {/* Available from other profiles */}
              {availableFromOtherProfiles.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginBottom: '8px', fontWeight: '600' }}>
                    <UserPlus size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    Available to Add
                  </div>
                  {availableFromOtherProfiles.map(list => (
                    <div key={list.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      background: 'rgba(96, 165, 250, 0.1)',
                      border: '1px solid rgba(96, 165, 250, 0.2)',
                      borderRadius: '8px',
                      marginBottom: '6px'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#fff' }}>{list.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                          {list.linkedProfiles.length} profile(s)
                        </div>
                      </div>
                      <button onClick={() => handleLinkShareToProfile(list)} style={{
                        padding: '4px 8px', background: '#3b82f6', border: 'none',
                        borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.7rem'
                      }}>
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </SidebarSection>
          )}
        </aside>

        {/* Main Content */}
        <main className={styles.libraryMain} style={{ flex: 1 }}>
          {/* Mobile List Selector - Only visible on mobile */}
          <div className={styles.mobileListSelector}>
            <button
              onClick={() => setMobileListOpen(!mobileListOpen)}
              className={styles.mobileListSelectorBtn}
            >
              <LibraryIcon size={18} />
              <span>{activeList?.name || 'Select List'}</span>
              <ChevronDown size={18} style={{ transform: mobileListOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
            </button>
            
            <AnimatePresence>
              {mobileListOpen && (
                <>
                  <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                    onClick={() => setMobileListOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className={styles.mobileListDropdown}
                  >
                    {/* Create New List Button */}
                    {showNewListInput ? (
                      <div style={{ marginBottom: '16px', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                        <input
                          type="text"
                          value={newListName}
                          onChange={(e) => setNewListName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { handleCreateList(); setMobileListOpen(false) } }}
                          placeholder="List name..."
                          autoFocus
                          style={{
                            width: '100%', background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.2)', color: '#fff',
                            padding: '10px 12px', borderRadius: '8px', outline: 'none', fontSize: '0.9rem',
                            marginBottom: '8px'
                          }}
                        />
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => { handleCreateList(); setMobileListOpen(false) }}
                            disabled={creatingList || !newListName.trim()}
                            style={{
                              flex: 1, background: '#e50914', border: 'none', color: '#fff',
                              padding: '8px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600',
                              fontSize: '0.85rem', opacity: creatingList || !newListName.trim() ? 0.5 : 1
                            }}
                          >
                            {creatingList ? '...' : 'Create'}
                          </button>
                          <button
                            onClick={() => { setShowNewListInput(false); setNewListName('') }}
                            style={{
                              background: 'rgba(255,255,255,0.1)', border: 'none',
                              color: '#888', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer'
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowNewListInput(true)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          background: 'rgba(255,255,255,0.08)', border: '1px dashed rgba(255,255,255,0.2)',
                          color: 'rgba(255,255,255,0.7)', padding: '10px', borderRadius: '8px',
                          cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500', marginBottom: '16px'
                        }}
                      >
                        <Plus size={16} />
                        New List
                      </button>
                    )}

                    {/* Pending Invites */}
                    {pendingInvites.length > 0 && (
                      <div style={{ marginBottom: '16px', padding: '10px', background: 'rgba(251, 191, 36, 0.1)', borderRadius: '10px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
                        <div style={{ fontSize: '0.75rem', color: '#fbbf24', marginBottom: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Mail size={12} />
                          Pending Invites ({pendingInvites.length})
                        </div>
                        {pendingInvites.map(invite => (
                          <div key={invite.id} style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '4px' }}>{invite.listName}</div>
                            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginBottom: '6px' }}>from {invite.sharedByName || 'Someone'}</div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => { handleAcceptInvite(invite); setMobileListOpen(false) }} style={{
                                flex: 1, padding: '6px', background: '#22c55e', border: 'none',
                                borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '0.75rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                              }}>
                                <Check size={12} />Accept
                              </button>
                              <button onClick={() => handleDeclineInvite(invite)} style={{
                                flex: 1, padding: '6px', background: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '4px',
                                color: '#f87171', cursor: 'pointer', fontSize: '0.75rem',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                              }}>
                                <XIcon size={12} />Decline
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* My Lists */}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Lock size={12} />
                        My Lists
                      </div>
                      {myLists.map(list => (
                        <div
                          key={list.id}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 10px', marginBottom: '4px', borderRadius: '8px',
                            background: activeList?.id === list.id ? 'rgba(255,255,255,0.1)' : 'transparent'
                          }}
                        >
                          <button
                            onClick={() => { handleListClick(list); setMobileListOpen(false) }}
                            style={{
                              flex: 1, textAlign: 'left', padding: '2px 0',
                              background: 'transparent', border: 'none', color: '#fff',
                              cursor: 'pointer', fontSize: '0.9rem', fontWeight: activeList?.id === list.id ? '600' : '400'
                            }}
                          >
                            {list.name}
                          </button>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleOpenShareModal(list.id); setMobileListOpen(false) }}
                              style={{
                                padding: '6px', background: 'rgba(255,255,255,0.08)', border: 'none',
                                borderRadius: '6px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)'
                              }}
                              title="Share"
                            >
                              <Share2 size={14} />
                            </button>
                            {!list.is_default && (
                              <button
                                onClick={(e) => { handleDeleteList(list, e); setMobileListOpen(false) }}
                                style={{
                                  padding: '6px', background: 'rgba(239, 68, 68, 0.15)', border: 'none',
                                  borderRadius: '6px', cursor: 'pointer', color: '#f87171'
                                }}
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Profile Shared Lists */}
                    {profileSharedLists.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#a855f7', marginBottom: '6px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={12} />
                          From Profiles
                        </div>
                        {profileSharedLists.map(list => (
                          <div
                            key={list.id}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 10px', marginBottom: '4px', borderRadius: '8px',
                              background: activeList?.id === list.id ? 'rgba(168, 85, 247, 0.15)' : 'transparent'
                            }}
                          >
                            <button
                              onClick={() => { handleListClick(list); setMobileListOpen(false) }}
                              style={{
                                flex: 1, textAlign: 'left', padding: '2px 0',
                                background: 'transparent', border: 'none', color: '#fff',
                                cursor: 'pointer', fontSize: '0.9rem', fontWeight: activeList?.id === list.id ? '600' : '400'
                              }}
                            >
                              {list.name}
                              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginLeft: '6px' }}>by {list.ownerName}</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleLeaveProfileSharedList(list.profileShare.id); setMobileListOpen(false) }}
                              style={{
                                padding: '6px', background: 'rgba(239, 68, 68, 0.15)', border: 'none',
                                borderRadius: '6px', cursor: 'pointer', color: '#f87171'
                              }}
                              title="Leave"
                            >
                              <LogOut size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Account Shared Lists */}
                    {accountSharedLists.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginBottom: '6px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Globe size={12} />
                          From Accounts
                        </div>
                        {accountSharedLists.map(list => (
                          <div
                            key={list.id}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 10px', marginBottom: '4px', borderRadius: '8px',
                              background: activeList?.id === list.id ? 'rgba(96, 165, 250, 0.15)' : 'transparent'
                            }}
                          >
                            <button
                              onClick={() => { handleListClick(list); setMobileListOpen(false) }}
                              style={{
                                flex: 1, textAlign: 'left', padding: '2px 0',
                                background: 'transparent', border: 'none', color: '#fff',
                                cursor: 'pointer', fontSize: '0.9rem', fontWeight: activeList?.id === list.id ? '600' : '400'
                              }}
                            >
                              {list.name}
                              <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginLeft: '6px' }}>by {list.sharedByName}</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleLeaveSharedList(list.share.id); setMobileListOpen(false) }}
                              style={{
                                padding: '6px', background: 'rgba(239, 68, 68, 0.15)', border: 'none',
                                borderRadius: '6px', cursor: 'pointer', color: '#f87171'
                              }}
                              title="Leave"
                            >
                              <LogOut size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Available from other profiles */}
                    {availableFromOtherProfiles.length > 0 && (
                      <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(96, 165, 250, 0.1)', borderRadius: '10px', border: '1px solid rgba(96, 165, 250, 0.2)' }}>
                        <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginBottom: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <UserPlus size={12} />
                          Available to Add
                        </div>
                        {availableFromOtherProfiles.map(list => (
                          <div key={list.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)'
                          }}>
                            <div>
                              <div style={{ fontSize: '0.85rem', color: '#fff' }}>{list.name}</div>
                              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>{list.linkedProfiles.length} profile(s)</div>
                            </div>
                            <button onClick={() => { handleLinkShareToProfile(list); setMobileListOpen(false) }} style={{
                              padding: '6px 10px', background: '#3b82f6', border: 'none',
                              borderRadius: '6px', color: '#fff', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '500'
                            }}>
                              Add
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>


          {/* List Header */}
          {activeList && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <h2 style={{ fontSize: '2rem', fontWeight: '700', color: '#fff', margin: 0 }}>
                  {activeList.name}
                </h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {isOwner && (
                    <>
                      <button
                        onClick={() => handleOpenShareModal(activeList.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                          color: '#fff', padding: '8px 14px', borderRadius: '8px',
                          cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500'
                        }}
                      >
                        <Share2 size={16} />
                        Share
                      </button>
                    </>
                  )}
                  {'share' in activeList && (
                    <button
                      onClick={() => handleLeaveSharedList((activeList as SharedList).share.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171', padding: '8px 14px', borderRadius: '8px',
                        cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500'
                      }}
                    >
                      <LogOut size={16} />
                      Leave
                    </button>
                  )}
                </div>
              </div>
              
              {/* Sharing info bar */}
              {!isOwner && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px',
                  background: getListSharingType(activeList) === 'account-shared' 
                    ? 'rgba(96, 165, 250, 0.1)' 
                    : 'rgba(147, 51, 234, 0.1)',
                  border: `1px solid ${getListSharingType(activeList) === 'account-shared' 
                    ? 'rgba(96, 165, 250, 0.2)' 
                    : 'rgba(147, 51, 234, 0.2)'}`,
                  borderRadius: '8px',
                  fontSize: '0.85rem'
                }}>
                  {getListSharingType(activeList) === 'account-shared' ? (
                    <>
                      <Globe size={16} style={{ color: '#60a5fa' }} />
                      <span style={{ color: '#93c5fd' }}>
                        Shared by <strong>{(activeList as SharedList).sharedByName || 'Someone'}</strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <User size={16} style={{ color: '#a855f7' }} />
                      <span style={{ color: '#c4b5fd' }}>
                        Shared by <strong>{(activeList as ProfileSharedList).ownerName || 'Another profile'}</strong>
                      </span>
                    </>
                  )}
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>•</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {(() => {
                      const perm = 'share' in activeList 
                        ? (activeList as SharedList).share.permission 
                        : (activeList as ProfileSharedList).profileShare?.permission
                      return perm === 'read' ? 'View only' : perm === 'add' ? 'Can add items' : 'Full access'
                    })()}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* List content */}
          {items.length === 0 ? (
            <div style={{ padding: '80px 20px', textAlign: 'center', color: '#666' }}>
              <LibraryIcon size={56} style={{ marginBottom: '20px', opacity: 0.4 }} />
              <p style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#888' }}>This list is empty</p>
              <p style={{ fontSize: '0.95rem', opacity: 0.7 }}>
                Add movies and shows from their detail pages
              </p>
            </div>
          ) : (
            <div className={styles.mediaGrid} style={{ padding: 0 }}>
              {items.map(item => (
                <LibraryItemCard
                  key={item.meta_id}
                  item={item}
                  profileId={profileId!}
                  currentListId={activeList?.id || 0}
                  lists={myLists}
                  sharedLists={accountSharedLists}
                  isOwner={isOwner}
                  canRemove={canRemove}
                  canAdd={canAdd}
                  showImdbRatings={showImdbRatings}
                  onRemove={() => {
                    setItems(items.filter(i => i.meta_id !== item.meta_id))
                  }}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Share Modals */}
      {shareListId && (
        <ShareListModal
          isOpen={shareModalOpen}
          onClose={() => { setShareModalOpen(false); setShareListId(null) }}
          listId={shareListId}
          listName={myLists.find(l => l.id === shareListId)?.name || 'List'}
          currentProfileId={parseInt(profileId!)}
        />
      )}
    </Layout>
  )
}

// Sidebar Section Component
interface SidebarSectionProps {
  title: string
  icon: React.ReactNode
  count: number
  badge?: number
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

function SidebarSection({ title, icon, count, badge, isOpen, onToggle, children }: SidebarSectionProps) {
  return (
    <div style={{ marginBottom: '20px' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 10px',
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.6)',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          borderRadius: '6px',
          transition: 'all 0.2s'
        }}
      >
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {icon}
        <span style={{ flex: 1, textAlign: 'left' }}>{title}</span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.75rem' }}>{count}</span>
        {badge && (
          <span style={{
            background: '#e50914',
            color: '#fff',
            padding: '2px 6px',
            borderRadius: '10px',
            fontSize: '0.7rem',
            fontWeight: '700'
          }}>{badge}</span>
        )}
      </button>
      {isOpen && (
        <div style={{ paddingLeft: '8px', marginTop: '6px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// List Sidebar Item Component
interface ListSidebarItemProps {
  list: List | SharedList | ProfileSharedList
  isActive: boolean
  sharingType: SharingType
  sharedBy?: string
  onClick: () => void
  onShare?: () => void
  onProfileShare?: () => void
  onDelete?: (e: React.MouseEvent) => void
  onLeave?: () => void
  showActions?: boolean
}

function ListSidebarItem({ 
  list, isActive, sharingType, sharedBy, onClick, 
  onShare, onDelete, onLeave, showActions 
}: ListSidebarItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  const hasActions = showActions && (onShare || (onDelete && !list.is_default))
  const hasLeave = !!onLeave

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        marginBottom: '4px',
        borderRadius: '8px',
        cursor: 'pointer',
        background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
        border: isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
        transition: 'all 0.15s',
        position: 'relative'
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ 
          fontSize: '0.9rem', 
          fontWeight: isActive ? '600' : '500', 
          color: isActive ? '#fff' : 'rgba(255,255,255,0.8)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {list.name}
        </div>
        {sharedBy && (
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
            by {sharedBy}
          </div>
        )}
      </div>
      
      {/* 3-dot menu button - show when active or has actions */}
      {(hasActions || hasLeave) && isActive && (
        <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              padding: '6px',
              background: menuOpen ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s'
            }}
          >
            <MoreVertical size={14} />
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {menuOpen && (
              <>
                {/* Backdrop to close menu */}
                <div 
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 999
                  }}
                  onClick={() => setMenuOpen(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: '4px',
                    background: 'rgba(25, 25, 25, 0.98)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '10px',
                    padding: '6px',
                    minWidth: '160px',
                    zIndex: 1000,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                  }}
                >
                  {onShare && (
                    <button
                      onClick={() => { onShare(); setMenuOpen(false) }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#fff',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        textAlign: 'left',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Share2 size={15} style={{ opacity: 0.7 }} />
                      Share List
                    </button>
                  )}
                  
                  {onDelete && !list.is_default && (
                    <>
                      {onShare && (
                        <div style={{ 
                          height: '1px', 
                          background: 'rgba(255,255,255,0.08)', 
                          margin: '4px 8px' 
                        }} />
                      )}
                      <button
                        onClick={(e) => { onDelete(e); setMenuOpen(false) }}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 12px',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#f87171',
                          fontSize: '0.85rem',
                          fontWeight: '500',
                          textAlign: 'left',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Trash2 size={15} />
                        Delete List
                      </button>
                    </>
                  )}

                  {hasLeave && (
                    <button
                      onClick={() => { onLeave!(); setMenuOpen(false) }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '10px 12px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#f87171',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        textAlign: 'left',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <LogOut size={15} />
                      Leave List
                    </button>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}