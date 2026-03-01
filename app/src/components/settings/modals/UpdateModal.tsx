import { useState, useEffect } from 'react';
import { Button, Modal } from '../../index';

type UpdateStatus = 'idle' | 'downloading' | 'installing' | 'done' | 'error';
import { Download, AlertCircle, Loader2, Sparkles, RefreshCw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

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

export function UpdateModal({ isOpen, onClose, updateData, currentVersion, isTauri = true, platformName }: UpdateModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadError, setDownloadError] = useState('');
  const [status, setStatus] = useState<UpdateStatus>('idle');

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

        await update.downloadAndInstall((event: any) => {
          if (event.event === 'Started') {
            contentLength = event.data?.contentLength ?? 0;
            setStatus('downloading');
          } else if (event.event === 'Progress') {
            downloaded += event.data?.chunkLength ?? 0;
            if (contentLength > 0) {
              setProgress(Math.round((downloaded / contentLength) * 100));
            }
          } else if (event.event === 'Finished') {
            setProgress(100);
            setStatus('installing');
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
        await handleAndroidUpdate(updateData, setProgress, setStatus);
        setStatus('done');
        toast.success('APK ready', { description: 'The installer should open automatically. If not, check your Downloads folder.' });
        onClose();
        return;
      }

      // ═════════════════════════════════════════════
      // 3. FALLBACK — Download asset for current platform
      // ═════════════════════════════════════════════
      await handleGenericDownload(updateData, platformName, setProgress, setStatus);
      setStatus('done');
      onClose();

    } catch (e: any) {
      console.error('Update failed:', e);
      setDownloadError(e.message || 'Failed to download update');
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
      return <>Downloading...</>;
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
              <span className="font-medium">Preparing installation...</span>
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
          <h5 className="text-sm font-medium text-zinc-300">What's New</h5>
          <div className="bg-zinc-950/50 rounded-lg border border-white/5 p-4 max-h-60 overflow-y-auto custom-scrollbar">
            <pre className="whitespace-pre-wrap text-sm text-zinc-400 font-sans">
              {updateData?.body || 'No release notes available.'}
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
  setProgress: (p: number) => void,
  setStatus: (s: UpdateStatus) => void,
) {
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

  // Download the APK
  const fileData = await downloadAsset(asset, setProgress);

  // Write to temp directory
  setStatus('installing');
  const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  const fileName = asset.name;
  await writeFile(fileName, fileData, { baseDir: BaseDirectory.Temp });

  // Get the full temp path and open with Android's installer
  const { tempDir } = await import('@tauri-apps/api/path');
  const tempPath = await tempDir();
  const filePath = `${tempPath}${fileName}`;

  // Use opener plugin to trigger APK installation on Android
  const { openPath } = await import('@tauri-apps/plugin-opener');
  await openPath(filePath);
}

/** Generic fallback: Download platform-appropriate asset and open it */
async function handleGenericDownload(
  updateData: UpdateData,
  platformName: string | undefined,
  setProgress: (p: number) => void,
  setStatus: (s: UpdateStatus) => void,
) {
  let asset;

  if (platformName === 'windows') {
    asset = updateData.assets?.find(a => a.name.endsWith('.exe') && !a.name.includes('sig'));
  } else if (platformName === 'linux') {
    asset = updateData.assets?.find(a => a.name.endsWith('.deb'))
         || updateData.assets?.find(a => a.name.endsWith('.AppImage'));
  } else if (platformName === 'macos') {
    asset = updateData.assets?.find(a => a.name.endsWith('.dmg'));
  }

  if (!asset) {
    throw new Error(`No compatible update file found for ${platformName || 'this platform'}.`);
  }

  const fileData = await downloadAsset(asset, setProgress);

  setStatus('installing');
  const { writeFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  const fileName = asset.name;
  await writeFile(fileName, fileData, { baseDir: BaseDirectory.Temp });

  const { tempDir } = await import('@tauri-apps/api/path');
  const tempPath = await tempDir();
  const filePath = `${tempPath}${fileName}`;

  const { openPath } = await import('@tauri-apps/plugin-opener');
  await openPath(filePath);
}

/** Download an asset with progress tracking, returns Uint8Array */
async function downloadAsset(
  asset: { browser_download_url: string; size: number; name: string },
  setProgress: (p: number) => void,
): Promise<Uint8Array> {
  const { fetch } = await import('@tauri-apps/plugin-http');
  const response = await fetch(asset.browser_download_url);

  if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);
  if (!response.body) throw new Error('Download failed: No response body');

  const contentLength = asset.size;
  const reader = response.body.getReader();

  let receivedLength = 0;
  const chunks: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    if (contentLength > 0) {
      setProgress(Math.min(99, Math.round((receivedLength / contentLength) * 100)));
    }
  }

  // Combine all chunks into a single Uint8Array
  const result = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    result.set(chunk, position);
    position += chunk.length;
  }

  setProgress(100);
  return result;
}
