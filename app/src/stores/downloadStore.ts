import { create } from 'zustand'
import { DownloadRecord, DownloadStatus } from '../services/downloads/download-service'

interface DownloadState {
  downloads: DownloadRecord[]
  setDownloads: (downloads: DownloadRecord[]) => void
  updateProgress: (id: string, progress: number, downloadedBytes: number, speed?: number) => void
  updateStatus: (id: string, status: DownloadStatus, filePath?: string, errorMessage?: string) => void
  addDownload: (record: DownloadRecord) => void
  removeDownload: (id: string) => void
}

export const useDownloadStore = create<DownloadState>((set) => ({
  downloads: [],

  setDownloads: (downloads) => set({ downloads }),

  addDownload: (record) =>
    set((state) => ({
      downloads: [record, ...state.downloads.filter((d) => d.id !== record.id)],
    })),

  updateProgress: (id, progress, downloadedBytes, speed) =>
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.id === id
          ? { ...d, progress, downloadedBytes, speed, status: 'downloading' as DownloadStatus }
          : d
      ),
    })),

  updateStatus: (id, status, filePath, errorMessage) =>
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.id === id
          ? {
              ...d,
              status,
              ...(filePath ? { filePath } : {}),
              ...(errorMessage ? { errorMessage } : {}),
              ...(status === 'completed'
                ? {
                    progress: 100,
                    fileSize: d.fileSize > 0 ? d.fileSize : d.downloadedBytes,
                  }
                : {}),
            }
          : d
      ),
    })),

  removeDownload: (id) =>
    set((state) => ({ downloads: state.downloads.filter((d) => d.id !== id) })),
}))
