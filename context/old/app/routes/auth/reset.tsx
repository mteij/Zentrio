import { PageProps } from "$fresh/server.ts";
import ResetPasswordForm from "../../islands/Auth/ResetPasswordForm.tsx";

export default function ResetPasswordPage(props: PageProps) {
  const token = props.url.searchParams.get("token");

  if (!token) {
    return (
      <div class="flex-grow flex items-center justify-center">
        <p class="text-red-500">Invalid or missing reset token.</p>
      </div>
    );
  }

  return (
    <div class="flex-grow flex flex-col items-center justify-center p-4">
      <div class="w-full max-w-md bg-black bg-opacity-75 p-8 rounded-lg">
        <h1 class="text-3xl font-bold mb-6 text-center">Set a New Password</h1>
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
