import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { SimpleLayout, Button, Input, TitleBar } from '../components'
import { ParticleBackground } from '../components/ui/ParticleBackground'
import { Loader2, ArrowRight } from "lucide-react";
import { authClient, getClientUrl } from '../lib/auth-client';
import { apiFetch } from '../lib/apiFetch';
import { getLoginBehaviorRedirectPath } from '../hooks/useLoginBehavior';

// Brand icons as SVG components
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
  </svg>
);

interface LandingPageProps {
  version?: string
}

export function LandingPage({ version }: LandingPageProps) {
  const navigate = useNavigate()
  
  const [view, setView] = useState<'intro' | 'login'>('intro')
  const [email, setEmail] = useState('')
  const [typewriterText, setTypewriterText] = useState('')
  const [isChecking, setIsChecking] = useState(false)
  
  const SLOGAN = "Stream Your Way"

  // Note: Authenticated user redirect is now handled by PublicRoute wrapper

  useEffect(() => {
    // Typewriter effect
    let i = 0
    const speed = 100
    const type = () => {
      if (i < SLOGAN.length) {
        setTypewriterText(SLOGAN.substring(0, i + 1))
        i++
        setTimeout(type, speed)
      } else {
        setTimeout(() => setView('login'), 800)
      }
    }
    type()
  }, [])

  const [providers, setProviders] = useState<{
    google: boolean;
    github: boolean;
    discord: boolean;
    oidc: boolean;
    oidcName: string;
  }>({
    google: false,
    github: false,
    discord: false,
    oidc: false,
    oidcName: 'OpenID'
  });

  useEffect(() => {
    apiFetch('/api/auth/providers')
      .then(res => {
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}`);
        }
        return res.json();
      })
      .then(data => setProviders(data))
      .catch(err => console.error("Failed to fetch auth providers", err));
  }, []);

  const handleSocialLogin = async (provider: "google" | "github" | "discord") => {
    try {
      const redirectPath = getLoginBehaviorRedirectPath()
      await authClient.signIn.social({
        provider,
        callbackURL: `${getClientUrl()}${redirectPath}`,
      });
    } catch (e) {
      console.error("Social login failed", e);
    }
  };

  return (
    <>
      <TitleBar />
      <ParticleBackground />
      
      <main className="min-h-screen flex items-center justify-center relative z-10 p-4 w-full">
        <div className="w-full max-w-lg mx-auto">
          <div className="w-full flex flex-col items-center justify-center text-center relative z-10" data-tauri-drag-region>
            
            <AnimatePresence mode="wait">
              {view === 'intro' ? (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center min-h-[60vh]"
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="mb-8"
                  >
                    <img src="/static/logo/icon-512.png" alt="Zentrio Logo" className="w-24 h-24 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)]" />
                  </motion.div>
                  <h1 className="text-5xl md:text-6xl font-bold mb-4 text-white tracking-tight">Zentrio</h1>
                  <div className="text-xl text-gray-400 font-mono tracking-wide">
                    <span id="typewriter-text">{typewriterText}</span><span className="animate-pulse text-purple-500">|</span>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="w-full flex flex-col items-center"
                >


                  <div className="w-full max-w-sm flex flex-col gap-4">
                    <form 
                      onSubmit={async (e) => {
                        e.preventDefault()
                        if (email && !isChecking) {
                          setIsChecking(true);
                          try {
                              const res = await apiFetch('/api/auth/identify', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ email })
                              });
                              const data = await res.json();
                              
                              if (data.exists) {
                                  navigate(`/signin?email=${encodeURIComponent(email)}`);
                              } else {
                                  navigate(`/register?email=${encodeURIComponent(email)}`);
                              }
                          } catch (err) {
                              console.error("Check failed", err);
                              // Fallback to signin if check fails
                              navigate(`/signin?email=${encodeURIComponent(email)}`);
                          } finally {
                              setIsChecking(false);
                          }
                        }
                      }}
                      className="w-full"
                    >
                      <div className="relative">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@example.com"
                          className="w-full h-14 pl-4 pr-14 bg-white/5 border border-white/10 hover:border-white/20 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/50 rounded-xl transition-all text-lg text-white placeholder:text-zinc-500 disabled:opacity-50"
                          required
                          autoFocus
                          disabled={isChecking}
                        />
                        <button 
                          type="submit"
                          disabled={isChecking}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isChecking ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
                        </button>
                      </div>
                    </form>

                    <div className="flex items-center gap-4 py-2">
                       <div className="h-px bg-white/10 flex-1"></div>
                       <span className="text-gray-500 text-sm font-medium uppercase tracking-wider">or continue with</span>
                       <div className="h-px bg-white/10 flex-1"></div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      {providers.google && (
                        <button
                          type="button"
                          onClick={() => handleSocialLogin("google")}
                          className="flex items-center justify-center gap-2 bg-white text-black hover:bg-gray-100 py-3 rounded-xl transition-colors font-medium text-sm"
                        >
                          <GoogleIcon />
                        </button>
                      )}
                      {providers.github && (
                        <button
                         type="button"
                          onClick={() => handleSocialLogin("github")}
                          className="flex items-center justify-center gap-2 bg-[#24292F] text-white hover:bg-[#2b3137] py-3 rounded-xl transition-colors font-medium text-sm"
                        >
                          <GitHubIcon />
                        </button>
                      )}
                      {providers.discord && (
                        <button
                         type="button"
                           onClick={() => handleSocialLogin("discord")}
                           className="flex items-center justify-center gap-2 bg-[#5865F2] text-white hover:bg-[#4752C4] py-3 rounded-xl transition-colors font-medium text-sm"
                        >
                          <DiscordIcon />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </main>

      <footer className="w-full py-6 text-center text-gray-500 text-sm relative z-10">
        <div className="container mx-auto px-4">
          <a href="https://github.com/mteij/Zentrio" target="_blank" className="hover:text-white transition-colors inline-flex items-center justify-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            v{version}
          </a>
        </div>
      </footer>
    </>
  )
}