import { invoke } from '@tauri-apps/api/core'

export type DownloadStatus = 'queued' | 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled'
export type DownloadQuality = 'standard' | 'higher' | 'best'

export interface DownloadRecord {
  id: string
  profileId: string
  mediaType: 'movie' | 'series'
  mediaId: string
  episodeId?: string
  title: string
  episodeTitle?: string
  season?: number
  episode?: number
  posterPath: string
  status: DownloadStatus
  progress: number
  quality: DownloadQuality
  filePath: string
  fileSize: number
  downloadedBytes: number
  addedAt: number
  completedAt?: number
  lastWatchedAt?: number
  watchedPercent: number
  streamUrl: string
  addonId: string
  errorMessage?: string
  smartDownload: boolean
  autoDelete: boolean
}

export interface StartDownloadPayload {
  profileId: string
  mediaType: 'movie' | 'series'
  mediaId: string
  episodeId?: string
  title: string
  episodeTitle?: string
  season?: number
  episode?: number
  posterPath: string
  streamUrl: string
  addonId: string
  quality: DownloadQuality
  /** Override per-download smart flag (undefined = use profile default) */
  smartDownload?: boolean
  /** Override per-download auto-delete flag (undefined = use profile default) */
  autoDelete?: boolean
}

export interface StorageStats {
  totalBytes: number
  count: number
}

export interface SmartDefaults {
  smartDownload: boolean
  autoDelete: boolean
}

export const downloadService = {
  start(payload: StartDownloadPayload): Promise<string> {
    return invoke<string>('download_start', { payload })
  },

  pause(id: string): Promise<void> {
    return invoke('download_pause', { id })
  },

  resume(id: string): Promise<void> {
    return invoke('download_resume', { id })
  },

  cancel(id: string): Promise<void> {
    return invoke('download_cancel', { id })
  },

  delete(id: string): Promise<void> {
    return invoke('download_delete', { id })
  },

  list(profileId: string): Promise<DownloadRecord[]> {
    return invoke<DownloadRecord[]>('download_list', { profileId })
  },

  storageStats(profileId: string): Promise<StorageStats> {
    return invoke<StorageStats>('download_storage_stats', { profileId })
  },

  purgeProfile(profileId: string): Promise<void> {
    return invoke('download_purge_profile', { profileId })
  },

  setDirectory(path: string): Promise<void> {
    return invoke('download_set_directory', { path })
  },

  getDirectory(): Promise<string> {
    return invoke<string>('download_get_directory')
  },

  getQuota(profileId: string): Promise<number> {
    return invoke<number>('download_get_quota', { profileId })
  },

  setQuota(profileId: string, quotaBytes: number): Promise<void> {
    return invoke('download_set_quota', { profileId, quotaBytes })
  },

  getSmartDefaults(profileId: string): Promise<SmartDefaults> {
    return invoke<SmartDefaults>('download_get_smart_defaults', { profileId })
  },

  setSmartDefaults(profileId: string, smartDownload: boolean, autoDelete: boolean): Promise<void> {
    return invoke('download_set_smart_defaults', { profileId, smartDownload, autoDelete })
  },
}
