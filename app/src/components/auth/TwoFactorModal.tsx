import { useState, useRef, useEffect } from 'react'
import { Button } from '../index'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { authClient } from '../../lib/auth-client'

interface TwoFactorModalProps {
  onBack: () => void
  onSuccess: () => void
  onUseBackupCode: () => void
  isLoading?: boolean
  error?: string
}

export function TwoFactorModal({
  onBack,
  onSuccess,
  onUseBackupCode,
  isLoading = false,
  error
}: TwoFactorModalProps) {
  const [code, setCode] = useState('')
  const [trustDevice, setTrustDevice] = useState(false)
  const [localLoading, setLocalLoading] = useState(false)
  const [localError, setLocalError] = useState<string | undefined>()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus input when component mounts
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length === 6 && !isLoading && !localLoading) {
      setLocalLoading(true)
      setLocalError(undefined)
      
      try {
        const { data, error: verifyError } = await authClient.twoFactor.verifyTotp({
          code,
          trustDevice,
        })
        
        if (verifyError) {
          setLocalError(verifyError.message || 'Invalid verification code')
          return
        }
        
        if (data) {
          onSuccess()
        }
      } catch (err: any) {
        setLocalError(err.message || 'Verification failed')
      } finally {
        setLocalLoading(false)
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '') // Only allow digits
    setCode(value)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleSubmit(e as any)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text')
    const digits = pastedData.replace(/\D/g, '').slice(0, 6)
    setCode(digits)
  }

  const displayError = localError || error
  const loading = isLoading || localLoading

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-start mb-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="!p-2 -ml-2 text-zinc-400 hover:text-white"
          disabled={loading}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>
      <div className="mb-6">
        <h3 className="text-white text-xl font-semibold mb-2">Two-Factor Authentication</h3>
        <p className="text-zinc-400 text-sm">
          Enter the 6-digit code from your authenticator app
        </p>
        {displayError && (
          <p className="text-red-500 mt-4 text-sm font-medium animate-pulse">
            {displayError}
          </p>
        )}
      </div>
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <div className="flex gap-1.5 md:gap-2 justify-center mb-6">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <input
                key={index}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={code[index] || ''}
                onChange={(e) => {
                  const newCode = code.split('')
                  newCode[index] = e.target.value.replace(/\D/g, '')
                  setCode(newCode.join(''))
                  
                  // Auto-focus next input
                  if (e.target.value && index < 5) {
                    const nextInput = e.target.parentElement?.children[index + 1] as HTMLInputElement
                    nextInput?.focus()
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !code[index] && index > 0) {
                    const prevInput = (e.target as HTMLInputElement).parentElement?.children[index - 1] as HTMLInputElement
                    prevInput?.focus()
                  }
                }}
                disabled={loading}
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
                className="w-9 h-12 md:w-11 md:h-14 bg-black/20 border border-white/10 rounded-lg text-lg md:text-xl font-bold text-center text-white font-mono focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            ))}
          </div>
          
          {/* Trust This Device Checkbox */}
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="relative">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={(e) => setTrustDevice(e.target.checked)}
                disabled={loading}
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
          
          {/* Hidden input for accessibility and form submission */}
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            disabled={loading}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="sr-only"
            aria-label="Two-factor authentication code"
          />
        </div>
        
        <div className="my-6">
          <Button
            variant="cta"
            type="submit"
            disabled={code.length !== 6 || loading}
            className="w-full !py-3"
          >
            {loading ? 'Verifying...' : 'Verify Code'}
          </Button>
        </div>
      </form>
      
      <div className="my-5 pt-4 border-t border-white/10 text-center">
        <button
          type="button"
          onClick={onUseBackupCode}
          disabled={loading}
          className="text-zinc-400 text-sm hover:text-white underline decoration-transparent hover:decoration-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Use a backup code instead
        </button>
      </div>
      
      <div className="flex items-center gap-3 mt-4 p-3 bg-[#e50914]/10 border border-[#e50914]/20 rounded-lg">
        <ShieldCheck className="w-5 h-5 text-[#e50914] flex-shrink-0" />
        <span className="text-zinc-400 text-xs leading-relaxed">
          Two-factor authentication adds an extra layer of security to your account
        </span>
      </div>
    </div>
  )
}
