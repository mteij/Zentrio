import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Share2, Users, LogOut, Library as LibraryIcon, Trash2, Mail, Check, X as XIcon, UserPlus, ChevronDown, ChevronRight, Lock, Globe, User, MoreVertical } from 'lucide-react'
import { Layout, RatingBadge, LazyImage, SkeletonCard } from '../../components'
import { List, ListItem, ListShare, Profile } from '../../services/database'
import styles from '../../styles/Streaming.module.css'
import { apiFetch } from '../../lib/apiFetch'
import { ShareListModal } from '../../components/features/ShareListModal'
import { useLibraryData } from '../../hooks/useLibraryData'

import { LibraryItemCard } from '../../components/library/LibraryItemCard'
import { 
  SidebarSection, 
  ListSidebarItem, 
  type SharedList, 
  type PendingInvite, 
  type AvailableSharedList, 
  type ProfileShare, 
  type ProfileSharedList, 
  type SharingType 
} from '../../components/library/LibrarySidebar'
import { toast } from 'sonner'

export const StreamingLibrary = () => {
  const { profileId, listId } = useParams<{ profileId: string, listId?: string }>()
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
      loading,
      error
    },
    setters: {
      setMyLists,
      setAccountSharedLists,
      setProfileSharedLists,
      setPendingInvites,
      setItems,
      setActiveList
    },
    actions: {
      refreshLibrary,
      createList,
      deleteList,
      selectList
    }
  } = useLibraryData(profileId, listId)
  
  // UI Only state
  const [showNewListInput, setShowNewListInput] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  const [shareModalOpen, setShareModalOpen] = useState(false)
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

  const handleCreateListWrapper = async () => {
    if (!newListName.trim()) return
    setCreatingList(true)
    const success = await createList(newListName.trim())
    setCreatingList(false)
    if (success) {
      setNewListName('')
      setShowNewListInput(false)
    }
  }

  const handleDeleteListWrapper = async (list: List, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm(`Delete "${list.name}"? This cannot be undone.`)) return
    await deleteList(list.id)
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
        refreshLibrary()
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
        refreshLibrary()
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

  // Memoize the available lists for moving items to reduce calculation in children
  const moveTargetLists = useMemo(() => {
    if (!activeList) return []
    return [
      ...myLists.filter(l => l.id !== activeList.id),
      ...accountSharedLists.filter(l => 
        l.id !== activeList.id && 
        (l.share.permission === 'add' || l.share.permission === 'full')
      )
    ]
  }, [activeList, myLists, accountSharedLists])

  const handleRemoveItem = useCallback((metaId: string) => {
    setItems(current => current.filter(i => i.meta_id !== metaId))
  }, [])


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
          top: 'calc(var(--titlebar-height, 0px) + 20px + env(safe-area-inset-top))'
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
                onKeyDown={(e) => e.key === 'Enter' && handleCreateListWrapper()}
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
                  onClick={handleCreateListWrapper}
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
                onClick={() => selectList(list)}
                onShare={() => handleOpenShareModal(list.id)}
                onDelete={(e) => handleDeleteListWrapper(list, e)}
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
                      onClick={() => selectList(list)}
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
                      onClick={() => selectList(list)}
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
                          onKeyDown={(e) => { if (e.key === 'Enter') { handleCreateListWrapper(); setMobileListOpen(false) } }}
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
                            onClick={() => { handleCreateListWrapper(); setMobileListOpen(false) }}
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
                            onClick={() => { selectList(list); setMobileListOpen(false) }}
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
                                onClick={(e) => { handleDeleteListWrapper(list, e); setMobileListOpen(false) }}
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
                              onClick={() => { selectList(list); setMobileListOpen(false) }}
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
                              onClick={() => { selectList(list); setMobileListOpen(false) }}
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
                  moveTargetLists={moveTargetLists}
                  isOwner={isOwner}
                  canRemove={canRemove}
                  canAdd={canAdd}
                  showImdbRatings={showImdbRatings}
                  onRemove={handleRemoveItem}
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

