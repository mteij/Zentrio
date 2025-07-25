import { h as _h } from "preact";
import EmailLinkForm from "../../islands/Auth/EmailLinkForm.tsx";
import ModernBackground from "../../components/ModernBackground.tsx";

export default function LoginPage() {
  return (
    <>
      <ModernBackground />
      <div class="flex-1 flex items-center justify-center p-4 relative z-10">
        <div class="w-full max-w-md min-w-[320px] bg-black bg-opacity-75 p-6 sm:p-8 rounded-lg text-center shadow-lg">
          <h1 class="text-2xl sm:text-3xl font-bold mb-4">Sign In or Sign Up</h1>
          <p class="text-gray-400 mb-6 text-sm sm:text-base">
            Enter your email to continue.
          </p>
          <EmailLinkForm />
        </div>
      </div>
    </>
  );
}
