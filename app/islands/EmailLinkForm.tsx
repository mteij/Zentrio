import { h as _h } from "preact";
import { useSignal } from "@preact/signals";

export default function EmailLinkForm() {
  const error = useSignal<string | null>(null);
  const isLoading = useSignal(false);

  const onSubmit = async (e: Event) => {
    e.preventDefault();
    isLoading.value = true;
    error.value = null;

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const email = formData.get("email") as string;

    const res = await fetch("/api/auth/send-link", {
      method: "POST",
      body: JSON.stringify({ email }),
      headers: { "Content-Type": "application/json" },
    });

    isLoading.value = false;
    if (res.ok) {
      const data = await res.json();
      globalThis.location.href = data.redirectUrl;
    } else {
      const text = await res.text();
      error.value = text || "Failed to send link.";
    }
  };

  return (
    <form onSubmit={onSubmit} class="space-y-4">
      {error.value && <div class="text-red-500 bg-red-100 p-3 rounded">{error.value}</div>}
      <input
        type="email"
        name="email"
        placeholder="Enter your email"
        required
        class="w-full bg-gray-700 text-white p-3 rounded focus:outline-none focus:ring-2 focus:ring-red-600"
      />
      <button
        type="submit"
        disabled={isLoading.value}
        class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded disabled:bg-gray-500"
      >
        {isLoading.value ? "Sending..." : "Continue with Email"}
      </button>
    </form>
  );
}