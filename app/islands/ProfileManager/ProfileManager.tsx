import { h as _h } from "preact";
import { useSignal, useComputed } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { ProfileSchema } from "../../utils/db.ts";
import { ObjectId } from "mongoose";
import ProfileManagerView from "./ProfileManagerView.tsx";
import ConfirmDialog from "../../components/ConfirmDialog.tsx";
import { UAParser } from "npm:ua-parser-js";

// Helper to convert MongoDB objects to plain objects for client-side use
const toPlainObject = (
  p: ProfileSchema & { _id: ObjectId; userId: ObjectId },
) => ({
  ...p,
  _id: p._id.toString(),
  userId: p.userId.toString(),
});

type PlainProfile = ReturnType<typeof toPlainObject>;

function getRandomFunEmojiUrl(name: string) {
  const seed = Math.random().toString(36).substring(2, 10);
  return `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${encodeURIComponent(name + seed)}`;
}
function getInitialsUrl(name: string) {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}`;
}

export function ProfileModal(
  { profile, onSave, onCancel, onRequestDelete }: {
    profile: PlainProfile | null;
    onSave: (data: Partial<Omit<ProfileSchema, "_id" | "userId">>) => void;
    onCancel: () => void;
    onRequestDelete?: (profile: PlainProfile) => void;
  },
) {
  const name = useSignal(profile?.name || "");
  const email = useSignal(profile?.email || "");
  const password = useSignal(profile?.password || "");
  const nsfwMode = useSignal(profile?.nsfwMode || false);
  const isEditing = !!profile?._id;
  const [initialPic] = profile
    ? [profile.profilePictureUrl]
    : [getInitialsUrl("NewUser")];
  const profilePictureUrl = useSignal(profile?.profilePictureUrl || initialPic);

  // Update avatar when name changes (if not editing)
  function handleNameChange(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    name.value = val;
    if (!isEditing) {
      profilePictureUrl.value = getInitialsUrl(val);
    }
  }

  function handleRandomize() {
    profilePictureUrl.value = getRandomFunEmojiUrl(name.value || "User");
  }
  function handleReset() {
    profilePictureUrl.value = getInitialsUrl(name.value || "User");
  }

  const handleSave = (e: Event) => {
    e.preventDefault();
    const profileData: any = {
      name: name.value,
      email: email.value,
      profilePictureUrl: profilePictureUrl.value,
      nsfwMode: nsfwMode.value,
    };
    
    // Only include password if it's not empty or if we're creating a new profile
    if (password.value.trim() !== "" || !isEditing) {
      profileData.password = password.value;
    }
    
    onSave(profileData);
  };

  return (
    <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-20 transition-all duration-300 animate-fade-in">
      <div class="bg-gray-800 p-8 rounded-lg w-full max-w-md shadow-2xl transform transition-all duration-300 animate-modal-pop">
        <h2 class="text-2xl font-bold mb-4 transition-colors duration-300">
          {isEditing ? "Edit Profile" : "Add Profile"}
        </h2>
        <form onSubmit={handleSave}>
          <div class="flex flex-col items-center mb-4">
            <img
              src={profilePictureUrl.value}
              alt="Avatar"
              class="w-20 h-20 rounded-full mb-2 bg-gray-700 transition-all duration-300 animate-avatar-pop"
              style="object-fit:cover;"
            />
            <div class="flex gap-2">
              <button
                type="button"
                onClick={handleRandomize}
                class="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors duration-200"
                tabIndex={-1}
              >
                Randomize
              </button>
              <button
                type="button"
                onClick={handleReset}
                class="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors duration-200"
                tabIndex={-1}
              >
                Reset
              </button>
            </div>
          </div>
          <input
            type="text"
            placeholder="Profile Name"
            value={name.value}
            onInput={handleNameChange}
            required
            class="w-full bg-gray-700 text-white px-3 py-2 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
          />
          <input
            type="email"
            placeholder="Stremio Email"
            value={email.value}
            onInput={(e) => email.value = (e.target as HTMLInputElement).value}
            required
            name="email"
            autoComplete="username"
            class="w-full bg-gray-700 text-white px-3 py-2 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
          />
          <input
            type="password"
            placeholder={isEditing ? "Stremio Password (leave empty to keep current)" : "Stremio Password"}
            value={password.value}
            onInput={(e) => password.value = (e.target as HTMLInputElement).value}
            required={!isEditing}
            name="password"
            autoComplete="current-password"
            class="w-full bg-gray-700 text-white px-3 py-2 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
          />
          
          {/* NSFW Mode Toggle */}
          <div class="mb-6 bg-gray-700 p-4 rounded">
            <div class="flex items-center justify-between">
              <div>
                <label class="text-white font-medium">NSFW Content Filter</label>
                <p class="text-xs text-gray-400 mt-1">
                  Hide adult content from this profile (requires TMDB API key)
                </p>
              </div>
              <div class="relative">
                <input
                  type="checkbox"
                  id="nsfwMode"
                  checked={nsfwMode.value}
                  onChange={(e) => nsfwMode.value = e.currentTarget.checked}
                  class="sr-only"
                />
                <div 
                  class={`block w-14 h-8 rounded-full cursor-pointer transition-colors duration-200 ${
                    nsfwMode.value ? 'bg-red-600' : 'bg-gray-600'
                  }`}
                  onClick={() => nsfwMode.value = !nsfwMode.value}
                >
                  <div class={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-200 ${
                    nsfwMode.value ? 'transform translate-x-6' : ''
                  }`}></div>
                </div>
              </div>
            </div>
          </div>
          <div class="flex justify-between">
            <div>
              {isEditing && onRequestDelete && (
                <button
                  type="button"
                  onClick={() => onRequestDelete(profile!)}
                  class="bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
                >
                  Delete
                </button>
              )}
            </div>
            <div class="flex space-x-4">
              <button
                type="button"
                onClick={onCancel}
                class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded transition-colors duration-200"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
      <style>
        {`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease;
        }
        @keyframes modal-pop {
          0% { opacity: 0; transform: scale(0.95);}
          100% { opacity: 1; transform: scale(1);}
        }
        .animate-modal-pop {
          animation: modal-pop 0.3s cubic-bezier(.4,2,.6,1) both;
        }
        @keyframes avatar-pop {
          0% { opacity: 0; transform: scale(0.7);}
          100% { opacity: 1; transform: scale(1);}
        }
        .animate-avatar-pop {
          animation: avatar-pop 0.4s cubic-bezier(.4,2,.6,1) both;
        }
        `}
      </style>
    </div>
  );
}

function useProfileManagerState(initialProfiles: (ProfileSchema & { _id: ObjectId; userId: ObjectId })[]) {
  const profiles = useSignal<PlainProfile[]>(initialProfiles.map(toPlainObject));
  const showAddModal = useSignal(false);
  const editingProfile = useSignal<PlainProfile | null>(null);
  const mobileEditMode = useSignal(false);

  // Store profiles in localStorage for auto-login functionality
  useEffect(() => {
    if (typeof window !== "undefined") {
      const profilesForStorage = profiles.value.map(p => ({ _id: p._id, name: p.name }));
      localStorage.setItem("profiles", JSON.stringify(profilesForStorage));
    }
  }, [profiles.value]);

  const handleCreate = async (data: Partial<Omit<ProfileSchema, "_id" | "userId">>) => {
    const res = await fetch("/api/profiles", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const newProfile = await res.json();
      profiles.value = [...profiles.value, toPlainObject(newProfile)];
      showAddModal.value = false;
    }
  };

  const handleUpdate = async (data: Partial<Omit<ProfileSchema, "_id" | "userId">>) => {
    if (!editingProfile.value) return;
    const res = await fetch(`/api/profiles/${editingProfile.value._id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updatedProfile = { ...editingProfile.value, ...data };
      profiles.value = profiles.value.map((p) =>
        p._id === updatedProfile._id ? updatedProfile : p
      );
      editingProfile.value = null;
    }
  };

  const handleDelete = async (profile: PlainProfile) => {
    const res = await fetch(`/api/profiles/${profile._id}`, { method: "DELETE" });
    if (res.ok) {
      profiles.value = profiles.value.filter((p) => p._id !== profile._id);
      editingProfile.value = null;
    }
  };

  return {
    profiles,
    showAddModal,
    editingProfile,
    mobileEditMode,
    handleCreate,
    handleUpdate,
    handleDelete,
  };
}

export default function ProfileManager(
  {
    initialProfiles,
    showSettings,
    setShowSettings,
    addonOrderEnabled,
    setAddonOrderEnabled,
  }: {
    initialProfiles: (ProfileSchema & { _id: ObjectId; userId: ObjectId })[],
    showSettings: { value: boolean },
    setShowSettings: { value: boolean },
    addonOrderEnabled: { value: boolean },
    setAddonOrderEnabled: { value: boolean },
  }
) {
  const {
    profiles,
    showAddModal,
    editingProfile,
    mobileEditMode,
    handleCreate,
    handleUpdate,
    handleDelete,
  } = useProfileManagerState(initialProfiles);

  // Detect mobile using UAParser.js
  const isMobile = useSignal(false);
  useEffect(() => {
    if (typeof window !== "undefined" && globalThis.navigator) {
      const parser = new UAParser();
      const device = parser.getDevice();
      isMobile.value = device.type === "mobile" || device.type === "tablet";
    }
  }, []);

  // Create a computed signal for the view mode - always use auto detection
  const shouldShowMobile = useComputed(() => {
    return isMobile.value;
  });

  // Provide a reliable toggle function for mobile edit mode
  const toggleMobileEditMode = () => {
    mobileEditMode.value = !mobileEditMode.value;
  };

  // Add signals for delete confirmation modal
  const showDeleteConfirm = useSignal(false);
  const profileToDelete = useSignal<PlainProfile | null>(null);

  // Handler for requesting delete (shows modal)
  const handleRequestDelete = (profile: PlainProfile) => {
    profileToDelete.value = profile;
    showDeleteConfirm.value = true;
  };

  // Handler for confirming delete
  const confirmDelete = async () => {
    if (profileToDelete.value) {
      await handleDelete(profileToDelete.value);
    }
    showDeleteConfirm.value = false;
    profileToDelete.value = null;
  };

  // Handler for canceling delete
  const cancelDelete = () => {
    showDeleteConfirm.value = false;
    profileToDelete.value = null;
  };

  const sharedProps = {
    profiles,
    showAddModal,
    editingProfile,
    mobileEditMode,
    handleCreate,
    handleUpdate,
    handleDelete,
    getRandomFunEmojiUrl,
    getInitialsUrl,
    ProfileModal: (props: any) =>
      ProfileModal({ ...props, onRequestDelete: handleRequestDelete }),
    toggleMobileEditMode,
    showSettings,
    setShowSettings,
    addonOrderEnabled,
    setAddonOrderEnabled,
    isMobile: isMobile.value,
  };

  return (
    <>
      <ProfileManagerView {...sharedProps} />
      <ConfirmDialog
        open={showDeleteConfirm.value}
        title="Delete Profile?"
        message={
          profileToDelete.value
            ? `Are you sure you want to delete "${profileToDelete.value.name}"? This cannot be undone.`
            : ""
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </>
  );
}