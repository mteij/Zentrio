import { SimpleLayout, Button, Modal, FormGroup, Input, ModalWithFooter } from '../components/index'
import { OTPModal } from '../components/auth/OTPModal'

interface SettingsPageProps {}

export function SettingsPage({}: SettingsPageProps) {
  return (
    <SimpleLayout title="Settings">
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('show-toast', (event) => {
              const { text, type, error } = event.detail;
              
              let toastType = 'message';
              if (type === 'success') toastType = 'message';
              if (type === 'error') toastType = 'error';
              if (type === 'info') toastType = 'warning';

              window.showToast(toastType, text, undefined, error);
            });
          `,
        }}
      />
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
              <h3>Username</h3>
              <p>Change your account username</p>
            </div>
            <div className="setting-control">
              <span id="currentUsername">Loading...</span>
              <Button variant="secondary" id="openUsernameModalBtn">
                Change
              </Button>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h3>Email Address</h3>
              <p>Change your account email address</p>
            </div>
            <div className="setting-control">
              <span id="currentEmail">Loading...</span>
              <Button variant="secondary" id="openEmailModalBtn">
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
              <Button variant="secondary" id="openPasswordModalBtn">
                Change Password
              </Button>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h3>Stay signed in on this device</h3>
              <p>When enabled, you will remain signed in indefinitely. When disabled, you will be signed out after 3 hours of inactivity. This preference is stored only on this device.</p>
            </div>
            <div className="setting-control">
              <div className="toggle" id="rememberMeLocalToggle" aria-label="Stay signed in on this device"></div>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h3>Two-Factor Authentication</h3>
              <p>Add an extra layer of security to your account.</p>
            </div>
            <div className="setting-control">
                <div id="twoFactorControl">
                    {/* Will be populated by JS */}
                    <Button variant="primary" id="enable2faBtn">Enable 2FA</Button>
                    <Button variant="danger" id="disable2faBtn" style={{ display: 'none' }}>Disable 2FA</Button>
                </div>
            </div>
          </div>
          
          <div id="backupCodesContainer" style={{ display: 'none', marginTop: '20px' }} className="setting-item">
              <div style={{ flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                  <h3>Backup Codes</h3>
                  <p>Save these codes in a safe place. You can use them to access your account if you lose your authenticator device.</p>
                  <pre id="backupCodesList" style={{ background: '#333', padding: '15px', borderRadius: '8px', width: '100%', overflowX: 'auto', fontFamily: 'monospace', marginTop: '10px' }}></pre>
                  <Button variant="secondary" style={{ marginTop: '15px' }} onClick={() => { const el = document.getElementById('backupCodesContainer'); if (el) el.style.display = 'none'; }}>
                    Done
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

          <div className="setting-item">
            <div className="setting-info">
              <h3>Hide Cinemeta Content</h3>
              <p>Removes rows from the Stremio home/discover screens that originate from Cinemeta.</p>
            </div>
            <div className="setting-control">
              <div className="toggle" id="hideCinemetaContentToggle"></div>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h3>Enable Downloads Manager</h3>
              <p>Shows a download button for each stream and a downloads panel within Stremio (requires page refresh after changing).</p>
            </div>
            <div className="setting-control">
              <div className="toggle" id="downloadsManagerEnabledToggle"></div>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h3>TMDB API Key</h3>
              <p>Required for NSFW filter functionality. Get your free key from <a href="https://www.themoviedb.org/signup" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>TMDB</a>. When set, enables NSFW content filtering in profiles.</p>
            </div>
            <div className="setting-control">
              <Input
                type="password"
                id="tmdbApiKeyInput"
                placeholder="Enter TMDB API key"
                autoComplete="new-password"
                name="tmdb_api_key_field"
                style={{
                  width: '300px',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'var(--text, white)',
                  fontSize: '14px',
                  transition: 'all 0.3s ease'
                }}
              />
            </div>
          </div>
        </div>
 
        {/* Appearance (local-only theme selection) */}
        <div className="settings-section">
          <h2 className="section-title">Appearance</h2>

          <div className="setting-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 16 }}>
            <div className="setting-info">
              <h3>Theme</h3>
              <p>Choose a subtle, modern theme for button colors, accents and the background. Use previews to pick a look; selection is stored locally on this device.</p>
            </div>

            <div className="setting-control" style={{ width: '100%' }}>
              <div id="themeGallery" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {/* Previews will be rendered by client JS */}
              </div>
            </div>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h3>Enable animated background</h3>
              <p>Toggle the animated Vanta background effect on/off</p>
            </div>
            <div className="setting-control">
              <div className="toggle" id="vantaToggle"></div>
            </div>
          </div>
        </div>


        {/* Danger Zone */}
        <div className="danger-zone">
          <h3>Danger Zone</h3>
          <div className="setting-item">
            <div className="setting-info">
              <h3>Delete Account</h3>
              <p>Permanently delete your account and all data</p>
            </div>
            <div className="setting-control">
              <Button variant="danger" id="deleteAccountBtn">
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Username Change Modal */}
      <ModalWithFooter
        id="usernameModal"
        title="Change username"
        footer={
          <>
            <Button variant="secondary" id="usernameCancelBtn">
              Cancel
            </Button>
            <Button variant="primary" id="usernameUpdateBtn">
              Update
            </Button>
          </>
        }
      >
        <FormGroup label="New Username" htmlFor="newUsername">
          <Input
            type="text"
            id="newUsername"
            placeholder="Enter new username"
            required
          />
        </FormGroup>
      </ModalWithFooter>

      {/* Email Change Modal */}
      <ModalWithFooter
        id="emailModal"
        title="Change email"
        footer={
          <>
            <Button variant="secondary" id="emailCancelBtn">
              Cancel
            </Button>
            <Button variant="primary" id="emailContinueBtn">
              Continue
            </Button>
          </>
        }
      >
        <FormGroup label="Current Email Address" htmlFor="oldEmail">
          <Input
            type="email"
            id="oldEmail"
            placeholder="Current email"
            disabled
            value=""
          />
        </FormGroup>
        <FormGroup label="New Email Address" htmlFor="newEmail">
          <Input
            type="email"
            id="newEmail"
            placeholder="Enter new email address"
            required
          />
        </FormGroup>
      </ModalWithFooter>

      {/* OTP Modal */}
      <Modal id="otpModal" title="Verify email">
        <OTPModal
          email=""
          onBack={() => {}}
          onVerify={() => {}}
          onResend={() => {}}
          resendSeconds={30}
        />
      </Modal>

      {/* 2FA Setup Modal */}
      <ModalWithFooter
        id="twoFactorModal"
        title="Setup Two-Factor Authentication"
        footer={
          <>
            <Button variant="secondary" id="twoFactorCancelBtn">
              Cancel
            </Button>
            <Button variant="primary" id="twoFactorVerifyBtn">
              Verify & Enable
            </Button>
          </>
        }
      >
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <p style={{ marginBottom: '15px', color: '#b3b3b3' }}>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</p>
            <div id="qrCodeContainer" style={{ background: 'white', padding: '10px', display: 'inline-block', borderRadius: '8px' }}>
                {/* QR Code will be injected here */}
            </div>
            <p id="qrCodeSecret" style={{ marginTop: '10px', fontSize: '12px', color: '#666', wordBreak: 'break-all' }}></p>
        </div>
        <FormGroup label="Verification Code" htmlFor="twoFactorCode">
          <Input
            type="text"
            id="twoFactorCode"
            placeholder="Enter 6-digit code"
            maxLength="6"
            style={{ textAlign: 'center', letterSpacing: '4px', fontSize: '18px' }}
          />
        </FormGroup>
      </ModalWithFooter>

      {/* Password Change Modal */}
      <ModalWithFooter
        id="passwordModal"
        title="Change Password"
        footer={
          <>
            <Button variant="secondary" id="passwordCancelBtn">
              Cancel
            </Button>
            <Button variant="primary" id="passwordUpdateBtn">
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
            minLength={8}
          />
        </FormGroup>
        <FormGroup label="Confirm New Password" htmlFor="confirmPassword">
          <Input
            type="password"
            id="confirmPassword"
            placeholder="Confirm new password"
            required
            minLength={8}
          />
        </FormGroup>
      </ModalWithFooter>

      {/* Settings wiring script */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function(){
  // Toast shim
  if (!window.addToast) {
    window.addToast = function(type, title, message, error){ console.log('[toast]', type, title, message||'', error||''); };
  }
  if (!window.showToast && window.addToast) {
    window.showToast = window.addToast;
  }

  // Fallback modal helpers if not provided by settings.js
  if (typeof window.openModal !== 'function') {
    window.openModal = function(modalId) {
      var modal = document.getElementById(modalId);
      if (!modal) return;
      modal.classList.add('active');
      document.body.classList.add('modal-open');
      // focus first input
      var firstInput = modal.querySelector('input');
      if (firstInput) setTimeout(function(){ firstInput.focus(); }, 50);
    };
  }
  if (typeof window.closeModal !== 'function') {
    window.closeModal = function(modalId) {
      var modal = document.getElementById(modalId);
      if (!modal) return;
      modal.classList.remove('active');
      document.body.classList.remove('modal-open');
    };
  }

  const headers = { 'Content-Type': 'application/json', 'X-Requested-With': 'xmlhttprequest' };
  let cachedEmail = '';

  async function fetchProfileEmail() {
    try {
      const res = await fetch('/api/user/profile');
      if (!res.ok) return '';
      const data = await res.json();
      const email = (data && data.email) || (data && data.data && data.data.email) || '';
      if (email) {
        cachedEmail = email;
        const span = document.getElementById('currentEmail');
        if (span) span.textContent = email;
        const oldInput = document.getElementById('oldEmail');
        if (oldInput) oldInput.value = email;
      }
      return email;
    } catch (_) {
      return '';
    }
  }

  function getCurrentEmailFromUI() {
    const span = document.getElementById('currentEmail');
    const v = span ? (span.textContent || '').trim() : '';
    return v;
  }

  function setInlineOtpError(msg) {
    // Use toast-only notifications for OTP errors (no inline messages)
    if (msg && typeof window.addToast === 'function') {
      window.addToast('error', 'Verification error', msg);
    }
  }

  function disable(el, flag) {
    if (!el) return;
    el.setAttribute('disabled', flag ? 'true' : '');
    if (!flag) el.removeAttribute('disabled');
  }

  // Email change + OTP flow
  let otpNewEmail = '';
  let resendSeconds = 0;
  let resendTimer = null;

  function startResendCooldown(sec) {
    resendSeconds = sec;
    updateResendText();
    if (resendTimer) clearInterval(resendTimer);
    resendTimer = setInterval(() => {
      resendSeconds -= 1;
      updateResendText();
      if (resendSeconds <= 0) {
        clearInterval(resendTimer);
        resendTimer = null;
      }
    }, 1000);
  }

  function updateResendText() {
    const el = document.getElementById('resendOtpText');
    if (el) {
      const s = resendSeconds > 0 ? resendSeconds : 0;
      el.textContent = 'Resend OTP (' + s + 's)';
      el.style.pointerEvents = s > 0 ? 'none' : 'auto';
      el.style.opacity = s > 0 ? '0.6' : '1';
    }
  }

  function openEmailModal() {
    const old = cachedEmail || getCurrentEmailFromUI();
    const oldInput = document.getElementById('oldEmail');
    if (oldInput) oldInput.value = old || '';
    openModal('emailModal');
    setTimeout(() => {
      const el = document.getElementById('newEmail');
      if (el) el.focus();
    }, 100);
  }

  async function initiateEmailChange() {
    const btn = document.getElementById('emailContinueBtn');
    disable(btn, true);
    try {
      const old = cachedEmail || getCurrentEmailFromUI();
      const newInput = document.getElementById('newEmail');
      const newEmail = newInput ? newInput.value.trim().toLowerCase() : '';
      if (!newEmail || newEmail.indexOf('@') === -1 || (old && newEmail === old)) {
        window.addToast('error', 'Invalid email', 'Enter a different valid email.');
        return;
      }

      const res = await fetch('/api/user/email/initiate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ newEmail })
      });

      if (res.status === 401) {
        window.addToast('warning', 'Session expired', 'Redirecting to sign in...');
        setTimeout(() => { window.location.href = '/'; }, 800);
        return;
      }

      if (res.ok) {
        openOtpModalFor(newEmail);
        startResendCooldown(30);
        return;
      }

      let code = '';
      try { const j = await res.json(); code = j?.error?.code || ''; } catch(_){}

      if (res.status === 409 || code === 'EMAIL_IN_USE') {
        window.addToast('error', 'Email already in use');
        return;
      }
      if (res.status === 429 || code === 'RATE_LIMITED') {
        window.addToast('error', 'Too many requests, try later.');
        return;
      }
      window.addToast('error', 'Could not start verification');
    } catch (e) {
      window.addToast('error', 'Network error', 'Please try again later.');
    } finally {
      disable(btn, false);
    }
  }

  function openOtpModalFor(newEmail) {
    otpNewEmail = newEmail;
    const p = document.getElementById('otpEmailText');
    if (p) p.textContent = "We've sent a 6-digit code to " + newEmail;
    setInlineOtpError('');
    openModal('otpModal');
    setTimeout(() => {
      const codeInput = document.getElementById('otpCodeInput');
      if (codeInput) codeInput.focus();
    }, 100);
  }

  async function verifyOtp() {
    const btn = document.getElementById('verifyOtpCodeBtn');
    const input = document.getElementById('otpCodeInput');
    const code = input ? (input.value || '').replace(/\\D/g, '') : '';
    if (!/^[0-9]{6}$/.test(code)) {
      setInlineOtpError('Please enter a valid 6-digit code.');
      if (input) input.focus();
      return;
    }
    disable(btn, true);
    try {
      const res = await fetch('/api/user/email/verify', {
        method: 'POST',
        headers,
        body: JSON.stringify({ newEmail: otpNewEmail, code })
      });

      if (res.status === 401) {
        window.addToast('warning', 'Session expired', 'Redirecting to sign in...');
        setTimeout(() => { window.location.href = '/'; }, 800);
        return;
      }

      let codeStr = '';
      let data = null;
      try { const j = await res.json(); codeStr = j?.error?.code || ''; data = j?.data || j; } catch(_){}

      if (res.ok) {
        const email = (data && (data.email || (data.data && data.data.email))) || otpNewEmail;
        cachedEmail = email;
        const span = document.getElementById('currentEmail');
        if (span) span.textContent = email;
        const oldInput = document.getElementById('oldEmail');
        if (oldInput) oldInput.value = email;
        closeModal('otpModal');
        closeModal('emailModal');
        window.addToast('success', 'Email updated. You may need to sign in again.');
        return;
      }

      if (res.status === 400 && codeStr === 'INVALID_CODE') {
        setInlineOtpError('Invalid verification code.');
        if (input) { input.focus(); input.select && input.select(); }
        return;
      }

      if (res.status === 409 || codeStr === 'EMAIL_IN_USE') {
        window.addToast('error', 'Email already in use');
        return;
      }

      if (res.status === 429 || codeStr === 'RATE_LIMITED') {
        window.addToast('error', 'Too many requests, try later.');
        return;
      }

      window.addToast('error', 'Verification failed');
    } catch (e) {
      window.addToast('error', 'Network error', 'Please try again later.');
    } finally {
      disable(btn, false);
    }
  }

  async function resendOtp() {
    if (resendSeconds > 0) return;
    if (!otpNewEmail) return;
    try {
      const res = await fetch('/api/user/email/initiate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ newEmail: otpNewEmail })
      });
      if (res.status === 401) {
        window.addToast('warning', 'Session expired', 'Redirecting to sign in...');
        setTimeout(() => { window.location.href = '/'; }, 800);
        return;
      }
      if (res.ok) {
        window.addToast('warning', 'Code resent');
        startResendCooldown(30);
        return;
      }
      let code = '';
      try { const j = await res.json(); code = j?.error?.code || ''; } catch(_){}
      if (res.status === 429 || code === 'RATE_LIMITED') {
        window.addToast('error', 'Too many requests, try later.');
        return;
      }
      window.addToast('error', 'Could not resend code');
    } catch (e) {
      window.addToast('error', 'Network error', 'Please try again later.');
    }
  }

  // Password flow
  async function submitPassword() {
    const btn = document.getElementById('passwordUpdateBtn');
    disable(btn, true);
    try {
      const oldPwEl = document.getElementById('currentPassword');
      const newPwEl = document.getElementById('newPassword');
      const confirmEl = document.getElementById('confirmPassword');
      const oldPassword = oldPwEl ? oldPwEl.value : '';
      const newPassword = newPwEl ? newPwEl.value : '';
      const confirmPassword = confirmEl ? confirmEl.value : '';

      if (!oldPassword) {
        window.addToast('error', 'Enter your current password');
        return;
      }
      if (!newPassword || newPassword.length < 8) {
        window.addToast('error', 'Password too short', 'Minimum length is 8 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        window.addToast('error', 'Passwords do not match');
        return;
      }

      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ oldPassword, newPassword })
      });

      if (res.status === 401) {
        window.addToast('warning', 'Unable to update password');
        return;
      }

      if (res.ok) {
        closeModal('passwordModal');
        window.addToast('success', 'Password updated; please sign in again.');
        setTimeout(() => { window.location.href = '/'; }, 1000);
        return;
      }

      let code = '';
      try { const j = await res.json(); code = j?.error?.code || ''; } catch(_){}
      if (res.status === 429 || code === 'RATE_LIMITED') {
        window.addToast('error', 'Too many requests, try later.');
        return;
      }
      window.addToast('error', 'Unable to update password');
    } catch (e) {
      window.addToast('error', 'Network error', 'Please try again later.');
    } finally {
      disable(btn, false);
    }
  }

  function wire() {
    // Prefill current email
    fetchProfileEmail();

    // Email modal
    const btnEmailOpen = document.getElementById('openEmailModalBtn');
    if (btnEmailOpen) btnEmailOpen.addEventListener('click', openEmailModal);

    const btnEmailCancel = document.getElementById('emailCancelBtn');
    if (btnEmailCancel) btnEmailCancel.addEventListener('click', () => closeModal('emailModal'));

    const btnEmailContinue = document.getElementById('emailContinueBtn');
    if (btnEmailContinue) btnEmailContinue.addEventListener('click', initiateEmailChange);

    // Password modal
    const btnPwdOpen = document.getElementById('openPasswordModalBtn');
    if (btnPwdOpen) btnPwdOpen.addEventListener('click', () => openModal('passwordModal'));

    const btnPwdCancel = document.getElementById('passwordCancelBtn');
    if (btnPwdCancel) btnPwdCancel.addEventListener('click', () => closeModal('passwordModal'));

    const btnPwdUpdate = document.getElementById('passwordUpdateBtn');
    if (btnPwdUpdate) btnPwdUpdate.addEventListener('click', submitPassword);

    // OTP modal
    const otpBack = document.getElementById('otpBackBtn');
    if (otpBack) otpBack.addEventListener('click', () => closeModal('otpModal'));

    const otpVerify = document.getElementById('verifyOtpCodeBtn');
    if (otpVerify) otpVerify.addEventListener('click', verifyOtp);

    const otpResend = document.getElementById('resendOtpText');
    if (otpResend) otpResend.addEventListener('click', resendOtp);
    
    // Delete account
    const deleteBtn = document.getElementById('deleteAccountBtn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
            if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                try {
                    const res = await fetch('/api/user/delete', { method: 'DELETE' });
                    if (res.ok) {
                        window.location.href = '/';
                    } else {
                        window.addToast('error', 'Failed to delete account');
                    }
                } catch (e) {
                    window.addToast('error', 'Network error');
                }
            }
        });
    }
  }

  document.addEventListener('DOMContentLoaded', wire);
})();
          `
        }}
      />
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

        /* Settings-page toggle: OFF is darker; thumb always white */
        .setting-control .toggle {
          position: relative;
          width: 50px;
          height: 24px;
          background: var(--toggle-off-bg, #0d0f12);
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.2s ease, box-shadow 0.2s ease;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06);
        }
        
        .setting-control .toggle.active {
          background: var(--accent, #e50914);
          box-shadow: none;
        }
        
        .setting-control .toggle::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          transition: transform 0.2s ease;
        }
        
        .setting-control .toggle.active::after {
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

      {/* Mobile session handler */}
      <script src="/static/js/mobile-session-handler.js"></script>
      
      {/* Settings page JavaScript */}
      {/* Vanta.js and Three.js */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js"></script>
      <script src="/static/js/settings.js"></script>
    </SimpleLayout>
  )
}
