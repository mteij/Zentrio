import { useState, useEffect } from 'react'
import { Button } from '../index'
import { toast } from '../../utils/toast'

interface MagicLinkModalProps {
  email: string
  onBack: () => void
  onResend: () => void
  resendSeconds: number
  isLoading?: boolean
  error?: string
}

export function MagicLinkModal({
  email,
  onBack,
  onResend,
  resendSeconds,
  isLoading = false,
  error
}: MagicLinkModalProps) {
  const [canResend, setCanResend] = useState(false)

  useEffect(() => {
    // Handle resend timer
    if (resendSeconds > 0) {
      setCanResend(false)
    } else {
      setCanResend(true)
    }
  }, [resendSeconds])

  const handleResend = () => {
    if (canResend && !isLoading) {
      onResend()
      toast.info('Magic link sent', 'Check your inbox for the new link.')
    } else if (!canResend) {
      toast.warning('Please wait', 'You can resend the magic link in a moment.')
    }
  }

  return (
    <div id="magicLinkContainer" className="magic-link-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
        <Button
          id="magicLinkBackBtn"
          variant="secondary"
          onClick={onBack}
          className="back-button"
          disabled={isLoading}
        >
          ←
        </Button>
      </div>
      <div style={{ marginBottom: 30 }}>
        <h3 style={{ color: '#fff', marginBottom: 10 }}>Magic Link Sent!</h3>
        <p style={{ color: '#b3b3b3', marginBottom: 20 }}>We've sent a magic link to {email}</p>
        <p style={{ color: '#b3b3b3', fontSize: '0.9rem' }}>Click the link in your email to sign in automatically.</p>
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
            marginBottom: 20,
            opacity: isLoading ? 0.5 : 1
          }}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z" />
        </svg>
      </div>
      <div style={{ margin: '16px 0' }}>
        <span
          id="resendMagicText"
          className={`resend-text ${canResend && !isLoading ? 'cursor-pointer hover:text-white' : 'cursor-not-allowed opacity-50'}`}
          onClick={handleResend}
          style={{
            color: canResend && !isLoading ? '#b3b3b3' : '#666',
            transition: 'color 0.2s ease'
          }}
        >
          {isLoading ? 'Sending...' : canResend ? 'Resend Magic Link' : `Resend Magic Link (${resendSeconds}s)`}
        </span>
      </div>
    </div>
  )
}