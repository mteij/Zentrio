import { h } from "preact";
import { useEffect } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { useToast } from "../../shared/hooks/useToast.ts";
import { useSetting } from "../../shared/hooks/useSetting.ts";
import SettingsModal from "../Settings/SettingsModal.tsx";
import DownloadsModal from "../Downloads/DownloadsModal.tsx";
import { PlainProfile } from "./ProfileManager.tsx";
import { usePwa } from "../../shared/hooks/usePwa.ts";

// ProfileManagerView component
export default function ProfileManagerView(props: {
  profiles: { value: PlainProfile[] };
  showAddModal: { value: boolean };
  editingProfile: { value: PlainProfile | null };
  mobileEditMode: { value: boolean };
  handleCreate: (data: Partial<Omit<PlainProfile, "_id" | "userId">>) => void;
  handleUpdate: (data: Partial<Omit<PlainProfile, "_id" | "userId">>) => void;
  handleRequestDelete: (profile: PlainProfile) => void;
  ProfileModal: (props: {
    profile: PlainProfile | null;
    onSave: (data: Partial<Omit<PlainProfile, "_id" | "userId">>) => void;
    onCancel: () => void;
    onRequestDelete?: (profile: PlainProfile) => void;
  }) => h.JSX.Element;
  toggleMobileEditMode: () => void;
  isMobile: boolean;
  setShowDownloads: (value: boolean) => void;
}) {
  const {
    profiles,
    showAddModal,
    editingProfile,
    mobileEditMode,
    handleCreate,
    handleUpdate,
    handleRequestDelete,
    ProfileModal,
    toggleMobileEditMode,
    isMobile,
  } = props;

  const { success, info } = useToast();
  const isPwa = usePwa();
  const accentColor = useSetting<string>("accentColor", "#dc2626", "localStorage");
  const downloadsManagerEnabled = useSetting<boolean>("downloadsEnabled", false, "server");
  const isInitialized = useSignal(false);
  const lastProfileId = useSignal<string | null>(null);
  const showSettings = useSignal(false);
  const showDownloads = useSignal(false);
  const modalOpen = showAddModal.value || editingProfile.value !== null;
  const showAddProfile = profiles.value.length === 0 || (isMobile ? mobileEditMode.value : true);

  // Mark as initialized after first render
  useEffect(() => {
    // On initial load, try to get the last used profile ID from localStorage
    try {
      lastProfileId.value = localStorage.getItem("lastProfileId");
    } catch {
      // Ignore localStorage access errors
    }
    isInitialized.value = true;
  }, []);

  // Listen for page show events (e.g., when navigating back)
  useEffect(() => {
    const handlePageShow = () => {
      try {
        lastProfileId.value = localStorage.getItem("lastProfileId");
      } catch {
        // Ignore localStorage access errors
      }
    };

    globalThis.addEventListener("pageshow", handlePageShow);
    return () => {
      globalThis.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  // Show loading indicator until initialized
  if (!isInitialized.value) {
      return (
        <div class="flex flex-col items-center justify-center w-full h-[70vh]">
          <div class="spinner"></div>
          <p class="mt-4 text-lg text-gray-300">Loading profiles...</p>
        </div>
      );
  }


  // Desktop grid calculation
  const maxColumns = 4;
  const totalCards = profiles.value.length + (showAddProfile ? 1 : 0);
  const rows = Math.ceil(totalCards / maxColumns);
  const cards = [
    ...profiles.value.map((profile: PlainProfile) => ({ type: "profile", profile })),
    ...(showAddProfile ? [{ type: "add" }] : []),
  ];
  const rowsArr: ({ type: string; profile?: PlainProfile })[][] = [];
  for (let i = 0; i < rows; i++) {
    rowsArr.push(cards.slice(i * maxColumns, (i + 1) * maxColumns) as ({ type: string; profile?: PlainProfile })[]);
  }

  // --- MOBILE LAYOUT ---
  // <MobileProfileManagerView>
  if (isMobile) {
    return (
      <div class="flex flex-col w-full bg-black text-white" style={{ height: "100dvh", paddingTop: "clamp(0px, 0vh, 50px)" }}>
        {/* Mobile Header */}
        <h1 class="text-[5vw] sm:text-[3vw] font-bold text-center pb-4">
          {mobileEditMode.value ? "Edit mode" : "Who's watching?"}
        </h1>
        {/* Mobile Profile Grid */}
        <div
          class="flex-1 px-4 grid auto-rows-min justify-center content-start gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))",
            paddingBottom: "120px",
            overflowY: "auto",
            ...(modalOpen ? {
              pointerEvents: "none",
              userSelect: "none",
              opacity: 0.6
            } : {})
          }}
        >
          {/* Mobile Profile Cards */}
          {profiles.value.map((profile: PlainProfile) => {
            const _isActive = profile._id === lastProfileId.value;
            return (
              <div
                key={profile._id}
                class="flex flex-col items-center group relative transition-all duration-300"
                style={{
                  width: "100%",
                  transition: "all 0.2s cubic-bezier(.4,2,.6,1)",
                  height: "auto",
                  aspectRatio: "1/1.3",
                  cursor: "pointer",
                }}
              >
                {mobileEditMode.value ? (
                  <button
                    type="button"
                    class="w-full flex justify-center bg-transparent border-none p-0 m-0 mb-2"
                    onClick={() => (editingProfile.value = profile)}
                    aria-label={`Edit ${profile.name}`}
                  >
                    <div
                      class="rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-gray-700 shadow-lg transition-all duration-300"
                      style={{
                        width: "80%",
                        height: "auto",
                        aspectRatio: "1 / 1",
                        maxWidth: "100px",
                        backgroundImage: `url(${profile.profilePictureUrl})`,
                        backgroundPosition: "center",
                        backgroundSize: "cover",
                        margin: "0 auto",
                      }}
                    />
                  </button>
                ) : (
                  <a
                    href={`/player/${profile._id}`}
                    class={`w-full flex justify-center bg-transparent border-none p-0 m-0 mb-2 hover:scale-105`}
                    tabIndex={modalOpen ? -1 : 0}
                    aria-disabled={modalOpen ? "true" : undefined}
                    style={{
                      pointerEvents: modalOpen ? "none" : "auto",
                      transition: "transform 0.2s",
                    }}
                  >
                    <div
                      class="rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-gray-700 shadow-lg transition-all duration-300"
                      style={{
                        width: "80%",
                        height: "auto",
                        aspectRatio: "1 / 1",
                        maxWidth: "100px",
                        backgroundImage: `url(${profile.profilePictureUrl})`,
                        backgroundPosition: "center",
                        backgroundSize: "cover",
                        margin: "0 auto",
                        filter: "none",
                      }}
                    />
                  </a>
                )}
                <span class="text-lg font-semibold text-white truncate w-full text-center">
                  {profile.name}
                </span>
              </div>
            );
          })}
          {showAddProfile && (
            <div
              key="add-profile"
              class="flex flex-col items-center cursor-pointer group relative transition-all duration-300 hover:scale-105 hover:z-10"
              style={{
                width: "100%",
                transition: "all 0.2s cubic-bezier(.4,2,.6,1)",
                height: "auto",
                aspectRatio: "1/1.3",
              }}
            >
              <button
                type="button"
                class="w-full flex justify-center bg-transparent border-none p-0 m-0 mb-2"
                onClick={() => (showAddModal.value = true)}
                tabIndex={modalOpen ? -1 : 0}
                aria-disabled={modalOpen ? "true" : undefined}
                style={modalOpen ? { pointerEvents: "none" } : undefined}
                aria-label="Add Profile"
              >
                <div
                  class="rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-gray-700 shadow-lg transition-all duration-300"
                style={{
                  width: "80%",
                  height: "auto",
                  aspectRatio: "1 / 1",
                  maxWidth: "100px",
                  fontSize: "clamp(1.5rem, 6vw, 2.5rem)",
                    color: "#fff",
                    margin: "0 auto",
                  }}
                >
                  +
                </div>
              </button>
              <span class="text-lg font-semibold text-white truncate w-full text-center">
                Add
              </span>
            </div>
          )}
        </div>
        {/* Mobile Profile Modal */}
        {showAddModal.value && (
          <ProfileModal
            profile={null}
            onSave={handleCreate}
            onCancel={() => (showAddModal.value = false)}
          />
        )}
        {/* Mobile Edit Profile Modal */}
        {editingProfile.value && (
          <ProfileModal
            profile={editingProfile.value}
            onSave={handleUpdate}
            onCancel={() => (editingProfile.value = null)}
            onRequestDelete={handleRequestDelete}
          />
        )}
        {/* Mobile Bottom Bar - Only show when isMobile is true */}
        {isMobile && (
          <div class="fixed bottom-0 inset-x-0 flex gap-2 justify-center bg-black bg-opacity-90 py-3 z-30 border-t border-gray-800">
          {/* Mobile Logout Button */}
          <button
            type="button"
            onClick={() => {
              success("You have been logged out.");
              setTimeout(() => {
                globalThis.location.href = "/auth/logout";
              }, 1000);
            }}
            class="text-white font-bold py-2 px-4 rounded-lg text-base transition-all duration-200"
            style={{
              backgroundColor: accentColor.value,
            }}
          >
            Logout
          </button>
          {/* Mobile Edit Button */}
          <button
            type="button"
            class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors text-lg"
            onClick={toggleMobileEditMode}
            aria-label={mobileEditMode.value ? "Done Editing" : "Edit Profiles"}
          >
            {mobileEditMode.value ? (
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="22" height="22" fill="none" viewBox="0 0 20 20">
                <path d="M4 15.5V16h.5l9.1-9.1a1 1 0 0 0 0-1.4l-1.1-1.1a1 1 0 0 0-1.4 0L4 13.5z" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          {/* Mobile Settings Button */}
          <button
            type="button"
            onClick={() => (showSettings.value = true)}
            class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors text-lg"
            aria-label="Settings"
          >
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3.5" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 8.6 15a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 15 8.6a1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 15z"/>
              </g>
            </svg>
          </button>
            {isPwa && downloadsManagerEnabled.value && (
              <button
                type="button"
                onClick={() => showDownloads.value = true}
                class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors text-lg"
                aria-label="Downloads"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            )}
            {/* PWA Install Prompt for Downloads */}
            {!isPwa && downloadsManagerEnabled.value && (
              <button
                type="button"
                onClick={() => {
                  info("Install the app to use the downloads manager.");
                }}
                class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors text-lg"
                aria-label="Install App for Downloads"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
            )}
          </div>
        )}
        {showSettings.value && (
          <SettingsModal
            onClose={() => (showSettings.value = false)}
            isMobile={isMobile}
          />
        )}
       {showDownloads.value && (
           <DownloadsModal
               onClose={() => showDownloads.value = false}
               isMobile={isMobile}
           />
       )}
      </div>
    );
  }

  // --- DESKTOP LAYOUT ---
  // <DesktopProfileManagerView>
  return (
    <div class="w-full flex flex-col items-center justify-center py-[5vh]">
      {/* Desktop Header */}
      <h1 class="text-4xl font-bold mb-[3vh] text-center tracking-tight">Who's watching?</h1>
      {/* Desktop Profile Grid */}
      <div class="flex flex-col gap-8 mb-4 w-full max-w-[900px]">
        {rowsArr.map((row, rowIdx) => (
          <div
            key={rowIdx}
            class="flex flex-row gap-8 justify-center"
            style={{ width: "100%" }}
          >
            {/* Desktop Profile/Add Cards */}
            {row.map((card) =>
              card.type === "profile"
                ? (card.profile && (() => {
                    const profile = card.profile; // Ensure profile is not undefined in this scope
                    const _isActive = profile._id === lastProfileId.value;
                    return (
                      // Desktop Profile Card
                      <div
                        key={profile._id}
                        class={`flex flex-col items-center group relative transition-all duration-300 rounded-xl shadow-lg p-6 hover:scale-105 cursor-pointer`}
                        style={{
                          width: "220px",
                          boxShadow: "0 4px 24px 0 #000a",
                          transition: "transform 0.2s",
                        }}
                      >
                        <a
                          href={`/player/${profile._id}`}
                          class="block w-full bg-transparent border-none p-0 m-0 mb-4"
                          tabIndex={modalOpen ? -1 : 0}
                          aria-disabled={modalOpen ? "true" : undefined}
                          style={{
                            pointerEvents: modalOpen ? "none" : "auto",
                          }}
                        >
                          <div
                            class="rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-gray-700 shadow-lg transition-all duration-300"
                            style={{
                              width: "120px",
                              height: "120px",
                              aspectRatio: "1 / 1",
                              backgroundImage: `url(${profile.profilePictureUrl})`,
                              backgroundPosition: "center",
                              backgroundSize: "cover",
                              margin: "0 auto",
                              filter: "none",
                            }}
                          />
                        </a>
                        <span class="text-lg font-semibold text-white mb-0.5 truncate w-full text-center">{profile.name}</span>
                        <button
                          type="button"
                          onClick={() => (editingProfile.value = profile)}
                          class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-900 bg-opacity-80 rounded-full p-2 shadow-md hover:bg-zentrio-red"
                          title={`Edit ${profile.name}`}
                          style={{
                            zIndex: 2,
                            cursor: "pointer",
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="18"
                            height="18"
                            fill="none"
                            viewBox="0 0 20 20"
                            style={{ color: "#fff" }}
                          >
                            <path
                              d="M4 15.5V16h.5l9.1-9.1a1 1 0 0 0 0-1.4l-1.1-1.1a1 1 0 0 0-1.4 0L4 13.5z"
                              stroke="#fff"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      </div>
                    );
                  })())
              : (
                // Desktop Add Profile Card
                <div
                  key="add-profile"
                  class="flex flex-col items-center cursor-pointer group relative transition-all duration-300 hover:scale-105 rounded-xl shadow-lg p-6 transition-transform duration-200"
                  style={{
                    width: "220px",
                    boxShadow: "0 4px 24px 0 #000a",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => showAddModal.value = true}
                    class="block w-full bg-transparent border-none p-0 m-0 mb-4"
                    style={{ minHeight: "0" }}
                    aria-label="Add Profile"
                    disabled={!!modalOpen}
                  >
                    <div
                      class="rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-gray-700 shadow-lg transition-all duration-300"
                      style={{
                        width: "120px",
                        height: "120px",
                        aspectRatio: "1 / 1",
                        fontSize: "3rem",
                        color: "#fff",
                        transition: "all 0.2s cubic-bezier(.4,2,.6,1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        margin: "0 auto",
                      }}
                    >
                      +
                    </div>
                  </button>
                  <span class="text-lg font-semibold text-white mb-0.5 truncate w-full text-center">Add Profile</span>
                </div>
              )
            )}
          </div>
        ))}
      </div>
      {/* Desktop Bottom Bar */}
      <div class="flex justify-center items-center gap-4 w-full mt-6">
        {/* Desktop Logout Button */}
        <button
          type="button"
          onClick={() => {
            success("You have been logged out.");
            setTimeout(() => {
              globalThis.location.href = "/auth/logout";
            }, 1000);
          }}
          class="text-white font-bold py-2 px-6 rounded-lg text-lg transition-all duration-200"
          style={{
            backgroundColor: accentColor.value,
          }}
        >
          Logout
        </button>
        {/* Desktop Settings Button */}
        <button
          type="button"
          onClick={() => (showSettings.value = true)}
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
        {isPwa && downloadsManagerEnabled.value && (
          <button
            type="button"
            onClick={() => showDownloads.value = true}
            class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors text-lg"
            aria-label="Downloads"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        )}
        {/* PWA Install Prompt for Downloads */}
        {!isPwa && downloadsManagerEnabled.value && (
          <button
            type="button"
            onClick={() => {
              info("Install the app to use the downloads manager.");
            }}
            class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors text-lg"
            aria-label="Install App for Downloads"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
        )}
      </div>
      {/* Desktop Add Profile Modal */}
      {showAddModal.value && (
        <div class="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70">
          <ProfileModal
            profile={null}
            onSave={handleCreate}
            onCancel={() => showAddModal.value = false}
          />
        </div>
      )}
      {/* Desktop Edit Profile Modal */}
      {editingProfile.value && (
        <div class="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70">
          <ProfileModal
            profile={editingProfile.value}
            onSave={handleUpdate}
            onCancel={() => editingProfile.value = null}
            onRequestDelete={handleRequestDelete}
          />
        </div>
      )}
      {showSettings.value && (
        <SettingsModal
          onClose={() => (showSettings.value = false)}
          isMobile={isMobile}
        />
      )}
       {showDownloads.value && (
           <DownloadsModal
               onClose={() => showDownloads.value = false}
               isMobile={isMobile}
           />
       )}
    </div>
  );
}
