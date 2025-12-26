import { isTauri, getServerUrl } from "../../lib/auth-client";
import { appMode } from "../../lib/app-mode";

interface ServerConnectionIndicatorProps {
  /** Visual variant: 'inline' for compact text link, 'card' for settings-style display */
  variant?: 'inline' | 'card';
}

/**
 * Displays the current server connection and allows changing to a different server.
 * Only renders in Tauri (desktop/mobile) apps, returns null in web browsers.
 * In guest mode, shows option to connect to a server instead.
 */
export function ServerConnectionIndicator({ variant = 'inline' }: ServerConnectionIndicatorProps) {
  // Only show in Tauri apps
  if (!isTauri()) {
    return null;
  }

  const isGuestMode = appMode.isGuest();
  const serverHostname = getServerUrl().replace(/^https?:\/\//, '');

  const handleChangeServer = () => {
    localStorage.removeItem("zentrio_server_url");
    localStorage.removeItem("zentrio_app_mode");
    // Navigate to root to trigger server selector
    window.location.href = '/';
  };

  if (variant === 'card') {
    if (isGuestMode) {
      return (
        <div className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4 border-b border-white/5 last:border-0">
          <div className="flex-1 pr-4">
            <h3 className="text-lg font-medium text-white mb-1">Leave Guest Mode</h3>
            <p className="text-sm text-zinc-400">
              You're currently in guest mode. Connect to a server to unlock cloud sync, 
              profile sharing, and full account features.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <button 
              onClick={handleChangeServer}
              className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-lg text-white transition-colors"
            >
              Connect to Server
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col md:flex-row md:items-center justify-between py-6 gap-4 border-b border-white/5 last:border-0">
        <div className="flex-1 pr-4">
          <h3 className="text-lg font-medium text-white mb-1">Server Connection</h3>
          <p className="text-sm text-zinc-400">
            Currently connected to <span className="text-zinc-200 font-medium">{serverHostname}</span>
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <button 
            onClick={handleChangeServer}
            className="px-4 py-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-lg text-white transition-colors"
          >
            Change Server
          </button>
        </div>
      </div>
    );
  }

  // Inline variant (for auth forms)
  if (isGuestMode) {
    return (
      <p className="mt-3">
        <button 
          onClick={handleChangeServer}
          className="text-zinc-400 hover:text-white hover:underline text-xs"
        >
          Guest Mode · Connect to a Server
        </button>
      </p>
    );
  }
  
  return (
    <p className="mt-3">
      <button 
        onClick={handleChangeServer}
        className="text-zinc-400 hover:text-white hover:underline text-xs"
      >
        Connected to {serverHostname} · Change Server
      </button>
    </p>
  );
}
