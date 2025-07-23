// ...existing code from app/islands/EmailLinkForm.tsx...
import { h } from "preact";
import { useSignal } from "@preact/signals";

interface EmailLinkFormProps {
  // No props needed anymore as it's self-contained
}

export default function EmailLinkForm({}: EmailLinkFormProps) {
  const email = useSignal("");
  const error = useSignal<string | null>(null);
  const isLoading = useSignal(false);

  const handleFormSubmit = async (e: h.JSX.TargetedEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Client-side validation
    if (!email.value.trim() || !/^\S+@\S+\.\S+$/.test(email.value)) {
      error.value = "Please enter a valid email address.";
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const res = await fetch("/api/auth/login-or-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.value }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "An unknown error occurred.");
      }
      if (data.redirectUrl) {
        globalThis.location.href = data.redirectUrl;
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      isLoading.value = false;
    }
  };

  return (
    <section role="form" class="animate-fadein">
      <form onSubmit={handleFormSubmit} class="space-y-4" autoComplete="on">
        <div>
          <label htmlFor="email" class="block text-sm font-medium text-gray-300 transition-all duration-200">
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            autoComplete="username"
            value={email.value}
            onInput={(e) => (email.value = e.currentTarget.value)}
            required
            class="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200"
            placeholder="you@example.com"
            disabled={isLoading.value}
          />
        </div>
        {error.value && <p class="text-sm text-red-500 transition-all duration-200">{error.value}</p>}
        <button
          type="submit"
          disabled={isLoading.value}
          class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 disabled:opacity-50 transition-all duration-200"
        >
          {isLoading.value ? "Checking..." : "Continue"}
        </button>
      </form>
      <style>
        {`
          @keyframes fadein {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-fadein {
            animation: fadein 0.5s cubic-bezier(.4,2,.6,1);
          }
        `}
      </style>
    </section>
  );
}