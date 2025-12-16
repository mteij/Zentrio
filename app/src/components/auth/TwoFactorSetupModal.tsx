import { useState, useEffect } from "react";
import { toast } from 'sonner'
import { Loader2 } from "lucide-react";
import { Modal } from "../ui/Modal";

interface TwoFactorSetupModalProps {
  onClose: () => void;
  onSuccess: () => void;
  hasPassword?: boolean; // No longer needed but kept for compatibility
}

export function TwoFactorSetupModal({ onClose, onSuccess }: TwoFactorSetupModalProps) {
  const [uri, setUri] = useState<string>("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Generate TOTP secret on mount
  useEffect(() => {
    generateSecret();
  }, []);

  const generateSecret = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/user/two-factor/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to generate 2FA");
      }
      
      const data = await res.json();
      setUri(data.data.totpURI);
      setBackupCodes(data.data.backupCodes || []);
    } catch (e: any) {
      setError(e.message || 'Failed to generate 2FA');
      toast.error('Setup Failed', { description: e.message || 'Failed to generate 2FA' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setConfirming(true);
    try {
      const res = await fetch('/api/user/two-factor/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ code })
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Verification failed");
      }
      
      onSuccess();
    } catch (e: any) {
      toast.error('Verification Failed', { description: e.message || 'Invalid code' });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Enable Two-Factor Authentication"
    >
      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
            <p className="text-sm text-zinc-400">Generating 2FA secret...</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">{error}</p>
            <button 
              onClick={generateSecret}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* QR Code */}
            <div className="text-center space-y-4">
              <div className="bg-white p-4 rounded-lg inline-block">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(uri)}`} 
                  alt="QR Code" 
                  className="w-[150px] h-[150px]"
                />
              </div>
              <p className="text-sm text-zinc-400">
                Scan this QR code with your authenticator app, then enter the code below.
              </p>
            </div>

            {/* Code Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Verification Code</label>
              <input 
                type="text" 
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-center font-mono text-xl text-white tracking-widest focus:outline-none focus:border-red-500"
                maxLength={6}
              />
            </div>
            
            {/* Backup Codes */}
            {backupCodes.length > 0 && (
              <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                <p className="text-xs font-semibold text-zinc-500 uppercase mb-2">Backup Codes (Save these!)</p>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((bc, i) => (
                    <code key={i} className="text-xs text-zinc-300 bg-zinc-900 px-2 py-1 rounded select-all">{bc}</code>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <button 
                onClick={onClose} 
                className="px-4 py-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button 
                onClick={handleVerify} 
                disabled={code.length !== 6 || confirming}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Activate"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
