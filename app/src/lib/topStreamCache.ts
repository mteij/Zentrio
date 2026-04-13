import { apiFetch } from './apiFetch'
import { resolveStreamsProgressive } from './stream-resolver'

export const STREAM_CACHE_FRESH_MS = 2 * 60 * 1000
export const STREAM_RESOLVE_TIMEOUT_MS = 10000
const AUTO_PLAY_WAIT_MIN_MS = 5000
const AUTO_PLAY_WAIT_MAX_MS = 30000
const AUTO_PLAY_WAIT_CACHE_TTL_MS = 2 * 60 * 1000

interface AutoPlayWaitCacheEntry {
  value: number
  expiresAt: number
}

const autoPlayWaitCache = new Map<string, AutoPlayWaitCacheEntry>()
const autoPlayWaitInFlight = new Map<string, Promise<number>>()

export interface CachedTopStream {
  url: string
  addonId: string
  subtitles?: Array<{ url: string; lang: string }>
  cachedAt?: number
}

interface ResolveTopStreamParams {
  profileId: string
  mediaType: string
  mediaId: string
  season?: number
  episode?: number
  forceRefresh?: boolean
  timeoutMs?: number
}

const inFlightResolvers = new Map<string, Promise<CachedTopStream | null>>()

function clearAutoPlayWaitCache(): void {
  autoPlayWaitCache.clear()
  autoPlayWaitInFlight.clear()
}

if (typeof window !== 'undefined') {
  window.addEventListener('streaming-settings-updated', clearAutoPlayWaitCache)
}

function clampAutoPlayWaitMs(value: number): number {
  if (!Number.isFinite(value)) return STREAM_RESOLVE_TIMEOUT_MS
  return Math.max(AUTO_PLAY_WAIT_MIN_MS, Math.min(AUTO_PLAY_WAIT_MAX_MS, Math.round(value)))
}

async function getAutoPlayWaitMs(profileId: string): Promise<number> {
  const now = Date.now()
  const cached = autoPlayWaitCache.get(profileId)
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  const existing = autoPlayWaitInFlight.get(profileId)
  if (existing) {
    return existing
  }

  const request = (async () => {
    try {
      const res = await apiFetch(`/api/streaming/settings?profileId=${encodeURIComponent(profileId)}`)
      if (!res.ok) throw new Error(`Settings request failed: ${res.status}`)
      const data = await res.json() as {
        data?: {
          playback?: {
            autoPlayMaxWaitMs?: unknown
          }
        }
      }

      const rawWait = data?.data?.playback?.autoPlayMaxWaitMs
      const parsedWait = typeof rawWait === 'number' ? rawWait : STREAM_RESOLVE_TIMEOUT_MS
      const value = clampAutoPlayWaitMs(parsedWait)
      autoPlayWaitCache.set(profileId, {
        value,
        expiresAt: now + AUTO_PLAY_WAIT_CACHE_TTL_MS,
      })
      return value
    } catch {
      const fallback = clampAutoPlayWaitMs(cached?.value ?? STREAM_RESOLVE_TIMEOUT_MS)
      autoPlayWaitCache.set(profileId, {
        value: fallback,
        expiresAt: now + 30_000,
      })
      return fallback
    }
  })()

  autoPlayWaitInFlight.set(profileId, request)
  try {
    return await request
  } finally {
    autoPlayWaitInFlight.delete(profileId)
  }
}

function episodeCacheKey(mediaId: string, season: number, episode: number): string {
  return `top_stream_${mediaId}_${season}_${episode}`
}

function fallbackCacheKey(mediaId: string): string {
  return `top_stream_${mediaId}`
}

export function parseCachedTopStream(raw: string | null): CachedTopStream | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { url?: unknown; addonId?: unknown; subtitles?: unknown; cachedAt?: unknown }
    if (!parsed || typeof parsed.url !== 'string' || parsed.url.length === 0) return null
    return {
      url: parsed.url,
      addonId: typeof parsed.addonId === 'string' ? parsed.addonId : '',
      subtitles: Array.isArray(parsed.subtitles) ? parsed.subtitles as Array<{ url: string; lang: string }> : undefined,
      cachedAt: typeof parsed.cachedAt === 'number' ? parsed.cachedAt : undefined,
    }
  } catch {
    return null
  }
}

export function isFreshCachedTopStream(stream: CachedTopStream): boolean {
  if (typeof stream.cachedAt !== 'number') return false
  return Date.now() - stream.cachedAt <= STREAM_CACHE_FRESH_MS
}

export function cacheTopStream(
  mediaId: string,
  stream: Pick<CachedTopStream, 'url' | 'addonId' | 'subtitles'>,
  season?: number,
  episode?: number
): void {
  const payload = JSON.stringify({
    url: stream.url,
    addonId: stream.addonId || '',
    subtitles: stream.subtitles,
    cachedAt: Date.now(),
  })

  sessionStorage.setItem(fallbackCacheKey(mediaId), payload)
  if (typeof season === 'number' && typeof episode === 'number') {
    sessionStorage.setItem(episodeCacheKey(mediaId, season, episode), payload)
  }
}

export function readCachedTopStream(
  mediaId: string,
  season?: number,
  episode?: number
): { stream: CachedTopStream; stale: boolean } | null {
  const scoped =
    typeof season === 'number' && typeof episode === 'number'
      ? parseCachedTopStream(sessionStorage.getItem(episodeCacheKey(mediaId, season, episode)))
      : null
  const fallback = parseCachedTopStream(sessionStorage.getItem(fallbackCacheKey(mediaId)))
  const stream = scoped || fallback
  if (!stream) return null
  return { stream, stale: !isFreshCachedTopStream(stream) }
}

function readFromEvent(eventData: any): CachedTopStream | null {
  const first = eventData?.allStreams?.[0] || eventData?.stream
  const streamUrl = first?.stream?.url || first?.url
  if (!streamUrl || typeof streamUrl !== 'string') return null
  const subtitles = first?.stream?.subtitles || first?.subtitles
  return {
    url: streamUrl,
    addonId: first?.addon?.id || first?.stream?.addonId || first?.addonId || '',
    subtitles: Array.isArray(subtitles) ? subtitles : undefined,
  }
}

export async function resolveTopStream({
  profileId,
  mediaType,
  mediaId,
  season,
  episode,
  forceRefresh = false,
  timeoutMs,
}: ResolveTopStreamParams): Promise<CachedTopStream | null> {
  if (!profileId || !mediaType || !mediaId) return null

  const scoped = typeof season === 'number' && typeof episode === 'number'
  const effectiveTimeoutMs = clampAutoPlayWaitMs(
    typeof timeoutMs === 'number' ? timeoutMs : await getAutoPlayWaitMs(profileId)
  )
  const inFlightKey = [profileId, mediaType, mediaId, scoped ? season : '', scoped ? episode : '', forceRefresh ? 'refresh' : 'normal'].join(':')
  const existing = inFlightResolvers.get(inFlightKey)
  if (existing) return existing

  const promise = new Promise<CachedTopStream | null>((resolve) => {
    let settled = false
    let timeout = 0

    const finish = (stream: CachedTopStream | null) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      resolver.cancel()
      if (stream) {
        cacheTopStream(mediaId, stream, scoped ? season : undefined, scoped ? episode : undefined)
      }
      resolve(stream)
    }

    const resolver = resolveStreamsProgressive({
      type: mediaType,
      id: mediaId,
      profileId,
      season,
      episode,
      forceRefresh,
    }, {
      onFirstPlayable: (data) => {
        finish(readFromEvent(data))
      },
      onAddonResult: (data) => {
        const stream = readFromEvent(data)
        if (stream) finish(stream)
      },
      onComplete: (data) => {
        finish(readFromEvent(data))
      }
    })

    timeout = window.setTimeout(() => {
      finish(null)
    }, effectiveTimeoutMs)

    void resolver.done.then((data) => {
      if (!data) finish(null)
    })
  })

  inFlightResolvers.set(inFlightKey, promise)
  try {
    return await promise
  } finally {
    inFlightResolvers.delete(inFlightKey)
  }
}

export async function getTopStream(params: ResolveTopStreamParams): Promise<CachedTopStream | null> {
  const cached = readCachedTopStream(params.mediaId, params.season, params.episode)
  if (cached && !cached.stale) return cached.stream

  const resolved = await resolveTopStream({
    ...params,
    forceRefresh: Boolean(cached),
  })
  return resolved || cached?.stream || null
}
