import { useState, useRef, useEffect } from 'react'
import { Button } from '../index'
import { authClient } from '../../lib/auth-client'
import { toast } from '../../utils/toast'
import { ArrowLeft, MailCheck, ShieldAlert } from 'lucide-react'

interface EmailVerificationModalProps {
  email: string
  onBack: () => void
  onSuccess: () => void
  onResend: () => void
  isLoading?: boolean
  error?: string
  resendSeconds: number
}

export function EmailVerificationModal({
  email,
  onBack,
  onSuccess,
  onResend,
  isLoading: parentIsLoading = false,
  error: parentError,
  resendSeconds
}: EmailVerificationModalProps) {
  const [code, setCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [canResend, setCanResend] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Focus input when component mounts
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  useEffect(() => {
    // Handle resend timer
    if (resendSeconds > 0) {
      setCanResend(false)
    } else {
      setCanResend(true)
    }
  }, [resendSeconds])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '') // Only allow digits
    setCode(value)
    if (localError) setLocalError(null)
  }

  const handleVerify = async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    if (code.length !== 6) return
    
    setIsVerifying(true)
    setLocalError(null)
    
    try {
      const { data, error } = await authClient.emailOtp.verifyEmail({
        email,
        otp: code
      })

      if (error) {
        setLocalError(error.message || 'Failed to verify email')
        toast.error('Verification Failed', error.message || 'Invalid code')
      } else {
        setIsVerified(true)
        toast.success('Email Verified', 'Your email has been successfully verified')
        setTimeout(() => {
          onSuccess()
        }, 1500)
      }
    } catch (err) {
      setLocalError('An unexpected error occurred')
      toast.error('Error', 'An unexpected error occurred')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendClick = async () => {
    if (canResend && !parentIsLoading && !isVerifying) {
        onResend()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && code.length === 6) {
      handleVerify()
    }
  }

  if (isVerified) {
    return (
      <div className="animate-in fade-in zoom-in-95 duration-300 text-center p-8">
        <div className="mb-8">
          <h3 className="text-xl font-bold text-white mb-2">Email Verified!</h3>
          <p className="text-zinc-400">
            Your email has been successfully verified.
          </p>
        </div>
        <div className="my-8 flex justify-center">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center">
            <MailCheck className="w-10 h-10 text-green-500" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-start mb-2">
        <Button
          variant="ghost"
          onClick={onBack}
          disabled={parentIsLoading || isVerifying}
          className="!p-2 -ml-2 text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
      </div>
      
      <div className="mb-6">
        <h3 className="text-white text-xl font-semibold mb-2">Verify Your Email</h3>
        <p className="text-zinc-400 text-sm">
          We've sent a 6-digit code to <span className="text-white font-medium">{email}</span>
        </p>
        
        {(localError || parentError) && (
          <p className="text-red-500 mt-4 text-sm font-medium animate-pulse bg-red-500/10 p-3 rounded-md border border-red-500/20">
            {localError || parentError}
          </p>
        )}
      </div>

      <div className="space-y-6">
        <div className="relative">
          <input
            ref={inputRef}
            className="w-full bg-black/20 border border-white/10 rounded-xl py-4 px-2 text-center font-mono text-3xl tracking-[0.5em] text-white focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914] transition-all placeholder:tracking-normal placeholder:text-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={parentIsLoading || isVerifying}
            autoFocus
          />
        </div>

        <Button
          variant="cta"
          onClick={() => handleVerify()}
          disabled={code.length !== 6 || parentIsLoading || isVerifying}
          className="w-full !py-3 text-base font-bold"
        >
          {isVerifying ? 'Verifying...' : 'Verify Email'}
        </Button>
      </div>
      
      <div className="mt-6 text-center">
        <button
          className={`text-sm font-medium transition-colors ${canResend && !parentIsLoading && !isVerifying ? 'text-zinc-400 hover:text-white cursor-pointer hover:underline decoration-white/20' : 'text-zinc-600 cursor-not-allowed'}`}
          onClick={handleResendClick}
          disabled={!canResend || parentIsLoading || isVerifying}
        >
          {canResend ? 'Resend Verification Code' : `Resend Code in ${resendSeconds}s`}
        </button>
      </div>

      <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3 items-start">
        <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-zinc-300 text-xs font-medium">Check your spam folder</p>
          <p className="text-zinc-500 text-xs leading-relaxed">
            If you don't see the email within a few minutes, please check your spam or junk folder.
          </p>
        </div>
      </div>
    </div>
  )
}

