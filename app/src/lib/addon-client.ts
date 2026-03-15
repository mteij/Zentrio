import type { Manifest, MetaDetail, MetaPreview, Stream } from '../services/addons/types'
import { createLogger } from '../utils/client-logger'
import { addonFetch } from './addon-fetch'

const log = createLogger('ClientAddonClient')

// Virtual manifest URL used for the server-side TMDB addon
export const ZENTRIO_TMDB_ADDON = 'zentrio://tmdb-addon'

const RESOURCE_TIMEOUTS = {
  manifest: 5000,
  catalog: 15000,
  meta: 12000,
  stream: 12000,
}

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const responseCache = new Map<string, CacheEntry<any>>()

const CACHE_TTLS = {
  manifest: 30 * 60 * 1000, // 30 minutes
  catalog: 5 * 60 * 1000,   // 5 minutes
  meta: 10 * 60 * 1000,     // 10 minutes
}

function buildAddonJsonError(url: string, rawText: string, contentType: string | null): Error {
  const trimmed = rawText.trim()
  const preview = trimmed.slice(0, 160).replace(/\s+/g, ' ')
  const looksLikeHtml =
    (contentType || '').toLowerCase().includes('text/html') ||
    /^<!doctype html/i.test(trimmed) ||
    /^<html/i.test(trimmed)

  if (looksLikeHtml) {
    return new Error(
      `Addon returned HTML instead of JSON for ${url}. This usually means the addon is blocked, fronted by an anti-bot page, or the app fell back to a non-addon URL. Preview: ${preview}`
    )
  }

  return new Error(`Addon returned invalid JSON for ${url}. Preview: ${preview}`)
}

async function parseAddonJson<T>(res: Response, url: string): Promise<T> {
  const rawText = await res.text()
  if (!rawText.trim()) return {} as T

  try {
    return JSON.parse(rawText) as T
  } catch {
    throw buildAddonJsonError(url, rawText, res.headers.get('content-type'))
  }
}

function getCached<T>(key: string): T | null {
  const entry = responseCache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key)
    return null
  }
  return entry.data as T
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  responseCache.set(key, { data, expiresAt: Date.now() + ttlMs })
}

/**
 * Client-side Stremio addon client.
 *
 * Mirrors the interface of the server-side AddonClient but uses addonFetch()
 * so calls are routed correctly on both Tauri (direct HTTP) and web (CORS proxy).
 * Includes an in-memory TTL response cache to avoid redundant external requests.
 */
export class ClientAddonClient {
  private baseUrl: string
  public manifestUrl: string
  public manifest: Manifest | null = null

  constructor(url: string) {
    if (url.endsWith('manifest.json')) {
      this.baseUrl = url.replace('/manifest.json', '')
      this.manifestUrl = url
    } else {
      this.baseUrl = url.replace(/\/$/, '')
      this.manifestUrl = `${this.baseUrl}/manifest.json`
    }
  }

  async init(): Promise<Manifest> {
    const cacheKey = `manifest:${this.baseUrl}`
    const cached = getCached<Manifest>(cacheKey)
    if (cached) {
      this.manifest = cached
      return cached
    }

    const res = await addonFetch(`${this.baseUrl}/manifest.json`, RESOURCE_TIMEOUTS.manifest)
    if (!res.ok) throw new Error(`Failed to fetch manifest from ${this.baseUrl}: ${res.statusText}`)
    const manifest = await parseAddonJson<Manifest>(res, `${this.baseUrl}/manifest.json`)
    this.manifest = manifest
    setCache(cacheKey, manifest, CACHE_TTLS.manifest)
    return manifest
  }

  async getCatalog(
    type: string,
    id: string,
    extra: Record<string, string> = {}
  ): Promise<MetaPreview[]> {
    if (!this.manifest) await this.init()

    let extraPath = ''
    const entries = Object.entries(extra)
    if (entries.length > 0) {
      extraPath = '/' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('/')
    }

    const url = `${this.baseUrl}/catalog/${type}/${id}${extraPath}.json`
    const cacheKey = `catalog:${url}`
    const cached = getCached<MetaPreview[]>(cacheKey)
    if (cached) return cached

    const items = await this.fetchResource<MetaPreview[]>(url, 'metas', RESOURCE_TIMEOUTS.catalog)
    setCache(cacheKey, items, CACHE_TTLS.catalog)
    return items
  }

  async getMeta(type: string, id: string): Promise<MetaDetail | null> {
    if (!this.manifest) await this.init()

    const safeId = encodeURIComponent(id)
    const url = `${this.baseUrl}/meta/${type}/${safeId}.json`
    const cacheKey = `meta:${url}`
    const cached = getCached<MetaDetail>(cacheKey)
    if (cached) return cached

    try {
      const meta = await this.fetchResource<MetaDetail>(url, 'meta', RESOURCE_TIMEOUTS.meta)
      setCache(cacheKey, meta, CACHE_TTLS.meta)
      return meta
    } catch (e) {
      log.warn(`getMeta failed for ${url}:`, e)
      return null
    }
  }

  async getStreams(type: string, id: string): Promise<Stream[]> {
    if (!this.manifest) await this.init()
    const safeId = encodeURIComponent(id)
    const url = `${this.baseUrl}/stream/${type}/${safeId}.json`
    return this.fetchResource<Stream[]>(url, 'streams', RESOURCE_TIMEOUTS.stream)
  }

  private async fetchResource<T>(url: string, extractKey: string, timeoutMs: number): Promise<T> {
    const res = await addonFetch(url, timeoutMs)
    if (!res.ok) throw new Error(`Addon request failed (${res.status}): ${url}`)

    const data = await parseAddonJson<Record<string, unknown>>(res, url)
    const addonError = typeof data?.err === 'string' ? data.err : null
    if (addonError) throw new Error(addonError)

    const result = data?.[extractKey]
    if (result === undefined || result === null) {
      return [] as unknown as T
    }
    return result as T
  }
}

// Module-level client cache so manifests are only fetched once per session
const clientCache = new Map<string, ClientAddonClient>()

/**
 * Returns a cached ClientAddonClient for the given manifest URL,
 * creating and initializing one if it doesn't exist yet.
 */
export function getAddonClient(manifestUrl: string): ClientAddonClient {
  const existing = clientCache.get(manifestUrl)
  if (existing) return existing
  const client = new ClientAddonClient(manifestUrl)
  clientCache.set(manifestUrl, client)
  return client
}
