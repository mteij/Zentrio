import { useState, useEffect } from "react";
import { toast } from 'sonner'
import { Loader2, AlertTriangle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { authClient } from "../../lib/auth-client";

interface TwoFactorSetupModalProps {
  onClose: () => void;
  onSuccess: () => void;
  hasPassword?: boolean;
}

export function TwoFactorSetupModal({ onClose, onSuccess, hasPassword = true }: TwoFactorSetupModalProps) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpURI, setTotpURI] = useState<string>("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [step, setStep] = useState<'password' | 'qr' | 'backup'>('password');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAlreadyEnabled, setIsAlreadyEnabled] = useState(false);

  // Check if 2FA is already enabled
  useEffect(() => {
    const check2FA = async () => {
      try {
        const session = await authClient.getSession();
        if (session?.data?.user?.twoFactorEnabled) {
          setIsAlreadyEnabled(true);
        }
      } catch (e) {
        // Ignore - user might not be logged in
      }
    };
    check2FA();
  }, []);

  // If user doesn't have a password (SSO-only), show a message
  if (!hasPassword) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Two-Factor Authentication">
        <div className="space-y-6 text-center py-4">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />
          <div>
            <h3 className="text-lg font-medium text-white mb-2">Password Required</h3>
            <p className="text-sm text-zinc-400">
              You need to set a password for your account before enabling two-factor authentication.
            </p>
            <p className="text-sm text-zinc-500 mt-2">
              Go to Settings → Account → Set Password first.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </Modal>
    );
  }

  const handleEnableTwoFactor = async () => {
    if (!password || password.length < 1) {
      setError("Please enter your password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: enableError } = await authClient.twoFactor.enable({
        password,
      });

      if (enableError) {
        throw new Error(enableError.message || "Failed to enable 2FA");
      }

      if (data?.totpURI) {
        setTotpURI(data.totpURI);
        setBackupCodes(data.backupCodes || []);
        setStep('qr');
      }
    } catch (e: any) {
      setError(e.message || "Failed to enable 2FA");
      toast.error('Setup Failed', { description: e.message || 'Failed to enable 2FA' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: verifyError } = await authClient.twoFactor.verifyTotp({
        code,
      });

      if (verifyError) {
        throw new Error(verifyError.message || "Invalid verification code");
      }

      if (data) {
        setStep('backup');
        toast.success('2FA Enabled', { description: 'Two-factor authentication is now active' });
      }
    } catch (e: any) {
      setError(e.message || "Invalid verification code");
      toast.error('Verification Failed', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    onSuccess();
  };

  const handleDisable2FA = async () => {
    if (!password || password.length < 1) {
      setError("Please enter your password to disable 2FA");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: disableError } = await authClient.twoFactor.disable({
        password,
      });

      if (disableError) {
        throw new Error(disableError.message || "Failed to disable 2FA");
      }

      toast.success('2FA Disabled', { description: 'Two-factor authentication has been disabled' });
      onSuccess();
    } catch (e: any) {
      setError(e.message || "Failed to disable 2FA");
      toast.error('Failed', { description: e.message });
    } finally {
      setLoading(false);
    }
  };

  // If 2FA is already enabled, show disable option
  if (isAlreadyEnabled) {
    return (
      <Modal isOpen={true} onClose={onClose} title="Two-Factor Authentication">
        <div className="space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20 mb-4">
              ✓ 2FA Enabled
            </div>
            <p className="text-sm text-zinc-400">
              Two-factor authentication is currently enabled on your account.
            </p>
          </div>

          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-500 uppercase">
              Enter Password to Disable
            </label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your account password"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button 
              onClick={onClose} 
              className="px-4 py-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button 
              onClick={handleDisable2FA} 
              disabled={loading || !password}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Disable 2FA"}
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={true} onClose={onClose} title="Enable Two-Factor Authentication">
      <div className="space-y-6">
        {step === 'password' && (
          <>
            <p className="text-sm text-zinc-400">
              Enter your password to set up two-factor authentication.
            </p>
            
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-500 uppercase">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your account password"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-red-500"
                onKeyDown={(e) => e.key === 'Enter' && handleEnableTwoFactor()}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={onClose} 
                className="px-4 py-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button 
                onClick={handleEnableTwoFactor} 
                disabled={loading || !password}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
              </button>
            </div>
          </>
        )}

        {step === 'qr' && (
          <>
            {/* QR Code */}
            <div className="text-center space-y-4">
              <div className="bg-white p-4 rounded-lg inline-block">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(totpURI)}`} 
                  alt="QR Code" 
                  className="w-[150px] h-[150px]"
                />
              </div>
              <p className="text-sm text-zinc-400">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

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
                onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && handleVerifyCode()}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setStep('password')} 
                className="px-4 py-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
              >
                Back
              </button>
              <button 
                onClick={handleVerifyCode} 
                disabled={code.length !== 6 || loading}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Activate"}
              </button>
            </div>
          </>
        )}

        {step === 'backup' && (
          <>
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                ✓ 2FA Enabled Successfully
              </div>
            </div>

            {/* Backup Codes */}
            {backupCodes.length > 0 && (
              <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                <p className="text-xs font-semibold text-yellow-500 uppercase mb-2">
                  ⚠️ Save These Backup Codes
                </p>
                <p className="text-xs text-zinc-400 mb-3">
                  Store these codes in a safe place. You can use them to access your account if you lose your authenticator.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((bc, i) => (
                    <code key={i} className="text-xs text-zinc-300 bg-zinc-900 px-2 py-1 rounded select-all">{bc}</code>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button 
                onClick={handleComplete}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
