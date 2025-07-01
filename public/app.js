// app.js

// --- Firebase Imports ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signOut,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    addDoc,
    getDocs,
    getDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Import Iframe Automation Module ---
import { executeStremioLoginAutomation } from "./iframe-automations/loginAutomation.js";


// --- Firebase Configuration ---
const firebaseConfig = __FIREBASE_CONFIG__;

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM Elements ---
const authScreen = document.getElementById('auth-screen');
const profileScreen = document.getElementById('profile-screen');
const splitScreenView = document.getElementById('split-screen-view');
const backToProfilesBtn = document.getElementById('back-to-profiles-btn');
const stremioIframe = document.getElementById('stremio-iframe');

const logoutBtn = document.getElementById('logout-btn');
const emailInput = document.getElementById('email');
const emailSigninBtn = document.getElementById('email-signin-btn');
const notificationContainer = document.getElementById('notification-container');

const profilesGrid = document.getElementById('profiles-grid');
const addProfileBtn = document.getElementById('add-profile-btn');

// Credentials Display in Header
const credentialsProfileName = document.getElementById('credentials-profile-name');
const tryAgainBtn = document.getElementById('try-again-btn');

// Add Profile Modal
const addProfileModal = document.getElementById('add-profile-modal');
const cancelAddProfileBtn = document.getElementById('cancel-add-profile-btn');
const saveProfileBtn = document.getElementById('save-profile-btn');
const stremioNameInput = document.getElementById('stremio-name');
const stremioEmailAddInput = document.getElementById('stremio-email-add');
const stremioPasswordAddInput = document.getElementById('stremio-password-add');

// Automation Failure Modal
const automationFailModal = document.getElementById('automation-fail-modal');
const automationFailMessage = document.getElementById('automation-fail-message');
const retryAutomationBtn = document.getElementById('retry-automation-btn');
const manualLoginBtn = document.getElementById('manual-login-btn');


// --- State Variables ---
let currentUserId = null;
let currentProfileId = null; // Store the ID of the currently active profile
// Global variable to track the current stage of the Stremio login automation
let stremioLoginAutomationStage = 0;
let currentProfileData = null; // Store the profile data for retries


// --- Notification Logic ---
/**
 * Displays a temporary notification message to the user.
 * @param {string} message - The message to display.
 * @param {string} [type='success'] - The type of notification ('success' or 'error').
 */
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notificationContainer.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// --- View Management ---
/**
 * Shows a specific view (screen) and hides others.
 * @param {HTMLElement} view - The HTML element representing the view to show.
 */
function showView(view) {
    authScreen.classList.add('hidden');
    profileScreen.classList.add('hidden');
    splitScreenView.classList.add('hidden');

    view.classList.remove('hidden');
    view.classList.add('flex');
}

// --- Automation Failure Modal Logic ---
/**
 * Displays the automation failure modal with a specific message.
 * @param {string} message - The message to display in the modal.
 */
function showAutomationFailModal(message) {
    automationFailMessage.textContent = message;
    automationFailModal.classList.remove('hidden');
}

/**
 * Hides the automation failure modal.
 */
function hideAutomationFailModal() {
    automationFailModal.classList.add('hidden');
}

// --- Authentication Logic ---
// Handles sign-in if the current URL is an email link.
const handleSignIn = async () => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) email = window.prompt('Please provide your email for confirmation');

        try {
            await signInWithEmailLink(auth, email, window.location.href);
            window.localStorage.removeItem('emailForSignIn');
            window.history.replaceState(null, "", window.location.pathname);
            showNotification('Successfully signed in!');
        } catch (error) {
            showNotification(`Error signing in: ${error.message}`, 'error');
        }
    }
};
handleSignIn();

// Listens for Firebase authentication state changes.
onAuthStateChanged(auth, user => {
    if (user) {
        currentUserId = user.uid;
        showView(profileScreen);
        loadProfiles();
    } else {
        currentUserId = null;
        showView(authScreen);
        profilesGrid.innerHTML = ''; // Clear profiles if logged out
    }
});

// Event listener for the email sign-in button.
emailSigninBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    if (!email) {
        showNotification('Please enter your email address.', 'error');
        return;
    }
    const actionCodeSettings = { url: window.location.href, handleCodeInApp: true };
    try {
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        window.localStorage.setItem('emailForSignIn', email);
        showNotification(`A sign-in link has been sent to ${email}.`);
        emailInput.value = ''; // Clear email input
    }
     catch (error) {
        showNotification(error.message, 'error');
    }
});

// Event listener for the logout button.
logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    showNotification('You have been logged out.');
});

// --- Profile Management Logic ---
/**
 * Loads user profiles from Firestore and displays them in the profiles grid.
 */
async function loadProfiles() {
    if (!currentUserId) return;
    profilesGrid.innerHTML = ''; // Clear existing profiles
    const profilesCollection = collection(db, 'users', currentUserId, 'profiles');
    const profileSnapshot = await getDocs(profilesCollection);

    if (profileSnapshot.empty) {
        showNotification('No profiles found. Add one to get started!', 'info');
    } else {
        profileSnapshot.forEach(doc => {
            const profile = doc.data();
            const profileElement = createProfileElement(doc.id, profile.name);
            profilesGrid.appendChild(profileElement);
        });
    }
}

/**
 * Creates an HTML element for a user profile.
 * @param {string} id - The Firestore document ID of the profile.
 * @param {string} name - The name of the profile.
 * @returns {HTMLElement} The created profile HTML element.
 */
function createProfileElement(id, name) {
    const div = document.createElement('div');
    div.className = 'flex flex-col items-center space-y-2 cursor-pointer group';
    div.dataset.id = id; // Store the profile ID

    const avatar = document.createElement('div');
    avatar.className = 'rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-gray-700';
    avatar.textContent = name.charAt(0).toUpperCase(); // Display first letter of name

    const nameEl = document.createElement('p');
    nameEl.className = 'text-gray-300 group-hover:text-white truncate w-full text-center text-lg';
    nameEl.textContent = name;

    div.appendChild(avatar);
    div.appendChild(nameEl);

    // Event listener to show the split screen with the selected profile
    div.addEventListener('click', () => {
        showSplitScreen(id);
    });
    return div;
}

/**
 * Displays the split-screen view with the Stremio iframe and initiates automation.
 * @param {string} profileId - The ID of the selected profile.
 */
async function showSplitScreen(profileId) {
    currentProfileId = profileId; // Store the current profile ID
    try {
        const profileDocRef = doc(db, 'users', currentUserId, 'profiles', profileId);
        const profileDoc = await getDoc(profileDocRef);
        if (profileDoc.exists()) {
            currentProfileData = profileDoc.data(); // Store profile data for automation retries
            credentialsProfileName.textContent = currentProfileData.name; // Display profile name in header

            const proxyUrl = "/stremio/"; // URL for the Stremio proxy
            stremioIframe.src = proxyUrl; // Load Stremio in the iframe

            showView(splitScreenView); // Show the split screen

            // Reset automation stage when a new profile is loaded from the UI.
            // If it's a "try again" initiated from stage 4, we don't reset.
            if (stremioLoginAutomationStage !== 4) {
                stremioLoginAutomationStage = 0;
            }

            // Set up the iframe's onload event to trigger automation
            stremioIframe.onload = async () => {
                const iframeDocument = stremioIframe.contentWindow.document;
                // Execute the automation, passing necessary context and callbacks
                stremioLoginAutomationStage = await executeStremioLoginAutomation(
                    iframeDocument,
                    currentProfileData,
                    stremioLoginAutomationStage,
                    showNotification,
                    showAutomationFailModal
                );
            };

        } else {
            showNotification('Could not find profile data.', 'error');
        }
    } catch (error) {
        showNotification('Failed to fetch profile credentials.', 'error');
    }
}

// Event listener for saving a new profile.
saveProfileBtn.addEventListener('click', async () => {
    const name = stremioNameInput.value;
    const email = stremioEmailAddInput.value;
    const password = stremioPasswordAddInput.value;
    if (!name || !email || !password) {
        showNotification('All fields are required.', 'error');
        return;
    }
    if (currentUserId) {
        try {
            await addDoc(collection(db, 'users', currentUserId, 'profiles'), { name, email, password });
            closeAddProfileModal();
            loadProfiles();
            showNotification('Profile saved successfully!');
        } catch (error) {
            showNotification('Failed to save profile: ' + error.message, 'error');
        }
    }
});

// --- Modal & Button Listeners ---
// Shows the add profile modal.
addProfileBtn.addEventListener('click', () => addProfileModal.classList.remove('hidden'));
// Hides the add profile modal.
cancelAddProfileBtn.addEventListener('click', closeAddProfileModal);
/**
 * Closes the add profile modal and clears its input fields.
 */
function closeAddProfileModal() {
    addProfileModal.classList.add('hidden');
    stremioNameInput.value = '';
    stremioEmailAddInput.value = '';
    stremioPasswordAddInput.value = '';
}

// Event listener for the "Back to Profiles" button.
backToProfilesBtn.addEventListener('click', () => {
    stremioIframe.src = "about:blank"; // Clear iframe content
    stremioIframe.onload = null; // Remove event listener to prevent re-triggering
    showView(profileScreen); // Show the profile selection screen
});

// Event listener for the "Try Again" button in the header.
tryAgainBtn.addEventListener('click', () => {
    if (currentProfileId) {
        showNotification('Attempting to re-open Stremio and re-login.', 'success');
        // Reset iframe src to about:blank first to force a full reload
        stremioIframe.src = "about:blank";
        // A small delay before re-setting src to allow browser to clear iframe content
        setTimeout(() => {
            showSplitScreen(currentProfileId); // Re-run the function for the current profile
        }, 100);
    } else {
        showNotification('No profile selected to try again.', 'error');
    }
});

// Event listener for the "Retry Automation" button in the failure modal.
retryAutomationBtn.addEventListener('click', () => {
    hideAutomationFailModal(); // Hide the modal
    stremioLoginAutomationStage = 0; // Reset to stage 0 for a full retry
    if (currentProfileId && currentProfileData) {
        // Re-trigger the iframe load which will initiate automation from Stage 0
        stremioIframe.src = "about:blank"; // Clear iframe
        setTimeout(() => {
            showSplitScreen(currentProfileId); // Reload iframe and restart automation
        }, 100);
    } else {
        showNotification('Cannot retry automation, no profile data available.', 'error');
    }
});

// Event listener for the "Continue Manually" button in the failure modal.
manualLoginBtn.addEventListener('click', () => {
    hideAutomationFailModal(); // Hide the modal
    // User can now manually interact with the iframe
    showNotification('Continuing manually. Please log in within the Stremio iframe.', 'info');
    stremioLoginAutomationStage = 0; // Reset stage as automation is aborted.
});
