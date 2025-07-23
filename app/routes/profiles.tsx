import { Handlers, PageProps } from "$fresh/server.ts";
import { AppState } from "./_middleware.ts";
import { getProfilesByUser, ProfileSchema, ObjectId as _ObjectId } from "../utils/db.ts";
import ProfileManager from "../islands/ProfileManager.tsx";
import SettingsModal from "../components/SettingsModal.tsx";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";

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
  // --- Settings Modal State ---
  const showSettings = useSignal(false);
  const addonOrderEnabled = useSignal(
    typeof window !== "undefined"
      ? localStorage.getItem("enableAddonOrderUserscript") === "true"
      : false
  );

  // --- Inject/Remove userscript when toggled ---
  // Move this effect into a useEffect to avoid running on the server and to ensure it runs after hydration.
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

  return (
    <div class="flex-grow flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen bg-black">
      <div class="w-full max-w-2xl min-w-[320px] bg-black bg-opacity-75 p-6 sm:p-8 rounded-lg animate-profilecard-in">
        <h1 class="text-2xl sm:text-5xl font-bold mb-8 text-center">Who's watching?</h1>
        <ProfileManager initialProfiles={data.profiles} />
        <div class="mt-8 flex justify-center items-center gap-4">
          <a
            href="/logout"
            class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-lg transition-all duration-200"
          >
            Logout
          </a>
          {/* Gear Icon Button */}
          <button
            type="button"
            aria-label="Settings"
            class="ml-2 p-2 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
            onClick={() => { showSettings.value = true; }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            {/* Gear SVG */}
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
              <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3.5" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 8.6 15a1.65 1.65 0 0 0-1.82-.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 15 8.6a1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 15z"/>
              </g>
            </svg>
          </button>
        </div>
      </div>
      {/* Settings Modal */}
      {showSettings.value && (
        <SettingsModal
          show={showSettings.value}
          onClose={() => showSettings.value = false}
          addonOrderEnabled={addonOrderEnabled}
          setAddonOrderEnabled={v => addonOrderEnabled.value = v}
        />
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
