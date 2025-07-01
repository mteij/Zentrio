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

// --- State Variables ---
let currentUserId = null;
let currentProfileId = null; // Store the ID of the currently active profile
// Global variable to track the current stage of the Stremio login automation
let stremioLoginAutomationStage = 0;

// --- Utility Functions for Automation ---
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForElement(doc, selector, interval = 500, retries = 20) {
    let element = null;
    for (let i = 0; i < retries; i++) {
        element = doc.querySelector(selector);
        if (element) {
            return element;
        }
        await delay(interval);
    }
    throw new Error(`Element with selector "${selector}" not found after ${retries * interval}ms.`);
}

// --- Notification Logic ---
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
function showView(view) {
    authScreen.classList.add('hidden');
    profileScreen.classList.add('hidden');
    splitScreenView.classList.add('hidden');

    view.classList.remove('hidden');
    view.classList.add('flex');
}

// --- Authentication Logic ---
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

// --- Profile Management Logic ---
async function loadProfiles() {
    if (!currentUserId) return;
    profilesGrid.innerHTML = '';
    const profilesCollection = collection(db, 'users', currentUserId, 'profiles');
    const profileSnapshot = await getDocs(profilesCollection);

    if (profileSnapshot.empty) {
        showNotification('No profiles found. Add one to get started!', 'error');
    } else {
        profileSnapshot.forEach(doc => {
            const profile = doc.data();
            const profileElement = createProfileElement(doc.id, profile.name);
            profilesGrid.appendChild(profileElement);
        });
    }
}

function createProfileElement(id, name) {
    const div = document.createElement('div');
    div.className = 'flex flex-col items-center space-y-2 cursor-pointer group';
    div.dataset.id = id;

    const avatar = document.createElement('div');
    avatar.className = 'rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-gray-700';
    avatar.textContent = name.charAt(0).toUpperCase();

    const nameEl = document.createElement('p');
    nameEl.className = 'text-gray-300 group-hover:text-white truncate w-full text-center text-lg';
    nameEl.textContent = name;

    div.appendChild(avatar);
    div.appendChild(nameEl);

    div.addEventListener('click', () => {
        showSplitScreen(id);
    });
    return div;
}

// This function now contains the core automation logic,
// allowing it to be called sequentially or upon iframe reload
async function executeStremioLoginAutomation(iframeDocument, profileData) {
    console.log("Stremio automation started/continued. Stage:", stremioLoginAutomationStage);
    try {
        if (stremioLoginAutomationStage === 0) {
            // Stage 0: Initial load, click profile icon
            await delay(1500); // Initial delay for Stremio UI to settle

            const profileMenuButton = await waitForElement(
                iframeDocument,
                'div[class*="nav-menu-popup-label-"]', // Selector for the main profile icon
                500, 40 // Wait up to 20 seconds
            );

            if (profileMenuButton) {
                console.log("Stage 0: Profile menu button found, clicking it.");
                profileMenuButton.click();
                showNotification(
                    "Profile menu opened, waiting for login/signup button...",
                    "success"
                );
                stremioLoginAutomationStage = 1; // Advance stage
                // Crucial: Immediately proceed to next stage within same onload execution
                await executeStremioLoginAutomation(iframeDocument, profileData);
            } else {
                console.log("Stage 0: Profile menu button not found.");
                showNotification("Stremio UI not as expected (Profile button missing).", "error");
            }
        } else if (stremioLoginAutomationStage === 1) {
            // Stage 1: Profile menu open, click "Log in / Sign up"
            await delay(1500); // Delay for popup content to render

            const loginSignupButton = await waitForElement(
                iframeDocument,
                'a[title="Log in / Sign up"]', // Selector for "Log in / Sign up" link
                500, 120 // Wait up to 60 seconds
            );

            if (loginSignupButton) {
                console.log("Stage 1: Login / Sign up button found by waitForElement, clicking it.");
                loginSignupButton.click();
                showNotification(
                    "Login/Sign up clicked, waiting for login page...",
                    "success"
                );
                stremioLoginAutomationStage = 2; // Advance stage
                // This click is expected to cause a full page navigation in the iframe.
                // The next iframe.onload will then start at Stage 2. No recursive call here.
            } else {
                console.log("Stage 1: Login / Sign up button not found in popup.");
                showNotification("Stremio UI not as expected (Login/Signup button missing).", "error");
            }
        } else if (stremioLoginAutomationStage === 2) {
            // Stage 2: On the intermediate login page, click "Log in" button
            await delay(1500); // Wait for new page to render

            const loginButtonOnPage = await waitForElement(
                iframeDocument,
                'div[class*="label-uHD7L"].uppercase-UbR3f' // Selector for the "Log in" button on the intermediate page
            );

            if (loginButtonOnPage) {
                console.log("Stage 2: 'Log in' button on intermediate page found, clicking it.");
                loginButtonOnPage.click();
                showNotification(
                    "Intermediate login button clicked, waiting for form...",
                    "success"
                );
                stremioLoginAutomationStage = 3; // Advance stage
                // Proceed immediately to the next stage as form appears on same page
                await executeStremioLoginAutomation(iframeDocument, profileData);
            } else {
                console.log("Stage 2: 'Log in' button on intermediate page not found.");
                showNotification("Stremio UI not as expected (Intermediate Login button missing).", "error");
            }
        } else if (stremioLoginAutomationStage === 3) {
            // Stage 3: Login form visible, autofill and submit
            await delay(1500); // Wait for login form to appear

            const emailField = await waitForElement(
                iframeDocument,
                'input[placeholder="E-mail"]' // Selector for email input
            );
            const passwordField = await waitForElement(
                iframeDocument,
                'input[placeholder="Password"]' // Selector for password input
            );
            const finalLoginButton = await waitForElement(
                iframeDocument,
                'div[class*="submit-button-x3L8z"]' // Selector for the final submit button
            );

            if (emailField && passwordField && finalLoginButton) {
                console.log("Stage 3: Login form elements found! Autofilling...");
                emailField.value = profileData.email;
                passwordField.value = profileData.password;

                emailField.dispatchEvent(new Event('input', { bubbles: true }));
                passwordField.dispatchEvent(new Event('input', { bubbles: true }));

                console.log("Form filled. Attempting to click final login button.");
                finalLoginButton.click();
                showNotification("Automatic login attempted...", "success");
                stremioLoginAutomationStage = 4; // Advance stage
                // This click is expected to cause a full page navigation to the dashboard.
                // The next iframe.onload will then start at Stage 4. No recursive call here.
            } else {
                console.log("Stage 3: Could not find all final login form elements.");
                showNotification("Stremio UI not as expected (Login form elements missing).", "error");
            }
        } else if (stremioLoginAutomationStage === 4) {
            // Stage 4: Post-login, open profile menu
            await delay(2000); // Give time for post-login redirects/UI to settle

            const profileMenuButtonAfterLogin = await waitForElement(
                iframeDocument,
                'div[class*="nav-menu-popup-label-"]' // Selector for the profile menu icon after login
            );

            if (profileMenuButtonAfterLogin) {
                console.log("Stage 4: Profile menu button found after login, clicking it.");
                profileMenuButtonAfterLogin.click();
                showNotification("Profile menu opened automatically!", "success");
            } else {
                console.log("Stage 4: Profile menu button not found after login.");
                showNotification("Stremio UI not as expected (Profile menu button after login missing).", "error");
            }
            stremioLoginAutomationStage = 0; // Reset stage for next time
        }
    } catch (error) {
        console.error("Error during automated login sequence:", error);
        showNotification(
            "An error occurred during automated login: " + error.message,
            "error"
        );
        stremioLoginAutomationStage = 0; // Reset stage on error
    }
}


async function showSplitScreen(profileId) {
    currentProfileId = profileId; // Store the current profile ID
    try {
        const profileDocRef = doc(db, 'users', currentUserId, 'profiles', profileId);
        const profileDoc = await getDoc(profileDocRef);
        if (profileDoc.exists()) {
            const profileData = profileDoc.data();
            credentialsProfileName.textContent = profileData.name;

            const proxyUrl = "/stremio/";
            stremioIframe.src = proxyUrl;

            showView(splitScreenView);

            // Reset automation stage when a new profile is loaded from the UI.
            // But if it's a try-again, we don't want to reset if it's already on stage 4.
            // This ensures that after a full page navigation (like login/signup click),
            // the automation continues from the next stage.
            if (stremioLoginAutomationStage !== 4) {
                stremioLoginAutomationStage = 0;
            }


            stremioIframe.onload = async () => {
                const iframeDocument = stremioIframe.contentWindow.document;
                // Pass profileData to the automation logic
                await executeStremioLoginAutomation(iframeDocument, profileData);
            };

        } else {
            showNotification('Could not find profile data.', 'error');
        }
    } catch (error) {
        showNotification('Failed to fetch profile credentials.', 'error');
    }
}


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
addProfileBtn.addEventListener('click', () => addProfileModal.classList.remove('hidden'));
cancelAddProfileBtn.addEventListener('click', closeAddProfileModal);
function closeAddProfileModal() {
    addProfileModal.classList.add('hidden');
    stremioNameInput.value = '';
    stremioEmailAddInput.value = '';
    stremioPasswordAddInput.value = '';
}

backToProfilesBtn.addEventListener('click', () => {
    stremioIframe.src = "about:blank";
    stremioIframe.onload = null; // Remove event listener to prevent re-triggering
    showView(profileScreen);
});

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