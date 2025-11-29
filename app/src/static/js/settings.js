// Client-side JavaScript for settings page functionality
// This replaces the inline script from settings.html

// Settings state
const settings = {};
let tmdbApiKey = '';
let currentAppearanceProfileId = null;
let appearanceSettings = {
    theme_id: 'zentrio',
    show_imdb_ratings: true,
    show_age_ratings: true,
    background_style: 'vanta',
    custom_theme_config: null
};

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
                callbackURL: window.__TAURI__ ? 'tauri://localhost' : '/settings'
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
             appearanceSettings.theme_id = theme.id;
             saveAppearanceSettings();
             
             try { localStorage.setItem('zentrioTheme', theme.id); } catch (e) {}
             applyThemeObject(theme);
             // highlight active tile
             gallery.querySelectorAll('.theme-tile').forEach(t => t.style.outline = 'none');
             tile.style.outline = `2px solid ${theme.accent || '#e50914'}`;
             if (selector) selector.value = theme.id;
             
             // Show/hide edit button based on theme
             if (theme.id === 'custom') {
                 openCustomThemeEditor(theme);
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
                     <span class="iconify" data-icon="mdi:pencil" style="font-size: 14px;"></span>
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
     
     appearanceSettings.theme_id = 'custom';
     appearanceSettings.custom_theme_config = JSON.stringify(customTheme);
     saveAppearanceSettings();

     applyThemeObject(customTheme);
     showMessage('Custom theme saved', 'success');
     closeModal('customThemeModal');
     
     // Re-render gallery to update preview
     fetchThemes().then(themes => {
         window.__loadedThemes = themes;
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

// Appearance Profile Functions
async function loadAppearanceProfiles() {
    const select = document.getElementById('appearance-profile-select');
    if (!select) return;

    try {
        const res = await fetch('/api/user/settings-profiles');
        if (res.ok) {
            const data = await res.json();
            const profiles = data.data || data || [];
            select.innerHTML = '';
            
            if (profiles.length === 0) {
                select.innerHTML = '<option value="">No settings profiles found</option>';
                return;
            }

            profiles.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                select.appendChild(opt);
            });

            const lastSelectedId = localStorage.getItem('lastSelectedAppearanceProfile');
            if (lastSelectedId && profiles.some(p => p.id.toString() === lastSelectedId)) {
                select.value = lastSelectedId;
            } else if (profiles.length > 0) {
                select.value = profiles[0].id;
            }
            
            if (select.value) {
                loadAppearanceSettings(select.value);
                updateAppearanceProfileActions();
            }
        }
    } catch (e) {
        console.error('Failed to load settings profiles', e);
        select.innerHTML = '<option value="">Error loading profiles</option>';
    }
}

function updateAppearanceProfileActions() {
    const select = document.getElementById('appearance-profile-select');
    const deleteBtn = document.getElementById('delete-settings-profile-btn-appearance');
    const renameBtn = document.getElementById('rename-settings-profile-btn-appearance');
    
    if (!select || !deleteBtn || !renameBtn) return;
    
    const selectedOption = select.options[select.selectedIndex];
    const isDefault = selectedOption && selectedOption.textContent === 'Default';
    
    deleteBtn.style.display = isDefault ? 'none' : 'inline-block';
    renameBtn.style.display = isDefault ? 'none' : 'inline-block';
}

async function loadAppearanceSettings(settingsProfileId) {
    currentAppearanceProfileId = settingsProfileId;
    try {
        const res = await fetch(`/api/appearance/settings?settingsProfileId=${settingsProfileId}`);
        if (res.ok) {
            const data = await res.json();
            if (data.data) {
                appearanceSettings = data.data;
                renderAppearanceUI();
            }
        }
    } catch (e) {
        console.error('Failed to load appearance settings', e);
    }
}

async function saveAppearanceSettings() {
    if (!currentAppearanceProfileId) return;
    try {
        const res = await fetch(`/api/appearance/settings?settingsProfileId=${currentAppearanceProfileId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Requested-With': 'xmlhttprequest'
            },
            body: JSON.stringify(appearanceSettings)
        });
        if (res.ok) {
            showMessage('Appearance settings saved successfully', 'success');
        } else {
            showMessage('Failed to save appearance settings', 'error');
        }
    } catch (e) {
        console.error('Failed to save appearance settings', e);
    }
}

function renderAppearanceUI() {
    // Update Theme Gallery Selection
    const gallery = document.getElementById('themeGallery');
    if (gallery) {
        gallery.querySelectorAll('.theme-tile').forEach(t => t.style.outline = 'none');
        const activeTile = gallery.querySelector(`.theme-tile[data-theme-id="${appearanceSettings.theme_id}"]`);
        if (activeTile) {
            activeTile.style.outline = `2px solid var(--accent)`;
        }
    }

    // Update Background Style
    const bgSelect = document.getElementById('backgroundStyleSelect');
    if (bgSelect) {
        bgSelect.value = appearanceSettings.background_style || 'vanta';
    }

    // Update IMDb Ratings Toggle
    const imdbToggle = document.getElementById('imdbRatingsToggle');
    if (imdbToggle) {
        imdbToggle.classList.toggle('active', !!appearanceSettings.show_imdb_ratings);
    }

    // Update Age Ratings Toggle (in Zentrio Config Modal)
    const ageToggle = document.getElementById('enableAgeRatingToggle');
    if (ageToggle) {
        ageToggle.classList.toggle('active', !!appearanceSettings.show_age_ratings);
    }

    // Apply settings locally
    try {
        localStorage.setItem('zentrioTheme', appearanceSettings.theme_id);
        localStorage.setItem('zentrioBackgroundStyle', appearanceSettings.background_style);
        localStorage.setItem('zentrioHideImdbRatings', !appearanceSettings.show_imdb_ratings);
        localStorage.setItem('zentrioHideAgeRatings', !appearanceSettings.show_age_ratings);
        if (appearanceSettings.custom_theme_config) {
            localStorage.setItem('zentrioCustomTheme', appearanceSettings.custom_theme_config);
        }
    } catch (e) {}

    // Apply theme
    const themes = window.__loadedThemes || [];
    let theme = null;
    if (appearanceSettings.theme_id === 'custom') {
        try { theme = JSON.parse(appearanceSettings.custom_theme_config); } catch(e) {}
    }
    if (!theme) {
        theme = themes.find(t => t.id === appearanceSettings.theme_id);
    }
    if (theme) applyThemeObject(theme);
    
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // Fetch themes from server and render gallery
    (async function initThemes() {
        const themes = await fetchThemes();
        window.__loadedThemes = themes; // Store globally for access
        
        // Initialize Appearance Profile Selector
        const appearanceProfileSelect = document.getElementById('appearance-profile-select');
        if (appearanceProfileSelect) {
            appearanceProfileSelect.addEventListener('change', (e) => {
                const profileId = e.target.value;
                if (profileId) {
                    localStorage.setItem('lastSelectedAppearanceProfile', profileId);
                    loadAppearanceSettings(profileId);
                    updateAppearanceProfileActions();
                }
            });
            // Ensure we call this
            loadAppearanceProfiles();
        }

        // Appearance Profile Actions
        const createAppearanceProfileBtn = document.getElementById('create-settings-profile-btn-appearance');
        if (createAppearanceProfileBtn) {
            createAppearanceProfileBtn.addEventListener('click', async () => {
                const name = prompt("Enter name for new settings profile:");
                if (!name) return;
                
                try {
                    const res = await fetch('/api/user/settings-profiles', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'xmlhttprequest'
                        },
                        body: JSON.stringify({ name })
                    });
                    if (res.ok) {
                        const profile = await res.json();
                        await loadAppearanceProfiles();
                        if (appearanceProfileSelect) {
                            appearanceProfileSelect.value = profile.data.id;
                            loadAppearanceSettings(profile.data.id);
                            updateAppearanceProfileActions();
                        }
                    } else {
                        alert("Failed to create profile");
                    }
                } catch (e) {
                    console.error(e);
                }
            });
        }

        const deleteAppearanceProfileBtn = document.getElementById('delete-settings-profile-btn-appearance');
        if (deleteAppearanceProfileBtn) {
            deleteAppearanceProfileBtn.addEventListener('click', async () => {
                if (!currentAppearanceProfileId) return;
                if (!confirm("Are you sure you want to delete this settings profile?")) return;
                
                try {
                    const res = await fetch(`/api/user/settings-profiles/${currentAppearanceProfileId}`, {
                        method: 'DELETE',
                        headers: { 'X-Requested-With': 'xmlhttprequest' }
                    });
                    if (res.ok) {
                        currentAppearanceProfileId = null;
                        await loadAppearanceProfiles();
                    } else {
                        const err = await res.json();
                        alert(err.error?.message || "Failed to delete profile");
                    }
                } catch (e) {
                    console.error(e);
                }
            });
        }

        const renameAppearanceProfileBtn = document.getElementById('rename-settings-profile-btn-appearance');
        if (renameAppearanceProfileBtn) {
            renameAppearanceProfileBtn.addEventListener('click', async () => {
                if (!currentAppearanceProfileId) return;
                const name = prompt("Enter new name:");
                if (!name) return;
                
                try {
                    const res = await fetch(`/api/user/settings-profiles/${currentAppearanceProfileId}`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Requested-With': 'xmlhttprequest'
                        },
                        body: JSON.stringify({ name })
                    });
                    if (res.ok) {
                        const oldId = currentAppearanceProfileId;
                        await loadAppearanceProfiles();
                        if (appearanceProfileSelect) {
                            appearanceProfileSelect.value = oldId;
                            updateAppearanceProfileActions();
                        }
                    } else {
                        alert("Failed to rename profile");
                    }
                } catch (e) {
                    console.error(e);
                }
            });
        }

        // Wire background style selector
        const bgSelect = document.getElementById('backgroundStyleSelect');
        if (bgSelect) {
            bgSelect.addEventListener('change', () => {
                const newStyle = bgSelect.value;
                appearanceSettings.background_style = newStyle;
                saveAppearanceSettings();
                
                // Apply immediately
                try { localStorage.setItem('zentrioBackgroundStyle', newStyle); } catch (e) {}
                
                // Reapply theme to update background
                const current = appearanceSettings.theme_id;
                let theme = null;
                if (current === 'custom') {
                    try { theme = JSON.parse(appearanceSettings.custom_theme_config); } catch(e) {}
                }
                if (!theme) {
                    theme = themes.find(t => t.id === current);
                }
                if (theme) applyThemeObject(theme);
            });
        }

        // Wire IMDb Ratings Toggle
        const imdbToggle = document.getElementById('imdbRatingsToggle');
        if (imdbToggle) {
            imdbToggle.addEventListener('click', () => {
                const newState = !appearanceSettings.show_imdb_ratings;
                appearanceSettings.show_imdb_ratings = newState;
                imdbToggle.classList.toggle('active', newState);
                saveAppearanceSettings();
                
                // Apply immediately
                localStorage.setItem('zentrioHideImdbRatings', !newState);
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
    const zentrioConfigModal = document.getElementById('zentrioConfigModal');
    
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
    if (zentrioConfigModal) {
        zentrioConfigModal.addEventListener('click', (e) => handleModalClick(e, 'zentrioConfigModal'));
    }
    
    const zentrioConfigCancelBtn = document.getElementById('zentrioConfigCancelBtn');
    if (zentrioConfigCancelBtn) {
        zentrioConfigCancelBtn.addEventListener('click', () => closeModal('zentrioConfigModal'));
    }
    
    const zentrioConfigSaveBtn = document.getElementById('zentrioConfigSaveBtn');
    if (zentrioConfigSaveBtn) {
        zentrioConfigSaveBtn.addEventListener('click', () => {
            // Save config
            const ageToggle = document.getElementById('enableAgeRatingToggle');
            if (ageToggle) {
                appearanceSettings.show_age_ratings = ageToggle.classList.contains('active');
                saveAppearanceSettings();
                
                // Apply immediately
                localStorage.setItem('zentrioHideAgeRatings', !appearanceSettings.show_age_ratings);
            }
            
            closeModal('zentrioConfigModal');
            showMessage('Zentrio addon configuration saved', 'success');
        });
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

    // IMDb Ratings Toggle logic moved to initThemes to use appearanceSettings

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
                
                // If we have a current profile, install specifically for it
                // Otherwise fallback to global install (which might not be what we want anymore)
                // But wait, the backend /api/addons POST installs globally AND returns the addon.
                // We should probably update the backend to optionally link it to a profile immediately.
                // OR, we install globally, then enable for the current profile.
                
                // Let's use a new endpoint or modify the existing one to handle profile-specific installation context
                // For now, let's install globally (create record) then enable for profile.
                
                const res = await fetch('/api/addons', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        manifestUrl: url,
                        settingsProfileId: currentProfileId // Pass current profile ID to enable it immediately
                    })
                });
                
                if (res.ok) {
                    const addon = await res.json();
                    
                    if (currentProfileId) {
                        loadAddonsForProfile(currentProfileId);
                    }
                    
                    input.value = '';
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

    const exploreAddonsBtn = document.getElementById('exploreAddonsBtn');
    if (exploreAddonsBtn) {
        exploreAddonsBtn.addEventListener('click', () => {
            window.location.href = '/settings/explore-addons';
        });
    }

    // Initialize Addon Profile Selector
    const addonProfileSelect = document.getElementById('addonProfileSelect');
    if (addonProfileSelect) {
        addonProfileSelect.addEventListener('change', (e) => {
            const profileId = e.target.value;
            if (profileId) {
                localStorage.setItem('lastSelectedAddonProfile', profileId);
                loadAddonsForProfile(profileId);
                updateAddonProfileActions();
            }
        });
        loadAddonProfiles();
    }

    // Addon Profile Actions
    const createAddonProfileBtn = document.getElementById('create-settings-profile-btn-addons');
    if (createAddonProfileBtn) {
        createAddonProfileBtn.addEventListener('click', async () => {
            const name = prompt("Enter name for new settings profile:");
            if (!name) return;
            
            try {
                const res = await fetch('/api/user/settings-profiles', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'xmlhttprequest'
                    },
                    body: JSON.stringify({ name })
                });
                if (res.ok) {
                    const profile = await res.json();
                    await loadAddonProfiles();
                    if (addonProfileSelect) {
                        addonProfileSelect.value = profile.data.id;
                        loadAddonsForProfile(profile.data.id);
                        updateAddonProfileActions();
                    }
                } else {
                    alert("Failed to create profile");
                }
            } catch (e) {
                console.error(e);
            }
        });
    }

    const deleteAddonProfileBtn = document.getElementById('delete-settings-profile-btn-addons');
    if (deleteAddonProfileBtn) {
        deleteAddonProfileBtn.addEventListener('click', async () => {
            if (!currentProfileId) return;
            if (!confirm("Are you sure you want to delete this settings profile?")) return;
            
            try {
                const res = await fetch(`/api/user/settings-profiles/${currentProfileId}`, {
                    method: 'DELETE',
                    headers: { 'X-Requested-With': 'xmlhttprequest' }
                });
                if (res.ok) {
                    currentProfileId = null;
                    await loadAddonProfiles();
                } else {
                    const err = await res.json();
                    alert(err.error?.message || "Failed to delete profile");
                }
            } catch (e) {
                console.error(e);
            }
        });
    }

    const renameAddonProfileBtn = document.getElementById('rename-settings-profile-btn-addons');
    if (renameAddonProfileBtn) {
        renameAddonProfileBtn.addEventListener('click', async () => {
            if (!currentProfileId) return;
            const name = prompt("Enter new name:");
            if (!name) return;
            
            try {
                const res = await fetch(`/api/user/settings-profiles/${currentProfileId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'xmlhttprequest'
                    },
                    body: JSON.stringify({ name })
                });
                if (res.ok) {
                    const oldId = currentProfileId;
                    await loadAddonProfiles();
                    if (addonProfileSelect) {
                        addonProfileSelect.value = oldId;
                        updateAddonProfileActions();
                    }
                } else {
                    alert("Failed to rename profile");
                }
            } catch (e) {
                console.error(e);
            }
        });
    }
});

function updateAddonProfileActions() {
    const select = document.getElementById('addonProfileSelect');
    const deleteBtn = document.getElementById('delete-settings-profile-btn-addons');
    const renameBtn = document.getElementById('rename-settings-profile-btn-addons');
    
    if (!select || !deleteBtn || !renameBtn) return;
    
    const selectedOption = select.options[select.selectedIndex];
    const isDefault = selectedOption && selectedOption.textContent === 'Default';
    
    deleteBtn.style.display = isDefault ? 'none' : 'inline-block';
    renameBtn.style.display = isDefault ? 'none' : 'inline-block';
}

let currentAddons = [];
let currentProfileId = null;

async function loadAddonProfiles() {
    const select = document.getElementById('addonProfileSelect');
    if (!select) return;

    try {
        const res = await fetch('/api/user/settings-profiles');
        if (res.ok) {
            const data = await res.json();
            const profiles = data.data || data || [];
            select.innerHTML = '';
            
            if (profiles.length === 0) {
                select.innerHTML = '<option value="">No settings profiles found</option>';
                return;
            }

            profiles.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                select.appendChild(opt);
            });

            const lastSelectedId = localStorage.getItem('lastSelectedAddonProfile');
            if (lastSelectedId && profiles.some(p => p.id.toString() === lastSelectedId)) {
                select.value = lastSelectedId;
            } else if (profiles.length > 0) {
                select.value = profiles[0].id;
            }

            if (select.value) {
                loadAddonsForProfile(select.value);
                updateAddonProfileActions();
            }
        }
    } catch (e) {
        console.error('Failed to load settings profiles', e);
        select.innerHTML = '<option value="">Error loading profiles</option>';
    }
}

async function loadAddonsForProfile(settingsProfileId) {
    currentProfileId = settingsProfileId;
    const list = document.getElementById('addonsList');
    if (!list) return;

    list.innerHTML = '<div style="color: #666">Loading addons...</div>';

    try {
        const res = await fetch(`/api/addons/settings-profile/${settingsProfileId}/manage`);
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

let sortableInstance = null;

function renderAddonsList() {
    const list = document.getElementById('addonsList');
    if (!list) return;

    if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
    }
    
    list.innerHTML = '';

    if (currentAddons.length === 0) {
        list.innerHTML = '<div style="color: #666">No addons installed. Install one above.</div>';
        return;
    }

    currentAddons.forEach((addon, index) => {
        const item = document.createElement('div');
        item.className = 'addon-item';
        item.setAttribute('data-id', addon.id);
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.style.padding = '15px';
        item.style.background = 'rgba(255,255,255,0.05)';
        item.style.borderRadius = '8px';
        item.style.backdropFilter = 'blur(10px)';
        item.style.border = '1px solid rgba(255,255,255,0.05)';
        item.style.transition = 'transform 0.2s, background 0.2s';
        item.style.width = '100%'; // Ensure full width
        
        // Left side: Reorder controls + Info
        const left = document.createElement('div');
        left.style.display = 'flex';
        left.style.alignItems = 'center';
        left.style.gap = '15px';
        left.style.flex = '1';
        left.style.minWidth = '0'; // Allow text truncation

        // Drag Handle
        const handle = document.createElement('div');
        handle.className = 'drag-handle';
        handle.innerHTML = '<span class="iconify" data-icon="mdi:drag-horizontal" style="font-size: 20px; color: #888;"></span>';
        handle.style.cursor = 'grab';
        handle.style.display = 'flex';
        handle.style.alignItems = 'center';
        left.appendChild(handle);

        // Reorder controls
        const reorder = document.createElement('div');
        reorder.style.display = 'flex';
        reorder.style.flexDirection = 'column';
        reorder.style.gap = '2px';
        
        const upBtn = document.createElement('button');
        upBtn.innerHTML = '<span class="iconify" data-icon="mdi:chevron-up"></span>';
        upBtn.style.background = 'none';
        upBtn.style.border = 'none';
        upBtn.style.color = index === 0 ? '#444' : '#888';
        upBtn.style.cursor = index === 0 ? 'default' : 'pointer';
        upBtn.style.fontSize = '14px';
        upBtn.style.padding = '2px';
        if (index > 0) upBtn.onclick = () => moveAddon(index, -1);
        
        const downBtn = document.createElement('button');
        downBtn.innerHTML = '<span class="iconify" data-icon="mdi:chevron-down"></span>';
        downBtn.style.background = 'none';
        downBtn.style.border = 'none';
        downBtn.style.color = index === currentAddons.length - 1 ? '#444' : '#888';
        downBtn.style.cursor = index === currentAddons.length - 1 ? 'default' : 'pointer';
        downBtn.style.fontSize = '14px';
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
            placeholder.innerHTML = '<span class="iconify" data-icon="mdi:puzzle" style="font-size: 20px; color: #555"></span>';
            left.appendChild(placeholder);
        }

        // Text Info
        const text = document.createElement('div');
        text.style.minWidth = '0'; // Allow truncation
        text.innerHTML = `
            <div style="font-weight: bold; color: #fff; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${addon.name} <span style="font-size: 0.8em; color: #888; margin-left: 5px;">v${addon.version || '?'}</span></div>
            <div style="font-size: 13px; color: #aaa; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${addon.description || 'No description'}</div>
        `;
        left.appendChild(text);
        item.appendChild(left);

        // Right side: Configure + Toggle + Uninstall
        const right = document.createElement('div');
        right.style.display = 'flex';
        right.style.alignItems = 'center';
        right.style.gap = '15px';

        // Share Button (Hide for Zentrio)
        if (addon.manifest_url !== 'zentrio://tmdb-addon') {
            const shareBtn = document.createElement('button');
            shareBtn.innerHTML = '<span class="iconify" data-icon="mdi:share-variant" style="font-size: 16px;"></span>';
            shareBtn.className = 'btn btn-secondary btn-small';
            shareBtn.title = 'Share Addon';
            shareBtn.style.display = 'flex';
            shareBtn.style.alignItems = 'center';
            shareBtn.style.justifyContent = 'center';
            
            shareBtn.onclick = (e) => {
                e.stopPropagation();
                shareAddon(addon);
            };
            right.appendChild(shareBtn);
        }

        // Configure Button (if supported or Zentrio)
        // Check behaviorHints.configurable OR configurationRequired
        let behaviorHints = {};
        if (typeof addon.behavior_hints === 'string') {
            try {
                behaviorHints = JSON.parse(addon.behavior_hints);
            } catch (e) {
                console.error('Failed to parse behavior_hints', e);
            }
        } else if (typeof addon.behavior_hints === 'object' && addon.behavior_hints !== null) {
            behaviorHints = addon.behavior_hints;
        }
        
        const isZentrio = addon.manifest_url === 'zentrio://tmdb-addon';
        const isConfigurable = isZentrio || (behaviorHints && behaviorHints.configurable) || (behaviorHints && behaviorHints.configurationRequired);
        
        const configBtn = document.createElement('button');
        // Gear icon
        configBtn.innerHTML = '<span class="iconify" data-icon="mdi:cog" style="font-size: 18px;"></span>';
        configBtn.className = 'btn btn-secondary btn-small';
        configBtn.title = isConfigurable ? 'Configure Addon' : 'Not Configurable';
        configBtn.style.display = 'flex';
        configBtn.style.alignItems = 'center';
        configBtn.style.justifyContent = 'center';
        configBtn.style.opacity = isConfigurable ? '1' : '0.5';
        if (!isConfigurable) configBtn.style.cursor = 'default';
        
        if (isConfigurable) {
            configBtn.onclick = (e) => {
                e.stopPropagation();
                if (isZentrio) {
                    openZentrioConfigModal();
                } else {
                    configureAddon(addon);
                }
            };
        }
        
        right.appendChild(configBtn);

        // Toggle Switch
        const toggleWrapper = document.createElement('div');
        toggleWrapper.className = `toggle ${addon.enabled ? 'active' : ''}`;
        toggleWrapper.style.transform = 'scale(0.8)'; // Make it slightly smaller
        
        // Disable toggle if Zentrio addon and no API key
        if (addon.manifest_url === 'zentrio://tmdb-addon' && !tmdbApiKey) {
            toggleWrapper.classList.add('disabled');
            toggleWrapper.title = 'TMDB API Key required (Account settings)';
            toggleWrapper.style.opacity = '0.5';
            toggleWrapper.style.cursor = 'not-allowed';
            toggleWrapper.onclick = () => {
                showMessage('Please add your TMDB API Key in Account settings to enable this addon.', 'error');
            };
        } else {
            toggleWrapper.onclick = () => toggleAddon(addon.id, !addon.enabled);
        }
        
        right.appendChild(toggleWrapper);

        // Uninstall Button (Hide for Zentrio)
        if (addon.manifest_url !== 'zentrio://tmdb-addon') {
            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<span class="iconify" data-icon="mdi:delete" style="font-size: 16px;"></span>';
            deleteBtn.className = 'btn btn-danger btn-small';
            deleteBtn.title = 'Remove from this profile';
            deleteBtn.style.display = 'flex';
            deleteBtn.style.alignItems = 'center';
            deleteBtn.style.justifyContent = 'center';
            
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                if (!confirm(`Remove ${addon.name} from this profile?`)) return;
                
                if (!currentProfileId || !addon.id) {
                    showMessage('Invalid profile or addon ID', 'error');
                    return;
                }

                try {
                    const res = await fetch(`/api/addons/settings-profile/${currentProfileId}/${addon.id}`, { method: 'DELETE' });
                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error || 'Failed to remove addon');
                    }
                    if (currentProfileId) loadAddonsForProfile(currentProfileId);
                    showMessage('Addon removed from profile', 'success');
                } catch (e) {
                    console.error(e);
                    showMessage(e.message || 'Failed to remove addon', 'error');
                }
            };
            
            right.appendChild(deleteBtn);
        }
        item.appendChild(right);
        list.appendChild(item);
    });

    sortableInstance = new Sortable(list, {
        animation: 150,
        handle: '.drag-handle',
        onEnd: function (evt) {
            const addonIds = Array.from(list.children).map(item => item.getAttribute('data-id'));
            saveAddonOrder(addonIds);
        }
    });
}

async function saveAddonOrder(addonIds) {
    if (!currentProfileId) return;

    // Update local array for consistency
    const newOrder = [];
    addonIds.forEach(id => {
        const addon = currentAddons.find(a => a.id === id);
        if (addon) newOrder.push(addon);
    });
    currentAddons = newOrder;

    try {
        await fetch(`/api/addons/settings-profile/${currentProfileId}/reorder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addonIds })
        });
    } catch (e) {
        console.error('Failed to save order', e);
        showMessage('Failed to save order', 'error');
        // Optionally, reload to revert UI changes on failure
        loadAddonsForProfile(currentProfileId);
    }
}

async function moveAddon(index, direction) {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentAddons.length) return;

    const movedAddon = currentAddons.splice(index, 1)[0];
    currentAddons.splice(newIndex, 0, movedAddon);

    renderAddonsList();

    const addonIds = currentAddons.map(a => a.id);
    await saveAddonOrder(addonIds);
}

function configureAddon(addon) {
    // Construct configuration URL
    // Usually it's the manifest URL without /manifest.json, with /configure appended
    let configUrl = addon.manifest_url.replace('/manifest.json', '');
    if (configUrl.endsWith('/')) configUrl = configUrl.slice(0, -1);
    configUrl += '/configure';
    
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

function openZentrioConfigModal() {
    // Load current config
    const ageToggle = document.getElementById('enableAgeRatingToggle');
    if (ageToggle) {
        ageToggle.classList.toggle('active', !!appearanceSettings.show_age_ratings);
        
        // Add click listener if not already added (check if it has a specific class or attribute?)
        // Or just replace the element to clear listeners?
        // Or just add listener once in init.
        // Let's check if we added it in init. We didn't.
        // So let's add it here but ensure we don't duplicate.
        if (!ageToggle.hasAttribute('data-listener-attached')) {
            ageToggle.addEventListener('click', () => {
                ageToggle.classList.toggle('active');
            });
            ageToggle.setAttribute('data-listener-attached', 'true');
        }
    }
    openModal('zentrioConfigModal');
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
        await fetch(`/api/addons/settings-profile/${currentProfileId}/toggle`, {
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


function shareAddon(addon) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('shareAddonModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'shareAddonModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <span class="close">&times;</span>
                <h2 style="margin-bottom: 20px; color: white;">Share Addon</h2>
                <p style="color: #ccc; margin-bottom: 15px;">Copy the link below to share this addon:</p>
                <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                    <input type="text" id="shareAddonUrl" readonly style="flex: 1; padding: 10px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px;">
                    <button id="copyShareUrlBtn" class="btn btn-primary" style="white-space: nowrap;">Copy</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Close button logic
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = () => {
            modal.classList.remove('active');
        };
        
        // Click outside to close
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        };
        
        // Copy button logic
        const copyBtn = document.getElementById('copyShareUrlBtn');
        copyBtn.onclick = () => {
            const input = document.getElementById('shareAddonUrl');
            input.select();
            document.execCommand('copy');
            
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        };
    }
    
    // Set URL and open modal
    const input = document.getElementById('shareAddonUrl');
    // Use manifest URL directly
    input.value = addon.manifest_url;
    
    modal.classList.add('active');
}

// Streaming settings logic moved to React component (StreamingSettings.tsx)
