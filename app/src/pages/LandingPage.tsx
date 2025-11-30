import { SimpleLayout, Button, FormGroup, Input } from '../components/index'

interface LandingPageProps {
  version?: string
}

export function LandingPage({ version }: LandingPageProps) {
  return (
    <SimpleLayout title="Welcome to Zentrio" disableThemeSync={true} className="force-default-theme">
      <div id="zentrio-vanta-bg" style={{ position: 'fixed', inset: 0, zIndex: 0, width: '100vw', height: '100vh' }}></div>
      
      <main className="main-content">
        <div className="container">
          <div className="hero-content" data-tauri-drag-region>
            
            {/* Intro View */}
            <div id="intro-view" className="intro-view">
              <div className="logo-wrapper">
                <img src="/static/logo/icon-512.png" alt="Zentrio Logo" className="intro-logo" />
              </div>
              <h1 className="intro-title">Zentrio</h1>
              <div className="slogan-container">
                <span id="typewriter-text"></span><span className="cursor">|</span>
              </div>
            </div>

            {/* Back Button Container - Moved outside login-view to be relative to main container or fixed */}
            <div id="back-btn-container"></div>

            {/* Login View */}
            <div id="login-view" className="login-view" style={{ display: 'none', opacity: 0 }}>
               <div className="setup-card" style={{ maxWidth: '400px', margin: '0 auto' }}>
                 <div id="inlineAuth"></div>
               </div>
            </div>

            {/* Hidden elements for compatibility with existing JS logic if needed, or we refactor JS */}
            <div id="setup-progress" style={{ display: 'none' }}>
                <div className="progress-header">
                  <h3>Connecting...</h3>
                  <p id="progress-message">Please wait...</p>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" id="progress-fill"></div>
                </div>
            </div>
             <div id="setup-error" style={{ display: 'none' }}>
                <div className="error-content">
                  <h3 style={{color: '#ef4444'}}>Error</h3>
                  <p id="error-message"></p>
                </div>
                <Button variant="secondary" id="retryConnectionBtn">Try Again</Button>
             </div>

          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <a href="https://github.com/mteij/Zentrio" target="_blank" className="github-link">
              <svg className="github-icon" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              v{version}
            </a>
          </div>
        </div>
      </footer>

      <script src="/static/js/landing.js"></script>
      
      {/* Vanta.js background - Neutral/Dark */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js"></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('DOMContentLoaded', () => {
              if (window.VANTA && window.VANTA.FOG) {
                VANTA.FOG({
                  el: "#zentrio-vanta-bg",
                  mouseControls: true,
                  touchControls: true,
                  gyroControls: false,
                  minHeight: 200.00,
                  minWidth: 200.00,
                  scale: 1.00,
                  scaleMobile: 1.00,
                  speed: 0.8,
                  zoom: 0.6,
                  highlightColor: 0x222222,
                  midtoneColor: 0x111111,
                  lowlightColor: 0x000000,
                  baseColor: 0x050505
                });
              }
            });
          `
        }}
      />
    </SimpleLayout>
  )
}