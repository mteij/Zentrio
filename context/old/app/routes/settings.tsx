import { PageProps } from "$fresh/server.ts";

export default function SettingsPage(_props: PageProps) {
  return (
    <div class="min-h-screen flex items-center justify-center bg-black">
      <div class="text-center">
        <h1 class="text-4xl font-bold text-white">Settings</h1>
        <p class="text-gray-400 mt-2">
          Please access settings through the modal on the main page.
        </p>
        <a href="/profiles" class="text-red-500 hover:underline mt-4 inline-block">
          Go to Profiles
        </a>
      </div>
    </div>
  );
}