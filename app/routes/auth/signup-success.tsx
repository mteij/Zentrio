import { PageProps } from "$fresh/server.ts";
import ModernBackground from "../../shared/components/ModernBackground.tsx";

export default function SignupSuccessPage(props: PageProps) {
  const email = props.url.searchParams.get("email");

  return (
    <>
      <ModernBackground />
      <div class="flex-grow flex items-center justify-center p-4 relative z-10">
        <div class="w-full max-w-md min-w-[320px] bg-black bg-opacity-75 p-6 sm:p-8 rounded-lg text-center">
          <h1 class="text-3xl font-bold mb-4">Account Created!</h1>
          <p class="text-gray-300 mb-6">
            We've sent a temporary password to{" "}
            <strong class="text-white">{email ? decodeURIComponent(email) : "your email"}</strong>.
            Please use it to log in.
          </p>
          <a
            href="/auth/login"
            class="w-full inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded"
          >
            Proceed to Login
          </a>
        </div>
      </div>
    </>
  );
}
