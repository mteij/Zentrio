import { h } from "preact";
import { useSignal, useSignalEffect } from "@preact/signals";
import { useFileSystem } from "../shared/hooks/useFileSystem.ts";

interface DownloadedFile {
  name: string;
  size: number;
}

export default function DownloadsManager() {
  const { getDirectoryHandle } = useFileSystem();
  const files = useSignal<DownloadedFile[]>([]);
  const isLoading = useSignal(true);
  const errorMessage = useSignal<string | null>(null);

  const listFiles = async () => {
    const dirHandle = getDirectoryHandle();
    if (!dirHandle) {
      errorMessage.value = "No download directory selected. Please select one in the settings.";
      isLoading.value = false;
      return;
    }

    try {
      const fileList: DownloadedFile[] = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === "file") {
          const file = await (entry as any).getFile();
          fileList.push({ name: file.name, size: file.size });
        }
      }
      files.value = fileList;
    } catch (error) {
      errorMessage.value = `Error reading files: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      isLoading.value = false;
    }
  };

  useSignalEffect(() => {
    listFiles();
  });

  const deleteFile = async (fileName: string) => {
    const dirHandle = getDirectoryHandle();
    if (!dirHandle) return;

    try {
      await dirHandle.removeEntry(fileName);
      await listFiles(); // Refresh the list
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
          <li key={file.name} class="p-4 flex items-center justify-between hover:bg-gray-800 transition-colors duration-200">
            <div class="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p class="font-medium text-white">{file.name}</p>
                <p class="text-sm text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
            <button
              onClick={() => deleteFile(file.name)}
              class="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-gray-900"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}