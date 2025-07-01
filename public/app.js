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

// --- Authentication Logic ---

// This function runs on page load to handle the sign-in process
const handleSignIn = async () => {
    // 1. Check if the user is returning from the email link
    if (isSignInWithEmailLink(auth, window.location.href)) {
        let email = window.localStorage.getItem('emailForSignIn');
        if (!email) {
            // User opened the link on a different device. To prevent session fixation
            // attacks, ask the user to provide the email again.
            email = window.prompt('Please provide your email for confirmation');
        }
        
        try {
            // 2. Complete the sign-in process
            await signInWithEmailLink(auth, email, window.location.href);
            // 3. Clean up the URL and local storage
            window.localStorage.removeItem('emailForSignIn');
            window.history.replaceState(null, "", window.location.pathname);
        } catch (error) {
            authError.textContent = `Error signing in: ${error.message}`;
            authError.classList.remove('hidden');
        }
    }
};

// Call the sign-in handler on page load
handleSignIn();


// Listen for authentication state changes (this now works for passwordless)
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
        profilesGrid.innerHTML = ''; // Clear profiles on logout
    }
});

// Send the sign-in link to the user's email
emailSigninBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    if (!email) {
        authError.textContent = 'Please enter your email address.';
        authError.classList.remove('hidden');
        return;
    }

    const actionCodeSettings = {
        // URL you want to redirect back to. The domain (www.example.com) must be
        // authorized in the Firebase console.
        url: window.location.href,
        handleCodeInApp: true, // This must be true.
    };

    try {
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        // The link was successfully sent. Inform the user.
        // Save the email locally so you don't have to ask for it again
        // if they open the link on the same device.
        window.localStorage.setItem('emailForSignIn', email);
        
        authError.classList.add('hidden');
        authMessage.textContent = `A sign-in link has been sent to ${email}. Please check your inbox.`;
        emailInput.classList.add('hidden');
        emailSigninBtn.classList.add('hidden');

    } catch (error) {
        authError.textContent = error.message;
        authError.classList.remove('hidden');
    }
});

// Logout user
logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
    // Reload to reset the auth UI state
    window.location.reload();
});


// --- Profile Management Logic (No changes needed here) ---

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
            console.log(`Selected profile: ${name} (ID: ${id})`);
            alert(`Simulating login for ${name}. Redirecting to Stremio...`);
            window.location.href = "https://web.stremio.com/";
        }
    });
    return div;
}

saveProfileBtn.addEventListener('click', async () => {
    const name = stremioNameInput.value;
    const email = stremioEmailInput.value;
    const password = stremioPasswordInput.value;
    if (!name || !email || !password) {
        addProfileError.textContent = 'All fields are required.';
        addProfileError.classList.remove('hidden');
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
        } catch (error) {
            addProfileError.textContent = 'Failed to save profile: ' + error.message;
            addProfileError.classList.remove('hidden');
        }
    }
});

confirmDeleteBtn.addEventListener('click', async () => {
    if (currentUserId && profileToDeleteId) {
        try {
            await deleteDoc(doc(db, 'users', currentUserId, 'profiles', profileToDeleteId));
            closeDeleteConfirmModal();
            loadProfiles();
        } catch (error) {
            console.error("Error deleting profile: ", error);
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
    addProfileError.classList.add('hidden');
    stremioNameInput.value = '';
    stremioEmailInput.value = '';
    stremioPasswordInput.value = '';
}
cancelDeleteBtn.addEventListener('click', closeDeleteConfirmModal);
function closeDeleteConfirmModal() {
    deleteConfirmModal.classList.add('hidden');
    profileToDeleteId = null;
}
