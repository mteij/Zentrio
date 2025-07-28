import { useDownloads } from "../../shared/hooks/useDownloads.ts";
import DownloadsGroup from "./DownloadsGroup.tsx";

export default function DownloadsModal({
  onClose,
  isMobile,
}: {
  onClose: () => void;
  isMobile: boolean;
}) {
  const { downloads, isLoading, deleteDownload, groupedDownloads } = useDownloads();

  const openVideoPlayer = (src: string) => {
    globalThis.location.href = `/player?src=${encodeURIComponent(src)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className={`bg-gray-900 rounded-lg shadow-2xl w-full ${isMobile ? 'max-w-md p-4' : 'max-w-2xl p-6'} relative animate-modal-pop max-h-[90vh] overflow-y-auto`}>
        <button
          type="button"
          className="absolute top-3 right-3 text-gray-400 hover:text-white text-2xl"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-6 text-white">Downloads</h2>

        {isLoading.value && <div>Loading...</div>}

        {!isLoading.value && downloads.value.length === 0 && (
            <div class="text-center py-12">
                <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <h3 class="mt-2 text-lg font-medium text-white">No downloads yet</h3>
                <p class="mt-1 text-sm text-gray-400">Start downloading from the player to see your files here.</p>
            </div>
        )}

        {!isLoading.value && downloads.value.length > 0 && (
            <div class="mt-6">
                {Object.entries(groupedDownloads()).map(([groupName, downloads]) => (
                    <DownloadsGroup
                        groupName={groupName}
                        downloads={downloads}
                        onPlay={(streamUrl) => openVideoPlayer(`/api/proxy?url=${encodeURIComponent(streamUrl)}`)}
                        onDelete={deleteDownload}
                    />
                ))}
            </div>
        )}
      </div>
    </div>
  );
}