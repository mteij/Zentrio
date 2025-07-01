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
    updateDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Import Iframe Automation Module ---
import { performStreamlinedLoginAutomation } from "./iframe-automations/loginAutomation.js";


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
let credentialsProfileName, headerProfilePicture, tryAgainBtn;
let addProfileModal, cancelAddProfileBtn, saveProfileBtn, stremioNameInput, stremioEmailAddInput, stremioPasswordAddInput;
let editProfileModal, editStremioNameInput, editStremioEmailInput, editStremioPasswordInput, editProfilePicturePreview, dicebearStyleSelect, dicebearSeedInput, generateDicebearBtn, randomizeDicebearSeedBtn, cancelEditProfileBtn, saveEditProfileBtn, deleteProfileBtn;


// --- State Variables ---
let currentUserId = null;
let currentProfileId = null;
let currentProfileData = null;
let editingProfileId = null;


// --- Utility Functions ---
function generateRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0987654321';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

function getDiceBearUrl(style, seed) { // Removed radius parameter
    return `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}`; // Removed radius from URL
}


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
            const profileElement = createProfileElement(doc.id, profile.name, profile.profilePictureUrl);
            profilesGrid.appendChild(profileElement);
        });
    }
}

/**
 * Creates an HTML element for a user profile.
 * @param {string} id - The Firestore document ID of the profile.
 * @param {string} name - The name of the profile.
 * @param {string} [profilePictureUrl] - The URL of the profile picture.
 * @returns {HTMLElement} The created profile HTML element.
 */
function createProfileElement(id, name, profilePictureUrl) {
    const div = document.createElement('div');
    div.className = 'flex flex-col items-center space-y-2 cursor-pointer group relative';
    div.dataset.id = id;

    const avatar = document.createElement('div');
    avatar.className = 'rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-gray-700';

    if (profilePictureUrl) {
        avatar.style.backgroundImage = `url(${profilePictureUrl})`;
        avatar.style.backgroundSize = 'cover';
        avatar.style.backgroundPosition = 'center';
        avatar.textContent = '';
    } else {
        avatar.textContent = name.charAt(0).toUpperCase();
    }

    const nameEl = document.createElement('p');
    nameEl.className = 'text-gray-300 group-hover:text-white truncate w-full text-center text-lg';
    nameEl.textContent = name;

    const editButton = document.createElement('button');
    editButton.className = 'edit-profile-btn absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300';
    editButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-3.586 3.586l-2.828 2.828-7.793 7.793 2.828 2.828 7.793-7.793 2.828-2.828-2.828-2.828z" />
                            </svg>`;
    editButton.title = `Edit ${name}`;
    editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showEditProfileModal(id);
    });


    div.appendChild(avatar);
    div.appendChild(nameEl);
    div.appendChild(editButton);

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
    currentProfileId = profileId;
    try {
        const profileDocRef = doc(db, 'users', currentUserId, 'profiles', profileId);
        const profileDoc = await getDoc(profileDocRef);
        if (profileDoc.exists()) {
            currentProfileData = profileDoc.data();
            credentialsProfileName.textContent = currentProfileData.name;

            // Update header profile picture
            if (currentProfileData.profilePictureUrl) {
                headerProfilePicture.src = currentProfileData.profilePictureUrl;
                headerProfilePicture.classList.remove('hidden');
            } else {
                headerProfilePicture.classList.add('hidden');
            }

            const proxyUrl = "/stremio/#/intro?form=login";
            stremioIframe.src = proxyUrl;

            showView(splitScreenView);

            // Set up the iframe's onload event to trigger automation
            stremioIframe.onload = async () => {
                const iframeDocument = stremioIframe.contentWindow.document;
                const automationSuccess = await performStreamlinedLoginAutomation(
                    iframeDocument,
                    currentProfileData,
                    showNotification
                );

                if (!automationSuccess) {
                    showNotification('Automated login failed. Please try again or log in manually within the iframe.', 'error');
                } else {
                    console.log("Streamlined login automation completed its attempt.");
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
 * Displays the edit profile modal with the current profile's data.
 * @param {string} profileId - The ID of the profile to edit.
 */
async function showEditProfileModal(profileId) {
    editingProfileId = profileId;
    const profileDocRef = doc(db, 'users', currentUserId, 'profiles', profileId);
    const profileDoc = await getDoc(profileDocRef);
    if (profileDoc.exists()) {
        const profile = profileDoc.data();
        editStremioNameInput.value = profile.name;
        editStremioEmailInput.value = profile.email;
        editStremioPasswordInput.value = profile.password;

        // Set up DiceBear defaults
        const defaultStyle = 'fun-emoji'; // Hardcode style
        let initialDiceBearSeed = profile.name.charAt(0).toUpperCase() + generateRandomString(5);
        
        if (profile.profilePictureUrl && profile.profilePictureUrl.includes('api.dicebear.com')) {
            try {
                const url = new URL(profile.profilePictureUrl);
                const seedParam = url.searchParams.get('seed');
                if (seedParam) {
                    initialDiceBearSeed = seedParam;
                }
            } catch (e) {
                console.warn("Could not parse existing DiceBear URL, using defaults:", e);
            }
        }

        dicebearStyleSelect.value = defaultStyle;
        dicebearSeedInput.value = initialDiceBearSeed;
        editProfilePicturePreview.src = getDiceBearUrl(defaultStyle, initialDiceBearSeed);

        editProfileModal.classList.remove('hidden');
    } else {
        showNotification('Profile not found for editing.', 'error');
    }
}

/**
 * Closes the edit profile modal and clears its input fields.
 */
function closeEditProfileModal() {
    editProfileModal.classList.add('hidden');
    editingProfileId = null;
    editStremioNameInput.value = '';
    editStremioEmailInput.value = '';
    editStremioPasswordInput.value = '';
    editProfilePicturePreview.src = "";
    dicebearSeedInput.value = '';
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
        const name = stremioNameInput.value.trim();
        const email = stremioEmailAddInput.value.trim();
        const password = stremioPasswordAddInput.value.trim();
        if (!name || !email || !password) {
            showNotification('All fields are required.', 'error');
            return;
        }
        if (currentUserId) {
            try {
                const defaultDiceBearSeed = name.charAt(0).toUpperCase() + generateRandomString(5);
                await addDoc(collection(db, 'users', currentUserId, 'profiles'), {
                    name,
                    email,
                    password,
                    profilePictureUrl: getDiceBearUrl('fun-emoji', defaultDiceBearSeed)
                });
                closeAddProfileModal();
                loadProfiles();
                showNotification('Profile saved successfully!');
            } catch (error) {
                showNotification('Failed to save profile: ' + error.message, 'error');
            }
        }
    });

    // Edit Profile Listeners
    cancelEditProfileBtn.addEventListener('click', closeEditProfileModal);

    generateDicebearBtn.addEventListener('click', () => {
        const style = 'fun-emoji';
        const seed = dicebearSeedInput.value.trim() || generateRandomString(10);
        dicebearSeedInput.value = seed;
        editProfilePicturePreview.src = getDiceBearUrl(style, seed);
    });

    randomizeDicebearSeedBtn.addEventListener('click', () => {
        const newSeed = generateRandomString(10);
        dicebearSeedInput.value = newSeed;
        const style = 'fun-emoji';
        editProfilePicturePreview.src = getDiceBearUrl(style, newSeed);
    });

    saveEditProfileBtn.addEventListener('click', async () => {
        const name = editStremioNameInput.value.trim();
        const email = editStremioEmailInput.value.trim();
        const password = editStremioPasswordInput.value.trim();
        const profilePictureUrl = editProfilePicturePreview.src;

        if (!name || !email || !password) {
            showNotification('Profile name, email, and password are required.', 'error');
            return;
        }

        if (editingProfileId && currentUserId) {
            try {
                const profileDocRef = doc(db, 'users', currentUserId, 'profiles', editingProfileId);
                await updateDoc(profileDocRef, {
                    name,
                    email,
                    password,
                    profilePictureUrl
                });
                closeEditProfileModal();
                loadProfiles();
                showNotification('Profile updated successfully!', 'success');
            } catch (error) {
                showNotification('Failed to update profile: ' + error.message, 'error');
            }
        }
    });

    deleteProfileBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this profile? This cannot be undone.')) {
            return;
        }
        if (editingProfileId && currentUserId) {
            try {
                await deleteDoc(doc(db, 'users', currentUserId, 'profiles', editingProfileId));
                closeEditProfileModal();
                loadProfiles();
                showNotification('Profile deleted successfully!', 'success');
            } catch (error) {
                showNotification('Failed to delete profile: ' + error.message, 'error');
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
    headerProfilePicture = document.getElementById('header-profile-picture');
    tryAgainBtn = document.getElementById('try-again-btn');

    addProfileModal = document.getElementById('add-profile-modal');
    cancelAddProfileBtn = document.getElementById('cancel-add-profile-btn');
    saveProfileBtn = document.getElementById('save-profile-btn');
    stremioNameInput = document.getElementById('stremio-name');
    stremioEmailAddInput = document.getElementById('stremio-email-add');
    stremioPasswordAddInput = document.getElementById('stremio-password-add');

    // Elements for editing
    editProfileModal = document.getElementById('edit-profile-modal');
    editStremioNameInput = document.getElementById('edit-stremio-name');
    editStremioEmailInput = document.getElementById('edit-stremio-email');
    editStremioPasswordInput = document.getElementById('edit-stremio-password');
    editProfilePicturePreview = document.getElementById('edit-profile-picture-preview');
    dicebearStyleSelect = document.getElementById('dicebear-style');
    dicebearSeedInput = document.getElementById('dicebear-seed');
    generateDicebearBtn = document.getElementById('generate-dicebear-btn');
    randomizeDicebearSeedBtn = document.getElementById('randomize-dicebear-seed-btn');
    cancelEditProfileBtn = document.getElementById('cancel-edit-profile-btn');
    saveEditProfileBtn = document.getElementById('save-edit-profile-btn');
    deleteProfileBtn = document.getElementById('delete-profile-btn');

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