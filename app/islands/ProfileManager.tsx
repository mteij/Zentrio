import { h as _h } from "preact";
import { useSignal } from "@preact/signals";
import { ProfileSchema } from "../utils/db.ts";
import { ObjectId } from "mongoose";

interface ProfileManagerProps {
  initialProfiles: (ProfileSchema & { _id: ObjectId; userId: ObjectId })[];
}

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

function ProfileModal(
  { profile, onSave, onCancel, onDelete }: {
    profile: PlainProfile | null;
    onSave: (data: Partial<Omit<ProfileSchema, "_id" | "userId">>) => void;
    onCancel: () => void;
    onDelete?: (id: string) => void;
  },
) {
  const name = useSignal(profile?.name || "");
  const email = useSignal(profile?.email || "");
  const password = useSignal(profile?.password || "");
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
    onSave({
      name: name.value,
      email: email.value,
      password: password.value,
      profilePictureUrl: profilePictureUrl.value,
    });
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
            class="w-full bg-gray-700 text-white p-3 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
          />
          <input
            type="email"
            placeholder="Stremio Email"
            value={email.value}
            onInput={(e) => email.value = (e.target as HTMLInputElement).value}
            required
            name="email"
            autoComplete="username"
            class="w-full bg-gray-700 text-white p-3 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
          />
          <input
            type="password"
            placeholder="Stremio Password"
            value={password.value}
            onInput={(e) => password.value = (e.target as HTMLInputElement).value}
            required
            name="password"
            autoComplete="current-password"
            class="w-full bg-gray-700 text-white p-3 rounded mb-6 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
          />
          <div class="flex justify-between">
            <div>
              {isEditing && onDelete && (
                <button
                  type="button"
                  onClick={() =>
                    confirm("Are you sure?") && onDelete(profile!._id)}
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

export default function ProfileManager(
  { initialProfiles }: ProfileManagerProps,
) {
  const profiles = useSignal<PlainProfile[]>(initialProfiles.map(toPlainObject));
  const showAddModal = useSignal(false);
  const editingProfile = useSignal<PlainProfile | null>(
    null,
  );

  const handleCreate = async (data: Partial<ProfileSchema>) => {
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

  const handleUpdate = async (
    data: Partial<Omit<ProfileSchema, "_id" | "userId">>,
  ) => {
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

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/profiles/${id}`, { method: "DELETE" });
    if (res.ok) {
      profiles.value = profiles.value.filter((p) => p._id !== id);
      editingProfile.value = null;
    }
  };

  return (
    <div>
      {/* Prevent interaction with profiles when a modal is open */}
      <div
        class={`flex flex-wrap justify-center gap-8 mb-10 transition-all duration-300${
          showAddModal.value || editingProfile.value ? " pointer-events-none select-none opacity-60" : ""
        }`}
        // Remove pointer-events/opacity when modal is closed
        style={
          showAddModal.value || editingProfile.value
            ? undefined
            : { pointerEvents: "auto", userSelect: "auto", opacity: 1 }
        }
      >
        {profiles.value.map((profile, idx) => (
          <div
            key={profile._id}
            class="flex flex-col items-center space-y-2 cursor-pointer group relative transition-all duration-300 hover:scale-105 hover:z-10"
            style={{ width: "160px", transition: "all 0.2s cubic-bezier(.4,2,.6,1)" }}
          >
            <a
              href={showAddModal.value || editingProfile.value ? undefined : `/player/${profile._id}`}
              class={`w-full flex justify-center ${showAddModal.value || editingProfile.value ? "pointer-events-none" : ""}`}
              tabIndex={showAddModal.value || editingProfile.value ? -1 : 0}
              aria-disabled={showAddModal.value || editingProfile.value ? "true" : undefined}
            >
              <div
                class="rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-gray-700 mb-3 shadow-lg transition-all duration-300 group-hover:ring-4 group-hover:ring-stremio-red/30"
                style={{
                  backgroundImage: `url(${profile.profilePictureUrl})`,
                  width: "140px",
                  height: "140px",
                  aspectRatio: "1 / 1",
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                  transition: "all 0.2s cubic-bezier(.4,2,.6,1)",
                }}
              >
              </div>
            </a>
            <p class="text-gray-300 group-hover:text-white truncate w-full text-center text-lg transition-colors duration-200 group-hover:scale-105">
              {profile.name}
            </p>
            <button
              type="button"
              onClick={() => editingProfile.value = profile}
              class="edit-profile-btn absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              title={`Edit ${profile.name}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zm-3.586 3.586l-2.828 2.828-7.793 7.793 2.828 2.828 7.793-7.793 2.828-2.828-2.828-2.828z" />
              </svg>
            </button>
          </div>
        ))}
        <div
          class="flex flex-col items-center justify-center space-y-2 cursor-pointer group relative transition-all duration-300 hover:scale-105"
          style={{ width: "160px", transition: "all 0.2s cubic-bezier(.4,2,.6,1)" }}
        >
          <button
            type="button"
            onClick={() => showAddModal.value = true}
            class="flex flex-col items-center justify-center w-full h-full transition-all duration-300"
            style={{ minHeight: "140px" }}
            aria-label="Add Profile"
          >
            <div
              class="rounded-lg flex items-center justify-center bg-gray-700 mb-3 shadow-lg transition-all duration-300 group-hover:ring-4 group-hover:ring-stremio-red/30"
              style={{
                width: "140px",
                height: "140px",
                aspectRatio: "1 / 1",
                fontSize: "3rem",
                color: "#fff",
                transition: "all 0.2s cubic-bezier(.4,2,.6,1)",
              }}
            >
              +
            </div>
            <span class="text-gray-300 group-hover:text-white text-lg font-bold transition-colors duration-200">Add Profile</span>
          </button>
        </div>
      </div>
      {showAddModal.value && (
        <ProfileModal
          profile={null}
          onSave={handleCreate}
          onCancel={() => showAddModal.value = false}
        />
      )}
      {editingProfile.value && (
        <ProfileModal
          profile={editingProfile.value}
          onSave={handleUpdate}
          onCancel={() => editingProfile.value = null}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}