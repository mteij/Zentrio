import { Button, Message } from '../index'

interface MagicLinkModalProps {
  email: string
  onBack: () => void
  onResend: () => void
  resendSeconds: number
  message?: string
}

export function MagicLinkModal({
  email,
  onBack,
  onResend,
  resendSeconds,
  message
}: MagicLinkModalProps) {
  return (
    <div id="magicLinkContainer" className="fade-in" style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
        <Button id="magicLinkBackBtn" variant="secondary" onClick={onBack} style={{ background: '#000', border: '1px solid #333', padding: '8px 12px' }}>
          ←
        </Button>
      </div>
      <div style={{ marginBottom: 30 }}>
        <h3 style={{ color: '#fff', marginBottom: 10 }}>Magic Link Sent!</h3>
        <p style={{ color: '#b3b3b3', marginBottom: 20 }}>We've sent a magic link to {email}</p>
        <p style={{ color: '#b3b3b3', fontSize: '0.9rem' }}>Click the link in your email to sign in automatically.</p>
      </div>
      <div style={{ margin: '20px 0' }}>
        <svg style={{ width: 64, height: 64, color: '#e50914', marginBottom: 20 }} fill="currentColor" viewBox="0 0 24 24">
          <path d="M20,8L12,13L4,8V6L12,11L20,6M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4Z" />
        </svg>
      </div>
      <div style={{ margin: '16px 0' }}>
        <span
          id="resendMagicText"
          style={{
            color: '#b3b3b3',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontSize: '0.9rem'
          }}
          onClick={onResend}
          onMouseOver={e => ((e.currentTarget as HTMLElement).style.color = '#e50914')}
          onMouseOut={e => ((e.currentTarget as HTMLElement).style.color = '#b3b3b3')}
        >
          Resend Magic Link ({resendSeconds}s)
        </span>
      </div>
      <Message id="magicLinkContainerMessage" show={!!message} type="error" ariaLive="polite">
        {message}
      </Message>
    </div>
  )
}