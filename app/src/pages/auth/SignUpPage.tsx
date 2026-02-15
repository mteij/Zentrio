import { motion } from "framer-motion";
import { AuthForms } from "../../components/auth/AuthForms";
import { ParticleBackground } from "../../components/ui/ParticleBackground";
import { isTauri } from "../../lib/auth-client";
import { BackButton } from "../../components/ui/BackButton";

export function SignUpPage() {
  // Force reload removed to prevent infinite loop
  // Cross-origin isolation is handled by server headers and checked in Player page for FFmpeg


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
          <AuthForms mode="signup" />
          
          {isTauri() && (
            <div className="mt-4 text-center">
              <BackButton onClick={handleChangeServer} label="Change Server" variant="static" />
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
