import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Copy, Loader2, RefreshCw, Tv2 } from 'lucide-react'
import { toast } from 'sonner'
import { AuthForms } from '../components/auth/AuthForms'
import { ParticleBackground } from '../components/ui/ParticleBackground'
import { apiFetchJson } from '../lib/apiFetch'
import { useAuthStore } from '../stores/authStore'

interface DeviceLinkCodeResponse {
  userCode: string
  expiresAt: number
  verificationUrl: string
}

type AuthMode = 'signin' | 'signup'

export function ActivateDevicePage() {
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [deviceCode, setDeviceCode] = useState<DeviceLinkCodeResponse | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const codeExpiresIn = useMemo(() => {
    if (!deviceCode) return null
    const remainingMs = deviceCode.expiresAt - Date.now()
    return Math.max(0, Math.ceil(remainingMs / 1000))
  }, [deviceCode])

  useEffect(() => {
    if (!deviceCode) return

    const timer = window.setInterval(() => {
      if (deviceCode.expiresAt <= Date.now()) {
        setDeviceCode(null)
      } else {
        setDeviceCode((current) => (current ? { ...current } : current))
      }
    }, 1000)

    return () => window.clearInterval(timer)
  }, [deviceCode])

  const generateCode = async () => {
    setIsGenerating(true)
    try {
      const data = await apiFetchJson<DeviceLinkCodeResponse>('/api/auth/device-link/create', {
        method: 'POST',
      })
      setDeviceCode(data)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate a device code'
      toast.error('Could not create device code', { description: message })
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && !deviceCode && !isGenerating) {
      void generateCode()
    }
  }, [deviceCode, isAuthenticated, isGenerating])

  const copyCode = async () => {
    if (!deviceCode?.userCode) return

    try {
      await navigator.clipboard.writeText(deviceCode.userCode)
      toast.success('Code copied', { description: 'Enter it on your TV to finish signing in.' })
    } catch {
      toast.error('Copy failed', { description: 'Please type the code manually.' })
    }
  }

  const formattedCode = deviceCode?.userCode
    ? `${deviceCode.userCode.slice(0, 3)} ${deviceCode.userCode.slice(3)}`
    : '000 000'

  return (
    <div className="min-h-dvh bg-black text-white overflow-hidden relative">
      <ParticleBackground />

      <main className="relative z-10 min-h-dvh px-6 py-10 lg:px-10">
        <div className="mx-auto grid min-h-[calc(100dvh-5rem)] max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <section className="rounded-[32px] border border-white/10 bg-black/55 p-8 shadow-2xl backdrop-blur-xl lg:p-12 flex flex-col justify-center">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300">
              <Tv2 className="h-7 w-7" />
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-white lg:text-4xl">
              Pair your TV
            </h1>

            <p className="mt-3 text-base leading-7 text-zinc-400">
              Sign in here to get a pairing code, then enter it in Zentrio on your TV.
            </p>
          </section>

          <section className="rounded-[32px] border border-white/10 bg-zinc-950/85 p-6 shadow-2xl backdrop-blur-xl lg:p-8">
            {isLoading ? (
              <div className="flex min-h-[32rem] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-red-400" />
              </div>
            ) : isAuthenticated ? (
              <div className="flex min-h-[32rem] flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Signed in as {user?.email || 'your account'}
                  </div>

                  <h2 className="mt-6 text-3xl font-semibold text-white">Your pairing code</h2>

                  <div className="mt-8 rounded-[28px] border border-red-500/20 bg-black/70 px-6 py-8 text-center shadow-[0_0_80px_rgba(127,29,29,0.25)]">
                    <div className="text-xs uppercase tracking-[0.4em] text-zinc-500">Pairing Code</div>
                    <div className="mt-4 font-mono text-5xl font-semibold tracking-[0.32em] text-white lg:text-6xl">
                      {formattedCode}
                    </div>
                    <div className="mt-4 text-sm text-zinc-500">
                      {codeExpiresIn !== null ? `Expires in ${Math.floor(codeExpiresIn / 60)}:${`${codeExpiresIn % 60}`.padStart(2, '0')}` : 'Generate a new code if this one expires.'}
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-zinc-500">
                    TV setup URL: <span className="font-medium text-zinc-300">{deviceCode?.verificationUrl || 'zentrio.eu/activate'}</span>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => void copyCode()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/15"
                  >
                    <Copy className="h-4 w-4" />
                    Copy code
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateCode()}
                    disabled={isGenerating}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                  >
                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Generate new code
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-h-[32rem]">
                <div className="mb-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 p-1">
                  <button
                    type="button"
                    onClick={() => setMode('signin')}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${mode === 'signin' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${mode === 'signup' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'}`}
                  >
                    Create Account
                  </button>
                </div>

                <AuthForms
                  mode={mode}
                  onSuccess={() => {
                    void generateCode()
                  }}
                  redirectPathOverride="/activate"
                />
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

export default ActivateDevicePage
