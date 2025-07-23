import { h as _h } from "preact";
import { useEffect } from "preact/hooks";
import { Signal } from "@preact/signals";
import SettingsModal from "../SettingsModal.tsx";

type Profile = {
  _id: string;
  name: string;
  profilePictureUrl?: string;
  // ...add other fields as needed...
};

interface MobileProfileManagerProps {
  profiles: Signal<Profile[]>;
  showAddModal: Signal<boolean>;
  editingProfile: Signal<Profile | null>;
  mobileEditMode: Signal<boolean>;
  handleCreate: (data: Partial<Profile>) => void;
  handleUpdate: (data: Partial<Profile>) => void;
  handleDelete: (profile: Profile) => void;
  getRandomFunEmojiUrl: (name: string) => string;
  getInitialsUrl: (name: string) => string;
  ProfileModal: any;
  toggleMobileEditMode: () => void;
  showSettings: { value: boolean };
  setShowSettings: (v: boolean) => void;
  addonOrderEnabled: { value: boolean };
  setAddonOrderEnabled: { value: boolean };
}

// Props: signals and handlers from ProfileManager
export default function MobileProfileManager({
  profiles,
  showAddModal,
  editingProfile,
  mobileEditMode,
  handleCreate,
  handleUpdate,
  handleDelete,
  getRandomFunEmojiUrl,
  getInitialsUrl,
  ProfileModal,
  toggleMobileEditMode,
  showSettings,
  setShowSettings,
  addonOrderEnabled,
  setAddonOrderEnabled,
}: MobileProfileManagerProps) {
  // Title
  const title = mobileEditMode.value ? "Edit mode" : "Who's watching?";

  // Only show Add Profile if: no profiles OR edit mode enabled
  const showAddProfile =
    profiles.value.length === 0 || mobileEditMode.value;

  const modalOpen = showAddModal.value || editingProfile.value !== null;

  // Ensure all cards (profile and add) use the same minHeight for alignment
  const cardMinHeight = "150px";

  // Remember last opened profile
  function handleProfileClick(profileId: string) {
    try {
      localStorage.setItem("lastProfileId", profileId);
    } catch {}
    window.location.href = `/player/${profileId}`;
  }

  return (
    <div class="relative min-h-[70vh] w-full">
      <h1 class="text-2xl sm:text-5xl font-bold mb-8 text-center">{title}</h1>
      <div
        class="flex flex-wrap justify-center gap-4 sm:gap-8 mb-10 transition-all duration-300"
        style={{
          maxHeight: "calc(100vh - 180px)",
          overflowX: "visible",
          overflowY: "visible",
          ...(modalOpen
            ? { pointerEvents: "none", userSelect: "none", opacity: 0.6 }
            : {}),
        }}
      >
        {profiles.value.map((profile: any) => (
          <div
            key={profile._id}
            class="flex flex-col items-center cursor-pointer group relative transition-all duration-300 hover:scale-105 hover:z-10"
            style={{
              width: "120px",
              minHeight: cardMinHeight,
              transition: "all 0.2s cubic-bezier(.4,2,.6,1)",
              flex: "0 0 auto",
            }}
          >
            {mobileEditMode.value ? (
              <button
                type="button"
                class="w-full flex justify-center mb-4 bg-transparent border-none p-0 m-0"
                style={{ background: "none", border: "none", padding: 0 }}
                onClick={() => editingProfile.value = profile}
                aria-label={`Edit ${profile.name}`}
              >
                <div
                  class="rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-gray-700 shadow-lg transition-all duration-300"
                  style={{
                    width: "100px",
                    height: "100px",
                    aspectRatio: "1 / 1",
                    backgroundImage: `url(${profile.profilePictureUrl})`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }}
                />
              </button>
            ) : (
              <button
                type="button"
                class="w-full flex justify-center bg-transparent border-none p-0 m-0 mb-4"
                tabIndex={modalOpen ? -1 : 0}
                aria-disabled={modalOpen ? "true" : undefined}
                style={modalOpen ? { pointerEvents: "none" } : undefined}
                onClick={() => handleProfileClick(profile._id)}
              >
                <div
                  class="rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-gray-700 shadow-lg transition-all duration-300 group-hover:ring-4 group-hover:ring-zentrio-red/30"
                  style={{
                    width: "100px",
                    height: "100px",
                    aspectRatio: "1 / 1",
                    backgroundImage: `url(${profile.profilePictureUrl})`,
                    backgroundPosition: "center",
                    backgroundSize: "cover",
                  }}
                />
              </button>
            )}
            <span class="text-lg font-semibold text-white mb-0.5 truncate w-full text-center">{profile.name}</span>
          </div>
        ))}
        {showAddProfile && (
          <div
            class="flex flex-col items-center cursor-pointer group relative transition-all duration-300 hover:scale-105"
            style={{
              width: "120px",
              minHeight: cardMinHeight,
              transition: "all 0.2s cubic-bezier(.4,2,.6,1)",
              flex: "0 0 auto",
            }}
          >
            <button
              type="button"
              onClick={() => showAddModal.value = true}
              class="flex flex-col items-center w-full h-full bg-transparent border-none p-0 m-0 mb-4 transition-all duration-300"
              style={{ minHeight: "100px" }}
              aria-label="Add Profile"
              disabled={!!modalOpen}
            >
              <div
                class="rounded-lg flex items-center justify-center bg-gray-700 shadow-lg transition-all duration-300 group-hover:ring-4 group-hover:ring-zentrio-red/30"
                style={{
                  width: "100px",
                  height: "100px",
                  aspectRatio: "1 / 1",
                  fontSize: "2.5rem",
                  color: "#fff",
                  transition: "all 0.2s cubic-bezier(.4,2,.6,1)",
                }}
              >
                +
              </div>
            </button>
            <span class="text-lg font-semibold text-white mb-0.5 truncate w-full text-center">Add Profile</span>
          </div>
        )}
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
      {/* Render the mobile action bar at the bottom, only on mobile */}
      <div class="fixed bottom-0 left-0 w-full flex gap-2 justify-center bg-black bg-opacity-90 py-3 sm:hidden z-30 border-t border-gray-800">
        <a
          href="/logout"
          class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-base transition-all duration-200"
        >
          Logout
        </a>
        <button
          type="button"
          class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors text-lg"
          onClick={toggleMobileEditMode}
          aria-label={mobileEditMode.value ? "Done Editing" : "Edit Profiles"}
          style={{ minWidth: "40px", minHeight: "40px" }}
        >
          {mobileEditMode.value ? (
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="22" height="22" fill="none" viewBox="0 0 20 20">
              <path d="M4 15.5V16h.5l9.1-9.1a1 1 0 0 0 0-1.4l-1.1-1.1a1 1 0 0 0-1.4 0L4 13.5z" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={() => showSettings.value = true}
          class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors text-lg"
          aria-label="Settings"
          style={{ minWidth: "40px", minHeight: "40px" }}
        >
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
            <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3.5" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 8.6 15a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 15 8.6a1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 15z"/>
            </g>
          </svg>
        </button>
      </div>
      {showSettings.value && (
        <SettingsModal
          onClose={() => showSettings.value = false}
          addonOrderEnabled={addonOrderEnabled}
          setAddonOrderEnabled={setAddonOrderEnabled}
        />
      )}
    </div>
  );
}