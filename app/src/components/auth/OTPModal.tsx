import { useState } from 'react'
import { Button, Message } from '../index'

interface OTPModalProps {
  email: string
  onBack: () => void
  onVerify: (code: string) => void
  onResend: () => void
  resendSeconds: number
  message?: string
}

export function OTPModal({
  email,
  onBack,
  onVerify,
  onResend,
  resendSeconds,
  message
}: OTPModalProps) {
  const [code, setCode] = useState('')
  return (
    <div id="otpContainer" className="fade-in" style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
        <Button id="otpBackBtn" variant="secondary" onClick={onBack} style={{ background: '#000', border: '1px solid #333', padding: '8px 12px' }}>
          ←
        </Button>
      </div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ color: '#fff', marginBottom: 10 }}>Enter OTP Code</h3>
        <p style={{ color: '#b3b3b3', marginBottom: 20 }}>We've sent a 6-digit code to {email}</p>
      </div>
      <div className="form-group">
        <input
          id="otpCodeInput"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          style={{
            textAlign: 'center',
            fontSize: '1.5rem',
            letterSpacing: '0.5rem',
            padding: 16,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            color: 'white',
            width: 200,
            margin: '0 auto',
            display: 'block'
          }}
          aria-describedby="otpHelp"
          value={code}
          onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
        />
        <div id="otpHelp" className="sr-only">Enter the 6-digit code sent to your email.</div>
      </div>
      <div style={{ margin: '20px 0' }}>
        <Button id="verifyOtpCodeBtn" variant="cta" onClick={() => onVerify(code)}>
          Verify Code
        </Button>
      </div>
      <div style={{ margin: '16px 0' }}>
        <span
          id="resendOtpText"
          style={{
            color: '#b3b3b3',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontSize: '0.9rem'
          }}
          onClick={onResend}
          onMouseOver={e => (e.currentTarget.style.color = '#e50914')}
          onMouseOut={e => (e.currentTarget.style.color = '#b3b3b3')}
        >
          Resend OTP ({resendSeconds}s)
        </span>
      </div>
      <Message id="otpContainerMessage" show={!!message} type="error" ariaLive="polite">
        {message}
      </Message>
    </div>
  )
}