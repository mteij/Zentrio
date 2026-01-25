// Library Sidebar Components
// Extracted from Library.tsx for better maintainability
import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, ChevronRight, Share2, Trash2, LogOut, MoreVertical } from 'lucide-react'
import type { List, ListShare, Profile } from '../../services/database'

// Types for shared lists
export interface SharedList extends List {
  share: ListShare
  sharedByName?: string
  isLinkedToThisProfile?: boolean
}

export interface PendingInvite extends ListShare {
  listName: string
  sharedByName?: string
}

export interface AvailableSharedList extends List {
  share: ListShare
  sharedByName?: string
  linkedProfiles: number[]
}

export interface ProfileShare {
  id: number
  list_id: number
  owner_profile_id: number
  shared_to_profile_id: number
  permission: 'read' | 'add' | 'full'
  profile?: Profile
}

export interface ProfileSharedList extends List {
  profileShare: ProfileShare
  ownerName?: string
}

export type SharingType = 'private' | 'account-shared' | 'profile-shared'

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

export function SidebarSection({ title, icon, count, badge, isOpen, onToggle, children }: SidebarSectionProps) {
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

export function ListSidebarItem({ 
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
