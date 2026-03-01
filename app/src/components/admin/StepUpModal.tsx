import { createContext, useContext, useRef, useState, useCallback, ReactNode } from 'react'
import { ShieldCheck, Loader2, RefreshCw, Mail } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { adminApi, AdminApiError } from '../../lib/adminApi'

// ── Context ───────────────────────────────────────────────────────────────────

interface StepUpContextValue {
  requireStepUp: () => Promise<boolean>
}

const StepUpContext = createContext<StepUpContextValue | null>(null)

export function useStepUp(): StepUpContextValue {
  const ctx = useContext(StepUpContext)
  if (!ctx) throw new Error('useStepUp must be used inside StepUpProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

interface StepUpProviderProps {
  children: ReactNode
}

type Phase = 'requesting' | 'entering' | 'verifying' | 'success'

export function StepUpProvider({ children }: StepUpProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('requesting')
  const [challengeId, setChallengeId] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [code, setCode] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Pending resolve/reject from requireStepUp()
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const close = useCallback((result: boolean) => {
    setIsOpen(false)
    setCode('')
    setErrorMsg('')
    resolveRef.current?.(result)
    resolveRef.current = null
  }, [])

  const requestChallenge = useCallback(async () => {
    setPhase('requesting')
    setErrorMsg('')
    try {
      const res = await adminApi.requestStepUp()
      setChallengeId(res.challengeId)
      setExpiresAt(res.expiresAt)
      setCode('')
      setPhase('entering')
    } catch (e) {
      const msg = e instanceof AdminApiError ? e.message : 'Failed to send verification code'
      setErrorMsg(msg)
      setPhase('entering')
    }
  }, [])

  const requireStepUp = useCallback(async (): Promise<boolean> => {
    // Fast-path: already verified recently
    try {
      const status = await adminApi.getStepUpStatus()
      if (status.hasValidStepUp) return true
    } catch {
      // Continue to modal if status check fails
    }

    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setIsOpen(true)
      setPhase('requesting')
      setCode('')
      setErrorMsg('')
      // Kick off OTP request immediately
      adminApi.requestStepUp().then((res) => {
        setChallengeId(res.challengeId)
        setExpiresAt(res.expiresAt)
        setPhase('entering')
      }).catch((e) => {
        const msg = e instanceof AdminApiError ? e.message : 'Failed to send verification code'
        setErrorMsg(msg)
        setPhase('entering')
      })
    })
  }, [])

  const verify = useCallback(async () => {
    if (code.length !== 6 || !challengeId) return
    setPhase('verifying')
    setErrorMsg('')
    try {
      await adminApi.verifyStepUp(challengeId, code)
      setPhase('success')
      setTimeout(() => close(true), 800)
    } catch (e) {
      const msg = e instanceof AdminApiError ? e.message : 'Verification failed'
      setErrorMsg(msg)
      setPhase('entering')
    }
  }, [code, challengeId, close])

  const handleCodeChange = useCallback((digit: string, index: number) => {
    setCode((prev) => {
      const chars = prev.split('')
      chars[index] = digit.replace(/\D/g, '')
      return chars.join('')
    })
  }, [])

  const handleDigitKey = useCallback((e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      const prev = (e.target as HTMLElement).parentElement?.children[index - 1] as HTMLInputElement
      prev?.focus()
    }
    if (e.key === 'Enter' && code.length === 6) verify()
  }, [code, verify])

  const handleDigitInput = useCallback((e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const digit = e.target.value.replace(/\D/g, '')
    handleCodeChange(digit, index)
    if (digit && index < 5) {
      const next = (e.target as HTMLElement).parentElement?.children[index + 1] as HTMLInputElement
      next?.focus()
    }
  }, [handleCodeChange])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    setCode(digits)
  }, [])

  const isLoading = phase === 'requesting' || phase === 'verifying'
  const canVerify = code.length === 6 && phase === 'entering'

  return (
    <StepUpContext.Provider value={{ requireStepUp }}>
      {children}

      <Modal
        isOpen={isOpen}
        onClose={() => close(false)}
        title="Admin Verification Required"
        maxWidth="max-w-md"
      >
        <div className="space-y-5">
          {/* Icon + description */}
          <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-zinc-300 text-sm leading-relaxed">
              This action requires recent verification. A one-time code has been sent to your email.
            </p>
          </div>

          {/* Phase: requesting */}
          {phase === 'requesting' && (
            <div className="flex items-center justify-center gap-2 py-4 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Sending verification code…</span>
            </div>
          )}

          {/* Phase: entering / verifying */}
          {(phase === 'entering' || phase === 'verifying') && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-zinc-400 text-sm">
                <Mail className="w-4 h-4 shrink-0" />
                <span>Enter the 6-digit code sent to your email</span>
                {expiresAt && (
                  <span className="ml-auto text-xs text-zinc-500">
                    expires {new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {/* OTP digit inputs */}
              <div className="flex gap-2 justify-center" onPaste={handlePaste}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <input
                    key={i}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={code[i] || ''}
                    onChange={(e) => handleDigitInput(e, i)}
                    onKeyDown={(e) => handleDigitKey(e, i)}
                    disabled={isLoading}
                    autoFocus={i === 0}
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    className="w-10 h-13 bg-black/20 border border-white/10 rounded-lg text-xl font-bold text-center text-white font-mono focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                ))}
              </div>

              {/* Error */}
              {errorMsg && (
                <p className="text-red-400 text-sm text-center">{errorMsg}</p>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={requestChallenge}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm"
                >
                  <RefreshCw className="w-4 h-4" />
                  Resend code
                </Button>
                <Button
                  variant="primary"
                  onClick={verify}
                  disabled={!canVerify || isLoading}
                  className="flex-1"
                >
                  {phase === 'verifying' ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
                    </span>
                  ) : 'Verify'}
                </Button>
              </div>
            </div>
          )}

          {/* Phase: success */}
          {phase === 'success' && (
            <div className="flex items-center justify-center gap-2 py-4 text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-sm font-medium">Verified successfully</span>
            </div>
          )}
        </div>
      </Modal>
    </StepUpContext.Provider>
  )
}
