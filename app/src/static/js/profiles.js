// Client-side JavaScript for profiles page functionality
// This replaces the massive inline script from profiles.html

let profiles = [];
let settingsProfiles = [];
let editingProfileId = null;
let currentAvatarSeed = '';

// DOM elements
const profilesGrid = document.getElementById('profilesGrid');
const profileModal = document.getElementById('profileModal');
const profileForm = document.getElementById('profileForm');
const modalTitle = document.getElementById('modalTitle');
const avatarPreview = document.getElementById('avatarPreview');
const modalMessage = document.getElementById('modalMessage');
const logoutBtn = document.getElementById('logoutBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const ageRatingGroup = document.getElementById('ageRatingGroup');
const ageRatingInput = document.getElementById('ageRatingInput');
const editModeBtn = document.getElementById('editModeBtn');
const createProfileBtn = document.getElementById('createProfileBtn');
const deleteProfileBtn = document.getElementById('deleteProfileBtn');

// UI state
let editMode = false;

// Load profiles from server (enhanced with better error handling)
async function loadProfiles() {
    try {
        const [profilesRes, settingsRes] = await Promise.all([
            fetch('/api/profiles'),
            fetch('/api/user/settings-profiles')
        ]);

        if (!profilesRes.ok) {
            const errorData = await profilesRes.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to load profiles: ${profilesRes.status} ${profilesRes.statusText}`);
        }
        profiles = await profilesRes.json();
        
        if (settingsRes.ok) {
            const data = await settingsRes.json();
            settingsProfiles = data.data || data || [];
        }

        renderProfiles();

        // Auto-open create profile modal if no profiles exist
        if (profiles.length === 0) {
            if (profileModal && profileModal.style.display !== 'block') {
                createProfile();
            }
        }
    } catch (error) {
        console.error('Failed to load profiles:', error);
        showMessage('Failed to load profiles. Please refresh the page.', 'error');
    }
}

function populateSettingsProfiles(selectedId = null) {
    const select = document.getElementById('settingsProfileInput');
    if (!select) return;
    
    select.innerHTML = '';
    settingsProfiles.forEach(sp => {
        const opt = document.createElement('option');
        opt.value = sp.id;
        opt.textContent = sp.name;
        if (selectedId && String(sp.id) === String(selectedId)) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });

    // Add "Create New Profile" option
    const createOpt = document.createElement('option');
    createOpt.value = 'create_new';
    createOpt.textContent = '+ Create New Profile';
    createOpt.style.fontWeight = 'bold';
    createOpt.style.color = 'var(--accent)';
    select.appendChild(createOpt);
    
    // If no selection and we have profiles, select the first one (usually Default)
    if (!selectedId && settingsProfiles.length > 0) {
        select.value = settingsProfiles[0].id;
    }

    // Add change listener for creation
    select.onchange = async (e) => {
        if (e.target.value === 'create_new') {
            const name = prompt("Enter name for new settings profile:");
            if (name) {
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
                        // Refresh settings profiles list
                        const settingsRes = await fetch('/api/user/settings-profiles');
                        if (settingsRes.ok) {
                            const data = await settingsRes.json();
                            settingsProfiles = data.data || data || [];
                            populateSettingsProfiles(profile.data.id);
                        }
                    } else {
                        alert("Failed to create profile");
                        // Revert selection
                        select.value = settingsProfiles[0]?.id || '';
                    }
                } catch (err) {
                    console.error(err);
                    alert("Error creating profile");
                    select.value = settingsProfiles[0]?.id || '';
                }
            } else {
                // Revert selection if cancelled
                select.value = settingsProfiles[0]?.id || '';
            }
        }
    };
}

// Load TMDB API key
async function loadTmdbApiKey() {
    try {
        const response = await fetch('/api/user/tmdb-api-key');
        if (response.ok) {
            const data = await response.json();
            const tmdbApiKey = data.tmdb_api_key || '';
            
            // Show/hide age rating group based on TMDB API key
            if (ageRatingGroup) {
                ageRatingGroup.style.display = tmdbApiKey ? 'block' : 'none';
            }
            
            // If no TMDB API key, set age rating to 18 (disabled)
            if (!tmdbApiKey && ageRatingInput) {
                ageRatingInput.value = '18';
            }
        }
    } catch (error) {
        console.error('Failed to load TMDB API key:', error);
        // Hide age rating group on error
        if (ageRatingGroup) {
            ageRatingGroup.style.display = 'none';
        }
    }
}

// Render profiles grid
function renderProfiles() {
    profilesGrid.innerHTML = '';

    // Add existing profiles
    profiles.forEach(profile => {
        const profileCard = document.createElement('div');
        profileCard.className = 'profile-card';
        profileCard.innerHTML = `
            <div class="profile-avatar">
                <div id="avatar-${profile.id}"></div>
            </div>
            <div class="profile-name">${profile.name}</div>
            ${profile.isDefault ? '<div class="profile-status">Default</div>' : ''}
        `;
        profileCard.addEventListener('click', () => {
            if (editMode) {
                editProfile(String(profile.id));
            } else {
                selectProfile(profile);
            }
        });
        profilesGrid.appendChild(profileCard);

        // Load avatar
        loadAvatar(profile.avatar, `avatar-${profile.id}`);
    });

    // Toggle visibility of Edit Mode availability (Add Profile button only shown in edit mode)
    if (editModeBtn) {
        editModeBtn.disabled = profiles.length === 0;
        if (profiles.length === 0 && editMode) {
            // Auto-disable edit mode if no profiles exist
            editMode = false;
            editModeBtn.setAttribute('aria-pressed', 'false');
            editModeBtn.classList.remove('active');
            // reflect visual state (icon, title, hidden buttons)
            updateEditModeUI();
        }
    }
}

// Load avatar from server
async function loadAvatar(seed, containerId) {
    try {
        // Get current theme colors to pass to avatar generator
        let colors = '';
        try {
            const themeData = localStorage.getItem('zentrioThemeData');
            if (themeData) {
                const theme = JSON.parse(themeData);
                // Create a palette from theme colors
                const palette = [
                    theme.accent || '#e50914',
                    theme.vanta?.highlight || '#222222',
                    theme.vanta?.midtone || '#111111',
                    theme.vanta?.base || '#000000',
                    theme.text || '#ffffff'
                ];
                colors = `?colors=${palette.map(c => encodeURIComponent(c)).join(',')}`;
            }
        } catch (e) {}

        const response = await fetch(`/api/avatar/${encodeURIComponent(seed)}${colors}`);
        if (response.ok) {
            const svg = await response.text();
            document.getElementById(containerId).innerHTML = svg;
        }
    } catch (error) {
        console.error('Failed to load avatar:', error);
    }
}

// Create new profile
function createProfile() {
    editingProfileId = null;
    modalTitle.textContent = 'Create New Profile';
    profileForm.reset();
    
    ageRatingInput.value = '18';
    populateSettingsProfiles();
    
    if (deleteProfileBtn) deleteProfileBtn.style.display = 'none';

    generateNewAvatar();
    profileModal.style.display = 'block';
}

// Edit existing profile
function editProfile(profileId) {
    // Convert profileId to number for comparison
    const numericProfileId = parseInt(profileId);
    const profile = profiles.find(p => p.id === numericProfileId);
    if (!profile) {
        console.error('Profile not found:', profileId, profiles);
        return;
    }

    editingProfileId = numericProfileId;
    modalTitle.textContent = 'Edit Profile';

    document.getElementById('profileName').value = profile.name;

    const initialAge = (profile.nsfw_filter_enabled === false ? 18 : (profile.nsfw_age_rating || 18));
    ageRatingInput.value = String(initialAge);
    
    populateSettingsProfiles(profile.settings_profile_id);

    currentAvatarSeed = profile.avatar;
    updateAvatarPreview(profile.avatar);

    if (deleteProfileBtn) deleteProfileBtn.style.display = 'inline-flex';

    profileModal.style.display = 'block';
}

// Initialize password toggles
function initPasswordToggles() {
    const toggleBtns = profileModal.querySelectorAll('.password-toggle-btn');
    toggleBtns.forEach(btn => {
        // Remove old listeners to prevent duplicates
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

// Delete profile (enhanced with better error handling)
async function deleteProfile(profileId) {
    if (!confirm('Are you sure you want to delete this profile?')) return;
    
    try {
        showMessage('Deleting profile...', 'info');
        
        // Convert profileId to number
        const numericProfileId = parseInt(profileId);
        const response = await fetch(`/api/profiles/${numericProfileId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to delete profile: ${response.status} ${response.statusText}`);
        }
        
        profileModal.style.display = 'none';
        await loadProfiles();
        showMessage('Profile deleted successfully', 'success');
    } catch (error) {
        console.error('Profile delete error:', error);
        showMessage(error.message, 'error');
    }
}

// Select profile and redirect to the session page
function selectProfile(profile) {
    // Store the selected profile to be used on the session page if needed
    localStorage.setItem('selectedProfile', JSON.stringify(profile));

    // Redirect to the native streaming page
    window.location.href = `/streaming/${profile.id}`;
}

// Update avatar preview
async function updateAvatarPreview(seed = null) {
    const profileName = document.getElementById('profileName').value;
    const avatarSeed = seed || currentAvatarSeed || profileName || 'default';
    
    try {
        // Get current theme colors
        let colors = '';
        try {
            const themeData = localStorage.getItem('zentrioThemeData');
            if (themeData) {
                const theme = JSON.parse(themeData);
                const palette = [
                    theme.accent || '#e50914',
                    theme.vanta?.highlight || '#222222',
                    theme.vanta?.midtone || '#111111',
                    theme.vanta?.base || '#000000',
                    theme.text || '#ffffff'
                ];
                colors = `?colors=${palette.map(c => encodeURIComponent(c)).join(',')}`;
            }
        } catch (e) {}

        const response = await fetch(`/api/avatar/${encodeURIComponent(avatarSeed)}${colors}`);
        if (response.ok) {
            const svg = await response.text();
            avatarPreview.innerHTML = svg;
            currentAvatarSeed = avatarSeed;
        }
    } catch (error) {
        console.error('Failed to update avatar preview:', error);
    }
}

// Generate new random avatar
async function generateNewAvatar() {
    try {
        // Get current theme colors
        let colors = '';
        try {
            const themeData = localStorage.getItem('zentrioThemeData');
            if (themeData) {
                const theme = JSON.parse(themeData);
                const palette = [
                    theme.accent || '#e50914',
                    theme.vanta?.highlight || '#222222',
                    theme.vanta?.midtone || '#111111',
                    theme.vanta?.base || '#000000',
                    theme.text || '#ffffff'
                ];
                colors = `?colors=${palette.map(c => encodeURIComponent(c)).join(',')}`;
            }
        } catch (e) {}

        const response = await fetch(`/api/avatar/random${colors}`);
        if (response.ok) {
            const data = await response.json();
            currentAvatarSeed = data.seed;
            avatarPreview.innerHTML = data.svg;
        }
    } catch (error) {
        console.error('Failed to generate new avatar:', error);
        // Fallback to name-based seed
        const profileName = document.getElementById('profileName').value || 'default';
        updateAvatarPreview(profileName);
    }
}

// Show message (enhanced with better styling and longer display for info messages)
function showMessage(text, type) {
    if (modalMessage) {
        modalMessage.textContent = text;
        modalMessage.className = `message ${type}`;
        modalMessage.style.display = 'block';
        
        // Show info messages longer for loading states
        const timeout = type === 'info' ? 5000 : 3000;
        setTimeout(() => {
            modalMessage.style.display = 'none';
        }, timeout);
    }
}

// Initialize page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadProfiles();
    loadTmdbApiKey();
    
    // Handle form submission (enhanced with better error handling and loading states)
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const saveBtn = document.getElementById('saveProfileBtn');
            const originalText = saveBtn.textContent;
            
            try {
                // Show loading state
                saveBtn.textContent = 'Saving...';
                saveBtn.disabled = true;
                
                const selectedAgeRaw = parseInt(ageRatingInput.value || '18', 10);
                const selectedAge = isNaN(selectedAgeRaw) ? 18 : selectedAgeRaw;
                const settingsProfileId = document.getElementById('settingsProfileInput').value;
                const formData = {
                    name: document.getElementById('profileName').value,
                    avatar: currentAvatarSeed || document.getElementById('profileName').value,
                    nsfwFilterEnabled: selectedAge < 18,
                    ageRating: selectedAge,
                    heroBannerEnabled: true,
                    settingsProfileId: settingsProfileId ? parseInt(settingsProfileId) : undefined
                };
                
                const url = editingProfileId ? `/api/profiles/${editingProfileId}` : '/api/profiles';
                const method = editingProfileId ? 'PUT' : 'POST';
                
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `Failed to save profile: ${response.status} ${response.statusText}`);
                }
                
                profileModal.style.display = 'none';
                await loadProfiles();
                showMessage(editingProfileId ? 'Profile updated successfully' : 'Profile created successfully', 'success');
                
            } catch (error) {
                console.error('Profile save error:', error);
                showMessage(error.message, 'error');
            } finally {
                // Reset button state
                saveBtn.textContent = originalText;
                saveBtn.disabled = false;
            }
        });
    }

    // Shuffle button
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', async () => {
            try {
                // Get current theme colors
                let colors = '';
                try {
                    const themeData = localStorage.getItem('zentrioThemeData');
                    if (themeData) {
                        const theme = JSON.parse(themeData);
                        const palette = [
                            theme.accent || '#e50914',
                            theme.vanta?.highlight || '#222222',
                            theme.vanta?.midtone || '#111111',
                            theme.vanta?.base || '#000000',
                            theme.text || '#ffffff'
                        ];
                        colors = `?colors=${palette.map(c => encodeURIComponent(c)).join(',')}`;
                    }
                } catch (e) {}

                const response = await fetch(`/api/avatar/random${colors}`);
                if (response.ok) {
                    const data = await response.json();
                    currentAvatarSeed = data.seed;
                    avatarPreview.innerHTML = data.svg;
                }
            } catch (error) {
                console.error('Failed to shuffle avatar:', error);
            }
        });
    }

    // Handle profile name input for avatar preview
    const profileNameInput = document.getElementById('profileName');
    if (profileNameInput) {
        profileNameInput.addEventListener('input', () => {
            if (!currentAvatarSeed) {
                updateAvatarPreview();
            }
        });
    }


    // Handle modal close
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            profileModal.style.display = 'none';
        });
    }

    // Handle logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to logout?')) return;
            logoutBtn.disabled = true;
            try {
                await fetch('/api/auth/sign-out', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin'
                });
            } catch (e) {
                console.error('Logout request failed:', e);
            } finally {
                try { localStorage.removeItem('selectedProfile'); } catch {}
                window.location.href = '/';
            }
        });
    }
    
    
    // Handle settings button (navigate to settings). Added for non-hydrated pages.
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            window.location.href = '/settings';
        });
    }
    
    // Edit mode toggle
    if (editModeBtn) {
        editModeBtn.addEventListener('click', () => {
            editMode = !editMode;
            editModeBtn.setAttribute('aria-pressed', String(editMode));
            editModeBtn.classList.toggle('active', editMode);

            // Update UI for edit mode
            updateEditModeUI();
        });
    }
    // Ensure the button shows the correct icon/state on initial load
    updateEditModeUI();

    // Create profile button (visible only when no profiles or when in edit mode)
    if (createProfileBtn) {
        createProfileBtn.addEventListener('click', createProfile);
    }

    // Delete profile from inside the modal (only visible while editing)
    if (deleteProfileBtn) {
        deleteProfileBtn.addEventListener('click', () => {
            if (editingProfileId != null) {
                deleteProfile(String(editingProfileId));
            }
        });
    }

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === profileModal) {
            profileModal.style.display = 'none';
        }
    });

});
// Update UI for edit mode
function updateEditModeUI() {
    const sectionTitle = document.getElementById('sectionTitle');
    const footerButtons = document.getElementById('footerButtons');

    if (sectionTitle) {
        sectionTitle.textContent = editMode ? 'Select profile to edit:' : 'Who\'s watching?';
    }

    if (footerButtons) {
        const buttons = footerButtons.querySelectorAll('button:not(#editModeBtn):not(#createProfileBtn)');
        buttons.forEach(button => {
            button.style.display = editMode ? 'none' : 'inline-flex';
        });


        // Show/hide the create profile button when toggling edit mode
        if (createProfileBtn) {
            // Only show Add Profile button while in edit mode
            createProfileBtn.style.display = editMode ? 'inline-flex' : 'none';
        }
    }

    // Update the editMode button icon + accessible labels to indicate "leave edit mode"
    if (editModeBtn) {
        // Pencil icon (default)
        const pencilIcon = '<i data-lucide="edit" style="width: 20px; height: 20px;"></i>';

        // Close / back icon (X)
        const closeIcon = '<i data-lucide="x" style="width: 20px; height: 20px;"></i>';

        // Apply icon and titles
        editModeBtn.innerHTML = editMode ? closeIcon : pencilIcon;
        editModeBtn.setAttribute('title', editMode ? 'Exit edit mode' : 'Edit mode');
        editModeBtn.setAttribute('aria-label', editMode ? 'Exit edit mode' : 'Toggle edit mode');
        
        // Re-initialize Lucide icons
        if (typeof window.lucide !== 'undefined' && window.lucide.createIcons) {
            window.lucide.createIcons();
        }
    }
}
// Initialize Vanta background (load themes from server and respect local preferences)
(function initVantaExternal() {
    async function startVanta() {
        try {
            // Load server-provided themes (if available)
            let themes = [];
            try {
                const res = await fetch('/api/themes');
                if (res.ok) themes = await res.json();
            } catch (e) {
                // ignore and fall back
            }
            window.__loadedThemes = themes;
    
            // Determine selected theme id (prefer localStorage)
            let storedThemeId = (function () { try { return localStorage.getItem('zentrioTheme') || (themes[0] && themes[0].id) || null; } catch (e) { return null; } })();
            
            // Check for custom theme
            let selectedTheme = null;
            if (storedThemeId === 'custom') {
                try {
                    const customData = localStorage.getItem('zentrioCustomTheme');
                    if (customData) selectedTheme = JSON.parse(customData);
                } catch(e) {}
            }
            
            if (!selectedTheme && themes && themes.length > 0) {
                selectedTheme = themes.find(t => t.id === storedThemeId) || themes[0];
            }
    
            // Apply selected theme CSS variables so buttons, text and other components pick up colors
            if (selectedTheme) {
                try {
                    try { localStorage.setItem('zentrioThemeData', JSON.stringify(selectedTheme)); } catch (e) {}
                    document.documentElement.style.setProperty('--accent', selectedTheme.accent || '#e50914');
                    document.documentElement.style.setProperty('--btn-primary-bg', selectedTheme.btnPrimary || selectedTheme.accent || '#e50914');
                    document.documentElement.style.setProperty('--btn-primary-bg-hover', selectedTheme.btnPrimaryHover || selectedTheme.btnPrimary || selectedTheme.accent || '#f40612');
                    document.documentElement.style.setProperty('--btn-secondary-bg', selectedTheme.btnSecondary || '#333');
                    document.documentElement.style.setProperty('--text', selectedTheme.text || '#ffffff');
                    document.documentElement.style.setProperty('--muted', selectedTheme.muted || '#b3b3b3');
    
                    if (selectedTheme.vanta) {
                        document.documentElement.style.setProperty('--vanta-highlight', selectedTheme.vanta.highlight);
                        document.documentElement.style.setProperty('--vanta-midtone', selectedTheme.vanta.midtone);
                        document.documentElement.style.setProperty('--vanta-lowlight', selectedTheme.vanta.lowlight);
                        document.documentElement.style.setProperty('--vanta-base', selectedTheme.vanta.base);
                    }
                } catch (e) { /* silent */ }
            }

            // Use shared theme manager
            if (window.ZentrioTheme) {
                window.ZentrioTheme.apply();
            }
        } catch (e) {
            console.error('Vanta init failed', e);
        }
    }

    // start after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startVanta);
    } else {
        startVanta();
    }
})();
