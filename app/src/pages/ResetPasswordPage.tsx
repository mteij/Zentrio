import { SimpleLayout, Button, Input, Message, AnimatedBackground } from '../components/index'

interface ResetPasswordPageProps {}

export function ResetPasswordPage({}: ResetPasswordPageProps) {
  return (
    <SimpleLayout title="Reset Password">
      <AnimatedBackground />
      
      <main className="flex-1 flex items-center justify-center py-5 min-h-[calc(100vh-100px)]">
        <div className="container">
          <div className="text-center relative z-10 max-w-[400px] mx-auto w-full">
            <h1 className="text-3xl font-bold text-white mb-4">Reset Password</h1>
            <p className="text-zinc-400 mb-6">Enter your new password below.</p>
            
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
        </div>
      </main>

      <footer className="py-8 bg-transparent relative z-10">
        <div className="container">
          <div className="text-center text-sm text-white/40 max-w-[600px] mx-auto">
            <p>© {new Date().getFullYear()} Zentrio</p>
          </div>
        </div>
      </footer>

      {/* Reset Password logic */}
      <script src="/static/js/reset-password.js"></script>
    </SimpleLayout>
  )
}
