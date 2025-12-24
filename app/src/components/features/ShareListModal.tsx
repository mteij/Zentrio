import { useState, useEffect } from 'react'
import { X, Mail, Share2, Trash2, Users, Eye, Plus, Edit3, User, Globe } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { apiFetch } from '../../lib/apiFetch'
import { toast } from 'sonner'
import { Profile } from '../../services/database'

interface ShareListModalProps {
  isOpen: boolean
  onClose: () => void
  listId: number
  listName: string
  currentProfileId: number
}

interface Share {
  id: number
  shared_to_email: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  permission: 'read' | 'add' | 'full'
  created_at: string
}

interface ProfileShare {
  id: number
  shared_to_profile_id: number
  permission: 'read' | 'add' | 'full'
  profile?: Profile
}

export function ShareListModal({ isOpen, onClose, listId, listName, currentProfileId }: ShareListModalProps) {
  const [activeTab, setActiveTab] = useState<'profiles' | 'email'>('profiles')
  
  // Data state
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [profileShares, setProfileShares] = useState<ProfileShare[]>([])
  const [emailShares, setEmailShares] = useState<Share[]>([])
  const [loading, setLoading] = useState(true)
  
  // Form state
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null)
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<'read' | 'add' | 'full'>('read')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadData()
      // Reset form
      setEmail('')
      setSelectedProfileId(null)
      setPermission('read')
    }
  }, [isOpen, listId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load all profiles for this account
      const profilesRes = await apiFetch('/api/profiles')
      if (profilesRes.ok) {
        const data = await profilesRes.json()
        // API returns array directly, not wrapped in { profiles: [] }
        const profilesArray = Array.isArray(data) ? data : (data.profiles || [])
        setProfiles(profilesArray.filter((p: Profile) => p.id !== currentProfileId))
      }

      // Load profile shares
      const profileSharesRes = await apiFetch(`/api/lists/${listId}/profile-shares`)
      if (profileSharesRes.ok) {
        const data = await profileSharesRes.json()
        setProfileShares(data.shares || [])
      }

      // Load email shares
      const emailSharesRes = await apiFetch(`/api/lists/${listId}/shares`)
      if (emailSharesRes.ok) {
        const data = await emailSharesRes.json()
        setEmailShares(data.shares || [])
      }
    } catch (e) {
      console.error('Failed to load sharing data:', e)
    } finally {
      setLoading(false)
    }
  }

  // --- Profile Sharing ---

  const handleProfileShare = async () => {
    if (!selectedProfileId) return

    setSending(true)
    try {
      const res = await apiFetch(`/api/lists/${listId}/share-with-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          targetProfileId: selectedProfileId, 
          permission 
        })
      })

      const data = await res.json()
      
      if (res.ok) {
        const sharedProfile = profiles.find(p => p.id === selectedProfileId)
        toast.success(`Shared with ${sharedProfile?.name || 'profile'}`)
        setSelectedProfileId(null)
        loadData()
      } else {
        toast.error(data.error || 'Failed to share list')
      }
    } catch (e) {
      console.error('Share failed:', e)
      toast.error('Failed to share list')
    } finally {
      setSending(false)
    }
  }

  const handleRevokeProfileShare = async (shareId: number) => {
    try {
      const res = await apiFetch(`/api/lists/${listId}/profile-shares/${shareId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success('Share removed')
        setProfileShares(profileShares.filter(s => s.id !== shareId))
      } else {
        toast.error('Failed to remove share')
      }
    } catch (e) {
      console.error('Revoke failed:', e)
      toast.error('Failed to remove share')
    }
  }

  // --- Email Sharing ---

  const handleEmailShare = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    
    setSending(true)
    try {
      const res = await apiFetch(`/api/lists/${listId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), permission })
      })

      const data = await res.json()
      
      if (res.ok) {
        toast.success(data.emailSent 
          ? `Invitation sent to ${email}` 
          : `Invitation created (email delivery failed)`
        )
        setEmail('')
        loadData()
      } else {
        toast.error(data.error || 'Failed to share list')
      }
    } catch (e) {
      console.error('Share failed:', e)
      toast.error('Failed to share list')
    } finally {
      setSending(false)
    }
  }

  const handleRevokeEmailShare = async (shareId: number) => {
    try {
      const res = await apiFetch(`/api/lists/${listId}/shares/${shareId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        toast.success('Share revoked')
        setEmailShares(emailShares.filter(s => s.id !== shareId))
      } else {
        toast.error('Failed to revoke share')
      }
    } catch (e) {
      console.error('Revoke failed:', e)
      toast.error('Failed to revoke share')
    }
  }

  // --- Helpers ---

  const getPermissionLabel = (perm: string) => {
    switch (perm) {
      case 'read': return 'View only'
      case 'add': return 'Can add'
      case 'full': return 'Full access'
      default: return perm
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b'
      case 'accepted': return '#22c55e'
      case 'declined': return '#ef4444'
      case 'expired': return '#6b7280'
      default: return '#6b7280'
    }
  }

  // Available profiles for sharing
  const availableProfiles = profiles.filter(
    p => !profileShares.some(s => s.shared_to_profile_id === p.id)
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Share "${listName}"`}>
      <div style={{ minWidth: '450px', maxWidth: '500px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0' }}>
          <button
            onClick={() => setActiveTab('profiles')}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'profiles' ? '2px solid #e50914' : '2px solid transparent',
              color: activeTab === 'profiles' ? '#fff' : '#888',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <User size={18} />
            <span>Profiles</span>
          </button>
          <button
            onClick={() => setActiveTab('email')}
            style={{
              flex: 1,
              padding: '12px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'email' ? '2px solid #e50914' : '2px solid transparent',
              color: activeTab === 'email' ? '#fff' : '#888',
              cursor: 'pointer',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <Globe size={18} />
            <span>External (Email)</span>
          </button>
        </div>

        {loading ? (
          <div style={{ color: '#666', textAlign: 'center', padding: '40px' }}>Loading...</div>
        ) : (
          <div style={{ minHeight: '300px' }}>
            {activeTab === 'profiles' ? (
              // --- Profiles Tab Content ---
              <div>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '16px' }}>
                  Share this list with other profiles in your account.
                </p>

                {availableProfiles.length > 0 ? (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', 
                      gap: '12px',
                      marginBottom: '16px'
                    }}>
                      {availableProfiles.map(profile => (
                        <button
                          key={profile.id}
                          type="button"
                          onClick={() => setSelectedProfileId(profile.id)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px',
                            background: selectedProfileId === profile.id 
                              ? 'rgba(229, 9, 20, 0.2)' 
                              : 'rgba(255,255,255,0.05)',
                            border: selectedProfileId === profile.id 
                              ? '2px solid #e50914' 
                              : '2px solid transparent',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                          }}
                        >
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1rem',
                            fontWeight: '700',
                            color: '#fff',
                            overflow: 'hidden'
                          }}>
                            {profile.avatar?.startsWith('http') ? (
                              <img src={profile.avatar} alt={profile.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              profile.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span style={{ 
                            color: selectedProfileId === profile.id ? '#fff' : '#999',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            textAlign: 'center',
                            width: '100%',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {profile.name}
                          </span>
                        </button>
                      ))}
                    </div>

                    <PermissionSelector permission={permission} setPermission={setPermission} getPermissionLabel={getPermissionLabel} />

                    <Button
                      onClick={handleProfileShare}
                      variant="primary"
                      disabled={!selectedProfileId || sending}
                      style={{ width: '100%', marginTop: '16px' }}
                    >
                      Share with Profile
                    </Button>
                  </div>
                ) : (
                   <div style={{ 
                    color: '#666', 
                    textAlign: 'center', 
                    padding: '20px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '8px',
                    marginBottom: '24px'
                  }}>
                    {profiles.length === 0 
                      ? 'No other profiles in this account'
                      : 'All profiles already have access'}
                  </div>
                )}

                {/* Profile Shares List */}
                {profileShares.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#888', fontSize: '0.85rem' }}>
                      <Users size={14} />
                      <span>Shared with ({profileShares.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {profileShares.map(share => {
                        const profile = profiles.find(p => p.id === share.shared_to_profile_id) || share.profile
                        return (
                          <div key={share.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                                {profile?.avatar?.startsWith('http') ? (
                                  <img src={profile.avatar} alt={profile?.name} className="w-full h-full object-cover" />
                                ) : (
                                  profile?.name?.charAt(0).toUpperCase()
                                )}
                              </div>
                              <div>
                                <div className="text-sm text-white font-medium">{profile?.name}</div>
                                <div className="text-xs text-gray-400">{getPermissionLabel(share.permission)}</div>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRevokeProfileShare(share.id)}
                              className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // --- Email Tab Content ---
              <div>
                <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '16px' }}>
                  Invite people outside your account via email.
                </p>

                <form onSubmit={handleEmailShare} style={{ marginBottom: '24px' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="friend@example.com"
                    />
                  </div>

                  <PermissionSelector permission={permission} setPermission={setPermission} getPermissionLabel={getPermissionLabel} />

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!email.trim() || sending}
                    style={{ width: '100%', marginTop: '16px' }}
                  >
                    <Mail size={16} style={{ marginRight: '8px' }} />
                     Send Invitation
                  </Button>
                </form>

                {/* Email Shares List */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#888', fontSize: '0.85rem' }}>
                    <Users size={14} />
                    <span>Invites ({emailShares.length})</span>
                  </div>
                  
                  {emailShares.length === 0 ? (
                    <div style={{ color: '#666', textAlign: 'center', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                      No active invitations
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {emailShares.map(share => (
                        <div key={share.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                          <div>
                            <div className="text-sm text-white">{share.shared_to_email}</div>
                            <div className="flex items-center gap-2 text-xs mt-1">
                              <span style={{ color: getStatusColor(share.status), textTransform: 'capitalize' }}>
                                {share.status}
                              </span>
                              <span className="text-gray-600">•</span>
                              <span className="text-gray-400">{getPermissionLabel(share.permission)}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRevokeEmailShare(share.id)}
                            className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

function PermissionSelector({ permission, setPermission, getPermissionLabel }: any) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: '8px', color: '#999', fontSize: '0.8rem' }}>
        Permission
      </label>
      <div style={{ display: 'flex', gap: '8px' }}>
        {(['read', 'add', 'full'] as const).map((perm) => (
          <button
            key={perm}
            type="button"
            onClick={() => setPermission(perm)}
            style={{
              flex: 1,
              padding: '8px',
              background: permission === perm ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.05)',
              border: permission === perm ? '1px solid #e50914' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: permission === perm ? '#e50914' : '#999',
              cursor: 'pointer',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.2s'
            }}
          >
            {perm === 'read' && <Eye size={12} />}
            {perm === 'add' && <Plus size={12} />}
            {perm === 'full' && <Edit3 size={12} />}
            {getPermissionLabel(perm)}
          </button>
        ))}
      </div>
    </div>
  )
}
