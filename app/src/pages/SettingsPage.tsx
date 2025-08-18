import { SimpleLayout, Button, Modal, FormGroup, Input, Message, ModalWithFooter } from '../components/index'

interface SettingsPageProps {}

export function SettingsPage({}: SettingsPageProps) {
  return (
    <SimpleLayout title="Settings">
      {/* VANTA background container */}
      <div id="vanta-bg" style={{ position: 'fixed', inset: 0, zIndex: 0, width: '100vw', height: '100vh' }}></div>
      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <h1 className="page-title">Settings</h1>
        <button
          id="backButton"
          className="back-btn"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Back to Profiles
        </button>

        {/* Account Settings */}
        <div className="settings-section">
          <h2 className="section-title">Account</h2>
          
          <div className="setting-item">
            <div className="setting-info">
              <h3>Email Address</h3>
              <p>Change your account email address</p>
            </div>
            <div className="setting-control">
              <span id="currentEmail">Loading...</span>
              <Button variant="secondary" onClick={() => console.log('Toggle email form')}>
                Change
              </Button>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h3>Password</h3>
              <p>Update your account password</p>
            </div>
            <div className="setting-control">
              <Button variant="secondary" onClick={() => console.log('Toggle password form')}>
                Change Password
              </Button>
            </div>
          </div>
        </div>

        {/* Plugins */}
        <div className="settings-section">
          <h2 className="section-title">Plugins</h2>
          <div className="setting-item">
            <div className="setting-info">
              <h3>Enable Addon Manager</h3>
              <p>Adds an "Edit Order" button to the Stremio addons page to allow reordering and removing addons.</p>
            </div>
            <div className="setting-control">
              <div className="toggle" id="addonManagerEnabledToggle"></div>
            </div>
          </div>
 
          <div className="setting-item">
            <div className="setting-info">
              <h3>Hide Calendar Button</h3>
              <p>Removes the Calendar button from the Stremio UI for all profiles</p>
            </div>
            <div className="setting-control">
              <div className="toggle" id="hideCalendarButtonToggle"></div>
            </div>
          </div>
 
          <div className="setting-item">
            <div className="setting-info">
              <h3>Hide Addons Button</h3>
              <p>Removes the Addons button from the Stremio UI for all profiles</p>
            </div>
            <div className="setting-control">
              <div className="toggle" id="hideAddonsButtonToggle"></div>
            </div>
          </div>
        </div>
 
        {/* Appearance (local-only theme selection) */}
        <div className="settings-section">
          <h2 className="section-title">Appearance</h2>

          <div className="setting-item" style={{ alignItems: 'flex-start', gap: 16 }}>
            <div className="setting-info">
              <h3>Theme</h3>
              <p>Choose a subtle, modern theme for button colors, accents and the background. Use previews to pick a look; selection is stored locally on this device.</p>
            </div>

            <div className="setting-control" style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
              <div id="themeGallery" style={{ display: 'flex', gap: 12 }}>
                {/* Previews will be rendered by client JS */}
              </div>

              <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
                <label htmlFor="vantaToggle" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted, #b3b3b3)' }}>
                  <input id="vantaToggle" type="checkbox" />
                  Enable animated background
                </label>
    
                <button id="customizeThemeBtn" className="btn btn-secondary btn-small" type="button" onClick={() => {
                  try {
                    const top = (window as any);
                    const ev = new CustomEvent('openThemeCustomize');
                    document.dispatchEvent(ev);
                  } catch (e) {}
                }}>
                  Customize
                </button>
              </div>

            </div>
          </div>
        </div>

        {/* Theme customization modal */}
        <ModalWithFooter
          id="themeCustomizeModal"
          title="Customize Theme"
          footer={
            <>
              <Button variant="secondary" onClick={() => {
                try { document.getElementById('themeCustomizeModal')?.classList.remove('active'); document.body.classList.remove('modal-open'); } catch (e) {}
              }}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => {
                try { document.getElementById('themeCustomizeModal')?.classList.remove('active'); document.body.classList.remove('modal-open'); } catch (e) {}
                // save handled by client JS event listener
                const saveEv = new CustomEvent('saveThemeCustomizations');
                document.dispatchEvent(saveEv);
              }}>
                Save
              </Button>
            </>
          }
        >
          <FormGroup>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input id="customVantaToggle" type="checkbox" defaultChecked />
              Animated background
            </label>
            <p style={{ color: 'var(--muted,#b3b3b3)', fontSize: 13 }}>Enable or disable the animated Vanta background.</p>
          </FormGroup>

          <FormGroup label="Grain size" htmlFor="grainSizeInput">
            <input type="number" id="grainSizeInput" defaultValue={0.6} step={0.1} min={0} max={5} className="form-control" />
            <p style={{ color: 'var(--muted,#b3b3b3)', fontSize: 13 }}>Smaller values = finer grain. Default is 0.6 for a subtle effect.</p>
          </FormGroup>
        </ModalWithFooter>

        {/* Danger Zone */}
        <div className="danger-zone">
          <h3>Danger Zone</h3>
          <div className="setting-item">
            <div className="setting-info">
              <h3>Delete Account</h3>
              <p>Permanently delete your account and all data</p>
            </div>
            <div className="setting-control">
              <Button variant="danger" onClick={() => console.log('Delete account')}>
                Delete Account
              </Button>
            </div>
          </div>
        </div>

        <Message id="message" />
      </div>

      {/* Email Change Modal */}
      <ModalWithFooter
        id="emailModal"
        title="Change Email Address"
        footer={
          <>
            <Button variant="secondary" onClick={() => console.log('Close email modal')}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => console.log('Update email')}>
              Update Email
            </Button>
          </>
        }
      >
        <FormGroup label="New Email Address" htmlFor="newEmail">
          <Input
            type="email"
            id="newEmail"
            placeholder="Enter new email address"
            required
          />
        </FormGroup>
      </ModalWithFooter>

      {/* Password Change Modal */}
      <ModalWithFooter
        id="passwordModal"
        title="Change Password"
        footer={
          <>
            <Button variant="secondary" onClick={() => console.log('Close password modal')}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => console.log('Update password')}>
              Update Password
            </Button>
          </>
        }
      >
        <FormGroup label="Current Password" htmlFor="currentPassword">
          <Input
            type="password"
            id="currentPassword"
            placeholder="Enter current password"
            required
          />
        </FormGroup>
        <FormGroup label="New Password" htmlFor="newPassword">
          <Input
            type="password"
            id="newPassword"
            placeholder="Enter new password (min 8 characters)"
            required
          />
        </FormGroup>
        <FormGroup label="Confirm New Password" htmlFor="confirmPassword">
          <Input
            type="password"
            id="confirmPassword"
            placeholder="Confirm new password"
            required
          />
        </FormGroup>
      </ModalWithFooter>

      {/* Settings page styles */}
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          background: var(--bg, #141414);
          color: var(--text, white);
          min-height: 100vh;
        }

        .container {
          max-width: 800px;
          margin: 120px auto 60px;
          padding: 0 20px;
        }

        .page-title {
          font-size: 48px;
          margin-bottom: 40px;
          font-weight: bold;
        }

        .back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--btn-secondary-bg, #333);
          color: var(--text, white);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.3s;
          text-decoration: none;
          margin-bottom: 20px;
          width: fit-content;
        }

        .back-btn:hover {
          background: rgba(255,255,255,0.04);
          color: var(--accent, #e50914);
        }

        .back-btn svg {
          transition: transform 0.3s;
        }

        .back-btn:hover svg {
          transform: translateX(-2px);
        }

        .settings-section {
          background: var(--section-bg, #222);
          border-radius: 8px;
          padding: 30px;
          margin-bottom: 30px;
        }

        .section-title {
          font-size: 24px;
          margin-bottom: 20px;
          color: var(--accent, #e50914);
        }

        .setting-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 0;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }

        .setting-item:last-child {
          border-bottom: none;
        }

        .setting-info h3 {
          font-size: 18px;
          margin-bottom: 5px;
        }

        .setting-info p {
          color: var(--muted, #b3b3b3);
          font-size: 14px;
        }

        .setting-control {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .toggle {
          position: relative;
          width: 50px;
          height: 24px;
          background: var(--btn-secondary-bg, #333);
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.3s;
        }

        .toggle.active {
          background: var(--accent, #e50914);
        }

        .toggle::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          transition: transform 0.3s;
        }

        .toggle.active::after {
          transform: translateX(26px);
        }

        .danger-zone {
          border: 1px solid #dc3545;
          border-radius: 8px;
          padding: 20px;
          margin-top: 40px;
        }

        .danger-zone h3 {
          color: #dc3545;
          margin-bottom: 15px;
        }

        .modal {
          display: none;
          position: fixed;
          z-index: 1000;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.7);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .modal.active {
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 1;
        }

        .modal-content {
          background: var(--section-bg, #222);
          border-radius: 8px;
          padding: 30px;
          width: 90%;
          max-width: 500px;
          position: relative;
          transform: scale(0.7);
          transition: transform 0.3s ease;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal.active .modal-content {
          transform: scale(1);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 1px solid #333;
        }

        .modal-title {
          font-size: 24px;
          color: var(--accent, #e50914);
          margin: 0;
        }

        .modal-close {
          background: none;
          border: none;
          color: #b3b3b3;
          font-size: 28px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.3s;
        }

        .modal-close:hover {
          background: rgba(255,255,255,0.04);
          color: var(--text, white);
        }

        .modal-body {
          margin-bottom: 25px;
        }

        .modal-footer {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          padding-top: 15px;
          border-top: 1px solid #333;
        }

        body.modal-open {
          overflow: hidden;
        }

        @media (max-width: 768px) {
          .container {
            margin-top: 60px;
          }

          .page-title {
            font-size: 32px;
          }

          .setting-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 15px;
          }

          .modal-content {
            width: 95%;
            padding: 20px;
            margin: 10px;
          }

          .modal-footer {
            flex-direction: column;
          }

          .modal-footer .btn {
            width: 100%;
          }
        }
      `}</style>

      {/* Settings page JavaScript */}
      {/* Vanta.js and Three.js */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js"></script>
      <script src="/static/js/settings.js"></script>
    </SimpleLayout>
  )
}