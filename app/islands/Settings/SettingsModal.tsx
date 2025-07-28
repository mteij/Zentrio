import { h } from "preact";
import { useSignal, Signal } from "@preact/signals";
import { useEffect } from "preact/hooks";

import { ColorPicker } from "../../shared/components/forms/ColorPicker.tsx";
import { useToast } from "../../shared/hooks/useToast.ts";
import { usePwa } from "../../shared/hooks/usePwa.ts";
import { useFileSystem } from "../../shared/hooks/useFileSystem.ts";
import Setting from "../../shared/components/Settings/Setting.tsx";
import PluginSetting from "../../shared/components/Settings/PluginSetting.tsx";
import { useSetting } from "../../shared/hooks/useSetting.ts";

type AutoLoginOption = "none" | "last" | "profile";

export default function SettingsModal({
  onClose,
  isMobile,
}: {
  onClose: () => void;
  isMobile: boolean;
}) {
  const tab = useSignal<"general" | "plugins" | "ui" | "account">("general");
  const { success, error } = useToast();
  const isPwa = usePwa();
  const { canUseFileSystem, directoryName, selectDirectory } = useFileSystem();

  // Settings using the useSetting hook
  const settingsToLoad = 12;
  const loadedSettings = useSignal(0);
  const loadToastShown = useSignal(false);

  const onSettingLoad = () => {
    loadedSettings.value++;
  };

  const autoLogin = useSetting<AutoLoginOption>("autoLogin", "none", "localStorage", onSettingLoad);
  const autoLoginProfileId = useSetting<string | null>("autoLoginProfileId", null, "localStorage", onSettingLoad);
  const accentColor = useSetting<string>("accentColor", "#dc2626", "localStorage", onSettingLoad);
  const tmdbApiKey = useSetting<string>("tmdbApiKey", "", "server", onSettingLoad);
  const sessionLength = useSetting<string>("sessionLengthDays", "30", "localStorage", onSettingLoad);
  const hideCalendarButton = useSetting<boolean>("hideCalendarButton", false, "server", onSettingLoad);
  const hideAddonsButton = useSetting<boolean>("hideAddonsButton", false, "server", onSettingLoad);
  const mobileClickToHover = useSetting<boolean>("mobileClickToHover", false, "server", onSettingLoad);
  const addonSyncEnabled = useSetting<boolean>("addonSyncEnabled", false, "server", onSettingLoad);
  const addonSyncData = useSetting<any>("addonSyncData", { mainProfileId: null, autoSync: false }, "server", onSettingLoad);
  const addonOrderEnabled = useSetting<boolean>("addonOrderEnabled", false, "server", onSettingLoad);
  const downloadsManagerEnabled = useSetting<boolean>("downloadsEnabled", false, "server", onSettingLoad);

  // Other state signals
  const profiles = useSignal<{ _id: string; name: string }[]>([]);
  const deletePassword = useSignal<string>("");

  // Load initial data
  useEffect(() => {
    if (loadedSettings.value >= settingsToLoad && !loadToastShown.value) {
      success("All settings loaded successfully.");
      loadToastShown.value = true;
    }
  }, [loadedSettings.value]);

  useEffect(() => {
    // Load profiles from localStorage
    try {
      const stored = localStorage.getItem("profiles");
      if (stored) {
        profiles.value = JSON.parse(stored);
      }
    } catch {
      // Ignore parsing errors
    }
  }, []);

  // Apply accent color when it changes
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', accentColor.value);
    const themeColorMeta = document.getElementById('theme-color-meta') as HTMLMetaElement;
    if (themeColorMeta) {
      themeColorMeta.content = accentColor.value;
    }
  }, [accentColor.value]);



  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className={`bg-gray-900 rounded-lg shadow-2xl w-full ${isMobile ? 'max-w-md p-4' : 'max-w-2xl p-6'} relative animate-modal-pop max-h-[90vh] overflow-y-auto`}>
        <button
          type="button"
          className="absolute top-3 right-3 text-gray-400 hover:text-white text-2xl"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-6 text-white">Settings</h2>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-700 mb-6">
          {["general", "ui", "plugins", "account"].map((tabName) => (
            <button
              type="button"
              className={`px-4 py-2 font-medium text-base transition-colors duration-150 ${
                tab.value === tabName ? "" : "text-gray-400 hover:text-gray-200"
              }`}
              style={
                tab.value === tabName
                  ? { color: accentColor.value, borderBottom: `2px solid ${accentColor.value}` }
                  : undefined
              }
              onClick={() => (tab.value = tabName as any)}
            >
              {tabName.charAt(0).toUpperCase() + tabName.slice(1)}
            </button>
          ))}
        </div>

        {/* General Tab */}
        {tab.value === "general" && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">General Settings</h3>
            <Setting
              title="Auto-login behavior"
              description="Choose what happens when you visit the site while logged in."
            >
              <select
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                value={autoLogin.value}
                onChange={(e) => (autoLogin.value = e.currentTarget.value as AutoLoginOption)}
              >
                <option value="none">Show profile selection page (default)</option>
                <option value="last">Automatically log in to last used profile</option>
                <option value="profile">Automatically log in to a specific profile</option>
              </select>
              {autoLogin.value === "profile" && profiles.value.length > 0 && (
                <select
                  className="mt-2 w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                  value={autoLoginProfileId.value ?? ""}
                  onChange={(e) => (autoLoginProfileId.value = e.currentTarget.value || null)}
                >
                  <option value="">Select a profile...</option>
                  {profiles.value.map((p) => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
              )}
            </Setting>

            <Setting
              title="TMDB API Key"
              description={
                <>
                  Required for NSFW content filtering. Get a free key from{" "}
                  <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                    TMDB
                  </a>.
                </>
              }
            >
              <input
                type="password"
                value={tmdbApiKey.value}
                onInput={(e) => (tmdbApiKey.value = e.currentTarget.value)}
                placeholder="Enter your TMDB API key"
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
              />
            </Setting>

            <Setting
              title="Session Length"
              description="How long your login session should last."
            >
              <select
                className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                value={sessionLength.value}
                onChange={(e) => (sessionLength.value = e.currentTarget.value)}
              >
                <option value="0">Never</option>
                <option value="0.0417">1 hour</option>
                <option value="1">1 day</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
              </select>
            </Setting>
          </div>
        )}

        {/* UI Tab */}
        {tab.value === "ui" && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">UI Settings</h3>
            <Setting
              title="Accent Color"
              description="Choose the accent color for the interface."
            >
              <ColorPicker
                value={accentColor.value}
                onChange={(color) => (accentColor.value = color)}
                presets={["#dc2626", "#2563eb", "#059669", "#7c3aed", "#ea580c"]}
              />
            </Setting>
            <Setting
              title="Hide Calendar Button"
              description="Hide the calendar button in the Stremio UI."
            >
              <div class="flex items-center justify-end">
                <input
                  type="checkbox"
                  checked={hideCalendarButton.value}
                  onChange={(e) => (hideCalendarButton.value = e.currentTarget.checked)}
                />
              </div>
            </Setting>
            <Setting
              title="Hide Addons Button"
              description="Hide the addons button in the Stremio UI."
            >
              <div class="flex items-center justify-end">
                <input
                  type="checkbox"
                  checked={hideAddonsButton.value}
                  onChange={(e) => (hideAddonsButton.value = e.currentTarget.checked)}
                />
              </div>
            </Setting>
            <Setting
              title="Mobile Click to Show Controls"
              description="On mobile, tap the video to show controls instead of pausing."
            >
              <div class="flex items-center justify-end">
                <input
                  type="checkbox"
                  checked={mobileClickToHover.value}
                  onChange={(e) => (mobileClickToHover.value = e.currentTarget.checked)}
                />
              </div>
            </Setting>
          </div>
        )}

        {/* Plugins Tab */}
        {tab.value === "plugins" && (
          <div>
            <h3 className="text-lg font-semibold mb-6 text-white">Plugins</h3>
            <PluginSetting
              title="Addons Synchronization"
              enabled={addonSyncEnabled}
              isExperimental
              howItWorks="Syncs Stremio addons between profiles."
              warning="This is experimental. Back up your addons."
            >
              <div>
                <label className="block text-gray-200 mb-2 text-sm font-medium">
                  Main Profile
                </label>
                <select
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600"
                  value={addonSyncData.value.mainProfileId}
                  onChange={(e) => (addonSyncData.value = { ...addonSyncData.value, mainProfileId: e.currentTarget.value })}
                >
                  <option value="">Select main profile...</option>
                  {profiles.value.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-200 text-sm font-medium">
                  Auto Sync
                </span>
                <input
                  type="checkbox"
                  checked={addonSyncData.value.autoSync}
                  onChange={(e) => (addonSyncData.value = { ...addonSyncData.value, autoSync: (e.target as HTMLInputElement).checked })}
                />
              </div>
            </PluginSetting>
            <PluginSetting
              title="Stremio Addon Manager"
              enabled={addonOrderEnabled}
              howItWorks="Adds an 'Edit Order' button to the Stremio addons page."
            >
              <p class="text-sm text-gray-400">
                This feature is enabled or disabled globally.
              </p>
            </PluginSetting>
            <PluginSetting
              title="Downloads Manager"
              enabled={downloadsManagerEnabled}
              isExperimental
              howItWorks="Download videos for offline viewing."
              pwaOnly
            >
              {downloadsManagerEnabled.value && (
                <div>
                  <label className="block text-gray-200 mb-2 text-sm font-medium">
                    Download Location
                  </label>
                  {canUseFileSystem ? (
                    <div>
                      <button
                        type="button"
                        onClick={selectDirectory}
                        className="px-4 py-2 rounded text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
                      >
                        Choose Directory
                      </button>
                      {directoryName.value && (
                        <p className="text-sm text-gray-300 mt-2">
                          Selected:{" "}
                          <span className="font-semibold">
                            {directoryName.value}
                          </span>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-yellow-400">
                      File System API not supported.
                    </p>
                  )}
                </div>
              )}
            </PluginSetting>
          </div>
        )}

        {/* Account Tab */}
        {tab.value === "account" && (
          <div>
            <h3 className="text-lg font-semibold mb-4 text-white">Account Settings</h3>
            <div className="bg-gray-800 rounded-lg p-4 mb-4">
              <h4 className="text-base font-medium text-gray-200 mb-2">Change Password</h4>
              <p className="text-xs text-gray-400 mt-2 mb-3">
                Click the button below to receive an email with a link to reset your password.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const response = await fetch('/api/auth/request-password-change', { method: 'POST' });
                    const result = await response.json();
                    if (response.ok) {
                      alert(result.message || 'Password reset email sent successfully.');
                    } else {
                      throw new Error(result.error || 'Failed to send password reset email.');
                    }
                  } catch (err) {
                    console.error('Password reset request failed:', err);
                    alert(err instanceof Error ? err.message : 'An unknown error occurred.');
                  }
                }}
                className="px-4 py-2 rounded text-sm font-medium transition-colors duration-200 bg-red-600 hover:bg-red-700 text-white"
              >
                Send Password Reset Email
              </button>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-red-600/50">
              <h4 className="text-base font-medium text-red-400 mb-2">Delete Account</h4>
              <p className="text-xs text-gray-400 mt-2 mb-3">
                This action is irreversible. All your data, including profiles and settings, will be permanently deleted. You will be logged out immediately.
              </p>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="password-confirm">Confirm with password</label>
                <input
                  type="password"
                  id="password-confirm"
                  placeholder="Enter your password"
                  className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={deletePassword.value}
                  onInput={(e) => deletePassword.value = e.currentTarget.value}
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!confirm("Are you sure you want to permanently delete your account? This action cannot be undone.")) {
                    return;
                  }
                  try {
                    const response = await fetch('/api/auth/delete-account', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ password: deletePassword.value }),
                    });
                    const result = await response.json();
                    if (response.ok) {
                      alert(result.message || 'Account deleted successfully.');
                      globalThis.location.href = '/auth/logout';
                    } else {
                      throw new Error(result.error || 'Failed to delete account.');
                    }
                  } catch (err) {
                    console.error('Account deletion failed:', err);
                    alert(err instanceof Error ? err.message : 'An unknown error occurred.');
                  }
                }}
                className="mt-4 px-4 py-2 rounded text-sm font-medium transition-colors duration-200 bg-red-800 hover:bg-red-700 text-white w-full"
              >
                Permanently Delete My Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}