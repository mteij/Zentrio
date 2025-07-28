import { get, set, remove, getAll, STORES } from "../utils/idb.ts";

export interface Download {
  id: string; // Will be a hash of the streamUrl
  fileName: string;
  streamUrl: string;
  total: number;
  downloaded: number;
  status: 'queued' | 'downloading' | 'completed' | 'failed' | 'paused';
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

async function generateId(streamUrl: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(streamUrl);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function addDownload(downloadData: Omit<Download, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'downloaded' | 'total'>): Promise<Download> {
  const id = await generateId(downloadData.streamUrl);
  const now = new Date();
  
  const existingDownload = await get<Download>(STORES.DOWNLOADS, id);
  if (existingDownload) {
    console.log("Download already exists:", existingDownload);
    return existingDownload;
  }

  const download: Download = {
    ...downloadData,
    id,
    createdAt: now,
    updatedAt: now,
    status: 'queued',
    downloaded: 0,
    total: 0,
  };
  
  console.log("Saving new download object:", download);
  await set(STORES.DOWNLOADS, download);
  return download;
}

export async function updateDownload(id: string, updates: Partial<Omit<Download, 'id'>>): Promise<Download> {
  const download = await get<Download>(STORES.DOWNLOADS, id);
  if (!download) {
    throw new Error(`Download with id ${id} not found`);
  }
  const updatedDownload = { ...download, ...updates, updatedAt: new Date() };
  await set(STORES.DOWNLOADS, updatedDownload);
  return updatedDownload;
}

export async function getDownload(id: string): Promise<Download | undefined> {
  return await get<Download>(STORES.DOWNLOADS, id);
}

export async function getAllDownloads(): Promise<Download[]> {
    return await getAll<Download>(STORES.DOWNLOADS);
}

export async function deleteDownload(id: string): Promise<void> {
  await remove(STORES.DOWNLOADS, id);
}