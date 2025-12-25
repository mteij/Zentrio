import { motion } from "framer-motion";
import { AuthForms } from "../../components/auth/AuthForms";
import { TitleBar } from "../../components";
import { ParticleBackground } from "../../components/ui/ParticleBackground";

export function SignUpPage() {
  return (
    <>
      <TitleBar />
      <ParticleBackground />
      
      <div className="min-h-screen w-full flex items-center justify-center p-4 relative z-10 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-lg"
        >
          <AuthForms mode="signup" />
        </motion.div>
      </div>
    </>
  );
}
