import { SimpleLayout, Button } from '../components/index'

interface TauriEntryPageProps {}

export function TauriEntryPage({}: TauriEntryPageProps) {
  return (
    <SimpleLayout title="Welcome to Zentrio" disableThemeSync={true} className="force-default-theme">
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #000000 100%)'
      }}></div>
      
      <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="hero-content" data-tauri-drag-region>
            <div className="logo-container" style={{ marginBottom: '2rem' }}>
              <img src="/static/logo/icon-512.png" alt="Zentrio Logo" style={{ width: '120px', height: '120px', borderRadius: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} />
            </div>
            <h1 style={{ fontSize: '3rem', marginBottom: '1rem', fontWeight: 'bold' }}>Zentrio</h1>
            <p style={{ fontSize: '1.2rem', color: '#aaa', marginBottom: '3rem' }}>Your personal streaming hub</p>

            <Button 
              variant="primary" 
              id="nextBtn" 
              className="entry-button"
              style={{ 
                padding: '12px 48px', 
                fontSize: '1.1rem',
                borderRadius: '50px',
                background: 'white',
                color: 'black',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer',
                transition: 'transform 0.2s ease'
              }}
            >
              Next
            </Button>
          </div>
        </div>
      </main>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              const nextBtn = document.getElementById('nextBtn');
              if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                  window.location.href = '/tauri-login';
                });
                
                // Add hover effect
                nextBtn.addEventListener('mouseenter', () => {
                  nextBtn.style.transform = 'scale(1.05)';
                });
                nextBtn.addEventListener('mouseleave', () => {
                  nextBtn.style.transform = 'scale(1)';
                });
              }
            })();
          `
        }}
      />

    </SimpleLayout>
  )
}