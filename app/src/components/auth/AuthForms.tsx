import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from 'sonner'
import { openUrl } from "@tauri-apps/plugin-opener";
import { authClient, getClientUrl, getServerUrl, isTauri } from "../../lib/auth-client";
import { apiFetch, apiFetchJson } from "../../lib/apiFetch";
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Loader2, 
  Sparkles, 
  KeyRound
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { EmailVerificationModal } from "./EmailVerificationModal";


import { useLoginBehavior, getLoginBehaviorRedirectPath } from "../../hooks/useLoginBehavior";
import { useSessionDuration } from "../../hooks/useSessionDuration";
import { useAuthStore } from "../../stores/authStore";

// Brand icons as SVG components
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
  </svg>
);

const DiscordIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
  </svg>
);

type AuthMethod = "password" | "magic-link" | "otp";
type AuthMode = "signin" | "signup";

interface AuthFormsProps {
  mode: AuthMode;
  onSuccess?: () => void;
}

export function AuthForms({ mode, onSuccess }: AuthFormsProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getRedirectPath } = useLoginBehavior();
  const { duration, setDuration } = useSessionDuration();
  const [method, setMethod] = useState<AuthMethod>("password");
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

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
    apiFetchJson<any>('/api/auth/providers')
      .then(data => setProviders(data))
      .catch(err => console.error("Failed to fetch auth providers", err));
  }, []);

  useEffect(() => {
    if (resendSeconds > 0) {
      const timer = setTimeout(() => setResendSeconds(s => s - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendSeconds]);



  const handleSocialLogin = async (provider: "google" | "github" | "discord" | "oidc") => {
    try {
      setLoading(true);
      const redirectPath = getLoginBehaviorRedirectPath();
      
      // In Tauri, we use a custom scheme for the callback to handle deep linking
      // This allows us to catch the callback in the running app instance
      const callbackURL = isTauri() 
        ? "zentrio://auth/callback" 
        : `${getClientUrl()}${redirectPath}`;

      if (isTauri()) {
        // In Tauri, we open the social login in the default system browser
        // This prevents the main window from navigating away (keeping titlebar visible)
        // and allows for a smooth callback via deep linking
        const serverUrl = getServerUrl();
        // Use the login-proxy endpoint which handles the POST request requirement for Better Auth via system browser
        // AND use /api/auth/native-redirect as the callbackURL which will handle the session handoff
        const handoffUrl = `${serverUrl}/api/auth/native-redirect`;
        const url = `${serverUrl}/api/auth/login-proxy?provider=${provider}&callbackURL=${encodeURIComponent(handoffUrl)}`;
        
        await openUrl(url);
        // We don't need to do anything else, the deep link listener in TitleBar will handle the rest
      } else {
        // Web behavior
        await authClient.signIn.social({
          provider,
          callbackURL,
        });
      }
    } catch (e: any) {
      toast.error('Login Failed', { description: e.message || 'Failed to initiate social login' })
      setLoading(false);
    }
  };


  const handleResendVerification = async () => {
    try {
        setResendSeconds(30);
        await authClient.emailOtp.sendVerificationOtp({
            email,
            type: "email-verification"
        });
    } catch (e) {
        // ignore
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const redirectPath = getLoginBehaviorRedirectPath();
        const { data, error } = await authClient.signUp.email({
          email,
          password,
          name, // Using username as display name
          username: name, // Set username field explicitly
          callbackURL: `${getClientUrl()}${redirectPath}`
        } as any);
        if (error) throw error;
        
        // Account created, now send verification OTP and show modal
        setResendSeconds(30);
        // Send the initial verification OTP
        await authClient.emailOtp.sendVerificationOtp({
          email,
          type: "email-verification"
        });
        setShowVerificationModal(true);
      } else {
        // Sign In
        if (method === "password") {
          const redirectPath = getRedirectPath();
          const { data, error } = await authClient.signIn.email({
            email,
            password,
            callbackURL: `${getClientUrl()}${redirectPath}`
          });
          if (error) throw error;
          // Update auth store with user data AND session token before navigating
          // For Tauri, the token is required for Bearer auth since cookies don't work cross-origin
          if (data?.user) {
            const sessionData = data.token ? {
              user: data.user,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              token: data.token
            } : undefined;
            useAuthStore.getState().login(data.user, sessionData);
            
            // If parent provided onSuccess handler, call it and skip default behavior
            if (onSuccess) {
                onSuccess();
                return;
            }

            if (isTauri()) {
                // Clear app mode to ensure Onboarding Wizard runs
                localStorage.removeItem('zentrio_app_mode');
                localStorage.removeItem('zentrio_server_url');

                // Force reload if we were previously "uninitialized" to update AppRoutes
                // Check if we need reload:
                // If we are on /signin, AppRoutes was rendered.
                // If we navigate to /, AppRoutes re-renders? 
                // No, AppRoutes holds state. We must reload to update AppRoutes state.
                window.location.reload(); 
                return;
            }
          }
          navigate(redirectPath);
        } 
        else if (method === "magic-link") {
          const redirectPath = getLoginBehaviorRedirectPath();
          const callbackURL = isTauri()
            ? "zentrio://auth/magic-link"
            : `${getClientUrl()}${redirectPath}`;

          const { data, error } = await authClient.signIn.magicLink({
            email,
            callbackURL
          });
          if (error) throw error;
          toast.success('Email Sent', { description: 'Magic link sent! Check your email.' })
        }
        else if (method === "otp") {
          if (!showOtpInput) {
             const { data, error } = await authClient.emailOtp.sendVerificationOtp({
                email,
                type: "sign-in"
             });
             if (error) throw error;
             setShowOtpInput(true);
             toast.success('OTP Sent', { description: 'OTP sent to your email.' })
          } else {
             if (otp) {
                const redirectPath = getRedirectPath();
                const { data, error } = await authClient.signIn.emailOtp({
                    email,
                    otp
                });
                if (error) throw error;
                // Update auth store with user data AND session token before navigating
                if (data?.user) {
                  const sessionData = data.token ? {
                    user: data.user,
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    token: data.token
                  } : undefined;
                  useAuthStore.getState().login(data.user, sessionData);
                }
                
                // If parent provided onSuccess handler, call it and skip default behavior
                if (onSuccess) {
                    onSuccess();
                    return;
                }

                navigate(redirectPath);
             } else {
                 toast.warning('Missing Code', { description: 'Please enter the verification code' })
             }
          }
        }
      }
    } catch (e: any) {
      let msg = e.message || e.statusText || "Authentication failed";

      // Handle unverified email error
      if (typeof msg === 'string' && (
          msg.toLowerCase().includes("not verified") || 
          msg.toLowerCase().includes("verification required")
      )) {
         // Trigger OTP send
         await handleResendVerification();
         setShowVerificationModal(true);
         setLoading(false);
         return;
      }

      // Better error handling for common cases
      if (typeof msg === 'string' && (msg.includes("User not found") || msg.includes("Invalid email or password"))) {
          msg = "No account found with these credentials. Please check your email or sign up.";
      }
      toast.error('Authentication Failed', { description: msg })
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showVerificationModal ? (
        <div className="w-full max-w-lg mx-auto">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-10 shadow-2xl">
                <EmailVerificationModal 
                    email={email}
                    onBack={() => setShowVerificationModal(false)}
                    onSuccess={() => navigate(getRedirectPath())}
                    onResend={handleResendVerification}
                    resendSeconds={resendSeconds}
                />
            </div>
        </div>
      ) : (
    <div className="w-full max-w-lg mx-auto relative">


      <div className="bg-black/40 backdrop-blur-md border border-white/10 !rounded-2xl !p-6 md:!p-10 shadow-2xl transition-all duration-300 relative">

        <div className="text-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent mb-2">
            {mode === "signin" ? "Welcome Back" : "Create Account"}
          </h1>
          <p className="text-zinc-400 text-sm">
            {mode === "signin" 
              ? "Sign in to continue" 
              : "Get started with your free account"}
          </p>
        </div>

        {/* Auth Method Tabs (Sign In Only) */}
        {mode === "signin" && (
          <div className="flex p-1 bg-zinc-950/50 rounded-lg mb-6 border border-zinc-800/50">
            <button
              onClick={() => { setMethod("password"); setShowOtpInput(false); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs md:text-sm font-medium rounded-md transition-all ${
                method === "password" 
                  ? "bg-zinc-800 text-white shadow-sm" 
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Password
            </button>
            <button
              onClick={() => { setMethod("magic-link"); setShowOtpInput(false); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs md:text-sm font-medium rounded-md transition-all ${
                method === "magic-link" 
                  ? "bg-zinc-800 text-white shadow-sm" 
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Magic Link
            </button>
            <button
              onClick={() => { setMethod("otp"); setShowOtpInput(false); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs md:text-sm font-medium rounded-md transition-all ${
                method === "otp" 
                  ? "bg-zinc-800 text-white shadow-sm" 
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Code
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">

          {mode === "signup" && (
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                autoComplete="username"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="!w-full bg-white/5 border border-white/10 !rounded-md !px-4 !py-2.5 md:!py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all font-light text-sm md:text-base"
                placeholder="johndoe"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-2.5 md:top-3.5 w-5 h-5 text-zinc-500" />
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                className="!w-full bg-white/5 border border-white/10 !rounded-md !pl-10 !pr-4 !py-2.5 md:!py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all font-light text-sm md:text-base"
                placeholder="you@example.com"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore
              />
            </div>
          </div>

          {(mode === "signup" || (mode === "signin" && method === "password")) && (
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-2.5 md:top-3.5 w-5 h-5 text-zinc-500" />
                <input
                  type="password"
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="!w-full bg-white/5 border border-white/10 !rounded-md !pl-10 !pr-4 !py-2.5 md:!py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all font-light text-sm md:text-base"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          {mode === "signin" && method === "otp" && showOtpInput && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-1.5"
            >
              <label htmlFor="otp" className="text-xs font-semibold text-zinc-400 uppercase tracking-wider ml-1">Verification Code</label>
              <input
                type="text"
                id="otp"
                name="otp"
                autoComplete="one-time-code"
                inputMode="numeric"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="!w-full bg-white/5 border border-white/10 !rounded-md !px-4 !py-2.5 md:!py-3 text-white text-center tracking-[0.5em] font-mono text-lg placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
                placeholder="000000"
                maxLength={6}
              />
            </motion.div>
          )}

          {/* Keep me signed in checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="keepSignedIn"
              checked={duration === 'indefinite'}
              onChange={(e) => setDuration(e.target.checked ? 'indefinite' : 'session')}
              className="w-4 h-4 rounded border-white/20 bg-white/5 text-red-600 focus:ring-red-500 focus:ring-offset-0 cursor-pointer"
            />
            <label htmlFor="keepSignedIn" className="text-sm text-zinc-400 cursor-pointer hover:text-zinc-300 transition-colors">
              Keep me signed in
            </label>
          </div>

          <button
            type={loading ? "button" : "submit"}
            onClick={loading ? (e) => { e.preventDefault(); setLoading(false); } : undefined}
            disabled={false}
            className="!w-full bg-red-600 hover:bg-red-700 text-white font-medium !py-2.5 md:!py-3 !rounded-md transition-all flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Cancel</span>
              </>
            ) : (
              <>
                {mode === "signin" 
                  ? (method === "otp" && !showOtpInput ? "Send Code" : "Sign In") 
                  : "Create Account"}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        <div className="relative my-6 md:my-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs uppercase text-zinc-500 font-medium bg-transparent">Or continue with</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>



        <div className="flex flex-col gap-2.5 md:gap-3">
          {providers.google && (
            <button
              type="button"
              onClick={() => handleSocialLogin("google")}
              className="flex items-center justify-center gap-2 bg-white text-black hover:bg-gray-100 !py-2 md:!py-2.5 !rounded-md transition-colors font-medium text-sm !w-full"
            >
              <GoogleIcon />
              Google
            </button>
          )}
          {providers.github && (
            <button
             type="button"
              onClick={() => handleSocialLogin("github")}
              className="flex items-center justify-center gap-2 bg-[#24292F] text-white hover:bg-[#2b3137] !py-2 md:!py-2.5 !rounded-md transition-colors font-medium text-sm !w-full"
            >
              <GitHubIcon />
              GitHub
            </button>
          )}
          {providers.discord && (
            <button
             type="button"
               onClick={() => handleSocialLogin("discord")}
               className="flex items-center justify-center gap-2 bg-[#5865F2] text-white hover:bg-[#4752C4] !py-2 md:!py-2.5 !rounded-md transition-colors font-medium text-sm !w-full"
            >
              <DiscordIcon />
               Discord
            </button>
          )}
          {/* Add more providers if needed */}
        </div>

        
        <div className="mt-6 md:mt-8 text-center text-sm text-zinc-500">
          {mode === "signin" ? (
            <p>
              Don't have an account?{" "}
              <button 
                onClick={() => navigate("/register")}
                className="text-white hover:underline font-medium"
              >
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button 
                  onClick={() => navigate("/signin")}
                  className="text-white hover:underline font-medium"
              >
                Sign in
              </button>
            </p>
          )}
          
        </div>
      </div>
    </div>
      )}
    </>
  );
}
