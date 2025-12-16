import { useState, useRef, useEffect } from 'react'
import { Button } from '../index'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

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
  const [rememberDevice, setRememberDevice] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus input when component mounts
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length === 6 && !isLoading) {
      try {
        const res = await fetch('/api/auth/two-factor/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            rememberDevice
          })
        })
        
        if (res.ok) {
          onSuccess()
        } else {
          // Error will be handled by parent component or we could parse it here
          // const data = await res.json()
        }
      } catch (err) {
        // Error will be handled by parent component
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

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-start mb-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="!p-2 -ml-2 text-zinc-400 hover:text-white"
          disabled={isLoading}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>
      <div className="mb-6">
        <h3 className="text-white text-xl font-semibold mb-2">Two-Factor Authentication</h3>
        <p className="text-zinc-400 text-sm">
          Enter the 6-digit code from your authenticator app
        </p>
        {error && (
          <p className="text-red-500 mt-4 text-sm font-medium animate-pulse">
            {error}
          </p>
        )}
      </div>
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <div className="flex gap-2 justify-center mb-6">
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
                disabled={isLoading}
                className="w-11 h-14 bg-black/20 border border-white/10 rounded-lg text-xl font-bold text-center text-white font-mono focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            ))}
          </div>
          
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
            disabled={isLoading}
            className="sr-only"
            aria-label="Two-factor authentication code"
          />
        </div>
        
        <div className="my-6">
          <Button
            variant="cta"
            type="submit"
            disabled={code.length !== 6 || isLoading}
            className="w-full !py-3"
          >
            {isLoading ? 'Verifying...' : 'Verify Code'}
          </Button>
        </div>
        
        <div className="my-4">
          <label className="flex items-center gap-2 text-zinc-400 text-sm cursor-pointer hover:text-zinc-300 transition-colors">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              disabled={isLoading}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#e50914] focus:ring-[#e50914] focus:ring-offset-0"
            />
            Remember this device for 30 days
          </label>
        </div>
      </form>
      
      <div className="my-5 pt-4 border-t border-white/10 text-center">
        <button
          type="button"
          onClick={onUseBackupCode}
          disabled={isLoading}
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
