// Client-side JavaScript for profiles page functionality
// This replaces the massive inline script from profiles.html

let profiles = [];
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
const nsfwFilterEnabledToggle = document.getElementById('nsfwFilterEnabledToggle');
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
        const response = await fetch('/api/profiles');
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Failed to load profiles: ${response.status} ${response.statusText}`);
        }
        profiles = await response.json();
        renderProfiles();
    } catch (error) {
        console.error('Failed to load profiles:', error);
        showMessage('Failed to load profiles. Please refresh the page.', 'error');
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

    // Toggle visibility of Create Profile button and Edit Mode availability
    if (createProfileBtn) {
        createProfileBtn.style.display = profiles.length === 0 ? 'inline-flex' : 'none';
    }
    if (editModeBtn) {
        editModeBtn.disabled = profiles.length === 0;
        if (profiles.length === 0 && editMode) {
            // Auto-disable edit mode if no profiles exist
            editMode = false;
            editModeBtn.setAttribute('aria-pressed', 'false');
            editModeBtn.classList.remove('active');
        }
    }
}

// Load avatar from server
async function loadAvatar(seed, containerId) {
    try {
        const response = await fetch(`/api/avatar/${encodeURIComponent(seed)}`);
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
    const passwordInput = document.getElementById('stremioPassword');
    passwordInput.placeholder = 'Enter Stremio password';
    passwordInput.required = true;

    nsfwFilterEnabledToggle.classList.remove('active');
    ageRatingGroup.style.display = 'none';
    ageRatingInput.value = 0;

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
    document.getElementById('stremioEmail').value = profile.stremio_email || '';

    const passwordInput = document.getElementById('stremioPassword');
    passwordInput.value = '';
    passwordInput.placeholder = 'Leave blank to keep current password';
    passwordInput.required = false;

    const nsfwEnabled = profile.nsfw_filter_enabled || false;
    nsfwFilterEnabledToggle.classList.toggle('active', nsfwEnabled);
    ageRatingGroup.style.display = nsfwEnabled ? 'block' : 'none';
    ageRatingInput.value = profile.nsfw_age_rating || 0;

    currentAvatarSeed = profile.avatar;
    updateAvatarPreview(profile.avatar);

    if (deleteProfileBtn) deleteProfileBtn.style.display = 'inline-flex';

    profileModal.style.display = 'block';
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

    // Redirect to the session page, which will handle loading Stremio
    window.location.href = `/session/${profile.id}`;
}

// Update avatar preview
async function updateAvatarPreview(seed = null) {
    const profileName = document.getElementById('profileName').value;
    const avatarSeed = seed || currentAvatarSeed || profileName || 'default';
    
    try {
        const response = await fetch(`/api/avatar/${encodeURIComponent(avatarSeed)}`);
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
        const response = await fetch('/api/avatar/random');
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
                
                const formData = {
                    name: document.getElementById('profileName').value,
                    avatar: currentAvatarSeed || document.getElementById('profileName').value,
                    stremioEmail: document.getElementById('stremioEmail').value,
                    stremioPassword: document.getElementById('stremioPassword').value,
                    nsfwFilterEnabled: nsfwFilterEnabledToggle.classList.contains('active'),
                    ageRating: parseInt(ageRatingInput.value, 10)
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
                const response = await fetch('/api/avatar/random');
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
                await fetch('/api/auth/logout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'same-origin'
                });
            } catch (e) {
                console.error('Logout request failed:', e);
            } finally {
                try { localStorage.removeItem('selectedProfile'); } catch {}
                try { localStorage.removeItem('stremioSessionToken'); } catch {}
                window.location.href = '/';
            }
        });
    }
    
    // Handle downloads button
    const downloadsBtn = document.getElementById('downloadsBtn');
    if (downloadsBtn) {
        downloadsBtn.addEventListener('click', () => {
            alert('Downloads feature coming soon!');
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

    // NSFW toggle handler
    if (nsfwFilterEnabledToggle) {
        nsfwFilterEnabledToggle.addEventListener('click', () => {
            nsfwFilterEnabledToggle.classList.toggle('active');
            const isEnabled = nsfwFilterEnabledToggle.classList.contains('active');
            ageRatingGroup.style.display = isEnabled ? 'block' : 'none';
        });
    }
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
            createProfileBtn.style.display = editMode ? 'inline-flex' : (profiles.length === 0 ? 'inline-flex' : 'none');
        }
    }
}