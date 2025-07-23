import { h as _h } from "preact";
import { useSignal } from "@preact/signals";

interface ResetPasswordFormProps {
  token: string;
}

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const password = useSignal("");
  const message = useSignal<string | null>(null);
  const error = useSignal<string | null>(null);
  const isLoading = useSignal(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    isLoading.value = true;
    error.value = null;
    message.value = null;

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password: password.value }),
      headers: { "Content-Type": "application/json" },
    });

    isLoading.value = false;
    if (res.ok) {
      message.value = "Password reset successfully! You can now log in.";
    } else {
      error.value = "Failed to reset password. The token may be invalid or expired.";
    }
  };

  if (message.value) {
    return (
      <div class="text-center">
        <p class="text-green-400 mb-4">{message.value}</p>
        <a href="/login" class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
          Go to Login
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} class="space-y-4">
      {error.value && <div class="text-red-500 bg-red-100 p-3 rounded">{error.value}</div>}
      <input
        type="password"
        placeholder="Enter new password"
        required
        value={password.value}
        onInput={(e) => password.value = (e.target as HTMLInputElement).value}
        class="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
      />
      <button
        type="submit"
        disabled={isLoading.value}
        class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded disabled:bg-gray-500"
      >
        {isLoading.value ? "Resetting..." : "Reset Password"}
      </button>
    </form>
  );
}
