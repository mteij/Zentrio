import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ParticleBackground } from '../../components/ui/ParticleBackground'
import { TwoFactorModal } from '../../components/auth/TwoFactorModal'
import { authClient, isTauri } from '../../lib/auth-client'
import { useAuthStore } from '../../stores/authStore'
import { getLoginBehaviorRedirectPath } from '../../hooks/useLoginBehavior'

export function TwoFactorPage() {
  const navigate = useNavigate()
  const { refreshSession } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [showBackupCode, setShowBackupCode] = useState(false)
  const [backupCode, setBackupCode] = useState('')

  // Verify TOTP code
  const handleSuccess = async () => {
    setIsLoading(true)
    setError(undefined)

    try {
      // Re-check auth status after successful 2FA
      await refreshSession()
      toast.success('Two-factor verification successful')

      // In Tauri, ensure app mode is set and reload to update AppRoutes state
      const dest = getLoginBehaviorRedirectPath()
      if (isTauri()) {
        localStorage.setItem('zentrio_app_mode', 'connected')
        window.location.href = dest
        return
      }

      navigate(dest)
    } catch (err: any) {
      setError(err.message || 'Verification failed')
      toast.error('Verification failed', { description: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    // Go back to sign in
    navigate('/signin')
  }

  const handleUseBackupCode = () => {
    setShowBackupCode(true)
    setError(undefined)
  }

  const handleBackupCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!backupCode.trim()) return

    setIsLoading(true)
    setError(undefined)

    try {
      const { data, error: verifyError } = await authClient.twoFactor.verifyBackupCode({
        code: backupCode.replace(/-/g, ''),
        trustDevice: true,
      })

      if (verifyError) {
        throw new Error(verifyError.message || 'Invalid backup code')
      }

      if (data) {
        await refreshSession()
        toast.success('Backup code verified')

        // In Tauri, ensure app mode is set and reload to update AppRoutes state
        const dest = getLoginBehaviorRedirectPath()
        if (isTauri()) {
          localStorage.setItem('zentrio_app_mode', 'connected')
          window.location.href = dest
          return
        }

        navigate(dest)
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed')
      toast.error('Verification failed', { description: err.message })
    } finally {
      setIsLoading(false)
    }
  }

  if (showBackupCode) {
    return (
      <>
        <ParticleBackground />
        <div className="min-h-screen w-full flex items-center justify-center p-4 relative z-10 overflow-y-auto">
          <div className="w-full max-w-md">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 transition-all duration-300">
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

              {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}

              <form onSubmit={handleBackupCodeSubmit}>
                <input
                  type="text"
                  value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX"
                  className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-center font-mono text-xl text-white tracking-widest focus:outline-none focus:border-red-500 mb-4"
                  disabled={isLoading}
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  data-bwignore
                />

                <button
                  type="submit"
                  disabled={!backupCode.trim() || isLoading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg disabled:opacity-50"
                >
                  {isLoading ? 'Verifying...' : 'Verify Backup Code'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <ParticleBackground />
      <div className="min-h-screen w-full flex items-center justify-center p-4 relative z-10 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 md:p-8 transition-all duration-300">
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
  )
}
