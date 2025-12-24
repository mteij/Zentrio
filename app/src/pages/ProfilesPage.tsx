import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, LogOut, Edit, X, Plus } from 'lucide-react'
import { SimpleLayout, Button, ConfirmDialog, ProfileModal, LoadingSpinner, AnimatedBackground } from '../components'
import { useAuthStore } from '../stores/authStore'
import { apiFetch } from '../lib/apiFetch'
import styles from './ProfilesPage.module.css'

interface Profile {
  id: number
  name: string
  avatar: string
  avatar_style?: string
  isDefault?: boolean
  nsfw_filter_enabled?: boolean
  nsfw_age_rating?: number
  settings_profile_id?: number
}

interface ProfilesPageProps {
  user?: any
}

export function ProfilesPage({ user }: ProfilesPageProps) {
  const [profiles, setProfiles] = useState<Profile[]>(() => {
    // Initialize from cache if available
    try {
      const cached = localStorage.getItem('zentrioProfiles')
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(() => {
    // If we have cached profiles, we are not "loading" in the blocking sense
    return !localStorage.getItem('zentrioProfiles')
  })
  const [editMode, setEditMode] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadProfiles()
  }, [])

  const loadProfiles = async () => {
    try {
      const res = await apiFetch('/api/profiles')
      if (res.status === 401) {
        // Session expired or invalid, clear auth state and redirect to landing
        console.log('Session expired, redirecting to login...')
        localStorage.removeItem('zentrio-auth-storage')
        navigate('/')
        return
      }
      if (res.ok) {
        const data = await res.json()
        console.log("Profiles loaded:", data);
        setProfiles(data)
        localStorage.setItem('zentrioProfiles', JSON.stringify(data))
        if (data.length === 0) {
           console.log("No profiles found, retrying once in 1s to handle potential consistency delay...");
           setTimeout(async () => {
              try {
                  const res2 = await apiFetch('/api/profiles');
                  if (res2.ok) {
                      const data2 = await res2.json();
                      console.log("Retry profiles loaded:", data2);
                      setProfiles(data2);
                      localStorage.setItem('zentrioProfiles', JSON.stringify(data2));
                      if (data2.length === 0) {
                          console.log("Still no profiles, but allowing empty state as per user request.");
                      }
                  }
              } catch (e) {
                  // ignore
              }
           }, 1000);
        }
      }
    } catch (error) {
      console.error('Failed to load profiles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProfileClick = (profile: Profile) => {
    if (editMode) {
      handleEditProfile(profile)
    } else {
      localStorage.setItem('selectedProfile', JSON.stringify(profile))
      navigate(`/streaming/${profile.id}`)
    }
  }

  const handleCreateProfile = () => {
    setEditingProfile(null)
    setShowModal(true)
  }

  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile)
    setShowModal(true)
  }

  const handleLogout = async () => {
    try {
      await useAuthStore.getState().logout()
      navigate('/')
    } catch (e) {
      console.error('Logout failed', e)
    }
  }

  const handleModalClose = () => {
    setShowModal(false)
    setEditingProfile(null)
  }

  const handleProfileSaved = () => {
    loadProfiles()
    setShowModal(false)
    setEditingProfile(null)
  }

  return (
    <SimpleLayout title="Profiles">
      <AnimatedBackground />

      <header className="header" style={{ background: 'transparent', boxShadow: 'none' }}>
        <nav className="nav">
          {/* Header is now empty, buttons moved to footer */}
        </nav>
      </header>

      <main className={styles.profilesPage} style={{ position: 'relative', zIndex: 1 }}>
        <h1 className="sr-only">Profiles</h1>
        <div className={styles.profilesMain}>
          <section className={styles.profilesSection}>
            <h2 className={styles.sectionTitle} id="sectionTitle">
              {editMode ? 'Select profile to edit:' : "Who's watching?"}
            </h2>
            
            {loading ? (
              <div style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LoadingSpinner fullScreen={false} />
              </div>
            ) : (
              <div className={styles.profilesGrid} id="profilesGrid">
                {profiles.map(profile => (
                  <div key={profile.id} className={styles.profileCard} onClick={() => handleProfileClick(profile)}>
                    <div className={styles.profileAvatar}>
                      <div id={`avatar-${profile.id}`}>
                        <img 
                          src={profile.avatar.startsWith('http') || profile.avatar.startsWith('data:') ? profile.avatar : `/api/avatar/${encodeURIComponent(profile.avatar)}?style=${encodeURIComponent(profile.avatar_style || 'bottts-neutral')}`} 
                          alt={profile.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    </div>
                    <div className={styles.profileName}>{profile.name}</div>
                    {profile.isDefault && <div className={styles.profileStatus}>Default</div>}
                  </div>
                ))}
                
                {/* Add Profile Button (only in edit mode or if no profiles) */}
                {(editMode || profiles.length === 0) && (
                  <div className={styles.profileCard} onClick={handleCreateProfile}>
                    <div className={`${styles.profileAvatar} ${styles.addAvatar}`}>
                      <Plus className="w-10 h-10 text-[#666]" />
                    </div>
                    <div className={styles.profileName}>Add Profile</div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Footer with buttons */}
      <footer className={styles.footer}>
        <div className={styles.footerButtons} id="footerButtons">
          {!editMode && (
            <Button
              id="settingsBtn"
              variant="secondary"
              size="small"
              ariaLabel="Settings"
              title="Settings"
              onClick={() => navigate('/settings')}
            >
              <Settings className="w-5 h-5" />
            </Button>
          )}
          
          <Button
            id="editModeBtn"
            variant="secondary"
            size="small"
            ariaLabel={editMode ? "Exit edit mode" : "Toggle edit mode"}
            title={editMode ? "Done" : "Edit Profiles"}
            onClick={() => setEditMode(!editMode)}
            className={editMode ? "active" : ""}
            disabled={profiles.length === 0}
          >
            {editMode ? (
              <X className="w-5 h-5" />
            ) : (
              <Edit className="w-5 h-5" />
            )}
          </Button>
          
          {!editMode && (
            <Button
              id="logoutBtn"
              variant="danger"
              size="small"
              ariaLabel="Logout"
              title="Logout"
              onClick={() => setShowLogoutConfirm(true)}
            >
              <LogOut className="w-5 h-5" />
            </Button>
          )}
        </div>
      </footer>

      {/* Profile Modal */}
      {showModal && (
        <ProfileModal 
          isOpen={showModal} 
          onClose={handleModalClose} 
          profile={editingProfile}
          onSave={handleProfileSaved}
        />
      )}

      {/* Logout Confirmation */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        cancelText="Cancel"
        variant="danger"
      />
    </SimpleLayout>
  )
}
