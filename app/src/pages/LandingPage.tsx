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
                className="email-input"
                id="email"
                placeholder="Enter your email address"
                required
              />
              <Button type="submit" variant="cta" id="submitBtn">
                Get Started
              </Button>
            </form>
            
            <div className="loading" id="loading" style={{ display: 'none' }}>
              <div className="spinner"></div>
              Checking your account...
            </div>
            
            <Message id="message" role="alert" show={false} ariaLive="polite" />
            <div id="inlineAuth" className="inline-auth-container step-hidden" aria-live="polite"></div>
            <noscript>
              <p style={{ marginTop: '12px' }}>
                JavaScript is disabled. Continue to
                <a href="/signin">Sign in</a> or
                <a href="/register">Create an account</a>.
              </p>
            </noscript>
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

      {/* Inline styles for the landing page */}
      <style>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          background: #000000;
          color: white;
          height: 100vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        #vanta-bg {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: -1;
        }

        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 0 20px;
        }

        .main-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px 0;
        }

        .hero-content {
          text-align: center;
          z-index: 1;
          position: relative;
        }

        .hero-content h1 {
          font-size: 3.5rem;
          font-weight: bold;
          margin-bottom: 15px;
          background: linear-gradient(135deg, #e50914, #ff6b6b);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1.1;
        }

        .hero-content p {
          font-size: 1.3rem;
          margin-bottom: 30px;
          color: #b3b3b3;
          line-height: 1.4;
        }

        .email-form {
          display: flex;
          max-width: 500px;
          margin: 0 auto;
          gap: 15px;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          padding: 20px;
          border-radius: 12px;
          border: 1px solid rgba(229, 9, 20, 0.3);
          box-shadow: 0 10px 40px rgba(229, 9, 20, 0.2);
        }

        .email-input {
          flex: 1;
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: white;
          font-size: 16px;
          outline: none;
          transition: all 0.3s;
        }

        .email-input:focus {
          border-color: #e50914;
          background: rgba(255, 255, 255, 0.15);
        }

        .email-input::placeholder {
          color: #888;
        }

        .cta-button {
          padding: 16px 32px;
          background: linear-gradient(135deg, #e50914, #ff1a1a);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.3s;
          white-space: nowrap;
        }

        .cta-button:hover {
          background: linear-gradient(135deg, #ff1a1a, #e50914);
          transform: translateY(-2px);
          box-shadow: 0 10px 30px rgba(229, 9, 20, 0.4);
        }

        .cta-button:disabled {
          background: #666;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .loading {
          display: none;
          text-align: center;
          margin-top: 20px;
        }

        .spinner {
          border: 2px solid #333;
          border-top: 2px solid #e50914;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          animation: spin 1s linear infinite;
          display: inline-block;
          margin-right: 8px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .footer {
          padding: 15px 0;
          background: transparent;
        }

        .footer-content {
          text-align: center;
          font-size: 0.75rem;
          color: #666;
          line-height: 1.3;
          max-width: 600px;
          margin: 0 auto;
        }

        .footer-content a {
          color: #e50914;
          text-decoration: none;
        }

        .footer-content a:hover {
          text-decoration: underline;
        }

        .github-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          font-size: 0.8rem;
          color: #888;
          text-decoration: none;
          transition: color 0.3s;
        }

        .github-link:hover {
          color: #e50914;
        }

        .github-icon {
          width: 16px;
          height: 16px;
          fill: currentColor;
        }

        @media (max-width: 768px) {
          .hero-content h1 {
            font-size: 2.2rem;
            margin-bottom: 10px;
          }

          .hero-content p {
            font-size: 1.1rem;
            margin-bottom: 25px;
          }

          .email-form {
            flex-direction: column;
            max-width: 400px;
            padding: 15px;
          }

          .container {
            padding: 0 15px;
          }

          .footer-content {
            font-size: 0.7rem;
          }

          .github-link {
            font-size: 0.75rem;
          }
        }

        @media (max-width: 480px) {
          .hero-content h1 {
            font-size: 1.8rem;
          }

          .hero-content p {
            font-size: 1rem;
          }

          .email-form {
            max-width: 100%;
          }

          .footer-content {
            font-size: 0.65rem;
          }

          .github-link {
            font-size: 0.7rem;
          }

          .github-icon {
            width: 14px;
            height: 14px;
          }
        }

        .step-hidden {
          display: none !important;
        }

        .inline-auth-container {
          margin-top: 20px;
        }
      `}</style>

      {/* Landing page JavaScript */}
      <script src="/static/js/landing.js"></script>

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