import { useState, useEffect } from 'react';
import { Button } from '../index';
import { RefreshCw, Download, CheckCircle, Smartphone } from 'lucide-react';
import { fetch } from '@tauri-apps/plugin-http';
import { getVersion } from '@tauri-apps/api/app';
import { UpdateModal } from './modals/UpdateModal';
import { toast } from 'sonner';

export function UpdateSettings() {
  const [loading, setLoading] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('Unknown');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateData, setUpdateData] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    // Get current app version
    getVersion().then(v => setCurrentVersion(v)).catch(console.error);
  }, []);

  const checkForUpdates = async (silent = false) => {
    setLoading(true);
    try {
      // Fetch latest release from GitHub
      // Note: Use a proxy if rate limiting is an issue, or client-side fetch is fine for low volume
      const response = await fetch('https://api.github.com/repos/mteij/Zentrio/releases/latest', {
         headers: {
             'User-Agent': 'Zentrio-App'
         }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch update info');
      }

      const data = await response.json();
      const latestVersion = data.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present

      // Compare versions (semver-ish)
      // We assume simple comparison or use a library if needed.
      // For now, strict string inequality or simple check.
      // Ideally usage of 'semver' package.
      
      const hasUpdate = compareVersions(currentVersion, latestVersion);

      if (hasUpdate) {
        setUpdateAvailable(true);
        setUpdateData({
            version: latestVersion,
            body: data.body,
            assets: data.assets
        });
        if (!silent) setShowModal(true);
      } else {
        setUpdateAvailable(false);
        if (!silent) toast.success('Up to date', { description: 'You are using the latest version.' });
      }
      setLastChecked(new Date());

    } catch (e) {
      console.error(e);
      if (!silent) toast.error('Update Check Failed', { description: 'Could not connect to update server.' });
    } finally {
      setLoading(false);
    }
  };

  // Simple version comparison (returns true if v2 > v1)
  const compareVersions = (v1: string, v2: string) => {
    // Handle "Unknown"
    if (v1 === 'Unknown') return false;
    
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p2 > p1) return true;
      if (p2 < p1) return false;
    }
    return false;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-white">System & Updates</h2>
        <p className="text-zinc-400">Manage application updates and view system information.</p>
      </div>

      {/* Version Card */}
      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${updateAvailable ? 'bg-indigo-500/20 text-indigo-400' : 'bg-green-500/20 text-green-400'}`}>
               <Smartphone size={28} />
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">Zentrio for Android</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-zinc-400">Current Version:</span>
                <span className="font-mono text-zinc-200 bg-white/5 px-2 py-0.5 rounded text-sm">{currentVersion}</span>
              </div>
              <p className="text-sm text-zinc-500 mt-2">
                {lastChecked 
                  ? `Last checked: ${lastChecked.toLocaleTimeString()}`
                  : 'Check for updates to see if a new version is available.'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
             {updateAvailable ? (
                <Button 
                    variant="primary" 
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2"
                >
                    <Download size={18} />
                    Update Available
                </Button>
             ) : (
                <Button 
                    variant="secondary" 
                    onClick={() => checkForUpdates(false)}
                    disabled={loading}
                    className="flex items-center gap-2"
                >
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    Check for Updates
                </Button>
             )}
          </div>
        </div>
        
        {/* Status footer */}
        <div className="px-6 py-3 bg-white/5 border-t border-white/5 flex items-center gap-2 text-sm">
            {updateAvailable ? (
                <span className="text-indigo-400 flex items-center gap-2">
                    <SparklesIcon /> A new version is available!
                </span>
            ) : (
                <span className="text-green-400 flex items-center gap-2">
                     <CheckCircle size={14} /> You are on the latest version.
                </span>
            )}
        </div>
      </div>

      <UpdateModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)}
        updateData={updateData}
        currentVersion={currentVersion}
      />
    </div>
  );
}

function SparklesIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
    )
}
