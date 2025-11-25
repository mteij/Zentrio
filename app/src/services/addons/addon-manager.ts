import { AddonClient } from './client'
import { Manifest, MetaPreview, MetaDetail, Stream, Subtitle } from './types'
import { addonDb } from '../database'

const DEFAULT_TMDB_ADDON = 'https://v3-cinemeta.strem.io/manifest.json'

export class AddonManager {
  private clientCache = new Map<string, AddonClient>()

  constructor() {
    // Ensure default addon exists in DB
    try {
      const existing = addonDb.findByUrl(DEFAULT_TMDB_ADDON)
      if (!existing) {
        addonDb.create({
          manifest_url: DEFAULT_TMDB_ADDON,
          name: 'TMDB',
          description: 'The Movie Database Addon',
          version: '1.0.0',
          logo_url: 'https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_2-d537fb228cf3ded90420192a96da33a9f244fc962a07410a121121f3b7b2ed52.svg'
        })
      }
    } catch (e) {
      console.warn('Failed to init default addon', e)
    }
  }

  private async getClientsForProfile(profileId: number): Promise<AddonClient[]> {
    const addons = addonDb.getEnabledForProfile(profileId)
    console.log(`[AddonManager] Found ${addons.length} enabled addons for profile ${profileId}:`, addons.map(a => a.name))
    
    // If no addons enabled, enable default for this profile automatically?
    // Or just return empty? Let's auto-enable default if list is empty to avoid empty state.
    if (addons.length === 0) {
      const defaultAddon = addonDb.findByUrl(DEFAULT_TMDB_ADDON)
      if (defaultAddon) {
        addonDb.enableForProfile(profileId, defaultAddon.id)
        addons.push(defaultAddon)
      }
    }

    const clients: AddonClient[] = []
    for (const addon of addons) {
      let client = this.clientCache.get(addon.manifest_url)
      if (!client) {
        client = new AddonClient(addon.manifest_url)
        this.clientCache.set(addon.manifest_url, client)
      }
      clients.push(client)
    }
    
    await Promise.all(clients.map(c => c.init().catch(e => console.warn(`Failed to init ${c.manifest?.name}`, e))))
    console.log(`[AddonManager] Initialized ${clients.length} clients`)
    return clients
  }

  async getCatalogs(profileId: number): Promise<{ addon: Manifest, catalog: any, items: MetaPreview[] }[]> {
    const clients = await this.getClientsForProfile(profileId)
    const results: { addon: Manifest, catalog: any, items: MetaPreview[] }[] = []

    for (const client of clients) {
      if (!client.manifest) continue
      for (const cat of client.manifest.catalogs) {
        try {
          // Only fetch if it doesn't require extra args or has defaults?
          // For now, just fetch basic catalogs
          if (cat.extra?.some(e => e.isRequired)) continue
          
          const items = await client.getCatalog(cat.type, cat.id)
          results.push({
            addon: client.manifest,
            catalog: cat,
            items
          })
        } catch (e) {
          console.warn(`Failed to fetch catalog ${cat.id} from ${client.manifest.name}`, e)
        }
      }
    }
    return results
  }

  async getMeta(type: string, id: string, profileId: number): Promise<MetaDetail | null> {
    const clients = await this.getClientsForProfile(profileId)
    
    for (const client of clients) {
      if (!client.manifest) continue
      if (!client.manifest.resources.includes('meta')) continue
      if (!client.manifest.types.includes(type)) continue
      
      // Check ID prefixes if available
      if (client.manifest.idPrefixes && !client.manifest.idPrefixes.some(p => id.startsWith(p))) continue

      try {
        const meta = await client.getMeta(type, id)
        if (meta) return meta
      } catch (e) {
        // ignore
      }
    }
    return null
  }

  async search(query: string, profileId: number): Promise<MetaPreview[]> {
    const clients = await this.getClientsForProfile(profileId)
    const results: MetaPreview[] = []
    
    for (const client of clients) {
      if (!client.manifest) continue
      for (const cat of client.manifest.catalogs) {
        // Check if catalog supports search
        const searchExtra = cat.extra?.find(e => e.name === 'search')
        if (searchExtra) {
          try {
            const items = await client.getCatalog(cat.type, cat.id, { search: query })
            results.push(...items)
          } catch (e) {
            console.warn(`Search failed for ${client.manifest.name}`, e)
          }
        }
      }
    }
    return results
  }

  async getCatalogItems(profileId: number, manifestUrl: string, type: string, id: string): Promise<{ title: string, items: MetaPreview[] } | null> {
    // Ensure clients are initialized for this profile
    await this.getClientsForProfile(profileId)
    
    const client = this.clientCache.get(manifestUrl)
    if (!client || !client.manifest) return null

    const catalog = client.manifest.catalogs.find(c => c.type === type && c.id === id)
    if (!catalog) return null

    try {
      const items = await client.getCatalog(type, id)
      return {
        title: `${client.manifest.name} - ${catalog.name || catalog.type}`,
        items
      }
    } catch (e) {
      console.error(`Failed to fetch catalog ${id} from ${manifestUrl}`, e)
      return null
    }
  }

  async getStreams(type: string, id: string, profileId: number): Promise<{ addon: Manifest, streams: Stream[] }[]> {
    const clients = await this.getClientsForProfile(profileId)
    const results: { addon: Manifest, streams: Stream[] }[] = []

    const promises = clients.map(async (client) => {
      if (!client.manifest) return
      
      // Check if addon supports streams for this type
      const supportsStreams = client.manifest.resources.some(r => {
        if (typeof r === 'string') return r === 'stream'
        // @ts-ignore
        return r.name === 'stream' && (r.types?.includes(type) || client.manifest?.types.includes(type))
      })

      if (!supportsStreams) return
      
      // Check ID prefixes if defined
      if (client.manifest.idPrefixes && client.manifest.idPrefixes.length > 0) {
        if (!client.manifest.idPrefixes.some(p => id.startsWith(p))) return
      }

      try {
        console.log(`Requesting streams from ${client.manifest.name} for ${type}/${id}`)
        const streams = await client.getStreams(type, id)
        console.log(`Received ${streams ? streams.length : 0} streams from ${client.manifest.name}`)
        if (streams && streams.length > 0) {
          results.push({ addon: client.manifest, streams })
        }
      } catch (e) {
        console.warn(`Failed to fetch streams from ${client.manifest.name}`, e)
      }
    })

    await Promise.all(promises)
    return results
  }
}

export const addonManager = new AddonManager()