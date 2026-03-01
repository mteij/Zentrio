import { useState, useEffect } from 'react';
import { Button } from '../index';
import { RefreshCw, Download, CheckCircle, Smartphone, Globe } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { UpdateModal } from './modals/UpdateModal';
import { toast } from 'sonner';

declare const __APP_VERSION__: string;

type PlatformType = 'windows' | 'macos' | 'linux' | 'linux-deb' | 'linux-rpm' | 'android' | 'ios' | 'web';

export function UpdateSettings() {
  const [loading, setLoading] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('Unknown');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateData, setUpdateData] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isTauri, setIsTauri] = useState(false);
  const [platformName, setPlatformName] = useState<PlatformType>('web');

  useEffect(() => {
    const init = async () => {
        try {
            const v = await getVersion();
            setCurrentVersion(v);
            setIsTauri(true);
            
            try {
                const { platform } = await import('@tauri-apps/plugin-os');
                let osName: string = await platform();
                
                if (osName === 'linux') {
                   const agent = window.navigator.userAgent;
                   if (/Ubuntu|Debian/i.test(agent)) osName = 'linux-deb';
                   else if (/Fedora|Red Hat|CentOS|SUSE/i.test(agent)) osName = 'linux-rpm';
                }

                setPlatformName(osName as PlatformType);
            } catch (e) {
                console.error("Failed to detect platform", e);
            }
        } catch (e) {
            setCurrentVersion(typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'Web');
            setIsTauri(false);
        }
    };
    init();
  }, []);

  const isTauriUpdaterSupported = (p: PlatformType) => p === 'windows' || p === 'macos';

  const checkForUpdates = async (silent = false) => {
    setLoading(true);
    try {
      // ─────────────────────────────────────────────
      // MAC/WIN: Use Official Tauri Updater Plugin
      // Falls back to GitHub API if updater returns null
      // (e.g. all releases are pre-releases, which are
      // excluded from the /releases/latest redirect)
      // ─────────────────────────────────────────────
      if (isTauri && isTauriUpdaterSupported(platformName)) {
          let tauriUpdateFound = false;
          try {
              const { check } = await import('@tauri-apps/plugin-updater');
              const update = await check();
              
              if (update) {
                  tauriUpdateFound = true;
                  setUpdateAvailable(true);
                  setUpdateData({
                      version: update.version,
                      body: update.body,
                      date: update.date,
                      updateObj: update
                  });
                  if (!silent) setShowModal(true);
              }
              // If update is null, the updater endpoint returned no update
              // (could be all releases are pre-releases). Fall through to GitHub API.
          } catch (updaterErr) {
              // Tauri updater failed (e.g. network error, 404 on latest.json).
              // Fall through to the GitHub API fallback below.
              console.warn('Tauri updater failed, falling back to GitHub API:', updaterErr);
          }

          if (!tauriUpdateFound) {
              // Fallback: query GitHub API directly (supports pre-releases)
              const data = await fetchLatestRelease(isTauri);
              const latestVersion = data.tag_name.replace(/^v/, '');
              const hasUpdate = compareVersions(currentVersion, latestVersion);

              if (hasUpdate) {
                  setUpdateAvailable(true);
                  setUpdateData({
                      version: latestVersion,
                      body: data.body,
                      assets: data.assets,
                      isCustom: true
                  });
                  if (!silent) setShowModal(true);
              } else {
                  setUpdateAvailable(false);
                  if (!silent) toast.success('Up to date', { description: 'You are using the latest version.' });
              }
          }
      }
      // ─────────────────────────────────────────────
      // iOS: Cannot self-update — direct to App Store
      // ─────────────────────────────────────────────
      else if (isTauri && platformName === 'ios') {
          // On iOS, apps can only be updated through the App Store.
          // We still check GitHub releases to know IF there's a newer version.
          const data = await fetchLatestRelease(isTauri);
          const latestVersion = data.tag_name.replace(/^v/, '');
          const hasUpdate = compareVersions(currentVersion, latestVersion);

          if (hasUpdate) {
            setUpdateAvailable(true);
            setUpdateData({
                version: latestVersion,
                body: data.body,
                isIOS: true
            });
            if (!silent) setShowModal(true);
          } else {
            setUpdateAvailable(false);
            if (!silent) toast.success('Up to date', { description: 'You are using the latest version.' });
          }
      }
      // ─────────────────────────────────────────────
      // ANDROID / WEB: Custom GitHub Release Check
      // ─────────────────────────────────────────────
      else {
          const data = await fetchLatestRelease(isTauri);
          const latestVersion = data.tag_name.replace(/^v/, '');
          const hasUpdate = compareVersions(currentVersion, latestVersion);

          if (hasUpdate) {
            setUpdateAvailable(true);
            setUpdateData({
                version: latestVersion,
                body: data.body,
                assets: data.assets,
                isCustom: true
            });
            if (!silent) setShowModal(true);
          } else {
            setUpdateAvailable(false);
            if (!silent) toast.success('Up to date', { description: 'You are using the latest version.' });
          }
      }
      setLastChecked(new Date());

    } catch (e: any) {
      console.error(e);
      if (!silent) toast.error('Update Check Failed', { description: e.message || 'Could not check for updates.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Version Card */}
      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${updateAvailable ? 'bg-indigo-500/20 text-indigo-400' : 'bg-green-500/20 text-green-400'}`}>
               {isTauri ? <Smartphone size={28} /> : <Globe size={28} />}
            </div>
            <div>
              <h3 className="text-lg font-medium text-white">{isTauri ? 'Zentrio App' : 'Zentrio Web'}</h3>
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
        isTauri={isTauri}
        platformName={platformName}
      />
    </div>
  );
}

// ── Helpers ──────────────────────────────────────

/** Fetch latest release info from GitHub API.
 *  Uses /releases?per_page=1 instead of /releases/latest so that
 *  pre-releases (0.x.x) are also returned — GitHub's /releases/latest
 *  endpoint deliberately excludes pre-releases and drafts.
 */
async function fetchLatestRelease(isTauri: boolean) {
  const url = 'https://api.github.com/repos/mteij/Zentrio/releases?per_page=1';
  const headers = { 'User-Agent': 'Zentrio-App' };
  let response: Response;
  
  if (isTauri) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
    response = await tauriFetch(url, { headers }) as unknown as Response;
  } else {
    response = await window.fetch(url, { headers });
  }
  
  if (!response.ok) throw new Error('Failed to fetch update info from GitHub');
  const releases: any[] = await response.json();
  if (!releases || releases.length === 0) throw new Error('No releases found on GitHub');
  return releases[0];
}

/** Simple semver comparison — returns true if v2 > v1 */
function compareVersions(v1: string, v2: string) {
  if (v1 === 'Unknown') return false;
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      if ((parts2[i] || 0) > (parts1[i] || 0)) return true;
      if ((parts2[i] || 0) < (parts1[i] || 0)) return false;
  }
  return false;
}

function SparklesIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
    )
}
