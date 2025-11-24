import { SimpleLayout, Button, Input, Message } from '../components/index'

interface LandingPageProps {}

export function LandingPage({}: LandingPageProps) {
  return (
    <SimpleLayout title="Stream Your Way">
      <div id="vanta-bg"></div>
      
      <main className="main-content">
        <div className="container">
          <div className="hero-content" id="heroContent">
            <h1>Stream Your Way</h1>
            <p>Experience unlimited streaming with Stremio integration. Create profiles, manage your content, and enjoy seamless entertainment.</p>
            
            <form className="email-form" id="emailForm">
                <Input
                    type="email"
                    id="email"
                    className="email-input"
                    placeholder="Enter your email address"
                    required
                />
                <Button type="submit" variant="cta" id="submitBtn">
                    Get Started
                </Button>
            </form>

            <div id="loading" className="loading">
                <div className="spinner"></div>
                <p>Please wait...</p>
            </div>

            <div id="inlineAuth" className="step-hidden inline-auth-container"></div>

            <Message id="message" show={false} />
            
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <p>This is a personal project and is not affiliated with, endorsed, or sponsored by Stremio. I acknowledge that this service may test the boundaries of Stremio's terms of service and will comply with any and all takedown or cease and desist notices from Stremio or its legal representatives. The official Stremio website can be found at <a href="https://stremio.com" target="_blank">stremio.com</a>.</p>
            <a href="https://github.com/MichielEijpe/Zentrio" target="_blank" className="github-link">
              <svg className="github-icon" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Made with love for the stremio community
            </a>
          </div>
        </div>
      </footer>

      {/* Mobile session handler */}
      <script src="/static/js/mobile-session-handler.js"></script>
      
      {/* Landing page logic */}
      <script src="/static/js/landing.js"></script>
      
      {/* Vanta.js Scripts */}
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js"></script>
      
      {/* Iconify Script */}
      <script src="https://code.iconify.design/1/1.0.7/iconify.min.js"></script>

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