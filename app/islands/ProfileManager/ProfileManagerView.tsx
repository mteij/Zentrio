import { h as _h } from "preact";
import SettingsModal from "../SettingsModal.tsx";

export default function ProfileManagerView(props: any) {
  const {
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
    isMobile,
  } = props;

  const modalOpen = showAddModal.value || editingProfile.value !== null;
  const showAddProfile = profiles.value.length === 0 || (isMobile ? mobileEditMode.value : true);

  function handleProfileClick(profileId: string) {
    try {
      localStorage.setItem("lastProfileId", profileId);
    } catch {}
    window.location.href = `/player/${profileId}`;
  }

  // Desktop grid calculation
  const maxColumns = 4;
  const totalCards = profiles.value.length + (showAddProfile ? 1 : 0);
  const rows = Math.ceil(totalCards / maxColumns);
  const cards = [
    ...profiles.value.map((profile: any) => ({ type: "profile", profile })),
    ...(showAddProfile ? [{ type: "add" }] : []),
  ];
  const rowsArr: any[][] = [];
  for (let i = 0; i < rows; i++) {
    rowsArr.push(cards.slice(i * maxColumns, (i + 1) * maxColumns));
  }

  // --- MOBILE LAYOUT ---
  if (isMobile) {
    return (
      <div class="flex flex-col overflow-hidden w-full bg-black text-white" style={{ height: "100dvh" }}>
        <h1 class="text-2xl sm:text-5xl font-bold text-center py-4">
          {mobileEditMode.value ? "Edit mode" : "Who's watching?"}
        </h1>
        <div
          class="flex-1 overflow-y-auto scrollbar-hide px-4 flex flex-wrap justify-center gap-4 sm:gap-8"
          style={{
            paddingBottom: "120px",
            overflowX: "hidden",
            ...(modalOpen ? {
              pointerEvents: "none",
              userSelect: "none",
              opacity: 0.6,
            } : {}),
          }}
        >
          {profiles.value.map((profile: any) => (
            <div
              key={profile._id}
              class="flex flex-col items-center cursor-pointer group relative transition-all duration-300 hover:scale-105 hover:z-10"
              style={{
                width: "120px",
                transition: "all 0.2s cubic-bezier(.4,2,.6,1)",
                flex: "0 0 auto",
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
                  class="w-full flex justify-center bg-transparent border-none p-0 m-0 mb-2"
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
              <span class="text-lg font-semibold text-white truncate w-full text-center">
                {profile.name}
              </span>
            </div>
          ))}
          {showAddProfile && (
            <div
              class="flex flex-col items-center cursor-pointer group relative transition-all duration-300 hover:scale-105"
              style={{
                width: "120px",
                transition: "all 0.2s cubic-bezier(.4,2,.6,1)",
                flex: "0 0 auto",
              }}
            >
              <button
                type="button"
                onClick={() => (showAddModal.value = true)}
                class="flex flex-col items-center w-full h-full bg-transparent border-none p-0 m-0 mb-2 transition-all duration-300"
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
                  }}
                >
                  +
                </div>
              </button>
              <span class="text-lg font-semibold text-white truncate w-full text-center">
                Add Profile
              </span>
            </div>
          )}
        </div>
        {showAddModal.value && (
          <ProfileModal
            profile={null}
            onSave={handleCreate}
            onCancel={() => (showAddModal.value = false)}
          />
        )}
        {editingProfile.value && (
          <ProfileModal
            profile={editingProfile.value}
            onSave={handleUpdate}
            onCancel={() => (editingProfile.value = null)}
            onDelete={handleDelete}
          />
        )}
        <div class="fixed bottom-0 inset-x-0 flex gap-2 justify-center bg-black bg-opacity-90 py-3 sm:hidden z-30 border-t border-gray-800">
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
          <button
            type="button"
            onClick={() => (showSettings.value = true)}
            class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors text-lg"
            aria-label="Settings"
          >
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
              <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3.5" />
                <path d="M19.07 13.91a7.5 7.5 0 0 0 0-3.82l2.11-1.65a1 1 0 0 0 .24-1.31l-2-3.46a1 1 0 0 0-1.25-.45l-2.49 1a7.42 7.42 0 0 0-3.3-1.91l-.38-2.65A1 1 0 0 0 10 2h-4a1 1 0 0 0-1 .89l-.38 2.65a7.42 7.42 0 0 0-3.3 1.91l-2.49-1a1 1 0 0 0-1.25.45l-2 3.46a1 1 0 0 0 .24 1.31l2.11 1.65a7.5 7.5 0 0 0 0 3.82l-2.11 1.65a1 1 0 0 0-.24 1.31l2 3.46a1 1 0 0 0 1.25.45l2.49-1a7.42 7.42 0 0 0 3.3 1.91l.38 2.65A1 1 0 0 0 6 22h4a1 1 0 0 0 1-.89l.38-2.65a7.42 7.42 0 0 0 3.3-1.91l2.49 1a1 1 0 0 0 1.25-.45l2-3.46a1 1 0 0 0-.24-1.31z" />
              </g>
            </svg>
          </button>
        </div>
        {showSettings.value && (
          <SettingsModal
            onClose={() => (showSettings.value = false)}
            addonOrderEnabled={addonOrderEnabled}
            setAddonOrderEnabled={setAddonOrderEnabled}
            isMobile={isMobile}
          />
        )}
      </div>
    );
  }

  // --- DESKTOP LAYOUT ---
  return (
    <div class="w-full flex flex-col items-center justify-center min-h-[70vh]">
      <h1 class="text-4xl font-bold mb-10 text-center tracking-tight">{"Who's watching?"}</h1>
      <div class="flex flex-col gap-8 mb-4 w-full max-w-[900px]">
        {rowsArr.map((row, rowIdx) => (
          <div
            key={rowIdx}
            class="flex flex-row gap-8 justify-center"
            style={{ width: "100%" }}
          >
            {row.map((card, idx) =>
              card.type === "profile" ? (
                <div
                  key={card.profile._id}
                  class="relative group flex flex-col items-center rounded-xl shadow-lg p-6 transition-transform duration-200 hover:scale-105"
                  style={{
                    width: "220px",
                    boxShadow: "0 4px 24px 0 #000a",
                  }}
                >
                  <button
                    type="button"
                    class="block w-full bg-transparent border-none p-0 m-0 mb-4"
                    tabIndex={modalOpen ? -1 : 0}
                    aria-disabled={modalOpen ? "true" : undefined}
                    style={modalOpen ? { pointerEvents: "none" } : undefined}
                    onClick={() => handleProfileClick(card.profile._id)}
                  >
                    <div
                      class="rounded-lg profile-avatar flex items-center justify-center text-5xl font-bold bg-gray-700 shadow-lg transition-all duration-300 group-hover:ring-4 group-hover:ring-zentrio-red/30"
                      style={{
                        width: "120px",
                        height: "120px",
                        aspectRatio: "1 / 1",
                        backgroundImage: `url(${card.profile.profilePictureUrl})`,
                        backgroundPosition: "center",
                        backgroundSize: "cover",
                        margin: "0 auto",
                      }}
                    />
                  </button>
                  <span class="text-lg font-semibold text-white mb-0.5 truncate w-full text-center">{card.profile.name}</span>
                  <button
                    type="button"
                    onClick={() => editingProfile.value = card.profile}
                    class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gray-900 bg-opacity-80 rounded-full p-2 shadow-md hover:bg-zentrio-red"
                    title={`Edit ${card.profile.name}`}
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
                      <path d="M4 15.5V16h.5l9.1-9.1a1 1 0 0 0 0-1.4l-1.1-1.1a1 1 0 0 0-1.4 0L4 13.5z" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              ) : (
                <div
                  key="add-profile"
                  class="relative group flex flex-col items-center rounded-xl shadow-lg p-6 transition-transform duration-200 hover:scale-105 cursor-pointer"
                  style={{
                    width: "220px",
                    boxShadow: "0 4px 24px 0 #000a",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => showAddModal.value = true}
                    class="flex flex-col items-center w-full h-full bg-transparent border-none p-0 m-0 mb-4"
                    style={{ minHeight: "0" }}
                    aria-label="Add Profile"
                    disabled={!!modalOpen}
                  >
                    <div
                      class="rounded-lg flex items-center justify-center bg-gray-700 shadow-lg transition-all duration-300 group-hover:ring-4 group-hover:ring-zentrio-red/30"
                      style={{
                        width: "120px",
                        height: "120px",
                        aspectRatio: "1 / 1",
                        fontSize: "3rem",
                        color: "#fff",
                        transition: "all 0.2s cubic-bezier(.4,2,.6,1)",
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
      <div class="flex justify-center items-center gap-4 w-full mt-6">
        <a
          href="/logout"
          class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-lg transition-all duration-200"
        >
          Logout
        </a>
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
      {showAddModal.value && (
        <div class="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70">
          <ProfileModal
            profile={null}
            onSave={handleCreate}
            onCancel={() => showAddModal.value = false}
          />
        </div>
      )}
      {editingProfile.value && (
        <div class="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70">
          <ProfileModal
            profile={editingProfile.value}
            onSave={handleUpdate}
            onCancel={() => editingProfile.value = null}
            onDelete={handleDelete}
          />
        </div>
      )}
      {showSettings.value && (
        <SettingsModal
          onClose={() => showSettings.value = false}
          addonOrderEnabled={addonOrderEnabled}
          setAddonOrderEnabled={setAddonOrderEnabled}
          isMobile={isMobile}
        />
      )}
    </div>
  );
}
