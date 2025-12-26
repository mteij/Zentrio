import { motion } from 'framer-motion';
import { Button, Input, Message } from '../components/index';
import { ParticleBackground } from '../components/ui/ParticleBackground';

interface ResetPasswordPageProps {}

export function ResetPasswordPage({}: ResetPasswordPageProps) {
  return (
    <>
      <ParticleBackground />
      
      <div className="min-h-screen w-full flex items-center justify-center p-4 relative z-10 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
            <h1 className="text-3xl font-bold text-white mb-2 text-center">
              <span className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                Reset Password
              </span>
            </h1>
            <p className="text-zinc-400 mb-6 text-center text-sm">Enter your new password below.</p>
            
            <form id="resetPasswordForm" className="flex flex-col gap-4">
              <div className="w-full">
                <Input
                  type="password"
                  id="password"
                  placeholder="New Password"
                  required
                  minLength={8}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="w-full">
                <Input
                  type="password"
                  id="confirmPassword"
                  placeholder="Confirm Password"
                  required
                  minLength={8}
                  style={{ width: '100%' }}
                />
              </div>
              <Button type="submit" variant="cta" id="submitBtn" style={{ width: '100%' }}>
                Reset Password
              </Button>
            </form>

            <Message id="message" show={false} />
          </div>
        </motion.div>
      </div>

      {/* Reset Password logic */}
      <script src="/static/js/reset-password.js"></script>
    </>
  )
}
