import { SimpleLayout, Button, Modal, FormGroup, Input, Message } from '../components/index'

interface Profile {
  id: number
  name: string
  avatar: string
  isDefault?: boolean
  stremio_email?: string
  nsfw_filter_enabled?: boolean
  nsfw_age_rating?: number
}

interface ProfilesPageProps {
  profiles?: Profile[]
}

export function ProfilesPage({ profiles = [] }: ProfilesPageProps) {
  return (
    <SimpleLayout title="Profiles" additionalCSS={['/static/css/profiles.css']}>
      {/* VANTA background container (same as Settings page) */}
      <div id="vanta-bg" style={{ position: 'fixed', inset: 0, zIndex: 0, width: '100vw', height: '100vh' }}></div>

      <header className="header" style={{ background: 'transparent', boxShadow: 'none' }}>
        <nav className="nav">
          {/* Header is now empty, buttons moved to footer */}
        </nav>
      </header>

      <main className="profiles-page" style={{ position: 'relative', zIndex: 1 }}>
        <h1 className="sr-only">Profiles</h1>
        <div className="profiles-main">
          <section className="profiles-section">
            <h2 className="section-title" id="sectionTitle">Who's watching?</h2>
            <div className="profiles-grid" id="profilesGrid">
              {/* Profiles will be loaded via client-side JavaScript */}
            </div>
          </section>
        </div>
      </main>

      {/* Footer with buttons */}
      <footer className="footer">
        <div className="footer-buttons" id="footerButtons">
          <Button
            id="downloadsBtn"
            variant="secondary"
            size="small"
            ariaLabel="Downloads"
            title="Downloads"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
          </Button>
          
          <Button
            id="settingsBtn"
            variant="secondary"
            size="small"
            ariaLabel="Settings"
            title="Settings"
            onClick={() => window.location.href = '/settings'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
            </svg>
          </Button>
          
          <Button
            id="editModeBtn"
            variant="secondary"
            size="small"
            ariaLabel="Toggle edit mode"
            title="Edit mode"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm14.71-9.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.99-1.66z"/>
            </svg>
          </Button>
          
          <Button
            id="createProfileBtn"
            variant="primary"
            size="small"
            style={{ display: 'none' }}
            ariaLabel="Create profile"
            title="Create Profile"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            <span style={{ marginLeft: 8, fontWeight: 500 }}>Add Profile</span>
          </Button>
          
          <Button
            id="logoutBtn"
            variant="danger"
            size="small"
            ariaLabel="Logout"
            title="Logout"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.59L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
          </Button>
        </div>
      </footer>

      {/* Profile Modal */}
      <ProfileModal />

      {/* Add the client-side JavaScript */}
      {/* Vanta.js and Three.js for background visuals */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js"></script>
      <script src="/static/js/profiles.js"></script>
    </SimpleLayout>
  )
}

function ProfileModal() {
  return (
    <div id="profileModal" className="modal">
      <div className="modal-content">
        <span className="close">&times;</span>
        <h2 id="modalTitle">Create New Profile</h2>
        <form id="profileForm" className="profile-edit-form">
          <div className="profile-edit-container">
            <div className="avatar-section">
              <div className="avatar-preview" id="avatarPreview" aria-live="polite"></div>
              <Button
                type="button"
                variant="secondary"
                className="shuffle-btn"
                id="shuffleBtn"
              >
                🎲 Shuffle Avatar
              </Button>
            </div>
            
            <FormGroup label="Profile Name" htmlFor="profileName">
              <Input
                type="text"
                id="profileName"
                name="profileName"
                required
              />
            </FormGroup>
            
            <FormGroup htmlFor="stremioEmail">
              <label htmlFor="stremioEmail">
                Stremio Email <span style={{ color: '#e50914' }}>*</span>
              </label>
              <Input
                type="email"
                id="stremioEmail"
                name="stremioEmail"
                required
              />
            </FormGroup>
            
            <FormGroup label="Stremio Password" htmlFor="stremioPassword">
              <Input
                type="password"
                id="stremioPassword"
                name="stremioPassword"
                ariaDescribedBy="stremioPasswordHelp"
              />
            </FormGroup>

            <div className="form-group setting-item">
              <div className="setting-info">
                <label htmlFor="nsfwFilterEnabledToggle">Enable NSFW Filter</label>
                <p>Censor content based on age rating.</p>
              </div>
              <div className="setting-control">
                <div className="toggle" id="nsfwFilterEnabledToggle"></div>
              </div>
            </div>

            <FormGroup label="Age Rating" htmlFor="ageRatingInput" className="step-hidden" id="ageRatingGroup">
              <Input
                type="number"
                id="ageRatingInput"
                name="ageRating"
                min="0"
                max="18"
              />
            </FormGroup>

            <Button
              type="submit"
              className="btn-primary save-btn"
              id="saveProfileBtn"
            >
              Save Profile
            </Button>
            
            <Button
              type="button"
              variant="danger"
              size="small"
              id="deleteProfileBtn"
              style={{ display: 'none', marginTop: '8px' }}
            >
              Delete Profile
            </Button>
          </div>
        </form>
        
        <Message id="modalMessage" />
      </div>
    </div>
  )
}