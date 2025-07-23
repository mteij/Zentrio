import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { PageProps } from "$fresh/server.ts";

type AutoLoginOption = "none" | "last" | "profile";

export default function SettingsPage(_props: PageProps) {
  const tab = useSignal<"general" | "experimental">("general");
  const addonOrderEnabled = useSignal(false);

  // Auto-login settings
  const autoLogin = useSignal<AutoLoginOption>("none");
  const autoLoginProfileId = useSignal<string | null>(null);
  const profiles = useSignal<{ _id: string; name: string }[]>([]);

  // Load settings from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      addonOrderEnabled.value = localStorage.getItem("enableAddonOrderUserscript") === "true";
      autoLogin.value = (localStorage.getItem("autoLogin") as AutoLoginOption) || "none";
      autoLoginProfileId.value = localStorage.getItem("autoLoginProfileId") || null;
      // Load profiles for dropdown
      try {
        const stored = localStorage.getItem("profiles");
        if (stored) {
          profiles.value = JSON.parse(stored);
        }
      } catch {}
    }
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem("enableAddonOrderUserscript", addonOrderEnabled.value ? "true" : "false");
  }, [addonOrderEnabled.value]);

  useEffect(() => {
    localStorage.setItem("autoLogin", autoLogin.value);
    if (autoLogin.value === "profile" && autoLoginProfileId.value) {
      localStorage.setItem("autoLoginProfileId", autoLoginProfileId.value);
    } else {
      localStorage.removeItem("autoLoginProfileId");
    }
  }, [autoLogin.value, autoLoginProfileId.value]);

  return (
    <div class="min-h-screen flex flex-col items-center justify-center bg-black px-2">
      <div class="w-full max-w-3xl bg-gray-900 rounded-lg shadow-2xl p-4 sm:p-8 relative mt-6 sm:mt-12"
        style={{ minHeight: "60vh" }}>
        <button
          type="button"
          class="absolute top-3 right-3 text-gray-400 hover:text-white text-2xl"
          onClick={() => (window.location.href = "/profiles")}
          aria-label="Close"
        >
          ×
        </button>
        <h1 class="text-3xl font-bold mb-8 text-white text-center">Settings</h1>
        <div class="flex border-b border-gray-700 mb-8">
          <button
            type="button"
            class={`px-4 py-2 font-semibold transition-colors duration-150 ${
              tab.value === "general"
                ? "text-red-500 border-b-2 border-red-500"
                : "text-gray-400"
            }`}
            onClick={() => (tab.value = "general")}
          >
            General
          </button>
          <button
            type="button"
            class={`px-4 py-2 font-semibold transition-colors duration-150 ${
              tab.value === "experimental"
                ? "text-red-500 border-b-2 border-red-500"
                : "text-gray-400"
            }`}
            onClick={() => (tab.value = "experimental")}
          >
            Experimental
          </button>
        </div>
        {tab.value === "general" && (
          <div>
            <h2 class="text-lg font-semibold mb-4 text-white">General Settings</h2>
            <div class="mb-6">
              <label class="block text-gray-200 mb-2 font-medium">Auto-login behavior</label>
              <select
                class="w-full bg-gray-800 text-white p-2 rounded border border-gray-700"
                value={autoLogin.value}
                onChange={e => (autoLogin.value = e.currentTarget.value as AutoLoginOption)}
              >
                <option value="none">Show profile selection page (default)</option>
                <option value="last">Automatically log in to last used profile</option>
                <option value="profile">Automatically log in to a specific profile</option>
              </select>
              {autoLogin.value === "profile" && (
                <select
                  class="mt-2 w-full bg-gray-800 text-white p-2 rounded border border-gray-700"
                  value={autoLoginProfileId.value ?? ""}
                  onChange={e => (autoLoginProfileId.value = (e.currentTarget.value || null))}
                >
                  <option value="">Select a profile...</option>
                  {profiles.value.map((p) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              )}
              <p class="text-xs text-gray-500 mt-2">
                Choose what happens when you visit the site while logged in.
              </p>
            </div>
          </div>
        )}
        {tab.value === "experimental" && (
          <div>
            <h2 class="text-lg font-semibold mb-4 text-white">Experimental Features</h2>
            <div class="flex items-center justify-between mb-4">
              <span class="text-gray-200">Edit add on order</span>
              <label class="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={addonOrderEnabled.value}
                  onChange={e => (addonOrderEnabled.value = e.currentTarget.checked)}
                  class="form-checkbox h-5 w-5 text-red-600"
                />
                <span class="ml-2 text-gray-400 text-sm">
                  {addonOrderEnabled.value ? "Enabled" : "Disabled"}
                </span>
              </label>
            </div>
            <p class="text-xs text-gray-500">
              Adds a button to the Zentrio Addons page to copy your auth key and open the community Addon Manager.
            </p>
          </div>
        )}
      </div>
      <style>
        {`
          @media (max-width: 640px) {
            .max-w-3xl { max-width: 100vw !important; border-radius: 0 !important; }
            .p-4, .sm\\:p-8 { padding-left: 0.5rem !important; padding-right: 0.5rem !important; }
          }
          @keyframes modal-pop {
            0% { opacity: 0; transform: scale(0.95);}
            100% { opacity: 1; transform: scale(1);}
          }
          .animate-modal-pop {
            animation: modal-pop 0.3s cubic-bezier(.4,2,.6,1) both;
          }
        `}
      </style>
    </div>
  );
}
