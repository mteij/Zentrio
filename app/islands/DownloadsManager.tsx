import { useSignal } from "@preact/signals";
import { useFileSystem } from "../shared/hooks/useFileSystem.ts";
import { getAll, remove, STORES } from "../shared/utils/idb.ts";
import { useEffect } from "preact/hooks";

interface Download {
  name: string;
  total: number;
  downloaded: number;
  status: 'downloading' | 'completed' | 'failed' | 'starting';
}

interface DisplayFile {
  name: string;
  size: number;
  progress?: number;
  status: 'downloading' | 'completed' | 'failed' | 'starting';
}

export default function DownloadsManager() {
  const { getDirectoryHandle } = useFileSystem();
  const files = useSignal<DisplayFile[]>([]);
  const isLoading = useSignal(true);
  const errorMessage = useSignal<string | null>(null);

  const loadDownloads = async () => {
    isLoading.value = true;
    const dirHandle = getDirectoryHandle();
    if (!dirHandle) {
      errorMessage.value = "No download directory selected. Please select one in settings.";
      isLoading.value = false;
      return;
    }

    try {
      const inProgress = await getAll<Download>(STORES.DOWNLOADS);
      const completedFiles: DisplayFile[] = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === "file") {
          const file = await (entry as FileSystemFileHandle).getFile();
          if (!inProgress.some(d => d.name === file.name && d.status !== 'completed')) {
            completedFiles.push({ name: file.name, size: file.size, status: 'completed' });
          }
        }
      }

      const combined = [
        ...inProgress.map(d => ({
          name: d.name,
          size: d.total,
          status: d.status,
          progress: d.total > 0 ? (d.downloaded / d.total) * 100 : 0,
        })),
        ...completedFiles,
      ];
      
      // Remove duplicates, preferring in-progress entries
      const unique = combined.filter((file, index, self) =>
        index === self.findIndex((f) => f.name === file.name)
      );

      files.value = unique;
    } catch (error) {
      errorMessage.value = `Error reading files: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isLoading.value = false;
    }
  };

  useEffect(() => {
    loadDownloads();
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'DOWNLOAD_PROGRESS') {
        loadDownloads();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, []);

  const deleteFile = async (fileName: string) => {
    const dirHandle = getDirectoryHandle();
    if (!dirHandle) return;

    try {
      await dirHandle.removeEntry(fileName);
      await remove(STORES.DOWNLOADS, fileName);
      await loadDownloads();
    } catch (error) {
      alert(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  if (isLoading.value) {
    return <div>Loading...</div>;
  }

  if (errorMessage.value) {
    return <div class="text-red-500">{errorMessage.value}</div>;
  }

  if (files.value.length === 0) {
    return (
      <div class="text-center py-12">
        <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <h3 class="mt-2 text-lg font-medium text-white">No downloads yet</h3>
        <p class="mt-1 text-sm text-gray-400">Start downloading from the player to see your files here.</p>
      </div>
    );
  }

  return (
    <div class="bg-gray-900 rounded-lg shadow-lg">
      <ul class="divide-y divide-gray-800">
        {files.value.map((file) => (
          <li key={file.name} class="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-gray-800 transition-colors duration-200">
            <div class="flex items-center flex-1 min-w-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="flex-1 min-w-0">
                <p class="font-medium text-white truncate">{file.name}</p>
                {file.status === 'downloading' && file.progress !== undefined ? (
                  <div class="w-full bg-gray-700 rounded-full h-2.5 mt-1">
                    <div class="bg-red-600 h-2.5 rounded-full" style={{ width: `${file.progress}%` }}></div>
                    <p class="text-xs text-gray-400 mt-1">{file.progress.toFixed(1)}% of {(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <p class="text-sm text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB - {file.status}</p>
                )}
              </div>
            </div>
            <button
            type="button"
              onClick={() => deleteFile(file.name)}
              class="mt-3 sm:mt-0 sm:ml-4 px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-gray-900"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}