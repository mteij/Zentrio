import { AlertCircle, Download, ExternalLink, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createLogger } from '../../../utils/client-logger';
import { Button, Modal } from '../../index';

type UpdateStatus = 'idle' | 'downloading' | 'installing' | 'done' | 'error';

const log = createLogger('UpdateModal')

interface UpdateData {
  version: string;
  body: string;
  assets?: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
  updateObj?: any; // The raw update object from @tauri-apps/plugin-updater (desktop only)
  isCustom?: boolean;
  isIOS?: boolean;
}

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateData: UpdateData | null;
  currentVersion: string;
  isTauri?: boolean;
  platformName?: string;
}

export function UpdateModal({ isOpen, onClose, updateData, isTauri = true, platformName }: UpdateModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadError, setDownloadError] = useState('');
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const usesExternalDownload = !updateData?.updateObj && !!isTauri && !updateData?.isIOS;

  useEffect(() => {
    if (isOpen) {
      setDownloading(false);
      setProgress(0);
      setDownloadError('');
      setStatus('idle');
    }
  }, [isOpen]);

  const handleDownload = async () => {
    if (!updateData) return;

    // ─── Web: Just reload ────────────────────────
    if (!isTauri) {
      window.location.reload();
      return;
    }

    // ─── iOS: Open GitHub releases page ──────────
    if (updateData.isIOS) {
      try {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl('https://github.com/mteij/Zentrio/releases/latest');
      } catch {
        // Fallback
        window.open('https://github.com/mteij/Zentrio/releases/latest', '_blank');
      }
      onClose();
      return;
    }

    try {
      setDownloading(true);
      setStatus('downloading');
      setDownloadError('');

      // ═════════════════════════════════════════════
      // 1. DESKTOP — Official Tauri Updater Plugin
      // ═════════════════════════════════════════════
      if (updateData.updateObj) {
        const update = updateData.updateObj;
        let downloaded = 0;
        let contentLength = 0;

        log.info('Starting Tauri updater install', { version: update.version, platformName });
        await update.downloadAndInstall((event: any) => {
          if (event.event === 'Started') {
            contentLength = event.data?.contentLength ?? 0;
            setStatus('downloading');
            log.info('Updater download started', { contentLength });
          } else if (event.event === 'Progress') {
            downloaded += event.data?.chunkLength ?? 0;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
          } else if (event.event === 'Finished') {
            setProgress(100);
            setStatus('installing');
            log.info('Updater download finished, installing');
          }
        });

        // Relaunch to complete installation
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
        return;
      }

      // ═════════════════════════════════════════════
      // 2. ANDROID — Download APK + Open with Installer
      // ═════════════════════════════════════════════
      if (platformName === 'android') {
        const asset = await handleAndroidUpdate(updateData, setStatus);
        setStatus('done');
        toast.success('Download opened', {
          description: `The APK download for ${asset.name} was opened externally. Install it from your browser or download manager when it finishes.`,
        });
        onClose();
        return;
      }

      // ═════════════════════════════════════════════
      // 3. FALLBACK — Download asset for current platform
      // ═════════════════════════════════════════════
      const asset = await handleGenericDownload(updateData, platformName, setStatus);
      setStatus('done');
      toast.success('Download opened', {
        description: `The download for ${asset.name} was opened externally to avoid in-app installer failures.`,
      });
      onClose();

    } catch (e: any) {
      const message = getErrorMessage(e);
      log.error('Update failed:', e);
      setDownloadError(message);
      setStatus('error');
      setDownloading(false);
    }
  };

  // ─── Determine button label & icon ─────────────
  const getButtonContent = () => {
    if (!isTauri) {
      return <><RefreshCw size={18} /> Reload Application</>;
    }
    if (updateData?.isIOS) {
      return <><ExternalLink size={18} /> View on GitHub</>;
    }
    if (downloading) {
      return <>{status === 'installing' && usesExternalDownload ? 'Opening download...' : 'Downloading...'}</>;
    }
    if (usesExternalDownload) {
      return <><ExternalLink size={18} /> Open Download</>;
    }
    return <><Download size={18} /> Download &amp; Install</>;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Update Available"
      maxWidth="max-w-md"
    >
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
          <div className="p-3 rounded-full bg-indigo-500/20 text-indigo-400 shrink-0">
            <Sparkles size={24} />
          </div>
          <div>
            <h4 className="text-lg font-semibold text-white">New Version {updateData?.version}</h4>
            <p className="text-sm text-zinc-400 mt-1">
              {updateData?.isIOS 
                ? 'A new version is available. iOS updates are distributed through the App Store or GitHub.'
                : 'A new version of Zentrio is available. Upgrade now for the latest features and fixes.'
              }
            </p>
          </div>
        </div>

        {/* Status Messages */}
        {status === 'downloading' && (
          <div className="space-y-2">
             <div className="flex justify-between text-sm text-zinc-400">
                <span>Downloading update...</span>
                <span>{progress}%</span>
             </div>
             <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
             </div>
          </div>
        )}

        {status === 'installing' && (
           <div className="flex items-center gap-3 text-indigo-400 justify-center py-4">
              <Loader2 className="animate-spin" />
              <span className="font-medium">
                {usesExternalDownload ? 'Opening download...' : 'Preparing installation...'}
              </span>
           </div>
        )}

        {usesExternalDownload && !downloading && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-zinc-400">
            This platform uses an external download handoff. Zentrio will open the release asset in your browser or system downloader instead of buffering the whole installer inside the WebView.
          </div>
        )}

        {downloadError && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
            <AlertCircle size={16} />
            {downloadError}
          </div>
        )}

        {/* Changelog */}
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-zinc-300">What&apos;s New</h5>
          <div className="bg-zinc-950/50 rounded-lg border border-white/5 p-4 max-h-60 overflow-y-auto custom-scrollbar">
            <pre className="whitespace-pre-wrap text-sm text-zinc-400 font-sans">
              {(() => {
                let body = updateData?.body || 'No release notes available.';
                if (body === 'No release notes available.') return body;

                body = body
                  .split("**Links:**")[0]
                  .split("## Links:")[0]
                  .split("### Links:")[0]
                  .split("Links:")[0];

                body = body.trim();
                if (body.endsWith("---")) {
                  body = body.slice(0, -3).trim();
                }

                return body;
              })()}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2">
          <Button 
            variant="ghost" 
            onClick={onClose}
            disabled={downloading}
          >
            Later
          </Button>
          <Button 
            variant="primary" 
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2"
          >
            {getButtonContent()}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ══════════════════════════════════════════════════
// Platform-specific update handlers
// ══════════════════════════════════════════════════

/** Android: Download APK and trigger installation via opener */
async function handleAndroidUpdate(
  updateData: UpdateData,
  setStatus: (s: UpdateStatus) => void,
): Promise<NonNullable<UpdateData['assets']>[number]> {
  // Find the correct APK asset (prefer arm64, fallback to universal, then any APK)
  let asset = updateData.assets?.find(a => a.name.includes('arm64') && a.name.endsWith('.apk'));
  if (!asset) {
    asset = updateData.assets?.find(a => a.name.includes('universal') && a.name.endsWith('.apk'));
  }
  if (!asset) {
    asset = updateData.assets?.find(a => a.name.endsWith('.apk'));
  }

  if (!asset) {
    throw new Error('No APK found in the latest release. Please download manually from GitHub.');
  }

  setStatus('installing');
  log.info('Opening Android update externally', { asset: asset.name, url: asset.browser_download_url });
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(asset.browser_download_url);
  return asset;
}

/** Generic fallback: Download platform-appropriate asset and open it */
async function handleGenericDownload(
  updateData: UpdateData,
  platformName: string | undefined,
  setStatus: (s: UpdateStatus) => void,
): Promise<NonNullable<UpdateData['assets']>[number]> {
  let asset;

  if (platformName === 'windows') {
    asset = updateData.assets?.find(a => a.name.endsWith('.exe') && !a.name.includes('sig'));
  } else if (platformName?.startsWith('linux')) {
    if (platformName === 'linux-deb') {
      asset = updateData.assets?.find(a => a.name.endsWith('.deb'));
    } else if (platformName === 'linux-rpm') {
      asset = updateData.assets?.find(a => a.name.endsWith('.rpm'));
    } else {
      asset = updateData.assets?.find(a => a.name.endsWith('.deb'))
           || updateData.assets?.find(a => a.name.endsWith('.rpm'))
           || updateData.assets?.find(a => a.name.endsWith('.AppImage'));
    }
  } else if (platformName === 'macos') {
    asset = updateData.assets?.find(a => a.name.endsWith('.dmg'));
  }

  if (!asset) {
    throw new Error(`No compatible update file found for ${platformName || 'this platform'}.`);
  }

  setStatus('installing');
  log.info('Opening manual update externally', {
    platformName,
    asset: asset.name,
    url: asset.browser_download_url,
  });
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(asset.browser_download_url);
  return asset;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== '{}') {
      return serialized;
    }
  } catch {
    // Ignore serialization failures and fall back to String below.
  }

  const fallback = String(error);
  return fallback && fallback !== '[object Object]'
    ? fallback
    : 'Failed to download update';
}
