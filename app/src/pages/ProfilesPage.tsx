import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, LogOut, Edit, X, Plus, Check } from 'lucide-react'
import { SimpleLayout, ConfirmDialog, ProfileModal, AnimatedBackground, SkeletonProfile } from '../components'
import { useAuthStore } from '../stores/authStore'
import { apiFetch } from '../lib/apiFetch'
import { buildAvatarUrl } from '../lib/url'
import styles from './ProfilesPage.module.css'
import { ContextMenu } from '../components/ui/ContextMenu'

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

  // Track auth store for token availability
  const { session, isLoading: authLoading, isAuthenticated } = useAuthStore();
  
  // Determine if we're in Tauri environment
  const isTauriEnv = typeof window !== 'undefined' &&
    ((window as any).__TAURI_INTERNALS__ !== undefined || (window as any).__TAURI__ !== undefined);
  
  useEffect(() => {
    // Wait for auth to be ready and session token to be available
    // This prevents race conditions where we fetch before token is set
    if (authLoading) {
      console.log('[ProfilesPage] Waiting for auth to load...');
      return;
    }
    
    // For Tauri, we need a token; for web, cookies handle auth
    if (isTauriEnv && isAuthenticated && !session?.token) {
      console.log('[ProfilesPage] Authenticated but waiting for session token (Tauri mode)...');
      
      // Use Zustand subscribe to wait for token to become available
      const unsubscribe = useAuthStore.subscribe(
        (state) => state.session?.token,
        (token) => {
          if (token) {
            console.log('[ProfilesPage] Token now available via subscription, loading profiles...');
            loadProfiles(0);
            unsubscribe();
          }
        }
      );
      
      // Also set a fallback timeout in case subscription doesn't fire
      const fallbackTimer = setTimeout(() => {
        const freshToken = useAuthStore.getState().session?.token;
        if (freshToken) {
          console.log('[ProfilesPage] Token found via fallback timeout, loading profiles...');
          loadProfiles(0);
        } else {
          console.log('[ProfilesPage] Still no token after timeout, loading anyway (may fail)...');
          loadProfiles(0);
        }
        unsubscribe();
      }, 500);
      
      return () => {
        unsubscribe();
        clearTimeout(fallbackTimer);
      };
    }
    
    console.log('[ProfilesPage] Auth ready, loading profiles...', {
      authLoading,
      isAuthenticated,
      hasToken: !!session?.token,
      isTauriEnv
    });
    loadProfiles(0);
  }, [authLoading, session?.token, isAuthenticated, isTauriEnv])

  const loadProfiles = async (retryCount = 0) => {
    try {
      const res = await apiFetch('/api/profiles');
      // Log full response for debugging
      console.log(`[ProfilesPage] API Response: ${res.status}`, { ok: res.ok, url: res.url });

      if (res.status === 401) {
        // Session might be expired, try to refresh once?
        if (retryCount >= 2) {
             console.log('[ProfilesPage] Session expired (401) and max retries reached, redirecting to login...');
             navigate('/');
             return;
        }

        console.log('[ProfilesPage] Session expired (401), attempting refresh...');
        const refreshed = await useAuthStore.getState().refreshSession();
        console.log('[ProfilesPage] Refresh result:', refreshed);
        
        if (refreshed) {
             // Wait for state to propagate after refresh before retrying
             console.log('[ProfilesPage] Refresh success, waiting for token propagation...');
             await new Promise(resolve => setTimeout(resolve, 100));
             
             // Verify token is now available
             const newToken = useAuthStore.getState().session?.token;
             console.log('[ProfilesPage] New token available:', !!newToken);
             
             console.log('[ProfilesPage] Retrying loadProfiles...');
             return loadProfiles(retryCount + 1);
        }
        
        // If refresh failed, then redirect
        console.log('[ProfilesPage] Refresh failed, redirecting to login...');
        navigate('/');
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
              <div className={styles.profilesGrid} id="profilesGrid">
                {[1, 2, 3].map((i) => (
                  <SkeletonProfile key={i} />
                ))}
              </div>
            ) : (
              <div className={styles.profilesGrid} id="profilesGrid">
                {profiles.map(profile => (
                  <ProfileCard 
                    key={profile.id} 
                    profile={profile} 
                    onClick={handleProfileClick} 
                    onEdit={handleEditProfile}
                  />
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

      {/* Footer Navbar - styled like mobile streaming navbar */}
      <footer className={styles.footer}>
        <nav className={styles.footerNav} id="footerButtons">
          {/* Left group: main actions with animated active indicator */}
          <div 
            className={styles.navGroup}
            style={{ '--active-index': editMode ? 1 : 0 } as React.CSSProperties}
          >
            <div className={styles.navIndicator} />
            <button
              id="settingsBtn"
              className={`${styles.navItem} ${!editMode ? styles.navItemActive : ''}`}
              aria-label="Settings"
              title="Settings"
              onClick={() => !editMode && navigate('/settings')}
            >
              <Settings size={20} />
            </button>
            <button
              id="editModeBtn"
              className={`${styles.navItem} ${editMode ? styles.navItemActive : ''}`}
              aria-label={editMode ? 'Done editing' : 'Edit Profiles'}
              title={editMode ? 'Done' : 'Edit Profiles'}
              onClick={() => setEditMode(!editMode)}
              disabled={profiles.length === 0 && !editMode}
            >
              {editMode ? <Check size={20} /> : <Edit size={20} />}
            </button>
          </div>

          {/* Divider */}
          <div className={styles.navDivider} />

          {/* Right group: logout */}
          <button
            id="logoutBtn"
            className={`${styles.navItem} ${styles.navItemDanger}`}
            aria-label="Logout"
            title="Logout"
            onClick={() => setShowLogoutConfirm(true)}
          >
            <LogOut size={20} />
          </button>
        </nav>
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

// Extracted ProfileCard component to handle its own context menu hook isolated from the list
function ProfileCard({ profile, onClick, onEdit }: { 
    profile: Profile, 
    onClick: (p: Profile) => void,
    onEdit: (p: Profile) => void 
}) {
  return (
    <ContextMenu
        items={[
            {
                label: 'Edit Profile',
                icon: Edit,
                onClick: () => onEdit(profile)
            }
        ]}
    >
      <div 
        className={styles.profileCard} 
        onClick={() => onClick(profile)}
      >
        <div className={styles.profileAvatar}>
            <div id={`avatar-${profile.id}`}>
            <img 
                src={buildAvatarUrl(profile.avatar, profile.avatar_style || 'bottts-neutral')} 
                alt={profile.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  console.error(`[ProfilesPage] Avatar load failed for ${profile.name} (URL: ${e.currentTarget.src})`);
                  // Keep the broken image container but don't show the browser's broken icon if possible
                  // Alternatively we could set a fallback initials avatar here
                  e.currentTarget.style.opacity = '0';
                }}
            />
            </div>
        </div>
        <div className={styles.profileName}>{profile.name}</div>
        {profile.isDefault && <div className={styles.profileStatus}>Default</div>}
      </div>
    </ContextMenu>
  )
}
