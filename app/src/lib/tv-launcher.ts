import { invoke } from '@tauri-apps/api/core'
import { getAppTarget } from './app-target'
import { createLogger } from '../utils/client-logger'

const log = createLogger('TvLauncher')

const WATCH_NEXT_CONTINUE = 0

export interface ContinueWatchingLauncherPayload {
  profileId: string
  metaId: string
  metaType: string
  title: string
  description?: string
  posterUrl?: string
  season?: number
  episode?: number
  playbackPositionSeconds: number
  durationSeconds: number
  lastEngagementTimeUtcMillis?: number
}

type UpsertWatchNextArgs = Record<string, unknown> & {
  internalProviderId: string
  mediaType: string
  title: string
  description?: string | null
  posterUrl?: string | null
  deepLinkUri: string
  playbackPositionMillis: number
  durationMillis: number
  lastEngagementTimeUtcMillis: number
  watchNextType: number
}

function supportsTvLauncher(): boolean {
  const target = getAppTarget()
  return target.isTauri && target.os === 'android' && target.isTv
}

export function buildContinueWatchingProviderId(payload: Pick<ContinueWatchingLauncherPayload, 'profileId' | 'metaId' | 'season' | 'episode'>): string {
  return [
    payload.profileId,
    payload.metaId,
    payload.season ?? -1,
    payload.episode ?? -1,
  ].join(':')
}

export function buildContinueWatchingDeepLink(payload: Pick<ContinueWatchingLauncherPayload, 'profileId' | 'metaId' | 'metaType' | 'season' | 'episode'>): string {
  const params = new URLSearchParams({
    profileId: payload.profileId,
    type: payload.metaType,
    id: payload.metaId,
  })

  if (payload.season !== undefined) {
    params.set('season', String(payload.season))
  }

  if (payload.episode !== undefined) {
    params.set('episode', String(payload.episode))
  }

  return `zentrio://launcher/open?${params.toString()}`
}

function toUpsertArgs(payload: ContinueWatchingLauncherPayload): UpsertWatchNextArgs {
  return {
    internalProviderId: buildContinueWatchingProviderId(payload),
    mediaType: payload.metaType,
    title: payload.title,
    description: payload.description ?? null,
    posterUrl: payload.posterUrl ?? null,
    deepLinkUri: buildContinueWatchingDeepLink(payload),
    playbackPositionMillis: Math.max(0, Math.round(payload.playbackPositionSeconds * 1000)),
    durationMillis: Math.max(0, Math.round(payload.durationSeconds * 1000)),
    lastEngagementTimeUtcMillis: payload.lastEngagementTimeUtcMillis ?? Date.now(),
    watchNextType: WATCH_NEXT_CONTINUE,
  }
}

export async function syncContinueWatchingLauncher(payload: ContinueWatchingLauncherPayload): Promise<void> {
  if (!supportsTvLauncher()) {
    return
  }

  if (!payload.profileId || !payload.metaId || !payload.title) {
    return
  }

  if (payload.durationSeconds <= 0 || payload.playbackPositionSeconds <= 0) {
    return
  }

  try {
    await invoke('tv_launcher_upsert_watch_next', toUpsertArgs(payload))
  } catch (error) {
    log.warn('Failed to sync Watch Next entry', error)
  }
}

export async function removeContinueWatchingLauncher(payload: Pick<ContinueWatchingLauncherPayload, 'profileId' | 'metaId' | 'season' | 'episode'>): Promise<void> {
  if (!supportsTvLauncher()) {
    return
  }

  try {
    await invoke('tv_launcher_remove_watch_next', {
      internalProviderId: buildContinueWatchingProviderId(payload),
    })
  } catch (error) {
    log.warn('Failed to remove Watch Next entry', error)
  }
}
