import { PageProps } from "$fresh/server.ts";
import PasswordLoginForm from "../../islands/Auth/PasswordLoginForm.tsx";
import ModernBackground from "../../components/ModernBackground.tsx";

export default function PasswordLoginPage(props: PageProps) {
  const email = props.url.searchParams.get("email");

  if (!email) {
    return new Response("Email parameter is missing.", { status: 400 });
  }

  return (
    <>
      <ModernBackground />
      <div class="flex-grow flex items-center justify-center p-4 relative z-10">
        <div class="w-full max-w-md min-w-[320px] bg-black bg-opacity-75 p-6 sm:p-8 rounded-lg">
          <h1 class="text-3xl font-bold mb-2 text-center">Welcome Back</h1>
          <p class="text-center text-gray-400 mb-6">
            Enter your password for <strong class="text-white">{decodeURIComponent(email)}</strong>.
          </p>
          <PasswordLoginForm email={decodeURIComponent(email)} />
        </div>
      </div>
    </>
  );
}
