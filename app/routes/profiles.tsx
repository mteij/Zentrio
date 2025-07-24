import { Handlers, PageProps } from "$fresh/server.ts";
import { AppState } from "./_middleware.ts";
import { getProfilesByUser, ProfileSchema } from "../utils/db.ts";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import ProfileManager from "../islands/ProfileManager/ProfileManager.tsx";

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
    // Load addon manager setting from server
    const loadAddonManagerSetting = async () => {
      try {
        const response = await fetch('/api/addon-manager');
        if (response.ok) {
          const data = await response.json();
          addonOrderEnabled.value = data.enabled || false;
        }
      } catch (error) {
        console.warn('Failed to load addon manager setting:', error);
      }
    };
    
    loadAddonManagerSetting();
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
  }, [addonOrderEnabled.value]);

  // Handle auto-login behavior based on user settings
  useEffect(() => {
    if (typeof window !== "undefined") {
      const autoLogin = localStorage.getItem("autoLogin") || "none";
      const autoLoginProfileId = localStorage.getItem("autoLoginProfileId");
      const lastProfileId = localStorage.getItem("lastProfileId");
      
      // Only auto-redirect if user has auto-login enabled
      if (autoLogin === "last" && lastProfileId) {
        // Check if the last profile still exists
        if (data.profiles.some((p) => p._id === lastProfileId)) {
          window.location.href = `/player/${lastProfileId}`;
        }
      } else if (autoLogin === "profile" && autoLoginProfileId) {
        // Check if the specific profile still exists
        if (data.profiles.some((p) => p._id === autoLoginProfileId)) {
          window.location.href = `/player/${autoLoginProfileId}`;
        }
      }
      // If autoLogin is "none", do nothing - show profile selection
    }
  }, [data.profiles]);

  // Remove modalOpen, don't use it for dimming when settings modal is open
  // Only dim when add/edit profile modal is open (not for settings modal)
  // So, compute modalOpen based on ProfileManager modals only (not showSettings)
  // We'll pass showSettings to ProfileManager, but not use it for dimming here

  return (
    <div class="flex flex-col min-h-screen bg-black">
      <main class="flex-1 flex flex-col justify-center items-center p-4 sm:p-8">
        <div
          class="w-full max-w-2xl min-w-[320px] bg-black bg-opacity-75 p-6 sm:p-8 rounded-lg animate-profilecard-in flex flex-col items-center"
          style={{
            justifyContent: "center",
            // Do not dim for settings modal, only for add/edit profile modal
            // The ProfileManager will handle its own modal dimming
          }}
        >
          {/* Stack profiles and desktop actions together */}
          <div class="flex flex-col items-center w-full">
            <ProfileManager
              initialProfiles={data.profiles}
              showSettings={showSettings}
              setShowSettings={showSettings}
              addonOrderEnabled={addonOrderEnabled}
              setAddonOrderEnabled={addonOrderEnabled}
            />
          </div>
        </div>
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
      </main>
    </div>
  );
}
