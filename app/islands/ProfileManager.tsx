import { h } from "preact";
import { useSignal } from "@preact/signals";
import { ProfileSchema } from "../utils/db.ts";
import { ObjectId } from "mongodb";

interface ProfileManagerProps {
  initialProfiles: (ProfileSchema & { _id: ObjectId; userId: ObjectId })[];
}

// Helper to convert MongoDB objects to plain objects for client-side use
const toPlainObject = (
  p: ProfileSchema & { _id: ObjectId; userId: ObjectId },
) => ({
  ...p,
  _id: p._id.toHexString(),
  userId: p.userId.toHexString(),
});

type PlainProfile = ReturnType<typeof toPlainObject>;

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

  const handleSave = (e: Event) => {
    e.preventDefault();
    onSave({
      name: name.value,
      email: email.value,
      password: password.value,
    });
  };

  return (
    <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-20">
      <div class="bg-gray-800 p-8 rounded-lg w-full max-w-md">
        <h2 class="text-2xl font-bold mb-4">
          {isEditing ? "Edit Profile" : "Add Profile"}
        </h2>
        <form onSubmit={handleSave}>
          <input
            type="text"
            placeholder="Profile Name"
            value={name.value}
            onInput={(e) => name.value = (e.target as HTMLInputElement).value}
            required
            class="w-full bg-gray-700 text-white p-3 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-red-600"
          />
          <input
            type="email"
            placeholder="Stremio Email"
            value={email.value}
            onInput={(e) => email.value = (e.target as HTMLInputElement).value}
            required
            class="w-full bg-gray-700 text-white p-3 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-red-600"
          />
          <input
            type="password"
            placeholder="Stremio Password"
            value={password.value}
            onInput={(e) => password.value = (e.target as HTMLInputElement).value}
            required
            class="w-full bg-gray-700 text-white p-3 rounded mb-6 focus:outline-none focus:ring-2 focus:ring-red-600"
          />
          <div class="flex justify-between">
            <div>
              {isEditing && onDelete && (
                <button
                  type="button"
                  onClick={() =>
                    confirm("Are you sure?") && onDelete(profile!._id)}
                  class="bg-red-800 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                >
                  Delete
                </button>
              )}
            </div>
            <div class="flex space-x-4">
              <button
                type="button"
                onClick={onCancel}
                class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
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
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 mb-8">
        {profiles.value.map((profile) => (
          <div
            key={profile._id}
            class="flex flex-col items-center space-y-2 cursor-pointer group relative"
          >
            <a href={`/player/${profile._id}`} class="w-full">
              <div
                class="rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-gray-700"
                style={{ backgroundImage: `url(${profile.profilePictureUrl})` }}
              >
              </div>
            </a>
            <p class="text-gray-300 group-hover:text-white truncate w-full text-center text-lg">
              {profile.name}
            </p>
            <button
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
      </div>
      <button
        onClick={() => showAddModal.value = true}
        class="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-6 rounded-lg text-lg"
      >
        Add Profile
      </button>

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
