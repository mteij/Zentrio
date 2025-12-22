import { AuthForms } from "../../components/auth/AuthForms";
import { AnimatedBackground, TitleBar } from "../../components";

export function SignUpPage() {
  // Note: Authenticated user redirect is now handled by PublicRoute wrapper
  
  return (
    <>
      <TitleBar />
      <AnimatedBackground />
      <div className="h-[100vh] h-[var(--app-height,100vh)] w-full flex items-center justify-center p-4 relative z-10 overflow-hidden">
         <AuthForms mode="signup" />
      </div>
    </>
  );
}
