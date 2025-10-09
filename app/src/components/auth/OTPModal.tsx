import { Button } from '../index'

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
  resendSeconds
}: OTPModalProps) {
  return (
    <div id="otpContainer" className="otp-container fade-in">
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
        <Button
          id="otpBackBtn"
          variant="secondary"
          className="back-button"
        >
          ←
        </Button>
      </div>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ color: '#fff', marginBottom: 10 }}>Enter OTP Code</h3>
        <p id="otpEmailText" style={{ color: '#b3b3b3', marginBottom: 20 }}>
          We've sent a 6-digit code to {email}
        </p>
      </div>
      <div className="form-group">
        <input
          id="otpCodeInput"
          className="otp-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          aria-describedby="otpHelp"
        />
        <div id="otpHelp" className="sr-only">
          Enter the 6-digit code sent to your email.
        </div>
      </div>
      <div style={{ margin: '20px 0' }}>
        <Button id="verifyOtpCodeBtn" variant="cta">
          Verify Code
        </Button>
      </div>
      <div style={{ margin: '16px 0' }}>
        <span
          id="resendOtpText"
          className="resend-text"
        >
          Resend OTP ({resendSeconds}s)
        </span>
      </div>
    </div>
  )
}