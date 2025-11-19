import { SimpleLayout, Button, FormGroup, Input, Message } from '../components/index'
import { ProfileModal } from '../components/ProfileModal'

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
            <i data-lucide="download" style={{ width: 20, height: 20 }}></i>
          </Button>
          
          <Button
            id="settingsBtn"
            variant="secondary"
            size="small"
            ariaLabel="Settings"
            title="Settings"
            onClick={() => window.location.href = '/settings'}
          >
            <i data-lucide="settings" style={{ width: 20, height: 20 }}></i>
          </Button>
          
          <Button
            id="editModeBtn"
            variant="secondary"
            size="small"
            ariaLabel="Toggle edit mode"
            title="Edit mode"
          >
            <i data-lucide="edit" style={{ width: 20, height: 20 }}></i>
          </Button>
          
          <Button
            id="createProfileBtn"
            variant="primary"
            size="small"
            style={{ display: 'none' }}
            ariaLabel="Create profile"
            title="Create Profile"
          >
            <i data-lucide="plus" style={{ width: 20, height: 20 }}></i>
            <span style={{ marginLeft: 8, fontWeight: 500 }}>Add Profile</span>
          </Button>
          
          <Button
            id="logoutBtn"
            variant="danger"
            size="small"
            ariaLabel="Logout"
            title="Logout"
          >
            <i data-lucide="log-out" style={{ width: 20, height: 20 }}></i>
          </Button>
        </div>
      </footer>

      {/* Profile Modal */}
      <ProfileModal />

      {/* Mobile session handler */}
      <script src="/static/js/mobile-session-handler.js"></script>
      
      {/* Add the client-side JavaScript */}
      {/* Vanta.js and Three.js for background visuals */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js"></script>
      <script src="/static/js/profiles.js"></script>
    </SimpleLayout>
  )
}
