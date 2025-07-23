import { h } from "preact";
import { useSignal } from "@preact/signals";

interface PasswordLoginFormProps {
  email: string;
}

export default function PasswordLoginForm({ email }: PasswordLoginFormProps) {
  const password = useSignal("");
  const error = useSignal<string | null>(null);
  const isLoading = useSignal(false);
  const message = useSignal<string | null>(null);

  const handlePasswordLogin = async (e: h.JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();
    isLoading.value = true;
    error.value = null;
    const res = await fetch("/api/auth/login-with-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: password.value }),
    });
    isLoading.value = false;
    if (res.ok) {
      globalThis.location.href = "/profiles";
    } else {
      const data = await res.json();
      error.value = data.error || "Invalid credentials.";
    }
  };

  const handleSendCode = async () => {
    isLoading.value = true;
    error.value = null;
    const res = await fetch("/api/auth/send-login-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    isLoading.value = false;
    if (res.ok) {
      const data = await res.json();
      globalThis.location.href = data.redirectUrl;
    } else {
      const data = await res.json();
      error.value = data.error || "Failed to send code.";
    }
  };

  return (
    <form onSubmit={handlePasswordLogin} class="space-y-4">
      {error.value && <p class="text-sm text-red-500">{error.value}</p>}
      <input
        type="email"
        name="email"
        autoComplete="username"
        placeholder="Email"
        required
        class="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
        value={email}
        disabled={isLoading.value}
      />
      <input
        type="password"
        name="password"
        autoComplete="current-password"
        placeholder="Password"
        required
        class="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
        value={password.value}
        onInput={(e) => password.value = e.currentTarget.value}
        disabled={isLoading.value}
      />
      <button
        type="submit"
        disabled={isLoading.value}
        class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded disabled:bg-gray-500"
      >
        {isLoading.value ? "Signing In..." : "Sign In"}
      </button>
      <div class="text-center text-sm">
        <button
          type="button"
          onClick={handleSendCode}
          disabled={isLoading.value}
          class="text-red-500 hover:underline disabled:text-gray-400"
        >
          Email me a login code
        </button>
      </div>
    </form>
  );
}
