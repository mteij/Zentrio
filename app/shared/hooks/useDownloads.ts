import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { Download, getAllDownloads, addDownload as dbAddDownload, deleteDownload as dbDeleteDownload } from "../services/downloadManager.ts";
import { getAll, STORES } from "../utils/idb.ts";
import { useSetting } from "./useSetting.ts";

export function useDownloads() {
  const downloads = useSignal<Download[]>([]);
  const isLoading = useSignal(true);
  const subDlApiKey = useSetting<string>("subDlApiKey", "", "server");

  const loadDownloads = async () => {
    isLoading.value = true;
    const allDownloads = await getAllDownloads();
    const allProgress = await getAll<{ id: string, currentTime: number }>(STORES.PROGRESS);

    const downloadsWithProgress = allDownloads.map(download => {
      const progress = allProgress.find(p => p.id === download.streamUrl);
      return {
        ...download,
        currentTime: progress?.currentTime,
      };
    });

    downloads.value = downloadsWithProgress;
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
      subDlApiKey: subDlApiKey.value,
    });
  };

  const deleteDownload = async (id: string) => {
    await dbDeleteDownload(id);
    downloads.value = downloads.value.filter(d => d.id !== id);
  };

  const groupedDownloads = () => {
    const groups: { [key: string]: Download[] } = {};
    for (const download of downloads.value) {
      const seriesName = download.fileName.split(' - ')[0];
      if (!groups[seriesName]) {
        groups[seriesName] = [];
      }
      groups[seriesName].push(download);
    }
    return groups;
  };

  return {
    downloads,
    isLoading,
    addDownload,
    deleteDownload,
    groupedDownloads,
  };
}