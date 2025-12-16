import { AuthForms } from "../../components/auth/AuthForms";
import { AnimatedBackground } from "../../components";
import { useLocation } from "react-router-dom";

export function SignInPage() {
  const location = useLocation();
  
  return (
    <>
      <AnimatedBackground />
      <div className="min-h-screen w-full flex items-center justify-center p-4 relative z-10">
         <AuthForms mode="signin" />
      </div>
    </>
  );
}
