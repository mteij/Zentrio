import { motion } from "framer-motion";
import { useEffect } from "react";
import { AuthForms } from "../../components/auth/AuthForms";
import { ParticleBackground } from "../../components/ui/ParticleBackground";
import { isTauri } from "../../lib/auth-client";
import { BackButton } from "../../components/ui/BackButton";

export function SignInPage() {
  // Force reload removed to prevent infinite loop
  // Cross-origin isolation is handled by server headers

  const handleChangeServer = () => {
    localStorage.removeItem("zentrio_server_url");
    localStorage.removeItem("zentrio_app_mode");
    window.location.href = '/';
  };

  return (
    <>
      <ParticleBackground />
      
      <div className="min-h-screen w-full flex items-center justify-center p-4 relative z-10 overflow-y-auto">
        {isTauri() && (
           <div className="fixed top-0 left-0 z-50 px-4 pt-[max(24px,env(safe-area-inset-top,0px))]">
                <BackButton onClick={handleChangeServer} label="Change Server" variant="static" />
           </div>
        )}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg relative"
        >
          <AuthForms mode="signin" />
        </motion.div>
      </div>
    </>
  );
}
