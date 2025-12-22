import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from 'sonner';
import { AnimatedBackground, TitleBar } from "../../components";
import { TwoFactorModal } from "../../components/auth/TwoFactorModal";
import { authClient } from "../../lib/auth-client";
import { useAuthStore } from "../../stores/authStore";

export function TwoFactorPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [showBackupCode, setShowBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);

  // Verify TOTP code
  const handleSuccess = async () => {
    setIsLoading(true);
    setError(undefined);
    
    try {
      // Re-check auth status after successful 2FA
      await refreshSession();
      toast.success("Two-factor verification successful");
      navigate("/profiles");
    } catch (err: any) {
      setError(err.message || "Verification failed");
      toast.error("Verification failed", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    // Go back to sign in
    navigate("/signin");
  };

  const handleUseBackupCode = () => {
    setShowBackupCode(true);
    setError(undefined);
  };

  const handleBackupCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupCode.trim()) return;
    
    setIsLoading(true);
    setError(undefined);
    
    try {
      const { data, error: verifyError } = await authClient.twoFactor.verifyBackupCode({
        code: backupCode.replace(/-/g, ''),
        trustDevice,
      });
      
      if (verifyError) {
        throw new Error(verifyError.message || "Invalid backup code");
      }
      
      if (data) {
        await refreshSession();
        toast.success("Backup code verified");
        navigate("/profiles");
      }
    } catch (err: any) {
      setError(err.message || "Verification failed");
      toast.error("Verification failed", { description: err.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (showBackupCode) {
    return (
      <>
        <TitleBar />
        <AnimatedBackground />
        <div className="h-[100vh] h-[var(--app-height,100vh)] w-full flex items-center justify-center p-4 relative z-10 overflow-hidden">
          <div className="w-full max-w-md">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
              <button
                onClick={() => setShowBackupCode(false)}
                className="text-zinc-400 hover:text-white mb-4 flex items-center gap-2"
              >
                ← Back to code entry
              </button>
              
              <h2 className="text-white text-xl font-semibold mb-2">Enter Backup Code</h2>
              <p className="text-zinc-400 text-sm mb-6">
                Enter one of your backup codes to verify your identity
              </p>
              
              {error && (
                <p className="text-red-500 mb-4 text-sm">{error}</p>
              )}
              
              <form onSubmit={handleBackupCodeSubmit}>
                <input
                  type="text"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX"
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-center font-mono text-xl text-white tracking-widest focus:outline-none focus:border-red-500 mb-4"
                  disabled={isLoading}
                />
                
                {/* Trust This Device Checkbox */}
                <label className="flex items-center gap-3 cursor-pointer group mb-4">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={trustDevice}
                      onChange={(e) => setTrustDevice(e.target.checked)}
                      disabled={isLoading}
                      className="sr-only peer"
                    />
                    <div className="w-5 h-5 border-2 border-white/20 rounded peer-checked:bg-[#e50914] peer-checked:border-[#e50914] transition-all group-hover:border-white/40 peer-disabled:opacity-50">
                      {trustDevice && (
                        <svg className="w-full h-full text-white p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
                    Trust this device for 30 days
                  </span>
                </label>
                
                <button
                  type="submit"
                  disabled={!backupCode.trim() || isLoading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg disabled:opacity-50"
                >
                  {isLoading ? "Verifying..." : "Verify Backup Code"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TitleBar />
      <AnimatedBackground />
      <div className="h-[100vh] h-[var(--app-height,100vh)] w-full flex items-center justify-center p-4 relative z-10 overflow-hidden">
        <div className="w-full max-w-md">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
            <TwoFactorModal
              onBack={handleBack}
              onSuccess={handleSuccess}
              onUseBackupCode={handleUseBackupCode}
              isLoading={isLoading}
              error={error}
            />
          </div>
        </div>
      </div>
    </>
  );
}
