import { Download } from "../../shared/services/downloadManager.ts";

export default function DownloadsGroup({ groupName, downloads, onPlay, onDelete }: { groupName: string; downloads: (Download & { currentTime?: number })[]; onPlay: (src: string) => void; onDelete: (id: string) => void; }) {
  return (
    <div class="mt-6">
      <h3 class="text-lg font-semibold mb-4 text-white">{groupName}</h3>
      <ul class="divide-y divide-gray-800">
        {downloads.map((file) => (
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
                  <p class="text-sm text-gray-400">
                    {file.status === 'failed' ? (
                      <span class="text-red-400">Failed: {file.error}</span>
                    ) : (
                      <span>{(file.total / 1024 / 1024).toFixed(2)} MB - {file.status}</span>
                    )}
                  </p>
                )}
                {file.status === 'completed' && file.currentTime && (
                  <div class="w-full bg-gray-700 rounded-full h-1 mt-2">
                    <div class="bg-green-600 h-1 rounded-full" style={{ width: `${(file.currentTime / (file.total / 10000)) * 100}%` }}></div>
                  </div>
                )}
              </div>
            </div>
            <div class="flex items-center mt-3 sm:mt-0 sm:ml-4">
              {file.status === 'completed' && (
                <button
                  type="button"
                  onClick={() => onPlay(file.streamUrl)}
                  class="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 focus:ring-offset-gray-900 mr-2"
                >
                  Play
                </button>
              )}
              <button
                type="button"
                onClick={() => onDelete(file.id)}
                class="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-gray-900"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}