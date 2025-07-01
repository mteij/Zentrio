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
const stremioLoginEmail = document.getElementById('stremio-login-email');
const stremioLoginPassword = document.getElementById('stremio-login-password');
const copyPasswordBtn = document.getElementById('copy-password-btn');

// Add Profile Modal
const addProfileModal = document.getElementById('add-profile-modal');
const cancelAddProfileBtn = document.getElementById('cancel-add-profile-btn');
const saveProfileBtn = document.getElementById('save-profile-btn');
const stremioNameInput = document.getElementById('stremio-name');
const stremioEmailAddInput = document.getElementById('stremio-email-add');
const stremioPasswordAddInput = document.getElementById('stremio-password-add');

// --- State Variables ---
let currentUserId = null;
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
    } catch (error) {
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

async function showSplitScreen(profileId) {
    try {
        const profileDocRef = doc(db, 'users', currentUserId, 'profiles', profileId);
        const profileDoc = await getDoc(profileDocRef);
        if (profileDoc.exists()) {
            const profileData = profileDoc.data();
            credentialsProfileName.textContent = profileData.name;
            stremioLoginEmail.value = profileData.email;
            stremioLoginPassword.value = profileData.password;

            // Use the new proxy path
            const proxyUrl = "/stremio/";
            stremioIframe.src = proxyUrl;

            showView(splitScreenView);

            // Reset automation stage when a new profile is loaded
            stremioLoginAutomationStage = 0;

            stremioIframe.onload = async () => {
                console.log(
                    "Proxied iframe content loaded. Current automation stage:",
                    stremioLoginAutomationStage
                );

                const iframeDocument = stremioIframe.contentWindow.document;

                try {
                    if (stremioLoginAutomationStage === 0) {
                        // Stage 0: Initial load, click profile icon
                        await delay(1500); // Increased initial delay for page render

                        const profileMenuButton = await waitForElement(
                            iframeDocument,
                            'div[class*="nav-menu-popup-label-"]'
                        );

                        if (profileMenuButton) {
                            console.log("Stage 0: Profile menu button found, clicking it.");
                            profileMenuButton.click();
                            stremioLoginAutomationStage = 1; // Move to next stage
                            showNotification(
                                "Profile menu opened, waiting for login/signup button...",
                                "success"
                            );
                        } else {
                            console.log("Stage 0: Profile menu button not found.");
                            showNotification("Stremio UI not as expected (Profile button missing).", "error");
                        }
                    } else if (stremioLoginAutomationStage === 1) {
                        // Stage 1: Profile menu open, click "Log in / Sign up"
                        await delay(500); // Wait for popup to animate

                        const loginSignupButton = await waitForElement(
                            iframeDocument,
                            'a[title="Log in / Sign up"]'
                        );

                        if (loginSignupButton) {
                            console.log("Stage 1: Login / Sign up button found, clicking it.");
                            loginSignupButton.click();
                            stremioLoginAutomationStage = 2; // Move to next stage
                            showNotification(
                                "Login/Sign up clicked, waiting for login page...",
                                "success"
                            );
                            // This click is expected to cause a page navigation in the iframe,
                            // which will re-trigger onload and move to Stage 2.
                        } else {
                            console.log("Stage 1: Login / Sign up button not found in popup.");
                            showNotification("Stremio UI not as expected (Login/Signup button missing).", "error");
                        }
                    } else if (stremioLoginAutomationStage === 2) {
                        // Stage 2: On the intermediate login page, click "Log in" button
                        await delay(1500); // Wait for new page to render

                        // Selector for the "Log in" button on the intermediate page
                        // Assuming the provided div is clickable or its closest parent is
                        const loginButtonOnPage = await waitForElement(
                            iframeDocument,
                            'div[class*="label-uHD7L"].uppercase-UbR3f' // Using the specific label div
                        );

                        if (loginButtonOnPage) {
                            console.log("Stage 2: 'Log in' button on intermediate page found, clicking it.");
                            loginButtonOnPage.click();
                            stremioLoginAutomationStage = 3; // Move to next stage
                            showNotification(
                                "Intermediate login button clicked, waiting for form...",
                                "success"
                            );
                        } else {
                            console.log("Stage 2: 'Log in' button on intermediate page not found.");
                            showNotification("Stremio UI not as expected (Intermediate Login button missing).", "error");
                        }
                    } else if (stremioLoginAutomationStage === 3) {
                        // Stage 3: Login form visible, autofill and submit
                        await delay(1500); // Wait for login form to appear

                        const emailField = await waitForElement(
                            iframeDocument,
                            'input[placeholder="E-mail"]'
                        );
                        const passwordField = await waitForElement(
                            iframeDocument,
                            'input[placeholder="Password"]'
                        );
                        const finalLoginButton = await waitForElement(
                            iframeDocument,
                            'div[class*="submit-button-x3L8z"]'
                        );

                        if (emailField && passwordField && finalLoginButton) {
                            console.log("Stage 3: Login form elements found! Autofilling...");
                            emailField.value = profileData.email;
                            passwordField.value = profileData.password;

                            emailField.dispatchEvent(new Event('input', { bubbles: true }));
                            passwordField.dispatchEvent(new Event('input', { bubbles: true }));

                            console.log("Form filled. Attempting to click final login button.");
                            finalLoginButton.click();
                            stremioLoginAutomationStage = 4; // Login attempted
                            showNotification("Automatic login attempted...", "success");
                        } else {
                            console.log("Stage 3: Could not find all final login form elements.");
                            showNotification("Stremio UI not as expected (Login form elements missing).", "error");
                        }
                    } else if (stremioLoginAutomationStage === 4) {
                        // Stage 4: Post-login, open profile menu
                        await delay(2000); // Give time for post-login redirects/UI to settle

                        const profileMenuButtonAfterLogin = await waitForElement(
                            iframeDocument,
                            'div[class*="nav-menu-popup-label-"]'
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
    stremioIframe.onload = null;
    showView(profileScreen);
});

copyPasswordBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(stremioLoginPassword.value).then(() => {
        showNotification('Password copied to clipboard!');
    }).catch(err => {
        showNotification('Failed to copy password.', 'error');
    });
});
