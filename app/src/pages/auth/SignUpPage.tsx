import { AuthForms } from "../../components/auth/AuthForms";
import { AnimatedBackground } from "../../components";

export function SignUpPage() {
  return (
    <>
      <AnimatedBackground />
      <div className="min-h-screen w-full flex items-center justify-center p-4 relative z-10">
         <AuthForms mode="signup" />
      </div>
    </>
  );
}
