import { Manifest, MetaPreview, MetaDetail, Stream, Subtitle, AddonResponse } from './types'

export class AddonClient {
  private baseUrl: string
  public manifestUrl: string
  public manifest: Manifest | null = null

  constructor(url: string) {
    // Ensure URL ends with manifest.json or is the base URL
    if (url.endsWith('manifest.json')) {
      this.baseUrl = url.replace('/manifest.json', '')
      this.manifestUrl = url
    } else {
      this.baseUrl = url.replace(/\/$/, '')
      this.manifestUrl = `${this.baseUrl}/manifest.json`
    }
  }

  async init(): Promise<Manifest> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000) // 5s timeout for manifest
      
      const res = await fetch(`${this.baseUrl}/manifest.json`, { signal: controller.signal })
      clearTimeout(timeout)
      
      if (!res.ok) throw new Error(`Failed to fetch manifest: ${res.statusText}`)
      this.manifest = await res.json()
      return this.manifest!
    } catch (e) {
      console.error(`[AddonClient] Failed to init ${this.baseUrl}`, e)
      throw e
    }
  }

  async getCatalog(type: string, id: string, extra: Record<string, string> = {}, config: Record<string, any> = {}): Promise<MetaPreview[]> {
    if (!this.manifest) await this.init()
    
    // Construct extra path components (e.g. genre=Action&skip=20 -> genre=Action/skip=20)
    // Stremio protocol: /catalog/{type}/{id}/{extraArgs}.json
    // extraArgs are key=value pairs separated by /
    
    let extraPath = ''
    const entries = Object.entries(extra)
    if (entries.length > 0) {
      extraPath = '/' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('/')
    }

    const url = `${this.baseUrl}/catalog/${type}/${id}${extraPath}.json`
    return this.fetchResource<MetaPreview[]>(url, 'metas')
  }

  async getMeta(type: string, id: string, config: Record<string, any> = {}): Promise<MetaDetail> {
    if (!this.manifest) await this.init()
    const url = `${this.baseUrl}/meta/${type}/${id}.json`
    return this.fetchResource<MetaDetail>(url, 'meta')
  }

  async getStreams(type: string, id: string): Promise<Stream[]> {
    if (!this.manifest) await this.init()
    const url = `${this.baseUrl}/stream/${type}/${id}.json`
    return this.fetchResource<Stream[]>(url, 'streams')
  }

  async getSubtitles(type: string, id: string, videoHash?: string): Promise<Subtitle[]> {
    if (!this.manifest) await this.init()
    // Subtitles resource path: /subtitles/{type}/{id}/{videoHash}.json
    // videoHash is optional but often used for OpenSubtitles
    const hashPart = videoHash ? `/${videoHash}` : ''
    const url = `${this.baseUrl}/subtitles/${type}/${id}${hashPart}.json`
    return this.fetchResource<Subtitle[]>(url, 'subtitles')
  }

  private async fetchResource<T>(url: string, extractKey: keyof AddonResponse<any>): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`)
      
      const data = await res.json() as AddonResponse<any>
      
      if (data.err) {
        throw new Error(`Addon error: ${data.err}`)
      }

      if (data[extractKey]) {
        return data[extractKey] as T
      }
      
      // Fallback or empty
      if (Array.isArray(data[extractKey])) return [] as unknown as T
      throw new Error(`Response missing key: ${String(extractKey)}`)

    } catch (e) {
      // console.error(`[AddonClient] Error fetching ${url}`, e)
      throw e
    } finally {
      clearTimeout(timeout)
    }
  }
}