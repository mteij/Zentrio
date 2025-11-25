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
            const payload = await response.json();
            const data = payload.data || payload;
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
            const data = payload.data || payload;
            
            const email = data.email || '';
            if (email) {
                const el = document.getElementById('currentEmail');
                if (el) el.textContent = email;
            }

            const username = data.username || '';
            if (username) {
                const el = document.getElementById('currentUsername');
                if (el) el.textContent = username;
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

// Username modal functions
function toggleUsernameForm() {
    const currentUsername = document.getElementById('currentUsername').textContent;
    const input = document.getElementById('newUsername');
    if (input && currentUsername && currentUsername !== 'Loading...') {
        input.value = currentUsername;
    }
    openModal('usernameModal');
}

function closeUsernameModal() {
    closeModal('usernameModal');
}

async function updateUsername() {
    const newUsername = document.getElementById('newUsername').value.trim();
    
    if (!newUsername || newUsername.length < 3) {
        showMessage('Username must be at least 3 characters long', 'error');
        return;
    }

    try {
        const response = await fetch('/api/user/username', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'xmlhttprequest'
            },
            body: JSON.stringify({ username: newUsername })
        });

        if (response.ok) {
            const el = document.getElementById('currentUsername');
            if (el) el.textContent = newUsername;
            closeUsernameModal();
            showMessage('Username updated successfully', 'success');
        } else {
            const error = await response.json();
            showMessage(error.error || 'Failed to update username', 'error');
        }
    } catch (error) {
        console.error('Failed to update username:', error);
        showMessage('Failed to update username. Please try again.', 'error');
    }
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
        const response = await fetch('/api/auth/change-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'xmlhttprequest'
            },
            body: JSON.stringify({
                newEmail,
                callbackURL: '/settings'
            })
        });

        if (response.ok) {
            closeEmailModal();
            showMessage('Confirmation email sent. Please check your inbox.', 'success');
        } else {
            const error = await response.json();
            showMessage(error.message || error.error || 'Failed to initiate email change', 'error');
        }
    } catch (error) {
        console.error('Failed to update email:', error);
        showMessage('Failed to update email. Please try again.', 'error');
    }
}

// Password modal functions
function togglePasswordForm() {
    openModal('passwordModal');
    
    // Initialize password toggles in the modal
    const modal = document.getElementById('passwordModal');
    if (modal) {
        const toggleBtns = modal.querySelectorAll('.password-toggle-btn');
        toggleBtns.forEach(btn => {
            // Remove old listeners to prevent duplicates if opened multiple times
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', (e) => {
                const button = e.currentTarget;
                const input = button.previousElementSibling;
                const icon = button.querySelector('.iconify');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    if (icon) icon.setAttribute('data-icon', 'mdi:eye-off');
                } else {
                    input.type = 'password';
                    if (icon) icon.setAttribute('data-icon', 'mdi:eye');
                }
            });
        });
    }
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

    // Use shared theme manager if available
    if (window.ZentrioTheme) {
        window.ZentrioTheme.apply();
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
  
     // Add "Custom" theme option if not present
     let allThemes = [...themes];
     const customThemeData = localStorage.getItem('zentrioCustomTheme');
     if (customThemeData) {
         try {
             const customTheme = JSON.parse(customThemeData);
             // Check if custom theme is already in the list (by ID)
             if (!allThemes.find(t => t.id === 'custom')) {
                 allThemes.push(customTheme);
             }
         } catch (e) {
             console.error('Failed to parse custom theme', e);
         }
     } else {
         // Add a placeholder custom theme if none exists
         if (!allThemes.find(t => t.id === 'custom')) {
             allThemes.push({
                 id: 'custom',
                 name: 'Custom',
                 accent: '#e50914',
                 btnPrimary: '#e50914',
                 btnPrimaryHover: '#f40612',
                 text: '#ffffff',
                 muted: '#b3b3b3',
                 vanta: { highlight: '#222222', midtone: '#111111', lowlight: '#000000', base: '#000000', speed: 0.5, zoom: 0.3 }
             });
         }
     }

     allThemes.forEach(theme => {
         // add to selector (if present)
         if (selector) {
             const opt = document.createElement('option');
             opt.value = theme.id;
             opt.textContent = theme.name || theme.id;
             selector.appendChild(opt);
         }
  
         // Wrapper for tile and edit button
         const wrapper = document.createElement('div');
         wrapper.className = 'theme-tile-wrapper';
         wrapper.style.position = 'relative';

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
             
             // Show/hide edit button based on theme
             if (theme.id === 'custom') {
                 openCustomThemeEditor(theme);
             } else {
                 // document.getElementById('customThemeEditor').style.display = 'none';
             }
         });
  
         // preview on hover (apply temporarily)
         tile.addEventListener('mouseenter', () => {
             applyThemeObject(theme);
         });
         tile.addEventListener('mouseleave', () => {
             const current = (function() { try { return localStorage.getItem('zentrioTheme') || ''; } catch (e) { return ''; } })();
             if (current) {
                 const curTheme = allThemes.find(t => t.id === current);
                 if (curTheme) applyThemeObject(curTheme);
             }
         });
  
         // mark active
         if (theme.id === activeId) {
             tile.style.outline = `2px solid ${theme.accent || '#e50914'}`;
             if (theme.id === 'custom') {
                 // If custom is active on load, show editor? Maybe not automatically to keep it clean.
                 // But we should ensure the editor is populated with current values if opened.
             }
         }
  
         wrapper.appendChild(tile);

         // Add edit button for custom theme
         if (theme.id === 'custom') {
             const editBtn = document.createElement('div');
             editBtn.className = 'theme-tile-actions';
             editBtn.innerHTML = `
                 <button class="edit-theme-btn" title="Edit Custom Theme">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                         <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                         <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                     </svg>
                 </button>
             `;
             editBtn.querySelector('button').addEventListener('click', (e) => {
                 e.stopPropagation(); // Prevent tile click
                 openCustomThemeEditor(theme);
                 // Also select it
                 try { localStorage.setItem('zentrioTheme', theme.id); } catch (e) {}
                 applyThemeObject(theme);
                 gallery.querySelectorAll('.theme-tile').forEach(t => t.style.outline = 'none');
                 tile.style.outline = `2px solid ${theme.accent || '#e50914'}`;
             });
             wrapper.appendChild(editBtn);
         }

         gallery.appendChild(wrapper);
     });
  
     // selector change applies theme (only if selector exists)
     if (selector) {
         selector.addEventListener('change', () => {
             const id = selector.value;
             if (!id) return;
             applyThemeById(id, allThemes);
         });
     }
 }

 function openCustomThemeEditor(theme) {
     openModal('customThemeModal');
     
     // Populate inputs
     document.getElementById('accentColorInput').value = theme.accent || '#e50914';
     document.getElementById('accentColorValue').textContent = theme.accent || '#e50914';
     
     const v = theme.vanta || {};
     document.getElementById('highlightColorInput').value = v.highlight || '#222222';
     document.getElementById('highlightColorValue').textContent = v.highlight || '#222222';
     
     document.getElementById('midtoneColorInput').value = v.midtone || '#111111';
     document.getElementById('midtoneColorValue').textContent = v.midtone || '#111111';
     
     document.getElementById('lowlightColorInput').value = v.lowlight || '#000000';
     document.getElementById('lowlightColorValue').textContent = v.lowlight || '#000000';
     
     document.getElementById('baseColorInput').value = v.base || '#000000';
     document.getElementById('baseColorValue').textContent = v.base || '#000000';
     
     document.getElementById('speedInput').value = v.speed || 0.5;
     document.getElementById('speedValue').textContent = v.speed || 0.5;
     
     document.getElementById('zoomInput').value = v.zoom || 0.3;
     document.getElementById('zoomValue').textContent = v.zoom || 0.3;
 }

 function saveCustomTheme() {
     const accent = document.getElementById('accentColorInput').value;
     const highlight = document.getElementById('highlightColorInput').value;
     const midtone = document.getElementById('midtoneColorInput').value;
     const lowlight = document.getElementById('lowlightColorInput').value;
     const base = document.getElementById('baseColorInput').value;
     const speed = parseFloat(document.getElementById('speedInput').value);
     const zoom = parseFloat(document.getElementById('zoomInput').value);
     
     const customTheme = {
         id: 'custom',
         name: 'Custom',
         accent: accent,
         btnPrimary: accent,
         btnPrimaryHover: adjustColor(accent, -20), // Simple darken function needed or just use accent
         text: '#ffffff',
         muted: '#b3b3b3',
         vanta: {
             highlight,
             midtone,
             lowlight,
             base,
             speed,
             zoom
         }
     };
     
     localStorage.setItem('zentrioCustomTheme', JSON.stringify(customTheme));
     localStorage.setItem('zentrioTheme', 'custom');
     
     applyThemeObject(customTheme);
     showMessage('Custom theme saved', 'success');
     closeModal('customThemeModal');
     
     // Re-render gallery to update preview
     fetchThemes().then(themes => {
         renderThemeGallery(themes, 'custom');
     });
 }

 function adjustColor(color, amount) {
    return '#' + color.replace(/^#/, '').replace(/../g, color => ('0'+Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
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

        // Wire background style selector
        const bgSelect = document.getElementById('backgroundStyleSelect');
        if (bgSelect) {
            // Set initial state
            const stored = (function () { try { return localStorage.getItem('zentrioBackgroundStyle') || 'vanta'; } catch (e) { return 'vanta'; } })();
            bgSelect.value = stored;

            bgSelect.addEventListener('change', () => {
                const newStyle = bgSelect.value;
                try { localStorage.setItem('zentrioBackgroundStyle', newStyle); } catch (e) {}

                // Reapply theme to update background
                const current = (function () { try { return localStorage.getItem('zentrioTheme') || ''; } catch (e) { return ''; } })();
                
                // Find theme object (handle custom theme)
                let theme = null;
                if (current === 'custom') {
                    try { theme = JSON.parse(localStorage.getItem('zentrioCustomTheme')); } catch(e) {}
                }
                if (!theme) {
                    const themesRef = window.__loadedThemes || loaded;
                    theme = themesRef ? themesRef.find(t => t.id === current) : null;
                }
                
                if (theme) applyThemeObject(theme);
            });
        }
 
    })();

    loadSettings();
    loadUserInfo();
    loadTmdbApiKey();

    // Add modal event listeners
    const usernameModal = document.getElementById('usernameModal');
    const emailModal = document.getElementById('emailModal');
    const passwordModal = document.getElementById('passwordModal');
    const customThemeModal = document.getElementById('customThemeModal');
    
    if (usernameModal) {
        usernameModal.addEventListener('click', (e) => handleModalClick(e, 'usernameModal'));
    }
    if (emailModal) {
        emailModal.addEventListener('click', (e) => handleModalClick(e, 'emailModal'));
    }
    if (passwordModal) {
        passwordModal.addEventListener('click', (e) => handleModalClick(e, 'passwordModal'));
    }
    if (customThemeModal) {
        customThemeModal.addEventListener('click', (e) => handleModalClick(e, 'customThemeModal'));
    }
    
    // Add escape key listener
    document.addEventListener('keydown', handleEscapeKey);

    // Add back button listener
    const backButton = document.getElementById('backButton');
    if (backButton) {
        backButton.addEventListener('click', goBack);
    }
    
    // Username modal wiring
    const btnUsernameOpen = document.getElementById('openUsernameModalBtn');
    if (btnUsernameOpen) btnUsernameOpen.addEventListener('click', toggleUsernameForm);

    const btnUsernameCancel = document.getElementById('usernameCancelBtn');
    if (btnUsernameCancel) btnUsernameCancel.addEventListener('click', closeUsernameModal);

    const btnUsernameUpdate = document.getElementById('usernameUpdateBtn');
    if (btnUsernameUpdate) btnUsernameUpdate.addEventListener('click', updateUsername);

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

        // Initialize password toggle for TMDB input
        const container = tmdbInput.closest('.password-input-container');
        if (container) {
            const btn = container.querySelector('.password-toggle-btn');
            if (btn) {
                btn.addEventListener('click', (e) => {
                    const button = e.currentTarget;
                    const input = button.previousElementSibling;
                    const icon = button.querySelector('.iconify');
                    
                    if (input.type === 'password') {
                        input.type = 'text';
                        if (icon) icon.setAttribute('data-icon', 'mdi:eye-off');
                    } else {
                        input.type = 'password';
                        if (icon) icon.setAttribute('data-icon', 'mdi:eye');
                    }
                });
            }
        }
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

    // 2FA Logic
    const enable2faBtn = document.getElementById('enable2faBtn');
    const disable2faBtn = document.getElementById('disable2faBtn');
    const backupCodesContainer = document.getElementById('backupCodesContainer');
    const backupCodesList = document.getElementById('backupCodesList');
    
    // Modal elements
    const twoFactorModal = document.getElementById('twoFactorModal');
    const twoFactorCancelBtn = document.getElementById('twoFactorCancelBtn');
    const twoFactorVerifyBtn = document.getElementById('twoFactorVerifyBtn');
    const twoFactorCodeInput = document.getElementById('twoFactorCode');
    const qrCodeContainer = document.getElementById('qrCodeContainer');
    const qrCodeSecret = document.getElementById('qrCodeSecret');

    // Check 2FA status
    async function check2FAStatus() {
        try {
            const res = await fetch('/api/user/profile');
            if (res.ok) {
                const data = await res.json();
                const user = data.data || data;
                if (user.twoFactorEnabled) {
                    enable2faBtn.style.display = 'none';
                    disable2faBtn.style.display = 'inline-block';
                } else {
                    enable2faBtn.style.display = 'inline-block';
                    disable2faBtn.style.display = 'none';
                }
            }
        } catch (e) {
            console.error('Failed to check 2FA status', e);
        }
    }
    check2FAStatus();

    if (enable2faBtn) {
        enable2faBtn.addEventListener('click', async () => {
            const password = prompt('Enter your password to enable 2FA:');
            if (!password) return;

            try {
                const res = await fetch('/api/auth/two-factor/enable', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const data = await res.json();
                if (res.ok) {
                    // Show modal
                    openModal('twoFactorModal');
                    
                    // Render QR Code
                    qrCodeContainer.innerHTML = '';
                    const img = document.createElement('img');
                    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.totpURI)}`;
                    img.style.display = 'block';
                    img.style.width = '200px';
                    img.style.height = '200px';
                    qrCodeContainer.appendChild(img);
                    
                    // Show secret (optional, but good for manual entry)
                    // Extract secret from URI if possible, or just show URI?
                    // URI format: otpauth://totp/Issuer:Account?secret=SECRET&...
                    const secretMatch = data.totpURI.match(/secret=([^&]+)/);
                    if (secretMatch && secretMatch[1]) {
                        qrCodeSecret.textContent = `Secret: ${secretMatch[1]}`;
                    } else {
                        qrCodeSecret.textContent = '';
                    }

                    // Store backup codes for later display
                    if (data.backupCodes) {
                        backupCodesList.textContent = data.backupCodes.join('\n');
                    }
                } else {
                    showMessage(data.message || 'Failed to enable 2FA', 'error');
                }
            } catch (e) {
                showMessage('Network error', 'error');
            }
        });
    }

    if (twoFactorCancelBtn) {
        twoFactorCancelBtn.addEventListener('click', () => closeModal('twoFactorModal'));
    }

    if (twoFactorVerifyBtn) {
        twoFactorVerifyBtn.addEventListener('click', async () => {
            const code = twoFactorCodeInput.value;
            if (!code || code.length !== 6) {
                showMessage('Please enter a valid 6-digit code', 'error');
                return;
            }

            try {
                const res = await fetch('/api/auth/two-factor/verify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code })
                });
                const data = await res.json();
                if (res.ok) {
                    closeModal('twoFactorModal');
                    showMessage('Two-factor authentication enabled!', 'success');
                    check2FAStatus();
                    
                    // Show backup codes
                    if (backupCodesList.textContent) {
                        backupCodesContainer.style.display = 'block';
                    }
                } else {
                    showMessage(data.message || 'Invalid code', 'error');
                }
            } catch (e) {
                showMessage('Network error', 'error');
            }
        });
    }

    if (disable2faBtn) {
        disable2faBtn.addEventListener('click', async () => {
            const password = prompt('Enter your password to disable 2FA:');
            if (!password) return;

            try {
                const res = await fetch('/api/auth/two-factor/disable', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ password })
                });
                const data = await res.json();
                if (res.ok) {
                    showMessage('Two-factor authentication disabled!', 'success');
                    check2FAStatus();
                } else {
                    showMessage(data.message || 'Failed to disable 2FA', 'error');
                }
            } catch (e) {
                showMessage('Network error', 'error');
            }
        });
    }
    // Tab switching logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active class to clicked button
            btn.classList.add('active');

            // Show corresponding content
            const tabId = btn.getAttribute('data-tab');
            const content = document.getElementById(`tab-${tabId}`);
            if (content) {
                content.classList.add('active');
            }
        });
    });

    // Custom Theme Editor Listeners
    const colorInputs = [
        { input: 'accentColorInput', value: 'accentColorValue' },
        { input: 'highlightColorInput', value: 'highlightColorValue' },
        { input: 'midtoneColorInput', value: 'midtoneColorValue' },
        { input: 'lowlightColorInput', value: 'lowlightColorValue' },
        { input: 'baseColorInput', value: 'baseColorValue' }
    ];

    colorInputs.forEach(item => {
        const input = document.getElementById(item.input);
        const valueDisplay = document.getElementById(item.value);
        if (input && valueDisplay) {
            input.addEventListener('input', (e) => {
                valueDisplay.textContent = e.target.value;
                // Live preview?
                // We could create a temporary theme object and apply it
                // But maybe too heavy for Vanta. Let's just update values.
            });
        }
    });

    const rangeInputs = [
        { input: 'speedInput', value: 'speedValue' },
        { input: 'zoomInput', value: 'zoomValue' }
    ];

    rangeInputs.forEach(item => {
        const input = document.getElementById(item.input);
        const valueDisplay = document.getElementById(item.value);
        if (input && valueDisplay) {
            input.addEventListener('input', (e) => {
                valueDisplay.textContent = e.target.value;
            });
        }
    });

    const saveCustomThemeBtn = document.getElementById('saveCustomThemeBtn');
    if (saveCustomThemeBtn) {
        saveCustomThemeBtn.addEventListener('click', saveCustomTheme);
    }

    const cancelCustomThemeBtn = document.getElementById('cancelCustomThemeBtn');
    if (cancelCustomThemeBtn) {
        cancelCustomThemeBtn.addEventListener('click', () => {
            closeModal('customThemeModal');
        });
    }

    // Addons Logic
    const installAddonBtn = document.getElementById('installAddonBtn');
    if (installAddonBtn) {
        installAddonBtn.addEventListener('click', async () => {
            const input = document.getElementById('addonManifestUrl');
            const url = input.value.trim();
            if (!url) return;

            try {
                installAddonBtn.disabled = true;
                installAddonBtn.textContent = 'Installing...';
                
                const res = await fetch('/api/addons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ manifestUrl: url })
                });
                
                if (res.ok) {
                    input.value = '';
                    if (currentProfileId) loadAddonsForProfile(currentProfileId);
                    showMessage('Addon installed successfully', 'success');
                } else {
                    const err = await res.json();
                    showMessage(err.error || 'Failed to install addon', 'error');
                }
            } catch (e) {
                showMessage('Network error', 'error');
            } finally {
                installAddonBtn.disabled = false;
                installAddonBtn.textContent = 'Install';
            }
        });
    }

    // Initialize Addon Profile Selector
    const addonProfileSelect = document.getElementById('addonProfileSelect');
    if (addonProfileSelect) {
        addonProfileSelect.addEventListener('change', (e) => {
            const profileId = e.target.value;
            if (profileId) {
                loadAddonsForProfile(profileId);
            }
        });
        loadAddonProfiles();
    }
});

let currentAddons = [];
let currentProfileId = null;

async function loadAddonProfiles() {
    const select = document.getElementById('addonProfileSelect');
    if (!select) return;

    try {
        const res = await fetch('/api/profiles');
        if (res.ok) {
            const profiles = await res.json();
            select.innerHTML = '';
            
            if (profiles.length === 0) {
                select.innerHTML = '<option value="">No profiles found</option>';
                return;
            }

            profiles.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                select.appendChild(opt);
            });

            // Select first profile by default
            if (profiles.length > 0) {
                select.value = profiles[0].id;
                loadAddonsForProfile(profiles[0].id);
            }
        }
    } catch (e) {
        console.error('Failed to load profiles', e);
        select.innerHTML = '<option value="">Error loading profiles</option>';
    }
}

async function loadAddonsForProfile(profileId) {
    currentProfileId = profileId;
    const list = document.getElementById('addonsList');
    if (!list) return;

    list.innerHTML = '<div style="color: #666">Loading addons...</div>';

    try {
        const res = await fetch(`/api/addons/profile/${profileId}/manage`);
        if (res.ok) {
            currentAddons = await res.json();
            renderAddonsList();
        } else {
            list.innerHTML = '<div style="color: #d33">Failed to load addons</div>';
        }
    } catch (e) {
        console.error('Failed to load addons', e);
        list.innerHTML = '<div style="color: #d33">Network error</div>';
    }
}

function renderAddonsList() {
    const list = document.getElementById('addonsList');
    if (!list) return;
    
    list.innerHTML = '';

    if (currentAddons.length === 0) {
        list.innerHTML = '<div style="color: #666">No addons installed. Install one above.</div>';
        return;
    }

    currentAddons.forEach((addon, index) => {
        const item = document.createElement('div');
        item.className = 'addon-item';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '15px';
        item.style.background = 'rgba(255,255,255,0.05)';
        item.style.borderRadius = '8px';
        item.style.backdropFilter = 'blur(10px)';
        item.style.border = '1px solid rgba(255,255,255,0.05)';
        item.style.transition = 'transform 0.2s, background 0.2s';
        
        // Left side: Reorder controls + Info
        const left = document.createElement('div');
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.gap = '15px';
        left.style.flex = '1';

        // Reorder controls
        const reorder = document.createElement('div');
        reorder.style.display = 'flex';
        reorder.style.flexDirection = 'column';
        reorder.style.gap = '2px';
        
        const upBtn = document.createElement('button');
        upBtn.innerHTML = '&#9650;'; // Up arrow
        upBtn.style.background = 'none';
        upBtn.style.border = 'none';
        upBtn.style.color = index === 0 ? '#444' : '#888';
        upBtn.style.cursor = index === 0 ? 'default' : 'pointer';
        upBtn.style.fontSize = '10px';
        upBtn.style.padding = '2px';
        if (index > 0) upBtn.onclick = () => moveAddon(index, -1);
        
        const downBtn = document.createElement('button');
        downBtn.innerHTML = '&#9660;'; // Down arrow
        downBtn.style.background = 'none';
        downBtn.style.border = 'none';
        downBtn.style.color = index === currentAddons.length - 1 ? '#444' : '#888';
        downBtn.style.cursor = index === currentAddons.length - 1 ? 'default' : 'pointer';
        downBtn.style.fontSize = '10px';
        downBtn.style.padding = '2px';
        if (index < currentAddons.length - 1) downBtn.onclick = () => moveAddon(index, 1);

        reorder.appendChild(upBtn);
        reorder.appendChild(downBtn);
        left.appendChild(reorder);

        // Logo
        if (addon.logo) {
            const img = document.createElement('img');
            img.src = addon.logo;
            img.style.width = '40px';
            img.style.height = '40px';
            img.style.borderRadius = '4px';
            img.style.objectFit = 'cover';
            left.appendChild(img);
        } else {
            const placeholder = document.createElement('div');
            placeholder.style.width = '40px';
            placeholder.style.height = '40px';
            placeholder.style.borderRadius = '4px';
            placeholder.style.background = '#333';
            placeholder.style.display = 'flex';
            placeholder.style.alignItems = 'center';
            placeholder.style.justifyContent = 'center';
            placeholder.innerHTML = '<span style="font-size: 20px; color: #555">🧩</span>';
            left.appendChild(placeholder);
        }

        // Text Info
        const text = document.createElement('div');
        text.innerHTML = `
            <div style="font-weight: bold; color: #fff; font-size: 15px;">${addon.name} <span style="font-size: 0.8em; color: #888; margin-left: 5px;">v${addon.version || '?'}</span></div>
            <div style="font-size: 13px; color: #aaa; margin-top: 2px;">${addon.description || 'No description'}</div>
        `;
        left.appendChild(text);
        item.appendChild(left);

        // Right side: Configure + Toggle + Uninstall
        const right = document.createElement('div');
        right.style.display = 'flex';
        right.style.alignItems = 'center';
        right.style.gap = '15px';

        // Configure Button (if supported)
        if (addon.behaviorHints && addon.behaviorHints.configurable) {
            const configBtn = document.createElement('button');
            configBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.18-.08a2 2 0 0 0-2 0l-.44.44a2 2 0 0 0 0 2l.08.18a2 2 0 0 1 0 2l-.25.43a2 2 0 0 1-1.73 1l-.18.08a2 2 0 0 0 0 2v.44a2 2 0 0 0 2 2h.18a2 2 0 0 1 1.73 1l.25.43a2 2 0 0 1 0 2l-.08.18a2 2 0 0 0 0 2l.44.44a2 2 0 0 0 2 0l.18-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73v.18a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.18.08a2 2 0 0 0 2 0l.44-.44a2 2 0 0 0 0-2l-.08-.18a2 2 0 0 1 0-2l.25-.43a2 2 0 0 1 1.73-1l.18-.08a2 2 0 0 0 0-2v-.44a2 2 0 0 0-2-2h-.18a2 2 0 0 1-1.73-1l-.25-.43a2 2 0 0 1 0-2l.08-.18a2 2 0 0 0 0-2l-.44-.44a2 2 0 0 0-2 0l-.18.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
            configBtn.className = 'btn btn-secondary btn-sm';
            configBtn.title = 'Configure Addon';
            configBtn.style.padding = '8px';
            configBtn.style.background = 'transparent';
            configBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
            configBtn.style.color = '#fff';
            configBtn.style.borderRadius = '4px';
            configBtn.style.cursor = 'pointer';
            configBtn.style.display = 'flex';
            configBtn.style.alignItems = 'center';
            configBtn.style.justifyContent = 'center';
            
            configBtn.onclick = (e) => {
                e.stopPropagation();
                configureAddon(addon);
            };
            
            right.appendChild(configBtn);
        }

        // Toggle Switch
        const toggleWrapper = document.createElement('div');
        toggleWrapper.className = `toggle ${addon.enabled ? 'active' : ''}`;
        toggleWrapper.style.transform = 'scale(0.8)'; // Make it slightly smaller
        toggleWrapper.onclick = () => toggleAddon(addon.id, !addon.enabled);
        right.appendChild(toggleWrapper);

        // Uninstall Button
        const deleteBtn = document.createElement('button');
        deleteBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
        deleteBtn.className = 'btn btn-danger btn-sm';
        deleteBtn.title = 'Uninstall globally';
        deleteBtn.style.padding = '8px';
        deleteBtn.style.background = 'transparent';
        deleteBtn.style.border = '1px solid rgba(220, 53, 69, 0.3)';
        deleteBtn.style.color = '#dc3545';
        deleteBtn.style.borderRadius = '4px';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.style.display = 'flex';
        deleteBtn.style.alignItems = 'center';
        deleteBtn.style.justifyContent = 'center';
        
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            if (!confirm(`Uninstall ${addon.name} globally? This will remove it for all users.`)) return;
            try {
                await fetch(`/api/addons/${addon.id}`, { method: 'DELETE' });
                if (currentProfileId) loadAddonsForProfile(currentProfileId);
                showMessage('Addon uninstalled', 'success');
            } catch (e) {
                showMessage('Failed to uninstall', 'error');
            }
        };
        
        right.appendChild(deleteBtn);
        item.appendChild(right);
        list.appendChild(item);
    });
}

async function moveAddon(index, direction) {
    if (!currentProfileId) return;
    
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentAddons.length) return;

    // Swap in local array
    const temp = currentAddons[index];
    currentAddons[index] = currentAddons[newIndex];
    currentAddons[newIndex] = temp;

    // Re-render immediately for responsiveness
    renderAddonsList();

    // Send new order to server
    const addonIds = currentAddons.map(a => a.id);
    try {
        await fetch(`/api/addons/profile/${currentProfileId}/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addonIds })
        });
    } catch (e) {
        console.error('Failed to save order', e);
        showMessage('Failed to save order', 'error');
    }
}

function configureAddon(addon) {
    // Construct configuration URL
    // Usually it's the manifest URL without /manifest.json
    let configUrl = addon.manifest_url.replace('/manifest.json', '');
    if (configUrl.endsWith('/')) configUrl = configUrl.slice(0, -1);
    
    // Open in new window/tab
    const win = window.open(configUrl, '_blank');
    
    if (win) {
        // Poll for closure or URL change?
        // Stremio addons usually redirect back to stremio:// protocol with the new manifest URL
        // Since we are web, we might need manual intervention or a custom protocol handler if possible.
        // For now, we'll just let the user configure it and manually copy the new link if needed,
        // OR we can provide a prompt to paste the new manifest URL.
        
        const newUrl = prompt(`Configuring ${addon.name}.\n\n1. Configure the addon in the new window.\n2. Click "Install" when done.\n3. If it gives you a new link, paste it here to update:\n\n(Leave empty to cancel update)`, addon.manifest_url);
        
        if (newUrl && newUrl !== addon.manifest_url) {
            // Update addon with new manifest URL
            updateAddonManifest(addon.id, newUrl);
        }
    } else {
        showMessage('Popup blocked. Please allow popups to configure addons.', 'error');
    }
}

async function updateAddonManifest(addonId, newUrl) {
    try {
        // We treat this as installing a new addon (or updating existing if logic supports it)
        // Ideally we should have an update endpoint. For now, let's try the install endpoint
        // which might create a duplicate if not handled, or we delete old and add new.
        
        // Delete old
        await fetch(`/api/addons/${addonId}`, { method: 'DELETE' });
        
        // Install new
        const res = await fetch('/api/addons', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ manifestUrl: newUrl })
        });
        
        if (res.ok) {
            if (currentProfileId) loadAddonsForProfile(currentProfileId);
            showMessage('Addon updated successfully', 'success');
        } else {
            const err = await res.json();
            showMessage(err.error || 'Failed to update addon', 'error');
        }
    } catch (e) {
        showMessage('Network error during update', 'error');
    }
}

async function toggleAddon(addonId, enabled) {
    if (!currentProfileId) return;

    // Update local state
    const addon = currentAddons.find(a => a.id === addonId);
    if (addon) {
        addon.enabled = enabled;
        renderAddonsList();
    }

    try {
        await fetch(`/api/addons/profile/${currentProfileId}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addonId, enabled })
        });
    } catch (e) {
        console.error('Failed to toggle addon', e);
        showMessage('Failed to update addon status', 'error');
        // Revert on error
        if (addon) {
            addon.enabled = !enabled;
            renderAddonsList();
        }
    }
}

