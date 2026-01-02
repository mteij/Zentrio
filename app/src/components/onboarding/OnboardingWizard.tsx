import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Shield, Puzzle, ChevronRight, ChevronLeft, 
  ArrowRight, Loader2, Sparkles, Server
} from 'lucide-react';
import { toast } from 'sonner';
import { appMode } from '../../lib/app-mode';
import { resetAuthClient, isTauri, authClient } from '../../lib/auth-client';
import { AuthForms } from '../auth/AuthForms';
import { ParticleBackground } from '../ui/ParticleBackground';
import { useAuthStore } from '../../stores/authStore';
import { BackButton } from '../ui/BackButton';

interface OnboardingWizardProps {
  onComplete: (mode: 'guest' | 'connected', serverUrl?: string) => void;
}

// Feature slide component
interface FeatureSlideProps {
  icon: React.ElementType;
  title: string;
  description: string;
  highlights: string[];
  gradient: string;
}

function FeatureSlide({ icon: Icon, title, description, highlights, gradient }: FeatureSlideProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 py-20">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', duration: 1, bounce: 0.4 }}
        className={`w-32 h-32 rounded-3xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-8 shadow-2xl`}
        style={{ boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.4)' }}
      >
        <Icon className="w-16 h-16 text-white" strokeWidth={1.5} />
      </motion.div>
      
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-5xl md:text-6xl font-bold text-center mb-4"
      >
        <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
          {title}
        </span>
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-xl text-zinc-400 text-center max-w-xl mb-10"
      >
        {description}
      </motion.p>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex flex-wrap justify-center gap-3"
      >
        {highlights.map((item, i) => (
          <motion.span
            key={item}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 + i * 0.1 }}
            className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-zinc-300"
          >
            {item}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
}

// Welcome slide with Zentrio logo
function WelcomeSlide() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 1.2, bounce: 0.3 }}
        className="relative mb-8"
        style={{ width: 200, height: 200 }}
      >
        {/* Outer pulsing ring */}
        <motion.div
          animate={{ 
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.1, 0.3],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full border-2 border-red-500/30"
          style={{ margin: -20 }}
        />
        
        {/* Middle pulsing ring */}
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.4, 0.2, 0.4],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
          className="absolute inset-0 rounded-full border border-red-500/40"
          style={{ margin: -10 }}
        />
        
        {/* Soft glow halo */}
        <motion.div
          animate={{ 
            scale: [1, 1.15, 1],
            opacity: [0.4, 0.7, 0.4],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 bg-red-500 rounded-full blur-3xl"
          style={{ margin: -30 }}
        />
        
        {/* Orbiting dot 1 */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0"
          style={{ margin: -25 }}
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-400 shadow-lg shadow-red-500/50" />
        </motion.div>
        
        {/* Orbiting dot 2 (opposite direction) */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0"
          style={{ margin: -40 }}
        >
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-300/70" />
        </motion.div>
        
        {/* Orbiting dot 3 */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          className="absolute inset-0"
          style={{ margin: -55 }}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-red-200/50" />
        </motion.div>
        
        {/* The logo itself - floating freely */}
        <motion.img
          src="/static/logo/icon-192.png"
          alt="Zentrio"
          initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
          animate={{ 
            opacity: 1, 
            scale: 1, 
            rotate: 0,
            y: [0, -8, 0],
          }}
          transition={{ 
            opacity: { delay: 0.2, duration: 0.5 },
            scale: { delay: 0.2, duration: 0.6, ease: 'backOut' },
            rotate: { delay: 0.2, duration: 0.6 },
            y: { delay: 1, duration: 3, repeat: Infinity, ease: 'easeInOut' },
          }}
          className="relative w-full h-full object-contain drop-shadow-2xl"
          style={{ filter: 'drop-shadow(0 0 30px rgba(220, 38, 38, 0.5))' }}
        />
      </motion.div>
      
      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-5xl md:text-7xl font-bold text-center mb-4"
      >
        <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
          Welcome to Zentrio
        </span>
      </motion.h1>
      
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="text-xl text-zinc-400 text-center max-w-md"
      >
        Stream your way, on your terms
      </motion.p>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="mt-12 flex items-center gap-2 text-zinc-500"
      >
        <Sparkles className="w-4 h-4" />
        <span className="text-sm">Swipe or click to continue</span>
      </motion.div>
    </div>
  );
}

// Setup slide with server selection and full auth
interface SetupSlideProps {
  onComplete: (mode: 'guest' | 'connected', serverUrl?: string) => void;
}

function SetupSlide({ onComplete }: SetupSlideProps) {
  const [step, setStep] = useState<'server' | 'auth'>('server');
  // Initialize from localStorage if available (persisted during server selection before SSO redirect)
  const [serverUrl, setServerUrl] = useState(() => {
    const saved = localStorage.getItem('zentrio_server_url');
    return saved || 'https://app.zentrio.eu';
  });
  const [customUrl, setCustomUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const { isAuthenticated, user } = useAuthStore();
  
  // Check if already authenticated when entering auth step
  useEffect(() => {
    const checkAuth = async () => {
        try {
            console.log('[Onboarding] Proactive auth check...');
            const session = await authClient.getSession();
            if (session.data?.user) {
                console.log('[Onboarding] Session found, updating store...');
                useAuthStore.getState().login(session.data.user, {
                    user: session.data.user,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    token: session.data.session?.token
                });
            }
        } catch (e) {
            console.error('[Onboarding] Proactive check failed (expected if not logged in)', e);
        }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    console.log('[Onboarding] Auth check:', { step, isAuthenticated, user: !!user });
    if (isAuthenticated && user) {
        console.log('[Onboarding] Already authenticated, completing flow...');
        // Just complete immediately if we are already authenticated
        // This handles the social login redirect case
        onComplete('connected', serverUrl);
    }
  }, [step, isAuthenticated, user, onComplete, serverUrl]);
  
  const handleServerConnect = async (url: string) => {
    setChecking(true);
    try {
      let cleanUrl = url.replace(/\/$/, '');
      if (!cleanUrl.startsWith('http')) {
        cleanUrl = `https://${cleanUrl}`;
      }
      
      // Health check
      const fetchFn = isTauri() 
        ? (await import('@tauri-apps/plugin-http')).fetch 
        : fetch;
      
      const res = await fetchFn(`${cleanUrl}/api/health`, {
        signal: AbortSignal.timeout(5000),
      });
      
      if (!res.ok) throw new Error('Server not responding');
      
      localStorage.setItem('zentrio_server_url', cleanUrl);
      setServerUrl(cleanUrl);
      resetAuthClient();
      setStep('auth');
    } catch (e: any) {
      toast.error('Connection Failed', { description: e.message || 'Could not connect to server' });
    } finally {
      setChecking(false);
    }
  };

  const handleChangeServer = () => {
    localStorage.removeItem("zentrio_server_url");
    localStorage.removeItem("zentrio_app_mode");
    // Go back to server selection
    setStep('server');
    setServerUrl('');
    setCustomUrl('');
  };
  
  const handleGuestMode = () => {
    appMode.set('guest');
    localStorage.setItem('zentrio_server_url', 'http://localhost:3000');
    onComplete('guest');
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-8 py-12 overflow-y-auto">
      <AnimatePresence mode="wait">
        {step === 'server' ? (
          <motion.div
            key="server"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-md"
          >
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center justify-center mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Server className="w-8 h-8 text-red-500" />
                  </div>
                </div>
                
                <h2 className="text-3xl font-bold text-center mb-2">
                  <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                    Connect to Server
                  </span>
                </h2>
                <p className="text-zinc-400 text-center text-sm mb-8">
                  Choose the official server or connect to your own
                </p>
                
                <div className="space-y-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleServerConnect('https://app.zentrio.eu')}
                    disabled={checking}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {checking ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Use Official Server
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                  
                  <div className="relative flex items-center gap-4 my-6">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs uppercase text-zinc-500">Or self-host</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="https://your-server.com"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && customUrl && handleServerConnect(customUrl)}
                      className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleServerConnect(customUrl)}
                      disabled={!customUrl || checking}
                      className="flex-shrink-0 px-6 py-3 sm:py-0 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
            
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              onClick={handleGuestMode}
              className="w-full mt-6 text-zinc-500 hover:text-zinc-300 text-sm transition-colors text-center"
            >
              Continue without an account →
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            key="auth"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="w-full max-w-lg"
          >
            {/* Back button - Removed as AuthForms has its own */}
            
            {/* Server indicator - Moved higher up or kept? */}
            

            
            {/* Full AuthForms component - includes social login, magic link, OTP, etc. */}
            
            {/* Back Button (Change Server) */}
            {isTauri() && (
               <div className="absolute -top-12 left-0 md:-left-12 md:top-6 z-20">
                    <BackButton onClick={handleChangeServer} label="Change Server" />
               </div>
            )}

            <AuthForms 
                mode={authMode} 
                onSuccess={() => {
                    console.log('[Onboarding] AuthForms success callback');
                    onComplete('connected', serverUrl);
                }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Main wizard component
export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const slides = [
    { type: 'welcome' },
    { 
      type: 'feature',
      icon: Users,
      title: 'Family Profiles',
      description: 'Everyone gets their own space with personalized recommendations, watch history, and preferences.',
      highlights: ['Personal watchlists', 'Kid-friendly mode', 'Separate progress'],
      gradient: 'from-purple-500 to-indigo-600',
    },
    {
      type: 'feature',
      icon: Puzzle,
      title: 'Your Sources',
      description: 'Choose your own content sources with our powerful addon system. Your library, your rules.',
      highlights: ['Custom addons', 'Multiple sources', 'Community catalogs'],
      gradient: 'from-orange-500 to-red-600',
    },
    {
      type: 'feature',
      icon: Shield,
      title: 'Privacy First',
      description: 'Self-host your data or use our cloud. Either way, your viewing history stays private.',
      highlights: ['Self-hosting', 'No tracking', 'Open source'],
      gradient: 'from-emerald-500 to-teal-600',
    },
    { type: 'setup' },
  ];
  
  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };
  
  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };
  
  const skipToSetup = () => {
    setCurrentSlide(slides.length - 1);
  };
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
      if (e.key === 'Escape') skipToSetup();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);
  
  const slide = slides[currentSlide];
  
  return (
    <div 
      className="fixed inset-0 bg-black text-white overflow-hidden"
      style={{
        paddingTop: 'var(--safe-area-inset-top)',
        paddingBottom: 'var(--safe-area-inset-bottom)',
        paddingLeft: 'var(--safe-area-inset-left)',
        paddingRight: 'var(--safe-area-inset-right)',
      }}
    >
      <ParticleBackground />
      
      {/* Skip button */}
      {currentSlide < slides.length - 1 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={skipToSetup}
          className="absolute right-6 z-50 text-zinc-500 hover:text-white text-sm transition-colors flex items-center gap-1"
          style={{ top: 'calc(var(--safe-area-inset-top, 0px) + 1.5rem)' }}
        >
          Skip
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      )}
      
      {/* Navigation arrows */}
      {currentSlide > 0 && currentSlide < slides.length - 1 && (
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={prevSlide}
          className="absolute left-6 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
        >
          <ChevronLeft className="w-6 h-6" />
        </motion.button>
      )}
      
      {currentSlide < slides.length - 1 && (
        <motion.button
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={nextSlide}
          className="absolute right-6 top-1/2 -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all"
        >
          <ChevronRight className="w-6 h-6" />
        </motion.button>
      )}
      
      {/* Progress dots - Hide on setup slide */}
      {slide.type !== 'setup' && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === currentSlide 
                  ? 'w-8 bg-red-500' 
                  : 'bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
      
      {/* Slide content with swipe gesture support */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative z-10"
          // Enable horizontal drag for swipe gestures on non-setup slides
          drag={slide.type !== 'setup' ? 'x' : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(event, info) => {
            // Detect swipe direction based on velocity and offset
            const swipeThreshold = 50;
            const velocityThreshold = 500;
            
            if (info.offset.x < -swipeThreshold || info.velocity.x < -velocityThreshold) {
              // Swiped left -> go to next slide
              nextSlide();
            } else if (info.offset.x > swipeThreshold || info.velocity.x > velocityThreshold) {
              // Swiped right -> go to previous slide
              prevSlide();
            }
          }}
        >
          {slide.type === 'welcome' && <WelcomeSlide />}
          {slide.type === 'feature' && (
            <FeatureSlide
              icon={slide.icon!}
              title={slide.title!}
              description={slide.description!}
              highlights={slide.highlights!}
              gradient={slide.gradient!}
            />
          )}
          {slide.type === 'setup' && <SetupSlide onComplete={onComplete} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default OnboardingWizard;
