import { AuthForms } from "../../components/auth/AuthForms";
import { AnimatedBackground, TitleBar } from "../../components";
import { useLocation } from "react-router-dom";

export function SignInPage() {
  const location = useLocation();
  
  return (
    <>
      <TitleBar />
      <AnimatedBackground />
      <div className="h-[100vh] h-[var(--app-height,100vh)] w-full flex items-center justify-center p-4 relative z-10 overflow-hidden">
         <AuthForms mode="signin" />
      </div>
    </>
  );
}
