import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { ColorPicker } from "../shared/components/forms/ColorPicker.tsx";

type AutoLoginOption = "none" | "last" | "profile";

export default function SettingsModal({
  onClose,
  addonOrderEnabled,
  setAddonOrderEnabled,
}: {
  onClose: () => void;
  addonOrderEnabled: { value: boolean };
  setAddonOrderEnabled: { value: boolean };
}) {
  const tab = useSignal<"general" | "experimental">("general");
  
  // Auto-login settings
  const autoLogin = useSignal<AutoLoginOption>("none");
  const autoLoginProfileId = useSignal<string | null>(null);
  const profiles = useSignal<{ _id: string; name: string }[]>([]);
  
  // New general settings
  const accentColor = useSignal<string>("#dc2626");
  const tmdbApiKey = useSignal<string>("");
  
  // Addon sync settings
  const addonSyncEnabled = useSignal<boolean>(false);
  const mainProfileId = useSignal<string>("");
  const autoSync = useSignal<boolean>(false);
  const syncInterval = useSignal<number>(60);
  const lastSyncAt = useSignal<string>("");
  const isSyncing = useSignal<boolean>(false);
  const syncStatus = useSignal<string>("");

  // Load settings from localStorage and server
  useEffect(() => {
    if (typeof window !== "undefined") {
      autoLogin.value = (localStorage.getItem("autoLogin") as AutoLoginOption) || "none";
      autoLoginProfileId.value = localStorage.getItem("autoLoginProfileId") || null;
      accentColor.value = localStorage.getItem("accentColor") || "#dc2626";
      
      // Load profiles for dropdown
      try {
        const stored = localStorage.getItem("profiles");
        if (stored) {
          profiles.value = JSON.parse(stored);
        }
      } catch {}

      // Load TMDB API key from server
      loadTmdbApiKey();
      
      // Load addon sync settings
      loadAddonSyncSettings();
    }
  }, []);

  // Load TMDB API key from server
  const loadTmdbApiKey = async () => {
    try {
      const response = await fetch('/api/tmdb-key');
      if (response.ok) {
        const data = await response.json();
        if (data.hasApiKey) {
          tmdbApiKey.value = data.apiKey; // Will show masked key like "***abcd"
        }
      }
    } catch (error) {
      console.warn('Failed to load TMDB API key:', error);
    }
  };

  // Load addon sync settings from server
  const loadAddonSyncSettings = async () => {
    try {
      const response = await fetch('/api/addon-sync');
      if (response.ok) {
        const data = await response.json();
        const { settings } = data;
        
        addonSyncEnabled.value = settings.enabled || false;
        mainProfileId.value = settings.mainProfileId || "";
        // Remove syncDirection, always main_to_all
        // syncDirection.value = settings.syncDirection || "main_to_all";
        autoSync.value = settings.autoSync || false;
        syncInterval.value = settings.syncInterval || 60;
        lastSyncAt.value = settings.lastSyncAt ? new Date(settings.lastSyncAt).toLocaleString() : "";
      }
    } catch (error) {
      console.warn('Failed to load addon sync settings:', error);
    }
  };

  // Save auto-login settings to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("autoLogin", autoLogin.value);
      if (autoLogin.value === "profile" && autoLoginProfileId.value) {
        localStorage.setItem("autoLoginProfileId", autoLoginProfileId.value);
      } else {
        localStorage.removeItem("autoLoginProfileId");
      }
    }
  }, [autoLogin.value, autoLoginProfileId.value]);

  // Save new general settings to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("accentColor", accentColor.value);
      // Apply accent color to CSS custom property
      document.documentElement.style.setProperty('--accent-color', accentColor.value);
    }
  }, [accentColor.value]);

  // Save TMDB API key to server
  const saveTmdbApiKey = async (apiKey: string) => {
    if (!apiKey || apiKey.startsWith('***')) {
      return; // Don't save empty or masked keys
    }

    try {
      const response = await fetch('/api/tmdb-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });

      if (!response.ok) {
        throw new Error('Failed to save API key');
      }
      
      console.log('TMDB API key saved successfully');
    } catch (error) {
      console.error('Error saving TMDB API key:', error);
      alert('Failed to save TMDB API key. Please try again.');
    }
  };

  // Auto-save TMDB API key with debounce
  useEffect(() => {
    if (!tmdbApiKey.value || tmdbApiKey.value.startsWith('***')) {
      return;
    }

    const timeoutId = setTimeout(() => {
      saveTmdbApiKey(tmdbApiKey.value);
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [tmdbApiKey.value]);

  // Save addon order setting to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("enableAddonOrderUserscript", addonOrderEnabled.value ? "true" : "false");
    }
  }, [addonOrderEnabled.value]);

  // Save addon sync settings to server
  const saveAddonSyncSettings = async () => {
    try {
      const response = await fetch('/api/addon-sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: addonSyncEnabled.value,
          mainProfileId: mainProfileId.value || null,
          // syncDirection: syncDirection.value, // REMOVE
          autoSync: autoSync.value,
          syncInterval: syncInterval.value
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save addon sync settings');
      }
      
      console.log('Addon sync settings saved successfully');
    } catch (error) {
      console.error('Error saving addon sync settings:', error);
      alert('Failed to save addon sync settings. Please try again.');
    }
  };

  // Auto-save addon sync settings with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveAddonSyncSettings();
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [addonSyncEnabled.value, mainProfileId.value, autoSync.value, syncInterval.value]);

  // Manual sync function
  const performManualSync = async () => {
    if (isSyncing.value) return;

    isSyncing.value = true;
    syncStatus.value = "Syncing...";

    try {
      const response = await fetch('/api/addon-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });

      // Debugging: log the response status and body
      let debugText = "";
      if (!response.ok) {
        try {
          debugText = await response.text();
        } catch {}
        console.error("Addon sync failed, status:", response.status, "body:", debugText);
      }

      if (!response.ok) {
        let msg = "Sync failed";
        try {
          // Try to parse JSON error
          const data = JSON.parse(debugText);
          msg = data?.message || msg;
        } catch {
          if (debugText) msg = debugText;
        }
        syncStatus.value = `Sync failed: ${msg}`;
        isSyncing.value = false;
        setTimeout(() => { syncStatus.value = ""; }, 5000);
        return;
      }

      const result = await response.json();

      if (result.success) {
        syncStatus.value = result.message;
        setTimeout(() => loadAddonSyncSettings(), 1000);
      } else {
        syncStatus.value = `Sync failed: ${result.message}`;
      }
    } catch (error) {
      syncStatus.value = `Sync error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isSyncing.value = false;
      setTimeout(() => {
        syncStatus.value = "";
      }, 5000);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div class="bg-gray-900 rounded-lg shadow-2xl w-full max-w-2xl p-6 relative animate-modal-pop max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          class="absolute top-3 right-3 text-gray-400 hover:text-white text-2xl"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 class="text-2xl font-bold mb-6 text-white">Settings</h2>
        
        {/* Tab Navigation */}
        <div class="flex border-b border-gray-700 mb-6">
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

        {/* General Tab */}
        {tab.value === "general" && (
          <div>
            <h3 class="text-lg font-semibold mb-4 text-white">General Settings</h3>
            <div class="mb-6">
              <label class="block text-gray-200 mb-2 font-medium">Auto-login behavior</label>
              <select
                class="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
                value={autoLogin.value}
                onChange={e => (autoLogin.value = e.currentTarget.value as AutoLoginOption)}
              >
                <option value="none">Show profile selection page (default)</option>
                <option value="last">Automatically log in to last used profile</option>
                <option value="profile">Automatically log in to a specific profile</option>
              </select>
              {autoLogin.value === "profile" && profiles.value.length > 0 && (
                <select
                  class="mt-2 w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
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

            {/* Accent Color Setting */}
            <div class="mb-6">
              <div class="flex items-center mb-2">
                <span class="text-xs text-gray-400 mr-2" style={{ minWidth: "90px" }}>
                  Current accent
                </span>
                <div
                  class="rounded-full border border-gray-700"
                  style={{
                    width: "28px",
                    height: "28px",
                    background: accentColor.value,
                    display: "inline-block",
                  }}
                />
              </div>
              <ColorPicker
                label="Accent Color"
                value={accentColor.value}
                onChange={(color) => accentColor.value = color}
                presets={[
                  "#dc2626",
                  "#2563eb",
                  "#059669",
                  "#7c3aed",
                  "#ea580c",
                  "#0891b2",
                  "#be123c"
                ]}
              />
              <p class="text-xs text-gray-500 mt-2">
                Choose your preferred accent color for the interface. This affects buttons, links, and highlights.
              </p>
            </div>

            {/* TMDB API Key Setting */}
            <div class="mb-6">
              <label class="block text-gray-200 mb-2 font-medium">TMDB API Key</label>
              <input
                type="password"
                value={tmdbApiKey.value}
                onInput={(e) => tmdbApiKey.value = e.currentTarget.value}
                placeholder="Enter your TMDB API key (optional)"
                class="w-full bg-gray-800 text-white px-3 py-2 rounded border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
              />
              <p class="text-xs text-gray-500 mt-2">
                Required for NSFW content filtering in profiles. Get your free API key from{" "}
                <a 
                  href="https://www.themoviedb.org/settings/api" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="text-blue-400 hover:text-blue-300 underline"
                >
                  TMDB API Settings
                </a>
                {" "}(free for personal use).
              </p>
            </div>
          </div>
        )}

        {/* Experimental Tab */}
        {tab.value === "experimental" && (
          <div>
            <h3 class="text-lg font-semibold mb-6 text-white">Experimental Features</h3>
            {/* Addons Section */}
            <div class="mb-8">
              <h4 class="text-md font-semibold mb-4 text-gray-300 border-b border-gray-700 pb-2">Addons</h4>
              {/* Addon Sync */}
              <div class="bg-gray-800 rounded-lg p-4 mb-6">
                <div class="flex items-center justify-between mb-4">
                  <div>
                    <span class="text-gray-200 font-medium">Addon Synchronization</span>
                    <p class="text-xs text-gray-400 mt-1">
                      Sync addons between your profiles automatically
                    </p>
                  </div>
                  <div class="flex items-center">
                    <div class="relative">
                      <input
                        type="checkbox"
                        class="sr-only"
                        checked={addonSyncEnabled.value}
                        onChange={e => addonSyncEnabled.value = e.currentTarget.checked}
                      />
                      <div class={`block w-14 h-8 rounded-full transition-colors duration-200 cursor-pointer ${
                        addonSyncEnabled.value 
                          ? 'bg-red-600' 
                          : 'bg-gray-600'
                      }`}
                        onClick={() => addonSyncEnabled.value = !addonSyncEnabled.value}
                      ></div>
                      <div class={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-200 pointer-events-none ${
                        addonSyncEnabled.value ? 'transform translate-x-6' : ''
                      }`}></div>
                    </div>
                    <span class="ml-3 text-sm font-medium text-gray-300">
                      {addonSyncEnabled.value ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
                {addonSyncEnabled.value && (
                  <div class="space-y-4 border-t border-gray-700 pt-4">
                    {/* Main Profile Selection */}
                    <div>
                      <label class="block text-gray-200 mb-2 text-sm font-medium">Main Profile</label>
                      <select
                        class="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
                        value={mainProfileId.value}
                        onChange={e => mainProfileId.value = e.currentTarget.value}
                      >
                        <option value="">Select main profile...</option>
                        {profiles.value.map((p) => (
                          <option key={p._id} value={p._id}>{p.name}</option>
                        ))}
                      </select>
                      <p class="text-xs text-gray-500 mt-1">
                        The profile to sync addons from (main → all others)
                      </p>
                    </div>
                    {/* Auto Sync */}
                    <div class="flex items-center justify-between">
                      <div>
                        <span class="text-gray-200 text-sm font-medium">Auto Sync</span>
                        <p class="text-xs text-gray-400">
                          Automatically sync every {syncInterval.value} minutes
                        </p>
                      </div>
                      <div class="flex items-center">
                        <div class="relative">
                          <input
                            type="checkbox"
                            class="sr-only"
                            checked={autoSync.value}
                            onChange={e => autoSync.value = e.currentTarget.checked}
                          />
                          <div class={`block w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                            autoSync.value 
                              ? 'bg-red-600' 
                              : 'bg-gray-600'
                          }`}
                            onClick={() => autoSync.value = !autoSync.value}
                          ></div>
                          <div class={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 pointer-events-none ${
                            autoSync.value ? 'transform translate-x-6' : ''
                          }`}></div>
                        </div>
                      </div>
                    </div>
                    {/* Sync Interval */}
                    {autoSync.value && (
                      <div>
                        <label class="block text-gray-200 mb-2 text-sm font-medium">
                          Sync Interval (minutes)
                        </label>
                        <input
                          type="number"
                          min="5"
                          max="1440"
                          value={syncInterval.value}
                          onInput={e => syncInterval.value = Math.max(5, parseInt(e.currentTarget.value) || 60)}
                          class="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
                        />
                        <p class="text-xs text-gray-500 mt-1">
                          Minimum 5 minutes, maximum 24 hours (1440 minutes)
                        </p>
                      </div>
                    )}
                    {/* Manual Sync Button */}
                    <div class="flex items-center justify-between pt-2">
                      <div>
                        <button
                          onClick={performManualSync}
                          disabled={isSyncing.value || !mainProfileId.value}
                          class={`px-4 py-2 rounded text-sm font-medium transition-colors duration-200 ${
                            isSyncing.value || !mainProfileId.value
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : 'bg-red-600 hover:bg-red-700 text-white'
                          }`}
                        >
                          {isSyncing.value ? 'Syncing...' : 'Sync Now'}
                        </button>
                        {lastSyncAt.value && (
                          <p class="text-xs text-gray-500 mt-1">
                            Last sync: {lastSyncAt.value}
                          </p>
                        )}
                      </div>
                      {syncStatus.value && (
                        <div class="text-xs text-gray-300 max-w-xs">
                          {syncStatus.value}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                <div class="text-xs text-gray-500 bg-gray-700 rounded p-3 mt-4 space-y-2">
                  <div>
                    <strong>How it works:</strong> This feature uses the Stremio API to sync addons between your profiles. 
                    You can choose a main profile and sync direction. All profiles must have valid Stremio credentials.
                  </div>
                  <div class="border-t border-gray-600 pt-2">
                    <strong>Warning:</strong> This is an experimental feature. Always backup your addon configurations 
                    before using. Sync operations will overwrite existing addon collections.
                  </div>
                </div>
              </div>
              {/* Addon Order Userscript */}
              <div class="bg-gray-800 rounded-lg p-4">
                <div class="flex items-center justify-between mb-3">
                  <div>
                    <span class="text-gray-200 font-medium">Stremio Addon Manager</span>
                    <p class="text-xs text-gray-400 mt-1">
                      Adds an "Edit Order" button to the Stremio Addons page
                    </p>
                  </div>
                  <div class="flex items-center">
                    <div class="relative">
                      <input
                        type="checkbox"
                        class="sr-only"
                        checked={addonOrderEnabled.value}
                        onChange={e => setAddonOrderEnabled.value = e.currentTarget.checked}
                      />
                      <div class={`block w-14 h-8 rounded-full transition-colors duration-200 cursor-pointer ${
                        addonOrderEnabled.value 
                          ? 'bg-red-600' 
                          : 'bg-gray-600'
                      }`}
                        onClick={() => setAddonOrderEnabled.value = !addonOrderEnabled.value}
                      ></div>
                      <div class={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-200 pointer-events-none ${
                        addonOrderEnabled.value ? 'transform translate-x-6' : ''
                      }`}></div>
                    </div>
                    <span class="ml-3 text-sm font-medium text-gray-300">
                      {addonOrderEnabled.value ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
                <div class="text-xs text-gray-500 bg-gray-700 rounded p-3 space-y-2">
                  <div>
                    <strong>How it works:</strong> When enabled, this adds an "Edit Order" button to the Stremio web interface. 
                    Clicking it opens an integrated popup where you can drag-and-drop to reorder your addons and remove 
                    non-protected ones. Changes are saved directly to your Stremio account.
                  </div>
                  <div class="border-t border-gray-600 pt-2">
                    <strong>Credits:</strong> This feature is inspired by and built upon the work of{" "}
                    <a 
                      href="https://github.com/pancake3000/stremio-addon-manager" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      class="text-blue-400 hover:text-blue-300 underline"
                    >
                      pancake3000's stremio-addon-manager
                    </a>
                    . Thank you for the original concept and implementation that made this integrated solution possible.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <style>
          {`
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
    </div>
  );
}