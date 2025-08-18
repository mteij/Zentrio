// Client-side JavaScript for settings page functionality
// This replaces the inline script from settings.html

// Settings state
const settings = {};

// Load user settings
async function loadSettings() {
    try {
        const response = await fetch('/api/user/settings');
        if (response.ok) {
            const userSettings = await response.json();
            Object.assign(settings, userSettings);
            updateUI();
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Load user info
async function loadUserInfo() {
    try {
        const response = await fetch('/api/user/profile');
        if (response.ok) {
            const user = await response.json();
            document.getElementById('currentEmail').textContent = user.email || 'Email not available';
        } else {
            console.error('Failed to load user info: HTTP', response.status);
            document.getElementById('currentEmail').textContent = 'Error loading email';
        }
    } catch (error) {
        console.error('Failed to load user info:', error);
        document.getElementById('currentEmail').textContent = 'Error loading email';
    }
}

// Update UI with current settings
function updateUI() {
    // Update toggles
    Object.keys(settings).forEach(key => {
        const toggle = document.getElementById(`${key}Toggle`);
        if (toggle) {
            toggle.classList.toggle('active', settings[key]);
        }
    });
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
                'Content-Type': 'application/json'
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
            document.getElementById('currentEmail').textContent = newEmail;
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
function showMessage(text, type) {
    const message = document.getElementById('message');
    if (message) {
        message.textContent = text;
        message.className = `message ${type}`;
        message.style.display = 'block';
        setTimeout(() => {
            message.style.display = 'none';
        }, 5000);
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

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // VANTA fog background
    if (window.VANTA && window.VANTA.FOG) {
        window.VANTA.FOG({
            el: "#vanta-bg",
            mouseControls: false,
            touchControls: false,
            minHeight: 200.00,
            minWidth: 200.00,
            highlightColor: 0x222222,
            midtoneColor: 0x111111,
            lowlightColor: 0x000000,
            baseColor: 0x000000,
            blurFactor: 0.9,
            speed: 0.5,
            zoom: 0.7
        });
    } else {
        // fallback: try again after a short delay
        setTimeout(() => {
            if (window.VANTA && window.VANTA.FOG) {
                window.VANTA.FOG({
                    el: "#vanta-bg",
                    mouseControls: false,
                    touchControls: false,
                    minHeight: 200.00,
                    minWidth: 200.00,
                    highlightColor: 0x222222,
                    midtoneColor: 0x111111,
                    lowlightColor: 0x000000,
                    baseColor: 0x000000,
                    blurFactor: 0.9,
                    speed: 0.5,
                    zoom: 0.7
                });
            }
        }, 500);
    }

    loadSettings();
    loadUserInfo();

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
    
    // Add toggle event listeners
    const toggles = document.querySelectorAll('.toggle');
    toggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const settingName = toggle.id.replace('Toggle', '');
            toggleSetting(settingName);
        });
    });
});