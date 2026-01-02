import { motion } from "framer-motion";
import { useEffect } from "react";
import { AuthForms } from "../../components/auth/AuthForms";
import { ParticleBackground } from "../../components/ui/ParticleBackground";
import { isTauri } from "../../lib/auth-client";
import { BackButton } from "../../components/ui/BackButton";

export function SignInPage() {
  // Force reload if cross-origin isolated (breaks password managers)
  useEffect(() => {
      if (window.crossOriginIsolated) {
          console.log('[SignIn] Cross-origin isolated, reloading to disable for extensions...')
           if (!sessionStorage.getItem('reloading_for_extensions')) {
              sessionStorage.setItem('reloading_for_extensions', 'true')
              window.location.reload()
          } else {
               sessionStorage.removeItem('reloading_for_extensions')
          }
      } else {
          sessionStorage.removeItem('reloading_for_extensions')
      }
  }, [])

  const handleChangeServer = () => {
    localStorage.removeItem("zentrio_server_url");
    localStorage.removeItem("zentrio_app_mode");
    window.location.href = '/';
  };

  return (
    <>
      <ParticleBackground />
      
      <div className="min-h-screen w-full flex items-center justify-center p-4 relative z-10 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg relative"
        >
          {isTauri() && (
             <div className="absolute -top-12 left-0 md:-left-12 md:top-6 z-20">
                  <BackButton onClick={handleChangeServer} label="Change Server" />
             </div>
          )}
          <AuthForms mode="signin" />
        </motion.div>
      </div>
    </>
  );
}
