import { SimpleLayout, Button, Input, Message } from '../components/index'

interface ResetPasswordPageProps {}

export function ResetPasswordPage({}: ResetPasswordPageProps) {
  return (
    <SimpleLayout title="Reset Password">
      <div id="vanta-bg"></div>
      
      <main className="main-content">
        <div className="container">
          <div className="hero-content" style={{ maxWidth: '400px', margin: '0 auto' }}>
            <h1>Reset Password</h1>
            <p>Enter your new password below.</p>
            
            <form className="email-form" id="resetPasswordForm" style={{ flexDirection: 'column', gap: '16px' }}>
                <div className="form-group" style={{ width: '100%' }}>
                    <Input
                        type="password"
                        id="password"
                        className="email-input"
                        placeholder="New Password"
                        required
                        minLength={8}
                        style={{ width: '100%' }}
                    />
                </div>
                <div className="form-group" style={{ width: '100%' }}>
                    <Input
                        type="password"
                        id="confirmPassword"
                        className="email-input"
                        placeholder="Confirm Password"
                        required
                        minLength={8}
                        style={{ width: '100%' }}
                    />
                </div>
                <Button type="submit" variant="cta" id="submitBtn" style={{ width: '100%' }}>
                    Reset Password
                </Button>
            </form>

            <Message id="message" show={false} />
            
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <p>© {new Date().getFullYear()} Zentrio</p>
          </div>
        </div>
      </footer>

      {/* Reset Password logic */}
      <script src="/static/js/reset-password.js"></script>
      
      {/* Vanta.js Scripts */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js"></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('DOMContentLoaded', function() {
              if (typeof VANTA !== 'undefined' && VANTA.FOG) {
                VANTA.FOG({
                  el: "#vanta-bg",
                  mouseControls: true,
                  touchControls: true,
                  gyroControls: false,
                  minHeight: 200.00,
                  minWidth: 200.00,
                  highlightColor: 0xe50914,
                  midtoneColor: 0x333333,
                  lowlightColor: 0x000000,
                  baseColor: 0x000000,
                  blurFactor: 0.90,
                  speed: 0.50,
                  zoom: 0.30
                });
              }
            });
          `
        }}
      />
    </SimpleLayout>
  )
}