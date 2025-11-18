// Client-side JavaScript for settings page functionality
// This replaces the inline script from settings.html

// Settings state
const settings = {};
let tmdbApiKey = '';

// Load user settings
async function loadSettings() {
    try {
        const response = await fetch('/api/user/settings');
        if (response.ok) {
            const payload = await response.json();
            const userSettings = (payload && (payload.data || payload)) || {};
            if (userSettings && typeof userSettings === 'object') {
                Object.assign(settings, userSettings);
                updateUI();
            }
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Load TMDB API key
async function loadTmdbApiKey() {
    try {
        const response = await fetch('/api/user/tmdb-api-key');
        if (response.ok) {
            const data = await response.json();
            tmdbApiKey = data.tmdb_api_key || '';
            const tmdbInput = document.getElementById('tmdbApiKeyInput');
            if (tmdbInput) {
                tmdbInput.value = tmdbApiKey || '';
            }
        }
    } catch (error) {
        console.error('Failed to load TMDB API key:', error);
    }
}

// Auto-save TMDB API key with debounce
let tmdbSaveTimeout;
async function autoSaveTmdbApiKey() {
    const tmdbInput = document.getElementById('tmdbApiKeyInput');
    if (!tmdbInput) return;
    
    const newApiKey = tmdbInput.value.trim();
    
    // Clear existing timeout
    if (tmdbSaveTimeout) {
        clearTimeout(tmdbSaveTimeout);
    }
    
    // Set new timeout for auto-save (1 second debounce)
    tmdbSaveTimeout = setTimeout(async () => {
        try {
            const response = await fetch('/api/user/tmdb-api-key', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'xmlhttprequest'
                },
                body: JSON.stringify({ tmdb_api_key: newApiKey })
            });
            
            if (response.ok) {
                tmdbApiKey = newApiKey;
                showMessage('TMDB API key saved automatically', 'success');
            } else {
                throw new Error('Failed to save TMDB API key');
            }
        } catch (error) {
            showMessage(error.message, 'error');
        }
    }, 1000);
}

// Load user info
async function loadUserInfo() {
    try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
            const payload = await response.json();
            const email = (payload && (payload.email || (payload.data && payload.data.email))) || '';
            if (email) {
                const el = document.getElementById('currentEmail');
                if (el) el.textContent = email;
            }
        } else {
            console.error('Failed to load user info: HTTP', response.status);
        }
    } catch (error) {
        console.error('Failed to load user info:', error);
    }
}

// Update UI with current settings
function updateUI() {
    // Update server-backed toggles
    Object.keys(settings).forEach(key => {
        const toggle = document.getElementById(`${key}Toggle`);
        if (toggle) {
            toggle.classList.toggle('active', settings[key]);
        }
    });

    // Update local-only "Stay signed in" toggle
    const rememberToggle = document.getElementById('rememberMeLocalToggle');
    if (rememberToggle) {
        let pref = false;
        try { pref = localStorage.getItem('zentrioRememberMe') === 'true'; } catch (e) {}
        rememberToggle.classList.toggle('active', !!pref);
    }

// Update TMDB API key input
const tmdbInput = document.getElementById('tmdbApiKeyInput');
if (tmdbInput) {
    tmdbInput.value = tmdbApiKey || '';
}
}

// Toggle setting
async function toggleSetting(settingName) {
    settings[settingName] = !settings[settingName];
    updateUI();
    await saveSettings();
}

// Save settings to server
async function saveSettings() {
    try {
        const response = await fetch('/api/user/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'xmlhttprequest'
            },
            body: JSON.stringify(settings)
        });
 
        if (response.ok) {
            showMessage('Settings saved successfully', 'success');
        } else {
            throw new Error('Failed to save settings');
        }
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

// Modal utility functions
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    
    // Focus first input in modal
    const firstInput = modal.querySelector('input');
    if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    
    // Clear form inputs
    const inputs = modal.querySelectorAll('input');
    inputs.forEach(input => input.value = '');
}

// Email modal functions
function toggleEmailForm() {
    openModal('emailModal');
}

function closeEmailModal() {
    closeModal('emailModal');
}

async function updateEmail() {
    const newEmail = document.getElementById('newEmail').value;
    
    if (!newEmail || !newEmail.includes('@')) {
        showMessage('Please enter a valid email address', 'error');
        return;
    }

    try {
        const response = await fetch('/api/user/email', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: newEmail })
        });

        if (response.ok) {
            const el = document.getElementById('currentEmail');
            if (el) el.textContent = newEmail;
            closeEmailModal();
            showMessage('Email updated successfully', 'success');
        } else {
            const error = await response.json();
            showMessage(error.error || 'Failed to update email', 'error');
        }
    } catch (error) {
        console.error('Failed to update email:', error);
        showMessage('Failed to update email. Please try again.', 'error');
    }
}

// Password modal functions
function togglePasswordForm() {
    openModal('passwordModal');
}

function closePasswordModal() {
    closeModal('passwordModal');
}

function updatePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!currentPassword) {
        showMessage('Please enter your current password', 'error');
        return;
    }

    if (newPassword.length < 8) {
        showMessage('New password must be at least 8 characters long', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        showMessage('New passwords do not match', 'error');
        return;
    }

    closePasswordModal();
    showMessage('Password updated successfully', 'success');
}

// Modal event handlers
function handleModalClick(event, modalId) {
    if (event.target.classList.contains('modal')) {
        closeModal(modalId);
    }
}

function handleEscapeKey(event) {
    if (event.key === 'Escape') {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            closeModal(activeModal.id);
        }
    }
}

// Delete account
function deleteAccount() {
    const confirmation = prompt('Type "DELETE" to confirm account deletion:');
    if (confirmation === 'DELETE') {
        if (confirm('Are you absolutely sure? This action cannot be undone.')) {
            showMessage('Account deletion initiated. You will receive a confirmation email.', 'success');
        }
    }
}

// Show message
function showMessage(text, type, errorDetails) {
  console.log('showMessage called:', { text, type, errorDetails });
  if (window.addToast) {
    console.log('window.addToast is defined. Calling it now.');
    window.addToast(type, text, undefined, errorDetails);
  } else {
    console.error('window.addToast is NOT defined. Toast will not be shown.');
  }
}

// Go back to profiles page
function goBack() {
   // Ensure navigation affects the top-level window when embedded
   try {
       if (window.top && window.top !== window) {
           window.top.location.href = '/profiles';
       } else {
           window.location.href = '/profiles';
       }
   } catch (e) {
       // Accessing window.top can throw in some contexts; fallback to current window
       window.location.href = '/profiles';
   }
}

// Theme helpers: fetch themes from server, render previews, apply selection
async function fetchThemes() {
    try {
        const res = await fetch('/api/themes');
        if (!res.ok) throw new Error('Failed to fetch themes');
        return await res.json();
    } catch (e) {
        console.error('Failed to load themes', e);
        return [];
    }
}

function hexToInt(hex) {
    return parseInt(hex.replace('#', ''), 16);
}

function applyThemeObject(theme) {
    if (!theme) return;
    try { localStorage.setItem('zentrioThemeData', JSON.stringify(theme)); } catch (e) {}
    // Set CSS variables
    document.documentElement.style.setProperty('--accent', theme.accent || '#e50914');
    document.documentElement.style.setProperty('--btn-primary-bg', theme.btnPrimary || theme.accent || '#e50914');
    document.documentElement.style.setProperty('--btn-primary-bg-hover', theme.btnPrimaryHover || theme.btnPrimary || theme.accent || '#f40612');
    // Danger button colors (used by logout/delete)
    document.documentElement.style.setProperty('--btn-danger-bg', theme.btnDanger || theme.accent || '#dc3545');
    document.documentElement.style.setProperty('--btn-danger-bg-hover', theme.btnDangerHover || theme.btnDanger || theme.accent || '#c82333');
    // Use accent as a sensible default for secondary buttons when btnSecondary isn't provided
    document.documentElement.style.setProperty('--btn-secondary-bg', theme.btnSecondary || theme.accent || '#333');
    document.documentElement.style.setProperty('--text', theme.text || '#ffffff');
    document.documentElement.style.setProperty('--muted', theme.muted || '#b3b3b3');

    // Vanta variables
    if (theme.vanta) {
        document.documentElement.style.setProperty('--vanta-highlight', theme.vanta.highlight);
        document.documentElement.style.setProperty('--vanta-midtone', theme.vanta.midtone);
        document.documentElement.style.setProperty('--vanta-lowlight', theme.vanta.lowlight);
        document.documentElement.style.setProperty('--vanta-base', theme.vanta.base);
    }

    // Respect user's Vanta (animated background) preference
    const vantaPref = (function () { try { return localStorage.getItem('zentrioVanta'); } catch (e) { return null; } })();
    const vantaEnabled = (vantaPref === null) ? true : (vantaPref === 'true');

    // If disabled, destroy any existing instance and set a subtle static background
    if (!vantaEnabled) {
        if (window.__vantaSettingsInstance) {
            try { window.__vantaSettingsInstance.destroy(); } catch (e) {}
            window.__vantaSettingsInstance = null;
        }
        const vEl = document.getElementById('vanta-bg');
        if (vEl) {
            const bg = (theme && theme.vanta)
                ? `linear-gradient(180deg, ${theme.vanta.midtone} 0%, ${theme.vanta.base} 100%)`
                : 'linear-gradient(180deg, rgba(0,0,0,0.8), rgba(0,0,0,0.95))';
            vEl.style.background = bg;
            // remove any canvas injected by Vanta
            const canv = vEl.querySelector('canvas');
            if (canv) canv.remove();
        }
        return;
    }

    // Re-init Vanta to pick up new colors
    function initVanta() {
        try {
            if (!window.VANTA || !window.VANTA.FOG) return false;
            if (window.__vantaSettingsInstance) {
                try { window.__vantaSettingsInstance.destroy(); } catch (e) {}
                window.__vantaSettingsInstance = null;
            }
    
            const v = (theme.vanta || {});
            const el = document.getElementById('vanta-bg');
            if (el) el.style.background = 'transparent';
    
            window.__vantaSettingsInstance = window.VANTA.FOG({
                el: "#vanta-bg",
                mouseControls: false,
                touchControls: false,
                minHeight: 200.00,
                minWidth: 200.00,
                highlightColor: hexToInt(v.highlight || '#222222'),
                midtoneColor: hexToInt(v.midtone || '#111111'),
                lowlightColor: hexToInt(v.lowlight || '#000000'),
                baseColor: hexToInt(v.base || '#000000'),
                blurFactor: 0.90,
                speed: 0.50,
                zoom: 0.30
            });
            return true;
        } catch (e) {
            console.error('Vanta init failed', e);
            return false;
        }
    }
    
    if (!initVanta()) {
        setTimeout(initVanta, 300);
    }
}

async function applyThemeById(themeId, themes) {
    const theme = themes.find(t => t.id === themeId);
    if (!theme) return;
    try { localStorage.setItem('zentrioTheme', themeId); } catch (e) {}
    applyThemeObject(theme);
}

 // Render theme gallery previews
 function renderThemeGallery(themes, activeId) {
     const gallery = document.getElementById('themeGallery');
     const selector = document.getElementById('themeSelector');
     if (!gallery) return;
  
     gallery.innerHTML = '';
     if (selector) selector.innerHTML = '<option value="">Select theme...</option>';
  
     themes.forEach(theme => {
         // add to selector (if present)
         if (selector) {
             const opt = document.createElement('option');
             opt.value = theme.id;
             opt.textContent = theme.name || theme.id;
             selector.appendChild(opt);
         }
  
         // preview tile
         const tile = document.createElement('button');
         tile.type = 'button';
         tile.className = 'theme-tile';
         tile.setAttribute('data-theme-id', theme.id);
         tile.setAttribute('title', theme.name || theme.id);
         tile.style.cursor = 'pointer';
         tile.style.border = `1px solid rgba(255,255,255,0.06)`;
         tile.style.borderRadius = '8px';
         tile.style.padding = '8px';
         tile.style.minWidth = '120px';
         tile.style.display = 'flex';
         tile.style.flexDirection = 'column';
         tile.style.alignItems = 'stretch';
         tile.style.gap = '8px';
         tile.style.background = 'linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.06))';
         tile.style.color = 'var(--text, #fff)';
  
         // tiny preview bar: vanta -> midtone base
         const previewBar = document.createElement('div');
         previewBar.style.height = '36px';
         previewBar.style.borderRadius = '6px';
         previewBar.style.background = `linear-gradient(90deg, ${theme.vanta.midtone} 0%, ${theme.vanta.highlight} 40%, ${theme.vanta.lowlight} 100%)`;
         previewBar.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.02)';
         tile.appendChild(previewBar);
  
         // label row
         const row = document.createElement('div');
         row.style.display = 'flex';
         row.style.justifyContent = 'space-between';
         row.style.alignItems = 'center';
  
         const name = document.createElement('div');
         name.textContent = theme.name || theme.id;
         name.style.fontSize = '13px';
         name.style.color = 'var(--muted, #b3b3b3)';
         name.style.fontWeight = 600;
  
         const swatch = document.createElement('div');
         swatch.style.width = '36px';
         swatch.style.height = '20px';
         swatch.style.borderRadius = '4px';
         swatch.style.background = theme.accent || theme.btnPrimary || '#e50914';
         swatch.style.border = '1px solid rgba(0,0,0,0.2)';
  
         row.appendChild(name);
         row.appendChild(swatch);
         tile.appendChild(row);
  
         // select/apply on click
         tile.addEventListener('click', () => {
             try { localStorage.setItem('zentrioTheme', theme.id); } catch (e) {}
             applyThemeObject(theme);
             // highlight active tile
             gallery.querySelectorAll('.theme-tile').forEach(t => t.style.outline = 'none');
             tile.style.outline = `2px solid ${theme.accent || '#e50914'}`;
             if (selector) selector.value = theme.id;
         });
  
         // preview on hover (apply temporarily)
         tile.addEventListener('mouseenter', () => {
             applyThemeObject(theme);
         });
         tile.addEventListener('mouseleave', () => {
             const current = (function() { try { return localStorage.getItem('zentrioTheme') || ''; } catch (e) { return ''; } })();
             if (current) {
                 const curTheme = themes.find(t => t.id === current);
                 if (curTheme) applyThemeObject(curTheme);
             }
         });
  
         // mark active
         if (theme.id === activeId) {
             tile.style.outline = `2px solid ${theme.accent || '#e50914'}`;
         }
  
         gallery.appendChild(tile);
     });
  
     // selector change applies theme (only if selector exists)
     if (selector) {
         selector.addEventListener('change', () => {
             const id = selector.value;
             if (!id) return;
             applyThemeById(id, themes);
         });
     }
 }

// Upload handler: POST JSON to /api/themes/:id
async function uploadTheme(file) {
    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const id = parsed.id || (file.name || 'uploaded-theme').replace(/\.json$/i, '').replace(/[^a-z0-9-_]/gi, '-').toLowerCase();
        const res = await fetch(`/api/themes/${encodeURIComponent(id)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Upload failed' }));
            showMessage(err.error || 'Failed to upload theme', 'error');
            return false;
        }
        showMessage('Theme uploaded', 'success');
        return true;
    } catch (e) {
        console.error('Failed to upload theme', e);
        showMessage('Invalid theme file', 'error');
        return false;
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // Fetch themes from server and render gallery
    (async function initThemes() {
        const themes = await fetchThemes();
        let activeId = (function () { try { return localStorage.getItem('zentrioTheme') || ''; } catch (e) { return ''; } })();
    
        // If no themes found, fall back to a minimal built-in set to ensure UI works
        let loaded = themes;
        if (!loaded || loaded.length === 0) {
            loaded = [
                {
                    id: 'theme1',
                    name: 'Crimson (subtle)',
                    accent: '#e14a3b',
                    btnPrimary: '#e14a3b',
                    btnPrimaryHover: '#cf3f31',
                    text: '#eff1f3',
                    muted: '#bfc6cc',
                    vanta: { highlight: '#2a2a2a', midtone: '#161616', lowlight: '#080808', base: '#050505' }
                },
                {
                    id: 'theme2',
                    name: 'Ocean (muted)',
                    accent: '#2a8fb6',
                    btnPrimary: '#2a8fb6',
                    btnPrimaryHover: '#227aa3',
                    text: '#eaf6fb',
                    muted: '#a9cbdc',
                    vanta: { highlight: '#dff6ff', midtone: '#bfe7fb', lowlight: '#063043', base: '#02131a' }
                },
                {
                    id: 'theme3',
                    name: 'Forest (soft)',
                    accent: '#1fa07a',
                    btnPrimary: '#1fa07a',
                    btnPrimaryHover: '#178b67',
                    text: '#ecf9f3',
                    muted: '#bfe6d9',
                    vanta: { highlight: '#dff6e9', midtone: '#bfead2', lowlight: '#07321f', base: '#05150b' }
                }
            ];
        }
    
        // If no explicit stored theme, prefer the Zentrio theme when available
        if (!activeId && loaded && loaded.length > 0) {
            const zTheme = loaded.find(t => {
                if (!t) return false;
                const nid = (t.id || '').toString().toLowerCase();
                const nname = (t.name || '').toString().toLowerCase();
                return nid === 'zentrio' || nname === 'zentrio' || nname === 'zentrio theme';
            });
            if (zTheme) {
                activeId = zTheme.id;
                try { localStorage.setItem('zentrioTheme', activeId); } catch (e) {}
                // apply immediately so UI reflects it before user interaction
                applyThemeObject(zTheme);
            }
        }
    
        renderThemeGallery(loaded, activeId);
    
        // If active theme exists, apply it (unless already applied above)
        if (activeId) {
            const theme = loaded.find(t => t.id === activeId);
            if (theme) applyThemeObject(theme);
        }

        // wire Vanta toggle and persist preference
        const vantaToggle = document.getElementById('vantaToggle');
        if (vantaToggle) {
            // Set initial state
            const stored = (function () { try { return localStorage.getItem('zentrioVanta'); } catch (e) { return null; } })();
            const initialState = (stored === null) ? true : (stored === 'true');
            settings.vantaEnabled = initialState;
            vantaToggle.classList.toggle('active', initialState);

            vantaToggle.addEventListener('click', () => {
                settings.vantaEnabled = !settings.vantaEnabled;
                vantaToggle.classList.toggle('active', settings.vantaEnabled);
                try { localStorage.setItem('zentrioVanta', settings.vantaEnabled ? 'true' : 'false'); } catch (e) {}

                // reapply currently selected theme to enforce Vanta on/off
                const current = (function () { try { return localStorage.getItem('zentrioTheme') || ''; } catch (e) { return ''; } })();
                const themesRef = window.__loadedThemes || loaded;
                const theme = themesRef ? themesRef.find(t => t.id === current) : null;
                if (settings.vantaEnabled) {
                    if (theme) applyThemeObject(theme);
                } else {
                    if (window.__vantaSettingsInstance) {
                        try { window.__vantaSettingsInstance.destroy(); } catch (e) {}
                        window.__vantaSettingsInstance = null;
                    }
                    const vEl = document.getElementById('vanta-bg');
                    if (vEl) {
                        const bg = (theme && theme.vanta)
                            ? `linear-gradient(180deg, ${theme.vanta.midtone} 0%, ${theme.vanta.base} 100%)`
                            : 'linear-gradient(180deg, rgba(0,0,0,0.8), rgba(0,0,0,0.95))';
                        vEl.style.background = bg;
                        const canv = vEl.querySelector('canvas');
                        if (canv) canv.remove();
                    }
                }
            });
        }
 
    })();

    loadSettings();
    loadUserInfo();
    loadTmdbApiKey();

    // Add modal event listeners
    const emailModal = document.getElementById('emailModal');
    const passwordModal = document.getElementById('passwordModal');
    
    if (emailModal) {
        emailModal.addEventListener('click', (e) => handleModalClick(e, 'emailModal'));
    }
    if (passwordModal) {
        passwordModal.addEventListener('click', (e) => handleModalClick(e, 'passwordModal'));
    }
    
    // Add escape key listener
    document.addEventListener('keydown', handleEscapeKey);

    // Add back button listener
    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.addEventListener('click', goBack);
    }
    
    // Add toggle event listeners
    const toggles = document.querySelectorAll('.toggle');
    toggles.forEach(toggle => {
        // Skip local-only "remember me" toggle from server saves
        if (toggle.id === 'rememberMeLocalToggle') return;
        toggle.addEventListener('click', () => {
            const settingName = toggle.id.replace('Toggle', '');
            toggleSetting(settingName);
        });
    });

    // Local-only "Stay signed in" toggle wiring
    const rememberToggle = document.getElementById('rememberMeLocalToggle');
    if (rememberToggle) {
        // Initialize from localStorage
        let pref = false;
        try { pref = localStorage.getItem('zentrioRememberMe') === 'true'; } catch (e) {}
        rememberToggle.classList.toggle('active', pref);

        rememberToggle.addEventListener('click', () => {
            let cur = false;
            try { cur = localStorage.getItem('zentrioRememberMe') === 'true'; } catch (e) {}
            const next = !cur;
            try { localStorage.setItem('zentrioRememberMe', next ? 'true' : 'false'); } catch (e) {}
            rememberToggle.classList.toggle('active', next);
            if (window.showToast) {
                window.showToast('message', next ? 'Stay signed in enabled on this device' : 'Stay signed in disabled on this device');
            }
        });
    }

    // Add TMDB API key auto-save listener
    const tmdbInput = document.getElementById('tmdbApiKeyInput');
    if (tmdbInput) {
        tmdbInput.addEventListener('input', autoSaveTmdbApiKey);
        tmdbInput.addEventListener('blur', () => {
            // Save immediately when user leaves the input
            if (tmdbSaveTimeout) {
                clearTimeout(tmdbSaveTimeout);
            }
            autoSaveTmdbApiKey();
        });
    }

    // Enhance range inputs to reflect filled track with theme accent
    function updateRangeBackground(el) {
        if (!el) return;
        const min = parseFloat(el.min) || 0;
        const max = parseFloat(el.max) || 100;
        const val = parseFloat(el.value) || 0;
        const pct = ((val - min) / (max - min)) * 100;
        el.style.background = `linear-gradient(90deg, var(--accent) ${pct}%, rgba(255,255,255,0.06) ${pct}%)`;
    }
    
    const ranges = document.querySelectorAll('input[type="range"]');
    ranges.forEach(r => {
        updateRangeBackground(r);
        r.addEventListener('input', () => updateRangeBackground(r));
    });
    
    // Reapply range backgrounds when theme variables are applied
    document.addEventListener('themeApplied', () => {
        ranges.forEach(r => updateRangeBackground(r));
    });
});
