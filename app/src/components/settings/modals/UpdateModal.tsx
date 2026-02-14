import { useState, useEffect } from 'react';
import { Button, Modal } from '../../index';
import { fetch } from '@tauri-apps/plugin-http';
import { writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { open } from '@tauri-apps/plugin-shell';
import { tempDir } from '@tauri-apps/api/path';
import { platform } from '@tauri-apps/plugin-os';
import { Download, AlertCircle, Check, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface UpdateData {
  version: string;
  body: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    size: number;
  }>;
}

interface UpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  updateData: UpdateData | null;
  currentVersion: string;
  isTauri?: boolean;
}

export function UpdateModal({ isOpen, onClose, updateData, currentVersion, isTauri = true }: UpdateModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadError, setDownloadError] = useState('');
  const [status, setStatus] = useState<'idle' | 'downloading' | 'installing' | 'error'>('idle');

  useEffect(() => {
    if (isOpen) {
      // Reset state on open
      setDownloading(false);
      setProgress(0);
      setDownloadError('');
      setStatus('idle');
    }
  }, [isOpen]);

  const handleDownload = async () => {
    if (!updateData) return;

    // Handle Web Update (Refresh)
    if (!isTauri) {
        window.location.reload();
        return;
    }

    try {
      setDownloading(true);
      setStatus('downloading');
      setDownloadError('');

      const currentPlatform = await platform();
      let asset;

      if (currentPlatform === 'android') {
        // Find the correct asset (prefer arm64, fallback to universal)
        asset = updateData.assets.find(a => a.name.includes('arm64') && a.name.endsWith('.apk'));
        if (!asset) {
            asset = updateData.assets.find(a => a.name.includes('universal') && a.name.endsWith('.apk'));
        }
      } else if (currentPlatform === 'windows') {
        // Find .exe installer
        asset = updateData.assets.find(a => a.name.endsWith('.exe') && !a.name.includes('sig'));
      } else if (currentPlatform === 'linux') {
          // Find .deb package
          asset = updateData.assets.find(a => a.name.endsWith('.deb'));
          if (!asset) {
             asset = updateData.assets.find(a => a.name.endsWith('.AppImage'));
          }
      } else if (currentPlatform === 'macos') {
          // Find .dmg (preferred) or .app.tar.gz
          asset = updateData.assets.find(a => a.name.endsWith('.dmg'));
          if (!asset) {
              asset = updateData.assets.find(a => a.name.endsWith('.app.tar.gz'));
          }
      }

      if (!asset) {
        throw new Error(`No compatible update file found for ${currentPlatform}.`);
      }

      // Start Download
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

        // Update progress
        const percent = Math.round((receivedLength / contentLength) * 100);
        setProgress(percent);
      }

      // Combine chunks
      const blob = new Uint8Array(receivedLength);
      let position = 0;
      for (const chunk of chunks) {
        blob.set(chunk, position);
        position += chunk.length;
      }

      // Write to temp file
      setStatus('installing');
      const fileName = asset.name;
      
      await writeFile(fileName, blob, { baseDir: BaseDirectory.Temp });
      
      // Get temp path to open
      const tempPath = await tempDir();
      const filePath = `${tempPath}${fileName}`; 
      
      await open(filePath);
      
      setStatus('idle');
      onClose();
      
    } catch (e: any) {
      console.error('Update failed:', e);
      setDownloadError(e.message || 'Failed to download update');
      setStatus('error');
      setDownloading(false);
    }
  };

  const isUpdateAvailable = updateData && updateData.version !== currentVersion;

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
              A new version of Zentrio is available. Upgrade now for the latest features and fixes.
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
            {!isTauri ? (
                 <>
                 <RefreshCw size={18} />
                 Reload Application
                 </>
            ) : downloading ? (
                <>Downloading...</>
            ) : (
                <>
                <Download size={18} />
                Download & Install
                </>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
