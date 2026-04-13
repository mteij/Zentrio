import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  ChevronDown,
  Globe,
  Library as LibraryIcon,
  Lock,
  LogOut,
  Mail,
  Plus,
  Share2,
  Trash2,
  UserPlus,
  Users,
  X as XIcon,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout, LoadErrorState, SkeletonCard } from '../../components'
import { ShareListModal } from '../../components/features/ShareListModal'
import { LibraryItemCard } from '../../components/library/LibraryItemCard'
import {
  ListSidebarItem,
  SidebarSection,
  type ProfileSharedList,
  type SharedList,
} from '../../components/library/LibrarySidebar'
import { useStreamingProfile } from '../../hooks/useStreamingProfile'
import type { List } from '../../services/database'
import styles from '../../styles/Streaming.module.css'
import type { LibraryScreenModel } from './Library.model'

function permLabel(perm: string | undefined) {
  if (perm === 'read') return 'View only'
  if (perm === 'add') return 'Can add items'
  return 'Full access'
}

// ── Mobile sticky bar ────────────────────────────────────────────────────────

interface MobileBarProps {
  model: LibraryScreenModel
  onShare: (id: number) => void
  showNewListInput: boolean
  setShowNewListInput: (v: boolean) => void
  newListName: string
  setNewListName: (v: string) => void
  creatingList: boolean
  onCreateList: () => Promise<void>
}

function LibraryMobileBar({
  model,
  onShare,
  showNewListInput,
  setShowNewListInput,
  newListName,
  setNewListName,
  creatingList,
  onCreateList,
}: MobileBarProps) {
  const [open, setOpen] = useState(false)
  const { profile, profileAvatarNode } = useStreamingProfile(model.profileId)

  return (
    <div className={styles.libraryMobileBar}>
      {/* List selector */}
      <button
        type="button"
        className={styles.streamingMobileSearch}
        onClick={() => setOpen((o) => !o)}
        aria-label="Select list"
        aria-expanded={open}
      >
        <LibraryIcon size={18} aria-hidden="true" />
        <span>{model.activeList?.name ?? 'Library'}</span>
        <ChevronDown
          size={16}
          style={{
            marginLeft: 'auto',
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        />
      </button>

      {/* Profile button */}
      <Link
        to="/profiles"
        className={styles.streamingMobileProfileButton}
        aria-label={profile?.name ? `Switch profile. Current: ${profile.name}` : 'Switch profile'}
        title="Switch Profile"
      >
        <div className={styles.streamingMobileProfileAvatar}>
          {profileAvatarNode}
        </div>
      </Link>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className={styles.libraryMobileDropdown}
            >
              {/* Create new list */}
              {showNewListInput ? (
                <div style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void onCreateList()
                        setOpen(false)
                      }
                    }}
                    placeholder="List name..."
                    autoFocus
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      outline: 'none',
                      fontSize: '0.9rem',
                      marginBottom: '8px',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        void onCreateList()
                        setOpen(false)
                      }}
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
                        opacity: creatingList || !newListName.trim() ? 0.5 : 1,
                      }}
                    >
                      {creatingList ? '…' : 'Create'}
                    </button>
                    <button
                      onClick={() => {
                        setShowNewListInput(false)
                        setNewListName('')
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: '#888',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        cursor: 'pointer',
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
                    padding: '10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: '500',
                    marginBottom: '12px',
                  }}
                >
                  <Plus size={16} />
                  New List
                </button>
              )}

              {/* Pending invites */}
              {model.pendingInvites.length > 0 && (
                <div
                  style={{
                    marginBottom: '12px',
                    padding: '10px',
                    background: 'rgba(251,191,36,0.1)',
                    borderRadius: '10px',
                    border: '1px solid rgba(251,191,36,0.2)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#fbbf24',
                      marginBottom: '8px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Mail size={12} />
                    Pending Invites ({model.pendingInvites.length})
                  </div>
                  {model.pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      style={{ padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <div style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '4px' }}>
                        {invite.listName}
                      </div>
                      <div
                        style={{
                          fontSize: '0.7rem',
                          color: 'rgba(255,255,255,0.5)',
                          marginBottom: '6px',
                        }}
                      >
                        from {invite.sharedByName ?? 'Someone'}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => {
                            void model.actions.acceptInvite(invite)
                            setOpen(false)
                          }}
                          style={{
                            flex: 1,
                            padding: '6px',
                            background: '#22c55e',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <Check size={12} />
                          Accept
                        </button>
                        <button
                          onClick={() => void model.actions.declineInvite(invite)}
                          style={{
                            flex: 1,
                            padding: '6px',
                            background: 'rgba(239,68,68,0.2)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '4px',
                            color: '#f87171',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <XIcon size={12} />
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* My Lists */}
              <div style={{ marginBottom: '8px' }}>
                <div
                  style={{
                    fontSize: '0.75rem',
                    color: '#888',
                    marginBottom: '6px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Lock size={12} />
                  My Lists
                </div>
                {model.myLists.map((list) => (
                  <div
                    key={list.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      marginBottom: '2px',
                      borderRadius: '8px',
                      background:
                        model.activeList?.id === list.id
                          ? 'rgba(255,255,255,0.1)'
                          : 'transparent',
                    }}
                  >
                    <button
                      onClick={() => {
                        model.actions.selectList(list)
                        setOpen(false)
                      }}
                      style={{
                        flex: 1,
                        textAlign: 'left',
                        padding: '2px 0',
                        background: 'transparent',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: model.activeList?.id === list.id ? '600' : '400',
                      }}
                    >
                      {list.name}
                    </button>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onShare(list.id)
                          setOpen(false)
                        }}
                        style={{
                          padding: '6px',
                          background: 'rgba(255,255,255,0.08)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: 'rgba(255,255,255,0.6)',
                        }}
                        title="Share"
                      >
                        <Share2 size={14} />
                      </button>
                      {!list.is_default && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${list.name}"? This cannot be undone.`)) {
                              void model.actions.deleteList(list.id)
                              setOpen(false)
                            }
                          }}
                          style={{
                            padding: '6px',
                            background: 'rgba(239,68,68,0.15)',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            color: '#f87171',
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

              {/* Profile Shared */}
              {model.profileSharedLists.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#a855f7',
                      marginBottom: '6px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <User size={12} />
                    From Profiles
                  </div>
                  {model.profileSharedLists.map((list) => (
                    <div
                      key={list.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        marginBottom: '2px',
                        borderRadius: '8px',
                        background:
                          model.activeList?.id === list.id
                            ? 'rgba(168,85,247,0.15)'
                            : 'transparent',
                      }}
                    >
                      <button
                        onClick={() => {
                          model.actions.selectList(list)
                          setOpen(false)
                        }}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          padding: '2px 0',
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                        }}
                      >
                        {list.name}
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: 'rgba(255,255,255,0.5)',
                            marginLeft: '6px',
                          }}
                        >
                          by {list.ownerName}
                        </span>
                      </button>
                      <button
                        onClick={() =>
                          void model.actions.leaveProfileSharedList(list.profileShare.id)
                        }
                        style={{
                          padding: '6px',
                          background: 'rgba(239,68,68,0.15)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#f87171',
                        }}
                        title="Leave"
                      >
                        <LogOut size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Account Shared */}
              {model.accountSharedLists.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#60a5fa',
                      marginBottom: '6px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Globe size={12} />
                    From Accounts
                  </div>
                  {model.accountSharedLists.map((list) => (
                    <div
                      key={list.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        marginBottom: '2px',
                        borderRadius: '8px',
                        background:
                          model.activeList?.id === list.id
                            ? 'rgba(96,165,250,0.15)'
                            : 'transparent',
                      }}
                    >
                      <button
                        onClick={() => {
                          model.actions.selectList(list)
                          setOpen(false)
                        }}
                        style={{
                          flex: 1,
                          textAlign: 'left',
                          padding: '2px 0',
                          background: 'transparent',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                        }}
                      >
                        {list.name}
                        <span
                          style={{
                            fontSize: '0.7rem',
                            color: 'rgba(255,255,255,0.5)',
                            marginLeft: '6px',
                          }}
                        >
                          by {list.sharedByName}
                        </span>
                      </button>
                      <button
                        onClick={() => void model.actions.leaveSharedList(list.share.id)}
                        style={{
                          padding: '6px',
                          background: 'rgba(239,68,68,0.15)',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          color: '#f87171',
                        }}
                        title="Leave"
                      >
                        <LogOut size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Available to add */}
              {model.availableFromOtherProfiles.length > 0 && (
                <div
                  style={{
                    marginTop: '8px',
                    padding: '10px',
                    background: 'rgba(96,165,250,0.1)',
                    borderRadius: '10px',
                    border: '1px solid rgba(96,165,250,0.2)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#60a5fa',
                      marginBottom: '8px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <UserPlus size={12} />
                    Available to Add
                  </div>
                  {model.availableFromOtherProfiles.map((list) => (
                    <div
                      key={list.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#fff' }}>{list.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                          {list.linkedProfiles.length} profile(s)
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          void model.actions.linkShareToProfile(list)
                          setOpen(false)
                        }}
                        style={{
                          padding: '6px 10px',
                          background: '#3b82f6',
                          border: 'none',
                          borderRadius: '6px',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                        }}
                      >
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
  )
}

// ── Main view ────────────────────────────────────────────────────────────────

export function StreamingLibraryStandardView({ model }: { model: LibraryScreenModel }) {
  const [shareModalOpen, setShareModalOpen] = useState(false)
  const [shareListId, setShareListId] = useState<number | null>(null)
  const [sectionsOpen, setSectionsOpen] = useState({ private: true, shared: true })
  const [showNewListInput, setShowNewListInput] = useState(false)
  const [newListName, setNewListName] = useState('')
  const [creatingList, setCreatingList] = useState(false)

  const openShare = (id: number) => {
    setShareListId(id)
    setShareModalOpen(true)
  }

  const handleCreateList = useCallback(async () => {
    if (!newListName.trim()) return
    setCreatingList(true)
    const success = await model.actions.createList(newListName.trim())
    setCreatingList(false)
    if (success) {
      setNewListName('')
      setShowNewListInput(false)
    }
  }, [model.actions, newListName])

  const handleDeleteList = useCallback(
    async (list: List, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!confirm(`Delete "${list.name}"? This cannot be undone.`)) return
      await model.actions.deleteList(list.id)
    },
    [model.actions],
  )

  const handleRemoveItem = useCallback(
    (metaId: string) => {
      model.setters.setItems((items) => items.filter((i) => i.meta_id !== metaId))
    },
    [model.setters],
  )

  if (model.status === 'error') {
    return (
      <LoadErrorState
        message={model.errorMessage ?? 'Failed to load library'}
        onRetry={model.actions.retry}
        onBack={model.navigation.goBack}
      />
    )
  }

  const isAccountShared =
    model.activeList && !model.isOwner && 'share' in model.activeList
  const isProfileShared =
    model.activeList && !model.isOwner && 'profileShare' in model.activeList
  const sharedPerm = isAccountShared
    ? (model.activeList as SharedList).share.permission
    : isProfileShared
      ? (model.activeList as ProfileSharedList).profileShare?.permission
      : undefined

  return (
    <Layout title="Library" showHeader={false} showFooter={false}>
      {/* Ambient background */}
      <AnimatePresence mode="sync">
        {model.backgroundPoster && (
          <motion.div
            key={`ambient-${model.activeList?.id}`}
            className={styles.pageAmbientBackground}
            style={{ backgroundImage: `url(${model.backgroundPoster})` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      {/* Mobile sticky bar — shown only on mobile via CSS, replaces StreamingLayout's search header */}
      <LibraryMobileBar
        model={model}
        onShare={openShare}
        showNewListInput={showNewListInput}
        setShowNewListInput={setShowNewListInput}
        newListName={newListName}
        setNewListName={setNewListName}
        creatingList={creatingList}
        onCreateList={handleCreateList}
      />

      {/* Desktop layout */}
      <div
        className={`${styles.streamingLayout} ${styles.streamingLayoutNoHero} ${styles.libraryLayout}`}
      >
        {/* Sidebar — hidden on mobile via CSS */}
        <aside
          className={styles.librarySidebar}
          style={{
            width: '280px',
            flexShrink: 0,
            padding: '20px',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            height: 'calc(100vh - var(--app-content-top-offset, 0px) - 20px)',
            overflowY: 'auto',
            position: 'sticky',
            top: 'calc(var(--app-content-top-offset, 0px) + 20px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <LibraryIcon size={24} style={{ color: '#fff' }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fff', margin: 0 }}>
              Library
            </h1>
          </div>

          {/* Create list */}
          {showNewListInput ? (
            <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleCreateList()}
                placeholder="List name…"
                autoFocus
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  outline: 'none',
                  fontSize: '0.9rem',
                }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => void handleCreateList()}
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
                    opacity: creatingList || !newListName.trim() ? 0.5 : 1,
                  }}
                >
                  {creatingList ? '…' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowNewListInput(false)
                    setNewListName('')
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    color: '#888',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
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
                transition: 'all 0.2s',
              }}
            >
              <Plus size={18} />
              New List
            </button>
          )}

          {model.listsLoading && (
            <div style={{ marginBottom: '18px', color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem' }}>
              Loading lists…
            </div>
          )}

          {/* My Lists */}
          <SidebarSection
            title="My Lists"
            icon={<Lock size={16} />}
            count={model.myLists.length}
            isOpen={sectionsOpen.private}
            onToggle={() => setSectionsOpen((p) => ({ ...p, private: !p.private }))}
          >
            {model.myLists.map((list) => (
              <ListSidebarItem
                key={list.id}
                list={list}
                isActive={model.activeList?.id === list.id}
                sharingType="private"
                onClick={() => model.actions.selectList(list)}
                onShare={() => openShare(list.id)}
                onDelete={(e) => void handleDeleteList(list, e)}
                showActions
              />
            ))}
          </SidebarSection>

          {/* Shared Lists */}
          {(model.accountSharedLists.length > 0 ||
            model.profileSharedLists.length > 0 ||
            model.pendingInvites.length > 0 ||
            model.availableFromOtherProfiles.length > 0) && (
            <SidebarSection
              title="Shared Lists"
              icon={<Users size={16} />}
              count={model.accountSharedLists.length + model.profileSharedLists.length}
              badge={model.pendingInvites.length > 0 ? model.pendingInvites.length : undefined}
              isOpen={sectionsOpen.shared}
              onToggle={() => setSectionsOpen((p) => ({ ...p, shared: !p.shared }))}
            >
              {/* Pending invites */}
              {model.pendingInvites.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#fbbf24',
                      marginBottom: '8px',
                      fontWeight: '600',
                    }}
                  >
                    <Mail size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    Pending ({model.pendingInvites.length})
                  </div>
                  {model.pendingInvites.map((invite) => (
                    <div
                      key={invite.id}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(251,191,36,0.1)',
                        border: '1px solid rgba(251,191,36,0.2)',
                        borderRadius: '8px',
                        marginBottom: '8px',
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', color: '#fff', marginBottom: '6px' }}>
                        {invite.listName}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'rgba(255,255,255,0.5)',
                          marginBottom: '8px',
                        }}
                      >
                        from {invite.sharedByName ?? 'Someone'}
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => void model.actions.acceptInvite(invite)}
                          style={{
                            flex: 1,
                            padding: '6px',
                            background: '#22c55e',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <Check size={12} />
                          Accept
                        </button>
                        <button
                          onClick={() => void model.actions.declineInvite(invite)}
                          style={{
                            flex: 1,
                            padding: '6px',
                            background: 'rgba(239,68,68,0.2)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: '4px',
                            color: '#f87171',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                          }}
                        >
                          <XIcon size={12} />
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Profile Shared */}
              {model.profileSharedLists.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#a855f7',
                      marginBottom: '8px',
                      fontWeight: '600',
                    }}
                  >
                    <User size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    From Profiles
                  </div>
                  {model.profileSharedLists.map((list) => (
                    <ListSidebarItem
                      key={list.id}
                      list={list}
                      isActive={model.activeList?.id === list.id}
                      sharingType="profile-shared"
                      sharedBy={list.ownerName}
                      onClick={() => model.actions.selectList(list)}
                      onLeave={() => void model.actions.leaveProfileSharedList(list.profileShare.id)}
                    />
                  ))}
                </div>
              )}

              {/* Account Shared */}
              {model.accountSharedLists.length > 0 && (
                <div style={{ marginBottom: '12px' }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#60a5fa',
                      marginBottom: '8px',
                      fontWeight: '600',
                    }}
                  >
                    <Globe size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    From Accounts
                  </div>
                  {model.accountSharedLists.map((list) => (
                    <ListSidebarItem
                      key={list.id}
                      list={list}
                      isActive={model.activeList?.id === list.id}
                      sharingType="account-shared"
                      sharedBy={list.sharedByName}
                      onClick={() => model.actions.selectList(list)}
                      onLeave={() => void model.actions.leaveSharedList(list.share.id)}
                    />
                  ))}
                </div>
              )}

              {/* Available to Add */}
              {model.availableFromOtherProfiles.length > 0 && (
                <div style={{ marginTop: '12px' }}>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#60a5fa',
                      marginBottom: '8px',
                      fontWeight: '600',
                    }}
                  >
                    <UserPlus size={12} style={{ display: 'inline', marginRight: '4px' }} />
                    Available to Add
                  </div>
                  {model.availableFromOtherProfiles.map((list) => (
                    <div
                      key={list.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: 'rgba(96,165,250,0.1)',
                        border: '1px solid rgba(96,165,250,0.2)',
                        borderRadius: '8px',
                        marginBottom: '6px',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', color: '#fff' }}>{list.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>
                          {list.linkedProfiles.length} profile(s)
                        </div>
                      </div>
                      <button
                        onClick={() => void model.actions.linkShareToProfile(list)}
                        style={{
                          padding: '4px 8px',
                          background: '#3b82f6',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                        }}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </SidebarSection>
          )}
        </aside>

        {/* Main content */}
        <main className={styles.libraryMain} style={{ flex: 1 }}>
          {/* List header — desktop only (mobile shows name in sticky bar) */}
          {model.activeList && (
            <div style={{ marginBottom: '24px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <h2
                  style={{ fontSize: '2rem', fontWeight: '700', color: '#fff', margin: 0 }}

                >
                  {model.activeList.name}
                </h2>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {model.isOwner && (
                    <button onClick={() => openShare(model.activeList!.id)} className={styles.actionBtn}>
                      <Share2 size={16} />
                      Share
                    </button>
                  )}
                  {isAccountShared && (
                    <button
                      onClick={() =>
                        void model.actions.leaveSharedList(
                          (model.activeList as SharedList).share.id,
                        )
                      }
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                    >
                      <LogOut size={16} />
                      Leave
                    </button>
                  )}
                  {isProfileShared && (
                    <button
                      onClick={() =>
                        void model.actions.leaveProfileSharedList(
                          (model.activeList as ProfileSharedList).profileShare.id,
                        )
                      }
                      className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                    >
                      <LogOut size={16} />
                      Leave
                    </button>
                  )}
                </div>
              </div>

              {/* Sharing info bar */}
              {!model.isOwner && (isAccountShared || isProfileShared) && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 14px',
                    background: isAccountShared
                      ? 'rgba(96,165,250,0.1)'
                      : 'rgba(147,51,234,0.1)',
                    border: `1px solid ${isAccountShared ? 'rgba(96,165,250,0.2)' : 'rgba(147,51,234,0.2)'}`,
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                  }}
                >
                  {isAccountShared ? (
                    <>
                      <Globe size={16} style={{ color: '#60a5fa' }} />
                      <span style={{ color: '#93c5fd' }}>
                        Shared by{' '}
                        <strong>
                          {(model.activeList as SharedList).sharedByName ?? 'Someone'}
                        </strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <User size={16} style={{ color: '#a855f7' }} />
                      <span style={{ color: '#c4b5fd' }}>
                        Shared by{' '}
                        <strong>
                          {(model.activeList as ProfileSharedList).ownerName ??
                            'Another profile'}
                        </strong>
                      </span>
                    </>
                  )}
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>•</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{permLabel(sharedPerm)}</span>
                </div>
              )}
            </div>
          )}

          {/* Content area */}
          {model.activeList && model.itemsLoading ? (
            <div className={styles.mediaGrid} style={{ padding: 0 }}>
              {Array.from({ length: 12 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : !model.activeList && model.listsLoading ? (
            <div style={{ padding: '80px 20px', textAlign: 'center' }}>
              <LibraryIcon size={56} style={{ marginBottom: '20px', opacity: 0.4 }} />
              <p style={{ fontSize: '1.2rem', color: '#888' }}>Loading your library…</p>
            </div>
          ) : model.items.length === 0 ? (
            <div style={{ padding: '80px 20px', textAlign: 'center' }}>
              <LibraryIcon size={56} style={{ display: 'block', margin: '0 auto 20px', opacity: 0.4 }} />
              <p style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#888' }}>
                This list is empty
              </p>
              <p style={{ fontSize: '0.95rem', opacity: 0.7 }}>
                Add movies and shows from their detail pages
              </p>
            </div>
          ) : (
            <div className={styles.mediaGrid} style={{ padding: 0 }}>
              {model.items.map((item) => (
                <LibraryItemCard
                  key={item.meta_id}
                  item={item}
                  profileId={model.profileId}
                  currentListId={model.activeList?.id ?? 0}
                  moveTargetLists={model.moveTargetLists}
                  isOwner={model.isOwner}
                  canRemove={model.canRemove}
                  canAdd={model.canAdd}
                  showImdbRatings
                  onRemove={handleRemoveItem}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Share modal */}
      {shareListId !== null && (
        <ShareListModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false)
            setShareListId(null)
          }}
          listId={shareListId}
          listName={model.myLists.find((l) => l.id === shareListId)?.name ?? 'List'}
          currentProfileId={parseInt(model.profileId)}
        />
      )}
    </Layout>
  )
}

export default StreamingLibraryStandardView
