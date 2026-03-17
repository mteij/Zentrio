import type { AppTarget } from './app-target'

export interface OfflineDownloadsSettings {
  allowOnTv: boolean
}

export const DEFAULT_OFFLINE_DOWNLOADS_SETTINGS: OfflineDownloadsSettings = {
  allowOnTv: false,
}

export function readOfflineDownloadsSettings(raw: unknown): OfflineDownloadsSettings {
  const settings = raw as Partial<OfflineDownloadsSettings> | null | undefined

  return {
    allowOnTv: settings?.allowOnTv === true,
  }
}

export function canUseOfflineDownloads(target: Pick<AppTarget, 'isTv'>, settings?: Partial<OfflineDownloadsSettings> | null): boolean {
  const normalized = readOfflineDownloadsSettings(settings)
  return !target.isTv || normalized.allowOnTv
}
