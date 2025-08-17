import { h as _h } from "preact";
import ModernBackground from "../shared/components/ModernBackground.tsx";
import { Head } from "$fresh/runtime.ts";

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>404 - Not Found</title>
      </Head>
      <ModernBackground />
      <div class="flex-1 flex items-center justify-center p-4 relative z-10">
        <div class="w-full max-w-md min-w-[320px] bg-black bg-opacity-75 p-6 sm:p-8 rounded-lg text-center shadow-lg">
          <h1 class="text-4xl font-bold mb-4 text-red-500">404</h1>
          <h2 class="text-2xl sm:text-3xl font-bold mb-4">Page Not Found</h2>
          <p class="text-gray-400 mb-6 text-sm sm:text-base">
            Sorry, the page you are looking for could not be found.
          </p>
          <a
            href="/"
            class="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors duration-300"
          >
            Go Home
          </a>
        </div>
      </div>
    </>
  );
}