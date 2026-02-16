import { useState, useRef, useEffect } from 'react'
import { Button } from '../index'
import { apiFetch } from '../../lib/apiFetch'

interface PasswordResetModalProps {
  onBack: () => void
  onSuccess: () => void
  isLoading?: boolean
  error?: string
}

export function PasswordResetModal({
  onBack,
  isLoading = false,
  error
}: PasswordResetModalProps) {
  const [email, setEmail] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)
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
      const timer = setTimeout(() => {
        setResendSeconds(resendSeconds - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [resendSeconds])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return
    }
    
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          redirectTo: window.location.origin + '/reset-password'
        })
      })
      
      if (res.ok) {
        setIsSubmitted(true)
        setResendSeconds(60) // 1 minute cooldown
      }
    } catch {
      // Error will be handled by parent component
    }
  }

  const handleResend = async () => {
    if (resendSeconds > 0 || isLoading) return
    
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email,
          redirectTo: window.location.origin + '/reset-password'
        })
      })
      
      if (res.ok) {
        setResendSeconds(60)
      }
    } catch {
      // Error will be handled by parent component
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit(e as any)
    }
  }

  if (isSubmitted) {
    return (
      <div className="password-reset-container fade-in">
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
          <Button
            variant="secondary"
            onClick={onBack}
            className="back-button"
            disabled={isLoading}
          >
            ←
          </Button>
        </div>
        <div style={{ marginBottom: 30 }}>
          <h3 style={{ color: '#fff', marginBottom: 10 }}>Reset Email Sent!</h3>
          <p style={{ color: '#b3b3b3', marginBottom: 20 }}>
            We&apos;ve sent a password reset link to {email}
          </p>
          <p style={{ color: '#b3b3b3', fontSize: '0.9rem' }}>
            Check your inbox and click the link to reset your password.
          </p>
          {error && (
            <p style={{ color: '#ef4444', marginTop: 16, fontSize: '0.9rem' }}>
              {error}
            </p>
          )}
        </div>
        <div style={{ margin: '20px 0' }}>
          <svg 
            style={{ 
              width: 64, 
              height: 64, 
              color: '#e50914', 
              marginBottom: 20 
            }} 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M10,9.5C10,10.3 9.3,11 8.5,11C7.7,11 7,10.3 7,9.5C7,8.7 7.7,8 8.5,8C9.3,8 10,8.7 10,9.5M17,9.5C17,10.3 16.3,11 15.5,11C14.7,11 14,10.3 14,9.5C14,8.7 14.7,8 15.5,8C16.3,8 17,8.7 17,9.5M12,17.23C10.25,17.23 8.71,16.5 7.81,15.42L9.23,14C9.68,14.72 10.75,15.23 12,15.23C13.25,15.23 14.32,14.72 14.77,14L16.19,15.42C15.29,16.5 13.75,17.23 12,17.23Z" />
          </svg>
        </div>
        <div style={{ margin: '16px 0' }}>
          <span
            className={`resend-text ${resendSeconds === 0 && !isLoading ? 'cursor-pointer hover:text-white' : 'cursor-not-allowed opacity-50'}`}
            onClick={handleResend}
            style={{
              color: resendSeconds === 0 && !isLoading ? '#b3b3b3' : '#666',
              transition: 'color 0.2s ease'
            }}
          >
            {isLoading ? 'Sending...' : resendSeconds > 0 ? `Resend Email (${resendSeconds}s)` : 'Resend Email'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="password-reset-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
        <Button
          variant="secondary"
          onClick={onBack}
          className="back-button"
          disabled={isLoading}
        >
          ←
        </Button>
      </div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ color: '#fff', marginBottom: 10 }}>Reset Password</h3>
        <p style={{ color: '#b3b3b3', marginBottom: 20 }}>
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
        {error && (
          <p style={{ color: '#ef4444', marginBottom: 16, fontSize: '0.9rem' }}>
            {error}
          </p>
        )}
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <input
            ref={inputRef}
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            required
            style={{
              width: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '12px 16px',
              fontSize: '16px',
              color: '#fff',
              transition: 'all 0.2s ease'
            }}
          />
        </div>
        <div style={{ margin: '20px 0' }}>
          <Button
            variant="cta"
            type="submit"
            disabled={!email || isLoading}
            className="w-full"
          >
            {isLoading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </div>
      </form>
    </div>
  )
}