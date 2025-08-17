import { PageProps } from "$fresh/server.ts";
import ForgotPasswordForm from "../../islands/Auth/ForgotPasswordForm.tsx";

export default function ForgotPasswordPage(props: PageProps) {
  const email = props.url.searchParams.get("email") || "";

  return (
    <div class="flex-grow flex flex-col items-center justify-center p-4">
      <div class="w-full max-w-md bg-black bg-opacity-75 p-8 rounded-lg">
        <h1 class="text-3xl font-bold mb-6 text-center">Reset Your Password</h1>
        <p class="text-gray-300 text-center mb-6">
          Enter your email address and we'll send you a link to reset your password.
        </p>
        <ForgotPasswordForm initialEmail={email} />
      </div>
    </div>
  );
}