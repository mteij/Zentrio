import { Handlers, PageProps } from "$fresh/server.ts";
import { AppState } from "./_middleware.ts";
import { getProfilesByUser, ProfileSchema } from "../utils/db.ts";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import ProfileManager from "../islands/ProfileManager.tsx";
import SettingsModal from "../islands/SettingsModal.tsx"; // Only use SettingsModal

interface ProfilePageData {
  profiles: ProfileSchema[];
}

export const handler: Handlers<ProfilePageData, AppState> = {
  async GET(_req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("", {
        status: 307,
        headers: { Location: "/login" },
      });
    }
    const profiles = await getProfilesByUser(userId);
    return ctx.render({ profiles });
  },
};

export default function ProfilesPage({ data }: PageProps<ProfilePageData>) {
  const showSettings = useSignal(false);
  const addonOrderEnabled = useSignal(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      addonOrderEnabled.value = localStorage.getItem("enableAddonOrderUserscript") === "true";
    }
  }, []);

  useEffect(() => {
    if (addonOrderEnabled.value && !document.getElementById("addon-order-userscript")) {
      const script = document.createElement("script");
      script.src = "/userscripts/stremio-addon-manager.user.js";
      script.id = "addon-order-userscript";
      script.async = false;
      document.body.appendChild(script);
    } else if (!addonOrderEnabled.value && document.getElementById("addon-order-userscript")) {
      document.getElementById("addon-order-userscript")?.remove();
    }
    localStorage.setItem("enableAddonOrderUserscript", addonOrderEnabled.value ? "true" : "false");
  }, [addonOrderEnabled.value]);

  const modalOpen = showSettings.value;

  return (
    <div class="flex-grow flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen bg-black relative">
      {/* Settings Button - always clickable, outside the pointer-events-none container */}
      <div class="absolute top-8 right-8 z-40">
        <button
          type="button"
          class="flex items-center justify-center w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors text-lg"
          onClick={() => showSettings.value = true}
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
      <div
        class="w-full max-w-2xl min-w-[320px] bg-black bg-opacity-75 p-6 sm:p-8 rounded-lg animate-profilecard-in flex flex-col"
        style={{
          minHeight: "70vh",
          maxHeight: "80vh",
          justifyContent: "center",
          ...(modalOpen ? { pointerEvents: "none", userSelect: "none", opacity: 0.6 } : {}),
        }}
      >
        <h1 class="text-2xl sm:text-5xl font-bold mb-8 text-center">Who's watching?</h1>
        <ProfileManager initialProfiles={data.profiles} />
        <div class="mt-8 flex justify-center items-center gap-4">
          <a
            href="/logout"
            class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-lg transition-all duration-200"
          >
            Logout
          </a>
        </div>
      </div>
      {showSettings.value && (
        <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 transition-all duration-300 animate-fade-in">
          <SettingsModal
            _show={showSettings.value}
            onClose={() => { showSettings.value = false; }}
            addonOrderEnabled={addonOrderEnabled}
            setAddonOrderEnabled={(v: boolean) => { addonOrderEnabled.value = v; }}
          />
          <style>
            {`
              @keyframes fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              .animate-fade-in {
                animation: fade-in 0.3s ease;
              }
            `}
          </style>
        </div>
      )}
      <style>
        {`
          @keyframes profilecard-in {
            0% { opacity: 0; transform: scale(0.97);}
            100% { opacity: 1; transform: scale(1);}
          }
          .animate-profilecard-in {
            animation: profilecard-in 0.5s cubic-bezier(.4,2,.6,1);
          }
        `}
      </style>
    </div>
  );
}