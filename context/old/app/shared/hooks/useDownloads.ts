import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { Download, getAllDownloads, addDownload as dbAddDownload, deleteDownload as dbDeleteDownload } from "../services/downloadManager.ts";

export function useDownloads() {
  const downloads = useSignal<Download[]>([]);
  const isLoading = useSignal(true);

  const loadDownloads = async () => {
    isLoading.value = true;
    const allDownloads = await getAllDownloads();
    downloads.value = allDownloads;
    isLoading.value = false;
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

  const addDownload = async (fileName: string, streamUrl: string) => {
    const newDownload = await dbAddDownload({ fileName, streamUrl });
    if (!downloads.value.some(d => d.id === newDownload.id)) {
      downloads.value = [...downloads.value, newDownload];
    }
    navigator.serviceWorker.controller?.postMessage({
      type: 'DOWNLOAD_VIDEO',
      download: newDownload,
    });
  };

  const deleteDownload = async (id: string) => {
    await dbDeleteDownload(id);
    downloads.value = downloads.value.filter(d => d.id !== id);
  };

  return {
    downloads,
    isLoading,
    addDownload,
    deleteDownload,
  };
}