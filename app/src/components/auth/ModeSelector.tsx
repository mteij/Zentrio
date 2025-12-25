import { useState } from "react";
import { motion } from "framer-motion";
import { Cloud, Zap, Shield, Users, ArrowRight, Loader2 } from "lucide-react";
import { appMode } from "../../lib/app-mode";

interface ModeSelectorProps {
  onModeSelected: (mode: 'guest' | 'connected') => void;
}

/**
 * ModeSelector - First-launch screen for Tauri apps
 * 
 * Prominently features Connected Mode as the recommended option,
 * with Guest Mode available as a subtle fallback link.
 */
export function ModeSelector({ onModeSelected }: ModeSelectorProps) {
  const [loading, setLoading] = useState(false);

  const handleConnectedMode = () => {
    setLoading(true);
    appMode.set('connected');
    onModeSelected('connected');
  };

  const handleGuestMode = () => {
    appMode.set('guest');
    onModeSelected('guest');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white p-4">
      <motion.div 
        className="w-full max-w-lg mx-auto"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-10 shadow-2xl">
          
          {/* Logo/Brand */}
          <div className="text-center mb-8">
            <motion.div 
              className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/20 mb-6"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              <span className="text-4xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">Z</span>
            </motion.div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent mb-3">
              Welcome to Zentrio
            </h1>
            <p className="text-zinc-400 text-sm">
              Stream your way, on your terms
            </p>
          </div>

          {/* Features List */}
          <div className="space-y-3 mb-8">
            <FeatureItem icon={Cloud} text="Sync across all your devices" />
            <FeatureItem icon={Users} text="Multiple profiles for your family" />
            <FeatureItem icon={Shield} text="Secure cloud backup" />
            <FeatureItem icon={Zap} text="Fast, reliable streaming" />
          </div>

          {/* Primary CTA - Connected Mode */}
          <motion.button
            onClick={handleConnectedMode}
            disabled={loading}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-3 group disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-red-500/20"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Get Started
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </motion.button>

          {/* Subtle Guest Mode Option */}
          <div className="mt-6 text-center">
            <button
              onClick={handleGuestMode}
              className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors underline-offset-4 hover:underline"
            >
              Continue without an account
            </button>
            <p className="text-zinc-600 text-xs mt-2">
              Local only • No sync • You can upgrade anytime
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function FeatureItem({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-3 text-zinc-300">
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-red-400" />
      </div>
      <span className="text-sm">{text}</span>
    </div>
  );
}
