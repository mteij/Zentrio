import { h } from "preact";
import { useSignal } from "@preact/signals";

export default function LoginForm() {
  const error = useSignal<string | null>(null);
  const isLoading = useSignal(false);

  const onSubmit = async (e: Event) => {
    e.preventDefault();
    isLoading.value = true;
    error.value = null;

    // In a real app, you would implement the API call to your backend
    // For this example, we'll simulate a successful login and redirect.
    setTimeout(() => {
      // Simulate success
      window.location.href = "/profiles";
    }, 1000);
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
      <input
        type="password"
        name="password"
        placeholder="Enter your password"
        required
        class="w-full bg-gray-700 text-white p-3 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-red-600"
      />
      <button
        type="submit"
        disabled={isLoading.value}
        class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded disabled:bg-gray-500"
      >
        {isLoading.value ? "Signing In..." : "Sign In"}
      </button>
    </form>
  );
}
