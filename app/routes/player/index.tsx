import { PageProps } from "$fresh/server.ts";
import VideoPlayerHandler from "../../islands/VideoPlayerHandler.tsx";

export default function PlayerPage(props: PageProps) {
  const src = props.url.searchParams.get("src");
  const fileName = props.url.searchParams.get("fileName");
  const subtitlesParam = props.url.searchParams.get("subtitles");
  let subtitles = [];
  if (subtitlesParam) {
    try {
      subtitles = JSON.parse(subtitlesParam);
    } catch (e) {
      console.error("Failed to parse subtitles:", e);
    }
  }

  if (!src) {
    return <div>Video source not found.</div>;
  }

  return (
    <div class="w-screen h-screen bg-black relative">
      <VideoPlayerHandler src={src} subtitles={subtitles} fileName={fileName} />
      <a
        href="/profiles"
        class="absolute top-4 left-4 bg-gray-800 bg-opacity-50 text-white p-2 rounded-full hover:bg-gray-700 transition-colors z-10"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </a>
    </div>
  );
}