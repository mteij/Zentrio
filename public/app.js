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
const emailSigninBtn = document.getElementById('email-signin-btn');
const logoutBtn = document.getElementById('logout-btn');
const emailInput = document.getElementById('email');
const authError = document.getElementById('auth-error');
const authMessage = document.getElementById('auth-message');
const notificationContainer = document.getElementById('notification-container');

const profilesGrid = document.getElementById('profiles-grid');
const addProfileBtn = document.getElementById('add-profile-btn');
const editProfilesBtn = document.getElementById('edit-profiles-btn');

const addProfileModal = document.getElementById('add-profile-modal');
const cancelAddProfileBtn = document.getElementById('cancel-add-profile-btn');
const saveProfileBtn = document.getElementById('save-profile-btn');
const stremioNameInput = document.getElementById('stremio-name');
const stremioEmailInput = document.getElementById('stremio-email');
const stremioPasswordInput = document.getElementById('stremio-password');
const addProfileError = document.getElementById('add-profile-error');

const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

// --- State Variables ---
let currentUserId = null;
let isEditMode = false;
let profileToDeleteId = null;

// --- Notification Logic ---
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notificationContainer.appendChild(notification);

    // Trigger the animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Hide the notification after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        // Remove the element from the DOM after the animation completes
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}


// --- Authentication Logic ---

// This function runs on page load to handle the sign-in process
const handleSignIn = async () => {
    // 1. Check if the user is returning from the email link
    if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            email = window.prompt('Please provide your email for confirmation');
        }
        
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

// Call the sign-in handler on page load
handleSignIn();


// Listen for authentication state changes
onAuthStateChanged(auth, user => {
    if (user) {
        currentUserId = user.uid;
        authScreen.classList.add('hidden');
        profileScreen.classList.remove('hidden');
        loadProfiles();
    } else {
        currentUserId = null;
        authScreen.classList.remove('hidden');
        profileScreen.classList.add('hidden');
        profilesGrid.innerHTML = ''; 
    }
});

// Send the sign-in link to the user's email
emailSigninBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    if (!email) {
        showNotification('Please enter your email address.', 'error');
        return;
    }

    const actionCodeSettings = {
        url: window.location.href,
        handleCodeInApp: true,
    };

    try {
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        window.localStorage.setItem('emailForSignIn', email);
        showNotification(`A sign-in link has been sent to ${email}.`);
        emailInput.value = '';

    } catch (error) {
        showNotification(error.message, 'error');
    }
});

// Logout user
logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    showNotification('You have been logged out.');
    window.location.reload();
});


// --- Profile Management Logic ---

async function loadProfiles() {
    if (!currentUserId) return;
    profilesGrid.innerHTML = '';
    const profilesCollection = collection(db, 'users', currentUserId, 'profiles');
    const profileSnapshot = await getDocs(profilesCollection);
    
    if (profileSnapshot.empty) {
         addProfileModal.classList.remove('hidden');
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
    const avatarContainer = document.createElement('div');
    avatarContainer.className = 'relative';
    const avatar = document.createElement('div');
    avatar.className = 'w-32 h-32 rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-blue-500';
    avatar.textContent = name.charAt(0).toUpperCase();
    const deleteIcon = document.createElement('div');
    deleteIcon.className = 'delete-icon absolute top-0 right-0 bg-red-600 rounded-full p-1';
    deleteIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>`;
    deleteIcon.addEventListener('click', (e) => {
        e.stopPropagation();
        profileToDeleteId = id;
        deleteConfirmModal.classList.remove('hidden');
    });
    avatarContainer.appendChild(avatar);
    avatarContainer.appendChild(deleteIcon);
    const nameEl = document.createElement('p');
    nameEl.className = 'text-gray-400 group-hover:text-white';
    nameEl.textContent = name;
    div.appendChild(avatarContainer);
    div.appendChild(nameEl);
    div.addEventListener('click', () => {
        if (!isEditMode) {
            showNotification(`Welcome back, ${name}!`);
            setTimeout(() => {
                 window.location.href = "https://web.stremio.com/";
            }, 1000)
           
        }
    });
    return div;
}

saveProfileBtn.addEventListener('click', async () => {
    const name = stremioNameInput.value;
    const email = stremioEmailInput.value;
    const password = stremioPasswordInput.value;
    if (!name || !email || !password) {
        showNotification('All fields are required.', 'error');
        return;
    }
    if (currentUserId) {
        try {
            await addDoc(collection(db, 'users', currentUserId, 'profiles'), {
                name: name,
                email: email,
                password: password 
            });
            closeAddProfileModal();
            loadProfiles();
            showNotification('Profile saved successfully!');
        } catch (error) {
            showNotification('Failed to save profile: ' + error.message, 'error');
        }
    }
});

confirmDeleteBtn.addEventListener('click', async () => {
    if (currentUserId && profileToDeleteId) {
        try {
            await deleteDoc(doc(db, 'users', currentUserId, 'profiles', profileToDeleteId));
            closeDeleteConfirmModal();
            loadProfiles();
            showNotification('Profile deleted.', 'success');
        } catch (error) {
            showNotification("Error deleting profile: " + error.message, 'error');
        }
    }
});

editProfilesBtn.addEventListener('click', () => {
    isEditMode = !isEditMode;
    profilesGrid.classList.toggle('edit-mode');
    editProfilesBtn.textContent = isEditMode ? 'Done' : 'Edit';
});

addProfileBtn.addEventListener('click', () => addProfileModal.classList.remove('hidden'));
cancelAddProfileBtn.addEventListener('click', closeAddProfileModal);
function closeAddProfileModal() {
    addProfileModal.classList.add('hidden');
    stremioNameInput.value = '';
    stremioEmailInput.value = '';
    stremioPasswordInput.value = '';
}
cancelDeleteBtn.addEventListener('click', closeDeleteConfirmModal);
function closeDeleteConfirmModal() {
    deleteConfirmModal.classList.add('hidden');
    profileToDeleteId = null;
}