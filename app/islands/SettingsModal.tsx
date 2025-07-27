import { h as _h } from "preact";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";

import { ColorPicker } from "../shared/components/forms/ColorPicker.tsx";

type AutoLoginOption = "none" | "last" | "profile";

export default function SettingsModal({
  onClose,
  addonOrderEnabled,
  setAddonOrderEnabled,
  isMobile,
}: {
  onClose: () => void;
  addonOrderEnabled: { value: boolean };
  setAddonOrderEnabled: { value: boolean };
  isMobile: boolean;
}) {
  const tab = useSignal<"general" | "addons" | "ui">("general");
  
  // Auto-login settings
  const autoLogin = useSignal<AutoLoginOption>("none");
  const autoLoginProfileId = useSignal<string | null>(null);
  const profiles = useSignal<{ _id: string; name: string }[]>([]);

  // New general settings
  const accentColor = useSignal<string>("#dc2626");
  const tmdbApiKey = useSignal<string>("");
  const hideCalendarButton = useSignal<boolean>(false);
  const hideAddonsButton = useSignal<boolean>(false);
  const pwaOrientation = useSignal<string>("auto");

  // Addon sync settings
  const addonSyncEnabled = useSignal<boolean>(false);
  const mainProfileId = useSignal<string>("");

  const autoSync = useSignal<boolean>(false);
  const syncInterval = useSignal<number>(60);
  const lastSyncAt = useSignal<string>("");
  const isSyncing = useSignal<boolean>(false);
  const syncStatus = useSignal<string>("");

  const isPWA = useSignal<boolean>(false);
  // Collapsible section states - collapsed by default
  const addonSyncCollapsed = useSignal<boolean>(true);
  const addonManagerCollapsed = useSignal<boolean>(true);

  // Load settings from localStorage and server
  useEffect(() => {
    if (typeof window !== "undefined") {
      autoLogin.value = (localStorage.getItem("autoLogin") as AutoLoginOption) || "none";
      autoLoginProfileId.value = localStorage.getItem("autoLoginProfileId") || null;
      accentColor.value = localStorage.getItem("accentColor") || "#dc2626";
      pwaOrientation.value = localStorage.getItem("pwaOrientation") || "auto";
      
      // Load profiles for dropdown
      try {
        const stored = localStorage.getItem("profiles");
        if (stored) {
          profiles.value = JSON.parse(stored);
        }
      } catch {}

      // Load TMDB API key from server
      loadTmdbApiKey();
      
      // Load addon manager setting from server
      loadAddonManagerSetting();
      
      // Load addon sync settings
      loadAddonSyncSettings();
      
      // Load hide calendar button setting from server
      loadHideCalendarButtonSetting();

      // Load hide addons button setting from server
      loadHideAddonsButtonSetting();
    if (window.matchMedia('(display-mode: standalone)').matches) {
        isPWA.value = true;
      }
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

  // Load addon manager setting from server
  const loadAddonManagerSetting = async () => {
    try {
      const response = await fetch('/api/addon-manager');
      if (response.ok) {
        const data = await response.json();
        setAddonOrderEnabled.value = data.enabled || false;
      }
    } catch (error) {
      console.warn('Failed to load addon manager setting:', error);
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
        mainProfileId.value = settings.mainProfileId ? settings.mainProfileId.toString() : "";
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

  // Load hide calendar button setting from server
  const loadHideCalendarButtonSetting = async () => {
    try {
      const response = await fetch('/api/hide-calendar');
      if (response.ok) {
        const data = await response.json();
        hideCalendarButton.value = data.hideCalendarButton || false;
      }
    } catch (error) {
      console.warn('Failed to load hide calendar button setting:', error);
    }
  };

  // Save hide calendar button setting to server
  const saveHideCalendarButtonSetting = async (hide: boolean) => {
    try {
      const response = await fetch('/api/hide-calendar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hideCalendarButton: hide }),
      });

      if (!response.ok) {
        throw new Error('Failed to save hide calendar button setting');
      }
      
      console.log('Hide calendar button setting saved successfully');
    } catch (error) {
      console.error('Error saving hide calendar button setting:', error);
      alert('Failed to save hide calendar button setting. Please try again.');
    }
  };

  // Auto-save hide calendar button setting with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveHideCalendarButtonSetting(hideCalendarButton.value);
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [hideCalendarButton.value]);

  // Load hide addons button setting from server
  const loadHideAddonsButtonSetting = async () => {
    try {
      const response = await fetch('/api/hide-addons');
      if (response.ok) {
        const data = await response.json();
        hideAddonsButton.value = data.hideAddonsButton || false;
      }
    } catch (error) {
      console.warn('Failed to load hide addons button setting:', error);
    }
  };

  // Save hide addons button setting to server
  const saveHideAddonsButtonSetting = async (hide: boolean) => {
    try {
      const response = await fetch('/api/hide-addons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hideAddonsButton: hide }),
      });

      if (!response.ok) {
        throw new Error('Failed to save hide addons button setting');
      }
      
      console.log('Hide addons button setting saved successfully');
    } catch (error) {
      console.error('Error saving hide addons button setting:', error);
      alert('Failed to save hide addons button setting. Please try again.');
    }
  };

  // Auto-save hide addons button setting with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveHideAddonsButtonSetting(hideAddonsButton.value);
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
  }, [hideAddonsButton.value]);

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
      // Update PWA theme color
      const themeColorMeta = document.getElementById('theme-color-meta') as HTMLMetaElement;
      if (themeColorMeta) {
        themeColorMeta.content = accentColor.value;
      }
    }
  }, [accentColor.value]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pwaOrientation", pwaOrientation.value);
    }
  }, [pwaOrientation.value]);

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

  // Save addon manager setting to server
  const saveAddonManagerSetting = async (enabled: boolean) => {
    try {
      const response = await fetch('/api/addon-manager', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (!response.ok) {
        throw new Error('Failed to save addon manager setting');
      }
      
      console.log('Addon manager setting saved successfully');
    } catch (error) {
      console.error('Error saving addon manager setting:', error);
      alert('Failed to save addon manager setting. Please try again.');
    }
  };

  // Auto-save addon manager setting with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveAddonManagerSetting(addonOrderEnabled.value);
    }, 1000); // Debounce for 1 second

    return () => clearTimeout(timeoutId);
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
            <button
              type="button"
              className={`px-4 py-2 font-medium text-base transition-colors duration-150 ${
              tab.value === "general"
                ? "" // Remove static color classes
                : "text-gray-400 hover:text-gray-200"
            }`}
              style={
                tab.value === "general"
                  ? {
                      color: accentColor.value,
                      borderBottom: `2px solid ${accentColor.value}`,
                    }
                  : undefined
              }
              onClick={() => (tab.value = "general")}
            >
              General
            </button>
            <button
              type="button"
              className={`px-4 py-2 font-medium text-base transition-colors duration-150 ${
              tab.value === "ui"
                ? "" // Remove static color classes
                : "text-gray-400 hover:text-gray-200"
            }`}
              style={
                tab.value === "ui"
                  ? {
                      color: accentColor.value,
                      borderBottom: `2px solid ${accentColor.value}`,
                    }
                  : undefined
              }
              onClick={() => (tab.value = "ui")}
            >
              UI
            </button>
            <button
              type="button"
              className={`px-4 py-2 font-medium text-base transition-colors duration-150 ${
              tab.value === "addons"
                ? "" // Remove static color classes
                : "text-gray-400 hover:text-gray-200"
            }`}
              style={
                tab.value === "addons"
                  ? {
                      color: accentColor.value,
                      borderBottom: `2px solid ${accentColor.value}`,
                    }
                  : undefined
              }
              onClick={() => (tab.value = "addons")}
            >
              Addons
            </button>
          </div>

        {/* General Tab */}
          {tab.value === "general" && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-white">General Settings</h3>
              
              {/* Auto-login behavior */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="mb-0">
                  <label className="block text-base font-medium text-gray-200 mb-2">Auto-login behavior</label>
                  <select
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
                    value={autoLogin.value}
                    onChange={e => (autoLogin.value = e.currentTarget.value as AutoLoginOption)}
                  >
                    <option value="none">Show profile selection page (default)</option>
                    <option value="last">Automatically log in to last used profile</option>
                    <option value="profile">Automatically log in to a specific profile</option>
                  </select>
                  {autoLogin.value === "profile" && profiles.value.length > 0 && (
                    <select
                      className="mt-2 w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
                      value={autoLoginProfileId.value ?? ""}
                      onChange={e => (autoLoginProfileId.value = (e.currentTarget.value || null))}
                    >
                      <option value="">Select a profile...</option>
                      {profiles.value.map((p) => (
                        <option key={p._id} value={p._id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Choose what happens when you visit the site while logged in.
                  </p>
                </div>
              </div>


              {/* TMDB API Key Setting */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="mb-0">
                  <label className="block text-base font-medium text-gray-200 mb-2">TMDB API Key</label>
                  <input
                    type="password"
                    value={tmdbApiKey.value}
                    onInput={(e) => tmdbApiKey.value = e.currentTarget.value}
                    placeholder="Enter your TMDB API key (optional)"
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Required for NSFW content filtering in profiles. Get your free API key from{" "}
                    <a 
                      href="https://www.themoviedb.org/settings/api" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline"
                    >
                      TMDB API Settings
                    </a>
                    {" "}(free for personal use).
                  </p>
                </div>
              </div>

              {/* Session Length Setting */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="mb-0">
                  <label className="block text-base font-medium text-gray-200 mb-2">Session Length</label>
                  <select
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
                    value={localStorage.getItem("sessionLengthDays") || "30"}
                    onChange={e => {
                      localStorage.setItem("sessionLengthDays", e.currentTarget.value);
                    }}
                  >
                    <option value="0">Never (stay logged in)</option>
                    <option value="0.0417">1 hour</option>
                    <option value="0.125">3 hours</option>
                    <option value="1">1 day</option>
                    <option value="7">7 days</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="365">1 year</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    How long your login session should last before requiring re-authentication
                  </p>
                </div>
              </div>

            </div>
          )}

        {/* Addons Tab */}
          {tab.value === "addons" && (
            <div>
              <h3 className="text-lg font-semibold mb-6 text-white">Addons</h3>
                {/* Addon Sync */}
                <div className="bg-gray-800 rounded-lg p-4 mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-2">
                    <button
                      type="button"
                      onClick={() => addonSyncCollapsed.value = !addonSyncCollapsed.value}
                      className="flex items-center gap-3 flex-1 text-left bg-transparent border-none p-0 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <svg
                          className={`w-5 h-5 text-gray-300 transition-transform duration-200 ${
                            addonSyncCollapsed.value ? '' : 'rotate-90'
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-gray-200 font-medium text-base group-hover:text-white transition-colors">
                            Addon Synchronization
                          </span>
                          <span className="text-xs font-semibold text-red-500">Experimental</span>
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={addonSyncEnabled.value}
                          onChange={e => addonSyncEnabled.value = e.currentTarget.checked}
                        />
                        <div className={`block w-14 h-8 rounded-full transition-colors duration-200 cursor-pointer ${
                          addonSyncEnabled.value 
                            ? 'bg-red-600' 
                            : 'bg-gray-600'
                        }`}
                          onClick={() => addonSyncEnabled.value = !addonSyncEnabled.value}
                        ></div>
                        <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-200 pointer-events-none ${
                          addonSyncEnabled.value ? 'transform translate-x-6' : ''
                        }`}></div>
                      </div>
                      <span className="ml-3 text-sm font-medium text-gray-300">
                        {addonSyncEnabled.value ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  </div>
                  {addonSyncCollapsed.value ? (
                    <p className="text-xs text-gray-400 mt-2">
                      Sync your Stremio addons between profiles automatically. Click to expand for options and important warnings.
                    </p>
                  ) : (
                    <div className="space-y-4 border-t border-gray-700 pt-4 animate-fadeIn">
                      <p className="text-sm text-gray-400">
                        Sync addons between your profiles automatically.
                      </p>
                      {/* Main Profile Selection */}
                      <div>
                        <label className="block text-gray-200 mb-2 text-sm font-medium">Main Profile</label>
                        <select
                          className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
                          value={mainProfileId.value}
                          onChange={e => mainProfileId.value = e.currentTarget.value}
                        >
                          <option value="">Select main profile...</option>
                          {profiles.value.map((p) => (
                            <option key={p._id} value={p._id}>{p.name}</option>
                          ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                          The profile to sync addons from (main → all others)
                        </p>
                      </div>
                      {/* Auto Sync */}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-gray-200 text-sm font-medium">Auto Sync</span>
                          <p className="text-xs text-gray-400">
                            Automatically sync every {syncInterval.value} minutes
                          </p>
                        </div>
                        <div className="flex items-center">
                          <div className="relative">
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={autoSync.value}
                              onChange={e => autoSync.value = e.currentTarget.checked}
                            />
                            <div className={`block w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                              autoSync.value 
                                ? 'bg-red-600' 
                                : 'bg-gray-600'
                            }`}
                              onClick={() => autoSync.value = !autoSync.value}
                            ></div>
                            <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 pointer-events-none ${
                              autoSync.value ? 'transform translate-x-6' : ''
                            }`}></div>
                          </div>
                        </div>
                      </div>
                      {/* Sync Interval */}
                      {autoSync.value && (
                        <div>
                          <label className="block text-gray-200 mb-2 text-sm font-medium">
                            Sync Interval (minutes)
                          </label>
                          <input
                            type="number"
                            min="5"
                            max="1440"
                            value={syncInterval.value}
                            onInput={e => syncInterval.value = Math.max(5, parseInt(e.currentTarget.value) || 60)}
                            className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Minimum 5 minutes, maximum 24 hours (1440 minutes)
                          </p>
                        </div>
                      )}
                      {/* Manual Sync Button */}
                      <div className="flex items-center justify-between pt-2">
                        <div>
                          <button
                            onClick={performManualSync}
                            disabled={isSyncing.value || !mainProfileId.value}
                            className={`px-4 py-2 rounded text-sm font-medium transition-colors duration-200 ${
                              isSyncing.value || !mainProfileId.value
                                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                : 'bg-red-600 hover:bg-red-700 text-white'
                            }`}
                          >
                            {isSyncing.value ? 'Syncing...' : 'Sync Now'}
                          </button>
                          {lastSyncAt.value && (
                            <p className="text-xs text-gray-500 mt-1">
                              Last sync: {lastSyncAt.value}
                            </p>
                          )}
                        </div>
                        {syncStatus.value && (
                          <div className="text-xs text-gray-300 max-w-xs">
                            {syncStatus.value}
                          </div>
                        )}
                      </div>
                      {/* Warnings and disclaimers only when expanded */}
                      <div className="text-xs text-gray-500 bg-gray-700 rounded p-3 mt-4 space-y-2">
                        <div>
                          <strong>How it works:</strong> This feature uses the Stremio API to sync addons between your profiles. 
                          You can choose a main profile and sync direction. All profiles must have valid Stremio credentials.
                        </div>
                        <div className="border-t border-gray-600 pt-2">
                          <strong>Warning:</strong> This is an experimental feature. Always backup your addon configurations 
                          before using. Sync operations will overwrite existing addon collections.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {/* Addon Order Userscript */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-2">
                    <button
                      type="button"
                      onClick={() => addonManagerCollapsed.value = !addonManagerCollapsed.value}
                      className="flex items-center gap-3 flex-1 text-left bg-transparent border-none p-0 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-5 h-5 text-gray-300 transition-transform duration-200 ${
                          addonManagerCollapsed.value ? '' : 'rotate-90'
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-200 font-medium text-base group-hover:text-white transition-colors">
                          Stremio Addon Manager
                        </span>
                        {/* Removed Experimental tag */}
                      </div>
                    </div>
                  </button>
                  <div className="flex items-center">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={addonOrderEnabled.value}
                        onChange={e => setAddonOrderEnabled.value = e.currentTarget.checked}
                      />
                      <div className={`block w-14 h-8 rounded-full transition-colors duration-200 cursor-pointer ${
                        addonOrderEnabled.value 
                          ? 'bg-red-600' 
                          : 'bg-gray-600'
                      }`}
                        onClick={() => setAddonOrderEnabled.value = !addonOrderEnabled.value}
                      ></div>
                      <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-200 pointer-events-none ${
                        addonOrderEnabled.value ? 'transform translate-x-6' : ''
                      }`}></div>
                    </div>
                    <span className="ml-3 text-sm font-medium text-gray-300">
                      {addonOrderEnabled.value ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
                {addonManagerCollapsed.value ? (
                  <p className="text-xs text-gray-400 mt-2">
                    Adds an "Edit Order" button to the Stremio Addons page.
                  </p>
                ) : (
                  <div className="space-y-4 border-t border-gray-700 pt-4 animate-fadeIn">
                    <p className="text-sm text-gray-400">
                      Adds an "Edit Order" button to the Stremio Addons page.
                    </p>
                    <div className="text-xs text-gray-500 bg-gray-700 rounded p-3 space-y-2">
                      <div>
                        <strong>How it works:</strong> When enabled, this adds an "Edit Order" button to the Stremio web interface. 
                        Clicking it opens an integrated popup where you can drag-and-drop to reorder your addons and remove 
                        non-protected ones. Changes are saved directly to your Stremio account.
                      </div>
                      <div className="border-t border-gray-600 pt-2">
                        <strong>Credits:</strong> This feature is inspired by and built upon the work of{" "}
                          <a 
                            href="https://github.com/pancake3000/stremio-addon-manager" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline"
                        >
                          pancake3000's stremio-addon-manager
                        </a>
                        . Thank you for the original concept and implementation that made this integrated solution possible.
                      </div>
                    </div>
                  </div>
                )}
              </div>
          </div>
        )}

        {/* UI Tab */}
          {tab.value === "ui" && (
            <div>
              <h3 className="text-lg font-semibold mb-4 text-white">UI Settings</h3>
              
              {/* Accent Color Setting */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="mb-0">
                  <label className="block text-base font-medium text-gray-200 mb-2">Accent Color</label>
                  {/* Show current color above the options */}
                  <div className="flex items-center mb-3">
                    <span className="text-sm text-gray-400 mr-2">Current accent color:</span>
                    <div
                      className="w-6 h-6 rounded border-2 border-gray-600"
                      style={{ backgroundColor: accentColor.value }}
                    ></div>
                    <span className="ml-2 text-sm text-gray-400 font-mono">{accentColor.value}</span>
                  </div>
                  <ColorPicker
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
                  <p className="text-xs text-gray-500 mt-2">
                    Choose your preferred accent color for the interface. This affects buttons, links, and highlights.
                  </p>
                </div>
              </div>

              {/* Hide Calendar Button Setting */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="mb-0">
                  <div className="flex items-center justify-between">
                    <label className="block text-base font-medium text-gray-200">Hide Calendar Button</label>
                    <div className="relative inline-block w-12 h-6">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={hideCalendarButton.value}
                        onChange={e => hideCalendarButton.value = e.currentTarget.checked}
                      />
                      <div className={`block w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                        hideCalendarButton.value
                          ? 'bg-red-600'
                          : 'bg-gray-600'
                      }`}
                        onClick={() => hideCalendarButton.value = !hideCalendarButton.value}
                      ></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 pointer-events-none ${
                        hideCalendarButton.value ? 'transform translate-x-6' : ''
                      }`}></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Hide the calendar button in the Stremio interface. Refresh the Stremio page after changing this setting.
                  </p>
                </div>
              </div>

              {/* Hide Addons Button Setting */}
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="mb-0">
                  <div className="flex items-center justify-between">
                    <label className="block text-base font-medium text-gray-200">Hide Addons Button</label>
                    <div className="relative inline-block w-12 h-6">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={hideAddonsButton.value}
                        onChange={e => hideAddonsButton.value = e.currentTarget.checked}
                      />
                      <div className={`block w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer ${
                        hideAddonsButton.value
                          ? 'bg-red-600'
                          : 'bg-gray-600'
                      }`}
                        onClick={() => hideAddonsButton.value = !hideAddonsButton.value}
                      ></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 pointer-events-none ${
                        hideAddonsButton.value ? 'transform translate-x-6' : ''
                      }`}></div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Hide the addons button in the Stremio interface. Refresh the Stremio page after changing this setting.
                  </p>
                </div>
              </div>

              {/* PWA Orientation Setting */}
              {isPWA.value &&
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="mb-0">
                  <label className="block text-base font-medium text-gray-200 mb-2">PWA Orientation</label>
                  <select
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
                    value={pwaOrientation.value}
                    onChange={e => (pwaOrientation.value = e.currentTarget.value)}
                  >
                    <option value="auto">Auto (default)</option>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-2">
                    Sets the orientation for the Progressive Web App.
                  </p>
                </div>
              </div>}
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
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fadeIn {
            animation: fadeIn 0.2s ease-out;
          }
          `}
        </style>
      </div>
    </div>
  );
}
