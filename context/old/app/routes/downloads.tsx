import { PageProps } from "$fresh/server.ts";
import DownloadsModal from "../islands/Downloads/DownloadsModal.tsx";
import { useSignal } from "@preact/signals";

export default function DownloadsPage(_props: PageProps) {
  const showDownloads = useSignal(true);

  return (
    <div class="min-h-screen flex items-center justify-center bg-black">
      {showDownloads.value && (
        <DownloadsModal
          onClose={() => (showDownloads.value = false)}
          isMobile={false}
        />
      )}
    </div>
  );
}