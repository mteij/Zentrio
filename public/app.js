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

// --- Declare DOM Elements (will be initialized after DOMContentLoaded) ---
let authScreen, profileScreen, splitScreenView, backToProfilesBtn, stremioIframe;
let logoutBtn, emailInput, emailSigninBtn, notificationContainer;
let profilesGrid, addProfileBtn;
let credentialsProfileName, tryAgainBtn;
let addProfileModal, cancelAddProfileBtn, saveProfileBtn, stremioNameInput, stremioEmailAddInput, stremioPasswordAddInput;
let automationFailModal, automationFailMessage, retryAutomationBtn, manualLoginBtn;


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
    console.log("Attempting to show automation fail modal. Message:", message);
    console.log("Modal element:", automationFailModal);
    console.log("Message element:", automationFailMessage);

    // Ensure elements are not null before trying to set properties
    if (automationFailMessage) {
        automationFailMessage.textContent = message;
    } else {
        console.error("automationFailMessage element not found when trying to show modal.");
    }
    if (automationFailModal) {
        automationFailModal.classList.remove('hidden');
    } else {
        console.error("automationFailModal element not found when trying to show modal.");
    }
}

/**
 * Hides the automation failure modal.
 */
function hideAutomationFailModal() {
    if (automationFailModal) {
        automationFailModal.classList.add('hidden');
    }
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
                const automationResult = await executeStremioLoginAutomation(
                    iframeDocument,
                    currentProfileData,
                    stremioLoginAutomationStage,
                    showNotification,
                    showAutomationFailModal
                );

                if (automationResult === 'NAVIGATE') {
                    // If automation signals a navigation, force a reload to trigger onload again
                    console.log("Automation signaled navigation. Forcing iframe reload.");
                    stremioIframe.src = "about:blank"; // Clear before reloading
                    setTimeout(() => {
                        stremioIframe.src = proxyUrl; // Reload the iframe
                    }, 100); // Small delay before reloading
                } else {
                    // Otherwise, update the automation stage
                    stremioLoginAutomationStage = automationResult;
                }
            };

        } else {
            showNotification('Could not find profile data.', 'error');
        }
    } catch (error) {
        showNotification('Failed to fetch profile credentials.', 'error');
    }
}


// --- Modal & Button Listeners ---
/**
 * Closes the add profile modal and clears its input fields.
 */
function closeAddProfileModal() {
    addProfileModal.classList.add('hidden');
    stremioNameInput.value = '';
    stremioEmailAddInput.value = '';
    stremioPasswordAddInput.value = '';
}

/**
 * Attaches all necessary event listeners to DOM elements.
 * This function is called after DOMContentLoaded to ensure elements are available.
 */
function attachEventListeners() {
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
            emailInput.value = '';
        }
        catch (error) {
            showNotification(error.message, 'error');
        }
    });

    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        showNotification('You have been logged out.');
    });

    addProfileBtn.addEventListener('click', () => addProfileModal.classList.remove('hidden'));
    cancelAddProfileBtn.addEventListener('click', closeAddProfileModal);
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

    backToProfilesBtn.addEventListener('click', () => {
        stremioIframe.src = "about:blank";
        stremioIframe.onload = null;
        showView(profileScreen);
    });

    tryAgainBtn.addEventListener('click', () => {
        if (currentProfileId) {
            showNotification('Attempting to re-open Stremio and re-login.', 'success');
            stremioIframe.src = "about:blank";
            setTimeout(() => {
                showSplitScreen(currentProfileId);
            }, 100);
        } else {
            showNotification('No profile selected to try again.', 'error');
        }
    });

    retryAutomationBtn.addEventListener('click', () => {
        hideAutomationFailModal();
        stremioLoginAutomationStage = 0;
        if (currentProfileId && currentProfileData) {
            stremioIframe.src = "about:blank";
            setTimeout(() => {
                showSplitScreen(currentProfileId);
            }, 100);
        } else {
            showNotification('Cannot retry automation, no profile data available.', 'error');
        }
    });

    manualLoginBtn.addEventListener('click', () => {
        hideAutomationFailModal();
        showNotification('Continuing manually. Please log in within the Stremio iframe.', 'info');
        stremioLoginAutomationStage = 0;
    });
}


// --- Initialize DOM elements and attach event listeners after the DOM is fully loaded ---
document.addEventListener('DOMContentLoaded', () => {
    // Assign DOM elements
    authScreen = document.getElementById('auth-screen');
    profileScreen = document.getElementById('profile-screen');
    splitScreenView = document.getElementById('split-screen-view');
    backToProfilesBtn = document.getElementById('back-to-profiles-btn');
    stremioIframe = document.getElementById('stremio-iframe');

    logoutBtn = document.getElementById('logout-btn');
    emailInput = document.getElementById('email');
    emailSigninBtn = document.getElementById('email-signin-btn');
    notificationContainer = document.getElementById('notification-container');

    profilesGrid = document.getElementById('profiles-grid');
    addProfileBtn = document.getElementById('add-profile-btn');

    credentialsProfileName = document.getElementById('credentials-profile-name');
    tryAgainBtn = document.getElementById('try-again-btn');

    addProfileModal = document.getElementById('add-profile-modal');
    cancelAddProfileBtn = document.getElementById('cancel-add-profile-btn');
    saveProfileBtn = document.getElementById('save-profile-btn');
    stremioNameInput = document.getElementById('stremio-name');
    stremioEmailAddInput = document.getElementById('stremio-email-add');
    stremioPasswordAddInput = document.getElementById('stremio-password-add');

    automationFailModal = document.getElementById('automation-fail-modal');
    automationFailMessage = document.getElementById('automation-fail-message');
    retryAutomationBtn = document.getElementById('retry-automation-btn');
    manualLoginBtn = document.getElementById('manual-login-btn');

    // Attach event listeners
    attachEventListeners();

    // Handle initial sign-in (e.g., from email link)
    handleSignIn();

    // Listen for auth state changes
    onAuthStateChanged(auth, user => {
        if (user) {
            currentUserId = user.uid;
            showView(profileScreen);
            loadProfiles();
        } else {
            currentUserId = null;
            showView(authScreen);
            profilesGrid.innerHTML = '';
        }
    });
});
