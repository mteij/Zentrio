import { useDownloads } from "../../shared/hooks/useDownloads.ts";

export default function DownloadsModal({
  onClose,
  isMobile,
}: {
  onClose: () => void;
  isMobile: boolean;
}) {
  const { downloads, isLoading, deleteDownload } = useDownloads();

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
                <h3 class="text-lg font-semibold mb-4 text-white">Downloaded Files</h3>
                <ul class="divide-y divide-gray-800">
                    {downloads.value.map((file) => (
                        <li key={file.id} class="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-gray-800 transition-colors duration-200">
                            <div class="flex items-center flex-1 min-w-0">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div class="flex-1 min-w-0">
                                    <p class="font-medium text-white truncate">{file.fileName}</p>
                                    {file.status === 'downloading' ? (
                                        <div class="w-full bg-gray-700 rounded-full h-2.5 mt-1">
                                            <div class="bg-red-600 h-2.5 rounded-full" style={{ width: `${(file.downloaded / file.total) * 100}%` }}></div>
                                            <p class="text-xs text-gray-400 mt-1">{((file.downloaded / file.total) * 100).toFixed(1)}% of {(file.total / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                    ) : (
                                        <p class="text-sm text-gray-400">{(file.total / 1024 / 1024).toFixed(2)} MB - {file.status}</p>
                                    )}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => deleteDownload(file.id)}
                                class="mt-3 sm:mt-0 sm:ml-4 px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-gray-900"
                            >
                                Delete
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        )}
      </div>
    </div>
  );
}