import { h } from "preact";
import DownloadsManager from "../islands/DownloadsManager.tsx";

export default function DownloadsPage() {
  return (
    <div class="flex flex-col min-h-screen bg-black text-white">
      <header class="flex items-center p-4 border-b border-gray-800">
        <a href="/profiles" class="flex items-center text-gray-300 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Profiles
        </a>
      </header>
      <main class="flex-1 p-4 sm:p-8">
        <div class="max-w-4xl mx-auto">
          <h1 class="text-3xl font-bold mb-6">Downloads</h1>
          <DownloadsManager />
        </div>
      </main>
    </div>
  );
}