import { apiFetchJson } from './apiFetch'
import { getAddonClient } from './addon-client'
import { isTauri } from './auth-client'
import { createLogger } from '../utils/client-logger'
import type { MetaDetail, Stream, Manifest } from '../services/addons/types'
import { StreamProcessor, type StreamConfig } from '../services/addons/stream-processor'

const log = createLogger('StreamResolver')

const STREAM_CACHE_TTL_MS = 2 * 60 * 1000
const RETRY_PATTERNS = [
  /scraping in progress/i,
  /please try again/i,
  /rate limit/i,
  /too many requests/i,
  /busy/i,
  /wait/i,
]

type EnabledAddon = {
  id: number
  manifest_url: string
  name: string
  logo?: string
  logo_url?: string
}

type ResolverAddon = {
  id: string
  name: string
  logo?: string
}

type RawAddonResult = {
  addon: Manifest
  streams: Stream[]
}

type CachedStreamResolution = {
  cachedAt: number
  allStreams: ResolvedFlatStream[]
}

type StreamingDetailsResponse = {
  meta?: MetaDetail
}

export type ResolvedFlatStream = {
  stream: Stream
  addon: ResolverAddon
  parsed?: {
    resolution?: string
    encode?: string[]
    audioTags?: string[]
    audioChannels?: string[]
    visualTags?: string[]
    sourceType?: string
    seeders?: number
    size?: number
    languages?: string[]
    isCached?: boolean
  }
}

export type CacheStatusPayload = {
  fromCache: boolean
  cacheAgeMs: number
}

export type AddonResultPayload = {
  addon: ResolverAddon
  count: number
  allStreams?: ResolvedFlatStream[]
}

export type FirstPlayablePayload = {
  stream: ResolvedFlatStream
  totalCount: number
}

export type CompletePayload = {
  allStreams: ResolvedFlatStream[]
  totalCount: number
  fromCache: boolean
}

export type StreamResolverCallbacks = {
  onCacheStatus?: (payload: CacheStatusPayload) => void
  onAddonStart?: (payload: { addon: ResolverAddon }) => void
  onAddonResult?: (payload: AddonResultPayload) => void
  onAddonError?: (payload: { addon: ResolverAddon; error: string }) => void
  onFirstPlayable?: (payload: FirstPlayablePayload) => void
  onComplete?: (payload: CompletePayload) => void
}

export type StreamResolveParams = {
  type: string
  id: string
  profileId: string
  season?: number
  episode?: number
  forceRefresh?: boolean
  meta?: Partial<MetaDetail> | null
}

export type StreamResolveHandle = {
  cancel: () => void
  done: Promise<CompletePayload | null>
}

const resolutionCache = new Map<string, CachedStreamResolution>()

function buildCacheKey(params: StreamResolveParams): string {
  return [
    params.profileId,
    params.type,
    params.id,
    params.season ?? '',
    params.episode ?? '',
  ].join(':')
}

function isFresh(entry: CachedStreamResolution): boolean {
  return Date.now() - entry.cachedAt <= STREAM_CACHE_TTL_MS
}

function toResolverAddon(addon: Pick<Manifest, 'id' | 'name' | 'logo' | 'logo_url'>): ResolverAddon {
  return {
    id: addon.id,
    name: addon.name,
    logo: addon.logo || addon.logo_url,
  }
}

function isThirdPartyAddon(addon: EnabledAddon): boolean {
  return /^https?:\/\//i.test(addon.manifest_url)
}

function supportsResource(manifest: Manifest, resourceName: string, contentType: string): boolean {
  for (const resource of manifest.resources) {
    if (typeof resource === 'string') {
      if (resource === resourceName && manifest.types.includes(contentType)) {
        return true
      }
    } else if (resource && typeof resource === 'object') {
      const resourceTypes = resource.types || manifest.types
      if (resource.name === resourceName && resourceTypes.includes(contentType)) {
        return true
      }
    }
  }

  return false
}

function getResourceIdPrefixes(manifest: Manifest, resourceName: string): string[] | null {
  for (const resource of manifest.resources) {
    if (typeof resource === 'object' && resource !== null && resource.name === resourceName) {
      if (resource.idPrefixes && resource.idPrefixes.length > 0) {
        return resource.idPrefixes
      }
      return null
    }
  }

  return manifest.idPrefixes && manifest.idPrefixes.length > 0 ? manifest.idPrefixes : null
}

function canHandleId(manifest: Manifest, resourceName: string, id: string): boolean {
  const prefixes = getResourceIdPrefixes(manifest, resourceName)
  if (prefixes === null) return true

  const primaryId = id.includes(',') ? id.split(',')[0] : id
  return prefixes.some((prefix) => primaryId.startsWith(prefix))
}

function resolveSeriesVideoId(baseId: string, meta: MetaDetail | null, originalId: string, season?: number, episode?: number): string {
  if (season === undefined || episode === undefined) return baseId

  if (
    meta &&
    (baseId === originalId || baseId === meta.id) &&
    Array.isArray(meta.videos)
  ) {
    const match = meta.videos.find((video) => {
      const videoSeason = Number(video.season ?? 0)
      const videoEpisode = Number(video.episode ?? 0)
      return videoSeason === season && videoEpisode === episode
    })

    if (match?.id) {
      return String(match.id)
    }
  }

  return `${baseId}:${season}:${episode}`
}

function isRetryableResponse(streams: Stream[]): boolean {
  if (!streams || streams.length !== 1) return false
  const stream = streams[0]
  const text = `${stream.title || ''} ${stream.name || ''} ${stream.description || ''}`.toLowerCase()
  return RETRY_PATTERNS.some((pattern) => pattern.test(text))
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function fetchEnabledAddons(profileId: string): Promise<EnabledAddon[]> {
  return apiFetchJson<EnabledAddon[]>(`/api/addons/profile/${encodeURIComponent(profileId)}`)
}

async function fetchSettings(profileId: string): Promise<StreamConfig | undefined> {
  try {
    const data = await apiFetchJson<{ data?: StreamConfig }>(`/api/streaming/settings?profileId=${encodeURIComponent(profileId)}`)
    return data.data
  } catch (error) {
    log.warn('Failed to load stream settings, falling back to basic ordering:', error)
    return undefined
  }
}

async function fetchMeta(params: StreamResolveParams): Promise<MetaDetail | null> {
  const providedMeta = params.meta
  const hasUsefulMeta =
    providedMeta &&
    (typeof providedMeta.imdb_id === 'string' || Array.isArray(providedMeta.videos))

  if (hasUsefulMeta) {
    return {
      id: providedMeta.id || params.id,
      type: providedMeta.type || params.type,
      name: providedMeta.name || 'Unknown',
      imdb_id: providedMeta.imdb_id,
      videos: providedMeta.videos,
      poster: providedMeta.poster,
    }
  }

  try {
    const details = await apiFetchJson<StreamingDetailsResponse>(
      `/api/streaming/details/${params.type}/${encodeURIComponent(params.id)}?profileId=${encodeURIComponent(params.profileId)}`
    )
    return details.meta || null
  } catch (error) {
    log.warn('Failed to load meta for client-side stream resolution:', error)
    return providedMeta
      ? {
          id: providedMeta.id || params.id,
          type: providedMeta.type || params.type,
          name: providedMeta.name || 'Unknown',
          poster: providedMeta.poster,
          videos: providedMeta.videos,
          imdb_id: providedMeta.imdb_id,
        }
      : null
  }
}

function buildCandidateBaseIds(id: string, meta: MetaDetail | null): string[] {
  return Array.from(new Set([id, meta?.id, meta?.imdb_id].filter(Boolean) as string[]))
}

async function getMovieVideoIdsFromAddonMeta(clientManifest: Manifest, baseId: string, client: ReturnType<typeof getAddonClient>): Promise<string[]> {
  if (!supportsResource(clientManifest, 'meta', 'movie')) return []
  if (!canHandleId(clientManifest, 'meta', baseId)) return []

  const addonMeta = await client.getMeta('movie', baseId)
  if (!addonMeta) return []

  const ids: string[] = []
  const defaultVideoId = (addonMeta as any)?.behaviorHints?.defaultVideoId
  if (typeof defaultVideoId === 'string' && defaultVideoId.trim()) {
    ids.push(defaultVideoId.trim())
  }

  if (Array.isArray(addonMeta.videos)) {
    for (const video of addonMeta.videos) {
      if (video?.id) ids.push(String(video.id))
    }
  }

  return Array.from(new Set(ids)).filter(Boolean)
}

function applyPlatformOverrides(settings: StreamConfig | undefined): StreamConfig | undefined {
  if (!settings) return settings
  if (isTauri()) return settings

  const next: StreamConfig = structuredClone(settings)
  if (!next.filters) return next
  if (!next.filters.audioTag) {
    next.filters.audioTag = {}
  }
  if (!next.filters.audioTag.preferred) {
    next.filters.audioTag.preferred = []
  }

  const preferred = next.filters.audioTag.preferred
  const prependIfMissing = (value: string) => {
    if (!preferred.includes(value)) preferred.unshift(value)
  }

  prependIfMissing('multi')
  prependIfMissing('eac3')
  prependIfMissing('ac3')
  prependIfMissing('flac')
  prependIfMissing('opus')
  prependIfMissing('mp3')
  prependIfMissing('aac')

  return next
}

function flattenWithoutSettings(results: RawAddonResult[]): ResolvedFlatStream[] {
  const allStreams: ResolvedFlatStream[] = []

  results.forEach((result) => {
    result.streams.forEach((stream) => {
      if (!stream.behaviorHints) stream.behaviorHints = {}
      ;(stream.behaviorHints as any).sortIndex = allStreams.length
      allStreams.push({
        stream,
        addon: toResolverAddon(result.addon),
      })
    })
  })

  return allStreams
}

function processResults(results: RawAddonResult[], settings: StreamConfig | undefined, meta: MetaDetail | null): ResolvedFlatStream[] {
  if (!results.length) return []

  if (!settings) {
    return flattenWithoutSettings(results)
  }

  const effectiveSettings = applyPlatformOverrides(settings)
  if (!effectiveSettings) {
    return flattenWithoutSettings(results)
  }

  const processor = new StreamProcessor(effectiveSettings, isTauri() ? 'app' : 'web')
  const processed = processor.process(
    results.flatMap((result) =>
      result.streams.map((stream) => ({
        stream,
        addon: result.addon,
      }))
    ),
    meta || { id: '', type: '', name: 'Unknown' }
  )

  return processed.map((parsedStream, index) => {
    if (!parsedStream.original.behaviorHints) parsedStream.original.behaviorHints = {}
    ;(parsedStream.original.behaviorHints as any).sortIndex = index
    return {
      stream: parsedStream.original,
      addon: toResolverAddon(parsedStream.addon),
      parsed: {
        resolution: parsedStream.parsed.resolution,
        encode: parsedStream.parsed.encode,
        audioTags: parsedStream.parsed.audioTags,
        audioChannels: parsedStream.parsed.audioChannels,
        visualTags: parsedStream.parsed.visualTags,
        sourceType: parsedStream.parsed.sourceType,
        seeders: parsedStream.parsed.seeders,
        size: parsedStream.parsed.size,
        languages: parsedStream.parsed.languages,
        isCached: parsedStream.parsed.isCached,
      },
    }
  })
}

function emitCachedResults(entry: CachedStreamResolution, callbacks: StreamResolverCallbacks): CompletePayload {
  const cacheAgeMs = Date.now() - entry.cachedAt
  callbacks.onCacheStatus?.({ fromCache: true, cacheAgeMs })

  const counts = new Map<string, { addon: ResolverAddon; count: number }>()
  for (const item of entry.allStreams) {
    const existing = counts.get(item.addon.id)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(item.addon.id, { addon: item.addon, count: 1 })
    }
  }

  for (const { addon, count } of counts.values()) {
    callbacks.onAddonStart?.({ addon })
    callbacks.onAddonResult?.({
      addon,
      count,
      allStreams: entry.allStreams,
    })
  }

  const payload = {
    allStreams: entry.allStreams,
    totalCount: entry.allStreams.length,
    fromCache: true,
  }
  callbacks.onComplete?.(payload)
  return payload
}

export function resolveStreamsProgressive(params: StreamResolveParams, callbacks: StreamResolverCallbacks = {}): StreamResolveHandle {
  let cancelled = false
  const cacheKey = buildCacheKey(params)

  const done = (async (): Promise<CompletePayload | null> => {
    try {
      if (!params.forceRefresh) {
        const cached = resolutionCache.get(cacheKey)
        if (cached && isFresh(cached)) {
          return emitCachedResults(cached, callbacks)
        }
      } else {
        resolutionCache.delete(cacheKey)
      }

      callbacks.onCacheStatus?.({ fromCache: false, cacheAgeMs: 0 })

      const [enabledAddons, settings, meta] = await Promise.all([
        fetchEnabledAddons(params.profileId),
        fetchSettings(params.profileId),
        fetchMeta(params),
      ])

      if (cancelled) return null

      const candidateBaseIds = buildCandidateBaseIds(params.id, meta)
      const thirdPartyAddons = enabledAddons.filter(isThirdPartyAddon)
      const rawResultsByManifestUrl = new Map<string, RawAddonResult>()
      let firstPlayableSent = false

      const getOrderedResults = (): RawAddonResult[] =>
        thirdPartyAddons
          .map((addon) => rawResultsByManifestUrl.get(addon.manifest_url))
          .filter((result): result is RawAddonResult => Boolean(result))

      const emitProcessedResults = (addon: ResolverAddon, count: number): ResolvedFlatStream[] => {
        const allStreams = processResults(getOrderedResults(), settings, meta)

        callbacks.onAddonResult?.({
          addon,
          count,
          allStreams,
        })

        if (!firstPlayableSent && allStreams.length > 0) {
          firstPlayableSent = true
          callbacks.onFirstPlayable?.({
            stream: allStreams[0],
            totalCount: allStreams.length,
          })
        }

        return allStreams
      }

      const resolveAddonStreams = async (addon: EnabledAddon): Promise<void> => {
        if (cancelled) return
        const client = getAddonClient(addon.manifest_url)
        let manifest: Manifest

        try {
          manifest = await client.init()
        } catch (error) {
          if (cancelled) return
          callbacks.onAddonError?.({
            addon: {
              id: addon.manifest_url,
              name: addon.name,
              logo: addon.logo_url || addon.logo,
            },
            error: error instanceof Error ? error.message : String(error),
          })
          return
        }

        if (cancelled) return

        if (!supportsResource(manifest, 'stream', params.type)) {
          return
        }

        const baseId = candidateBaseIds.find((candidateId) => canHandleId(manifest, 'stream', candidateId))
        if (!baseId) {
          return
        }

        const resolverAddon = toResolverAddon(manifest)
        callbacks.onAddonStart?.({ addon: resolverAddon })

        const resolvedVideoId =
          params.type === 'series'
            ? resolveSeriesVideoId(baseId, meta, params.id, params.season, params.episode)
            : baseId

        let attempt = 0
        const maxRetries = 3

        while (attempt < maxRetries && !cancelled) {
          try {
            let streams = await client.getStreams(params.type, resolvedVideoId)
            if (cancelled) return

            if (params.type === 'movie' && (!streams || streams.length === 0)) {
              const altVideoIds = await getMovieVideoIdsFromAddonMeta(manifest, baseId, client)
              for (const videoId of altVideoIds) {
                if (cancelled) return
                try {
                  const extraStreams = await client.getStreams('movie', videoId)
                  if (cancelled) return
                  if (extraStreams && extraStreams.length > 0) {
                    streams = [...(streams || []), ...extraStreams]
                  }
                } catch {
                  // Ignore per-video-id failures and keep searching.
                }
              }
            }

            if (isRetryableResponse(streams) && attempt < maxRetries - 1) {
              attempt += 1
              await delay(5000)
              continue
            }

            if (streams && streams.length > 0) {
              rawResultsByManifestUrl.set(addon.manifest_url, { addon: manifest, streams })
            }

            emitProcessedResults(resolverAddon, streams?.length || 0)
            return
          } catch (error) {
            attempt += 1
            if (attempt < maxRetries) {
              await delay(3000)
              continue
            }

            callbacks.onAddonError?.({
              addon: resolverAddon,
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
      }

      await Promise.allSettled(thirdPartyAddons.map((addon) => resolveAddonStreams(addon)))

      if (cancelled) return null

      const allStreams = processResults(getOrderedResults(), settings, meta)
      const payload = {
        allStreams,
        totalCount: allStreams.length,
        fromCache: false,
      }

      resolutionCache.set(cacheKey, {
        cachedAt: Date.now(),
        allStreams,
      })

      callbacks.onComplete?.(payload)
      return payload
    } catch (error) {
      log.error('Client-side stream resolution failed:', error)
      return null
    }
  })()

  return {
    cancel: () => {
      cancelled = true
    },
    done,
  }
}

