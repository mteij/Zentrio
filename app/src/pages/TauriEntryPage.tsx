import { SimpleLayout, Button } from '../components/index'

interface TauriEntryPageProps {}

export function TauriEntryPage({}: TauriEntryPageProps) {
  return (
    <SimpleLayout title="Welcome to Zentrio" disableThemeSync={true} className="min-h-screen flex flex-col">
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #000000 100%)'
      }}></div>
      
      <main className="flex-1 flex items-center justify-center relative z-10">
        <div className="container text-center">
          <div className="flex flex-col items-center" data-tauri-drag-region>
            <div className="mb-8">
              <img src="/static/logo/icon-512.png" alt="Zentrio Logo" style={{ width: '120px', height: '120px', borderRadius: '24px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }} />
            </div>
            <h1 className="text-5xl mb-4 font-bold">Zentrio</h1>
            <p className="text-xl text-zinc-400 mb-12">Your personal streaming hub</p>

            <Button 
              variant="primary" 
              id="nextBtn" 
              className="entry-button px-12 py-3 text-lg rounded-full bg-white text-black font-bold border-none cursor-pointer transition-transform duration-200 hover:scale-105"
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