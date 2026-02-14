import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, ArrowLeft, Loader2, Server, X, Mail, Lock, User as UserIcon, Sparkles, KeyRound
} from 'lucide-react';
import { toast } from 'sonner';
import { appMode } from '../../lib/app-mode';
import { resetAuthClient, isTauri, authClient, getServerUrl, getClientUrl } from '../../lib/auth-client';
import { apiFetchJson } from '../../lib/apiFetch';
import { ParticleBackground } from '../ui/ParticleBackground';
import { useAuthStore } from '../../stores/authStore';


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

interface OnboardingWizardProps {
  onComplete: (mode: 'guest' | 'connected', serverUrl?: string) => void;
}

type OnboardingStep = 'main' | 'email-signin' | 'email-signup' | 'server';

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState<OnboardingStep>('main');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  
  // Server state
  const [serverUrl, setServerUrl] = useState(() => {
    const saved = localStorage.getItem('zentrio_server_url');
    if (saved) return saved;
    const defaultServer = 'https://app.zentrio.eu';
    localStorage.setItem('zentrio_server_url', defaultServer);
    resetAuthClient();
    return defaultServer;
  });
  const [customUrl, setCustomUrl] = useState('');
  const [checking, setChecking] = useState(false);
  
  // Email auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [emailMethod, setEmailMethod] = useState<'password' | 'magic-link' | 'otp'>('password');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  
  
  // Auth store
  const { isAuthenticated, user } = useAuthStore();
  
  // Available providers
  const [providers, setProviders] = useState<{
    google: boolean;
    github: boolean;
    discord: boolean;
    oidc: boolean;
    oidcName: string;
  }>({
    google: false, github: false, discord: false, oidc: false, oidcName: 'OpenID'
  });
  
  // Fetch available providers
  useEffect(() => {
    apiFetchJson<any>('/api/auth/providers')
      .then(data => setProviders(data))
      .catch(err => console.error('[Onboarding] Failed to fetch providers', err));
  }, []);
  
  // Check if already authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await authClient.getSession();
        if (session.data?.user) {
          useAuthStore.getState().login(session.data.user, {
            user: session.data.user,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            token: session.data.session?.token
          });
        }
      } catch (e) {
        // Expected if not logged in
      }
    };
    checkAuth();
  }, []);
  
  // Auto-complete when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      console.log('[Onboarding] Authenticated, completing flow');
      onComplete('connected', serverUrl);
    }
  }, [isAuthenticated, user, onComplete, serverUrl]);
  
  // Social login handler
  const handleSocialLogin = async (provider: 'google' | 'github' | 'discord' | 'oidc') => {
    try {
      setSocialLoading(provider);
      
      if (isTauri()) {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        const srvUrl = getServerUrl();
        const handoffUrl = `${srvUrl}/api/auth/native-redirect`;
        const url = `${srvUrl}/api/auth/login-proxy?provider=${provider}&callbackURL=${encodeURIComponent(handoffUrl)}`;
        await openUrl(url);
      } else {
        const callbackURL = `${getClientUrl()}/profiles`;
        await authClient.signIn.social({ provider, callbackURL });
      }
    } catch (e: any) {
      toast.error('Login Failed', { description: e.message || 'Could not sign in' });
      setSocialLoading(null);
    }
  };
  
  // Email sign in
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (emailMethod === 'password') {
        const { data, error } = await authClient.signIn.email({
          email,
          password,
          callbackURL: isTauri() ? undefined : `${getClientUrl()}/profiles`
        });
        if (error) throw error;
        if (data?.user) {
          const sessionData = data.token ? {
            user: data.user,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            token: data.token
          } : undefined;
          useAuthStore.getState().login(data.user, sessionData);
          onComplete('connected', serverUrl);
        }
      } else if (emailMethod === 'magic-link') {
        const callbackURL = isTauri()
          ? 'zentrio://auth/magic-link'
          : `${getClientUrl()}/profiles`;
        const { error } = await authClient.signIn.magicLink({ email, callbackURL });
        if (error) throw error;
        toast.success('Email Sent', { description: 'Check your inbox for the magic link.' });
      } else if (emailMethod === 'otp') {
        if (!showOtpInput) {
          const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' });
          if (error) throw error;
          setShowOtpInput(true);
          toast.success('Code Sent', { description: 'Check your email for the 6-digit code.' });
        } else if (otp) {
          const { data, error } = await authClient.signIn.emailOtp({ email, otp });
          if (error) throw error;
          if (data?.user) {
            const sessionData = data.token ? {
              user: data.user,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              token: data.token
            } : undefined;
            useAuthStore.getState().login(data.user, sessionData);
            onComplete('connected', serverUrl);
          }
        }
      }
    } catch (e: any) {
      let msg = e.message || 'Authentication failed';
      if (msg.includes('User not found') || msg.includes('Invalid email or password')) {
        msg = 'Invalid email or password. Check your credentials or create a new account.';
      }
      toast.error('Sign In Failed', { description: msg });
    } finally {
      setLoading(false);
    }
  };
  
  // Email sign up
  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name,
        username: name,
        callbackURL: isTauri() ? undefined : `${getClientUrl()}/profiles`
      } as any);
      if (error) throw error;
      
      // Auto sign in after registration
      const signIn = await authClient.signIn.email({ email, password });
      if (signIn.data?.user) {
        const sessionData = signIn.data.token ? {
          user: signIn.data.user,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          token: signIn.data.token
        } : undefined;
        useAuthStore.getState().login(signIn.data.user, sessionData);
        onComplete('connected', serverUrl);
      }
    } catch (e: any) {
      toast.error('Sign Up Failed', { description: e.message || 'Could not create account' });
    } finally {
      setLoading(false);
    }
  };
  
  // Server selection
  const handleServerSelected = async (url: string) => {
    setChecking(true);
    try {
      let cleanUrl = url.replace(/\/$/, '');
      if (!cleanUrl.startsWith('http')) cleanUrl = `https://${cleanUrl}`;
      
      const fetchFn = isTauri() 
        ? (await import('@tauri-apps/plugin-http')).fetch 
        : fetch;
      const res = await fetchFn(`${cleanUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('Server not responding');
      
      localStorage.setItem('zentrio_server_url', cleanUrl);
      setServerUrl(cleanUrl);
      resetAuthClient();
      setStep('main');
      toast.success('Connected', { description: cleanUrl });
    } catch (e: any) {
      toast.error('Connection Failed', { description: e.message || 'Could not reach server' });
    } finally {
      setChecking(false);
    }
  };
  
  // Guest mode
  const handleGuestMode = () => {
    appMode.set('guest');
    localStorage.setItem('zentrio_server_url', 'http://localhost:3000');
    onComplete('guest');
  };
  
  const hasSocialProviders = providers.google || providers.github || providers.discord || providers.oidc;
  
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
      
      <div className="relative z-10 flex flex-col items-center justify-center min-h-full px-6 py-8">
        <AnimatePresence mode="wait">
          
          {/* ============================================================
              MAIN SCREEN - Logo + Social Buttons + Email Option
              ============================================================ */}
          {step === 'main' && (
            <motion.div
              key="main"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-sm flex flex-col items-center"
            >
              {/* Server indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-10"
              >
                <button
                  onClick={() => setStep('server')}
                  className="inline-flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <Server className="w-3 h-3" />
                  <span className="font-mono">{serverUrl.replace('https://', '')}</span>
                  <span className="text-zinc-700">•</span>
                  <span className="underline underline-offset-2">change</span>
                </button>
              </motion.div>
              
              {/* Logo */}
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', duration: 0.8, bounce: 0.3 }}
                className="relative mb-6"
                style={{ width: 120, height: 120 }}
              >
                {/* Outer pulsing ring */}
                <motion.div
                  animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 rounded-full border-2 border-red-500/30"
                  style={{ margin: -15 }}
                />
                
                {/* Middle pulsing ring */}
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.2, 0.4] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                  className="absolute inset-0 rounded-full border border-red-500/40"
                  style={{ margin: -8 }}
                />
                
                {/* Soft glow */}
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute inset-0 bg-red-500 rounded-full blur-3xl"
                  style={{ margin: -20 }}
                />
                
                {/* Orbiting dot 1 */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0"
                  style={{ margin: -18 }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-red-400 shadow-lg shadow-red-500/50" />
                </motion.div>
                
                {/* Orbiting dot 2 (opposite direction) */}
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0"
                  style={{ margin: -28 }}
                >
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-red-300/70" />
                </motion.div>
                
                {/* Orbiting dot 3 */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0"
                  style={{ margin: -38 }}
                >
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-red-200/50" />
                </motion.div>
                
                {/* Logo with float animation */}
                <motion.img
                  src="/static/logo/icon-192.png"
                  alt="Zentrio"
                  animate={{ y: [0, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  className="relative w-full h-full object-contain drop-shadow-2xl"
                  style={{ filter: 'drop-shadow(0 0 20px rgba(220, 38, 38, 0.4))' }}
                />
              </motion.div>
              
              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl md:text-4xl font-bold text-center mb-2"
              >
                <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                  Start Streaming
                </span>
              </motion.h1>
              
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-sm text-zinc-500 text-center mb-10 max-w-xs"
              >
                Sign in to sync your watchlist, preferences, and profiles across devices
              </motion.p>
              
              {/* Social login buttons */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="w-full space-y-3"
              >
                {providers.google && (
                  <button
                    onClick={() => handleSocialLogin('google')}
                    disabled={!!socialLoading}
                    className="w-full flex items-center justify-center gap-3 bg-white text-black hover:bg-gray-100 py-3.5 rounded-xl transition-all font-medium text-[15px] disabled:opacity-50 shadow-lg shadow-white/5"
                  >
                    {socialLoading === 'google' ? (
                      <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
                    ) : (
                      <GoogleIcon />
                    )}
                    Continue with Google
                  </button>
                )}
                
                {providers.github && (
                  <button
                    onClick={() => handleSocialLogin('github')}
                    disabled={!!socialLoading}
                    className="w-full flex items-center justify-center gap-3 bg-[#24292F] text-white hover:bg-[#2b3137] py-3.5 rounded-xl transition-all font-medium text-[15px] disabled:opacity-50"
                  >
                    {socialLoading === 'github' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <GitHubIcon />
                    )}
                    Continue with GitHub
                  </button>
                )}
                
                {providers.discord && (
                  <button
                    onClick={() => handleSocialLogin('discord')}
                    disabled={!!socialLoading}
                    className="w-full flex items-center justify-center gap-3 bg-[#5865F2] text-white hover:bg-[#4752C4] py-3.5 rounded-xl transition-all font-medium text-[15px] disabled:opacity-50"
                  >
                    {socialLoading === 'discord' ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <DiscordIcon />
                    )}
                    Continue with Discord
                  </button>
                )}
                
                {/* Divider */}
                {hasSocialProviders && (
                  <div className="relative flex items-center gap-4 py-2">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-xs text-zinc-600 uppercase tracking-wider">or</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                )}
                
                {/* Email option */}
                <button
                  onClick={() => setStep('email-signin')}
                  className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white hover:bg-white/10 py-3.5 rounded-xl transition-all font-medium text-[15px]"
                >
                  <Mail className="w-5 h-5 text-zinc-400" />
                  Continue with Email
                </button>
              </motion.div>
              
              {/* Guest mode */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                onClick={handleGuestMode}
                className="mt-8 text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
              >
                Continue without an account →
              </motion.button>
            </motion.div>
          )}
          
          {/* ============================================================
              EMAIL SIGN IN
              ============================================================ */}
          {step === 'email-signin' && (
            <motion.div
              key="email-signin"
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -80 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-sm"
            >
              {/* Back button */}
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => { setStep('main'); setEmailMethod('password'); setOtp(''); setShowOtpInput(false); }}
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </motion.button>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="text-2xl font-bold text-white mb-1">Sign In</h2>
                <p className="text-sm text-zinc-500 mb-4">Choose your sign in method</p>
                
                {/* Method selector */}
                <div className="flex p-1 bg-zinc-950/50 rounded-lg mb-5 border border-zinc-800/50">
                  <button
                    type="button"
                    onClick={() => { setEmailMethod('password'); setShowOtpInput(false); setOtp(''); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
                      emailMethod === 'password' 
                        ? 'bg-zinc-800 text-white shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Password
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEmailMethod('magic-link'); setShowOtpInput(false); setOtp(''); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
                      emailMethod === 'magic-link' 
                        ? 'bg-zinc-800 text-white shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Magic Link
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEmailMethod('otp'); setShowOtpInput(false); setOtp(''); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
                      emailMethod === 'otp' 
                        ? 'bg-zinc-800 text-white shadow-sm' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Code
                  </button>
                </div>
                
                <form onSubmit={handleEmailSignIn} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-zinc-600" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value.toLowerCase())}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all text-[15px]"
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  
                  {/* Password field (password method only) */}
                  {emailMethod === 'password' && (
                    <div>
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-zinc-600" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all text-[15px]"
                          placeholder="••••••••"
                          autoComplete="current-password"
                        />
                      </div>
                      <div className="text-right mt-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!email) { toast.warning('Enter your email first'); return; }
                            try {
                              const fetchFn = isTauri() ? (await import('@tauri-apps/plugin-http')).fetch : fetch;
                              await fetchFn(`${getServerUrl()}/api/auth/forgot-password`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email, redirectTo: `${getServerUrl()}/reset-password` })
                              });
                              toast.success('Reset Link Sent', { description: `Check ${email} for the password reset link.` });
                            } catch { toast.error('Failed to send reset link'); }
                          }}
                          className="text-xs text-zinc-500 hover:text-white transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* OTP input (after code sent) */}
                  {emailMethod === 'otp' && showOtpInput && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Verification Code</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white text-center tracking-[0.5em] font-mono text-lg placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                        placeholder="000000"
                        maxLength={6}
                        autoFocus
                      />
                    </motion.div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-red-900/20 mt-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {emailMethod === 'magic-link' ? 'Send Magic Link' 
                          : emailMethod === 'otp' && !showOtpInput ? 'Send Code' 
                          : 'Sign In'}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
                
                <p className="text-center text-sm text-zinc-500 mt-6">
                  Don&apos;t have an account?{' '}
                  <button
                    onClick={() => { setStep('email-signup'); setPassword(''); setEmailMethod('password'); setOtp(''); setShowOtpInput(false); }}
                    className="text-white hover:underline font-medium"
                  >
                    Create one
                  </button>
                </p>
              </motion.div>
            </motion.div>
          )}
          
          {/* ============================================================
              EMAIL SIGN UP
              ============================================================ */}
          {step === 'email-signup' && (
            <motion.div
              key="email-signup"
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -80 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full max-w-sm"
            >
              {/* Back button */}
              <motion.button
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setStep('email-signin')}
                className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors mb-8 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Sign In
              </motion.button>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="text-2xl font-bold text-white mb-1">Create Account</h2>
                <p className="text-sm text-zinc-500 mb-8">Get started with your free account</p>
                
                <form onSubmit={handleEmailSignUp} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Username</label>
                    <div className="relative">
                      <UserIcon className="absolute left-3.5 top-3.5 w-5 h-5 text-zinc-600" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all text-[15px]"
                        placeholder="johndoe"
                        autoComplete="username"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-zinc-600" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value.toLowerCase())}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all text-[15px]"
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-zinc-600" />
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all text-[15px]"
                        placeholder="8+ characters"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-red-900/20 mt-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
                
                <p className="text-center text-sm text-zinc-500 mt-6">
                  Already have an account?{' '}
                  <button
                    onClick={() => { setStep('email-signin'); setPassword(''); }}
                    className="text-white hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </p>
              </motion.div>
            </motion.div>
          )}
          
          {/* ============================================================
              SERVER SELECTION
              ============================================================ */}
          {step === 'server' && (
            <motion.div
              key="server"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-sm"
            >
              <div className="bg-zinc-950/70 backdrop-blur-2xl border border-white/10 rounded-2xl p-7 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                      <Server className="w-5 h-5 text-red-500" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Server</h3>
                  </div>
                  <button
                    onClick={() => setStep('main')}
                    className="text-zinc-500 hover:text-white transition-colors p-1"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <p className="text-zinc-500 text-xs mb-5">
                  Connected to: <span className="text-zinc-300 font-mono">{serverUrl.replace('https://', '')}</span>
                </p>
                
                <div className="space-y-3">
                  <button
                    onClick={() => handleServerSelected('https://app.zentrio.eu')}
                    disabled={checking || serverUrl === 'https://app.zentrio.eu'}
                    className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {checking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Official Server'}
                  </button>
                  
                  <div className="relative flex items-center gap-4 my-3">
                    <div className="h-px flex-1 bg-white/10" />
                    <span className="text-[10px] uppercase text-zinc-600">Custom</span>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://your-server.com"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && customUrl && handleServerSelected(customUrl)}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                    <button
                      onClick={() => handleServerSelected(customUrl)}
                      disabled={!customUrl || checking}
                      className="px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl transition-all disabled:opacity-50"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          
        </AnimatePresence>
      </div>
    </div>
  );
}

export default OnboardingWizard;
