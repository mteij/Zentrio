import { AddonClient } from './client'
import { Manifest, MetaPreview, MetaDetail, Stream, Subtitle } from './types'
import { addonDb, streamDb } from '../database'
import { getConfig } from '../envParser'

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
    const initPromises: Promise<any>[] = []

    for (const addon of addons) {
      let client = this.clientCache.get(addon.manifest_url)
      if (!client) {
        client = new AddonClient(addon.manifest_url)
        this.clientCache.set(addon.manifest_url, client)
        // Only init if new or not ready
        initPromises.push(client.init().catch(e => console.warn(`Failed to init ${addon.name}`, e)))
      } else if (!client.manifest) {
         // Retry init if failed previously or incomplete
         initPromises.push(client.init().catch(e => console.warn(`Failed to re-init ${addon.name}`, e)))
      }
      clients.push(client)
    }
    
    // Wait for all inits to complete or fail, but don't block if some fail
    // Actually, we should probably race them or just wait for critical ones?
    // For now, let's just wait for all, but with a timeout?
    // The client.init() already has a timeout.
    if (initPromises.length > 0) {
        await Promise.allSettled(initPromises)
    }
    
    // console.log(`[AddonManager] Initialized ${clients.length} clients`)
    return clients
  }

  async getCatalogs(profileId: number): Promise<{ addon: Manifest, manifestUrl: string, catalog: any, items: MetaPreview[] }[]> {
    const clients = await this.getClientsForProfile(profileId)
    const results: { addon: Manifest, manifestUrl: string, catalog: any, items: MetaPreview[] }[] = []

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
            manifestUrl: client.manifestUrl,
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

  async getTrending(profileId: number): Promise<MetaPreview[]> {
    const clients = await this.getClientsForProfile(profileId)
    
    // 2. Try to find TMDB addon (Cinemeta)
    const tmdbClient = clients.find(c => c.manifest?.id?.includes('tmdb') || c.manifest?.name?.toLowerCase().includes('tmdb'))
    
    if (tmdbClient) {
      try {
        // Usually the first catalog is the most popular/trending one
        const cat = tmdbClient.manifest?.catalogs[0]
        if (cat) {
          const items = await tmdbClient.getCatalog(cat.type, cat.id)
          if (items && items.length > 0) {
            return items.slice(0, 10)
          }
        }
      } catch (e) {
        console.warn('Failed to fetch trending from TMDB addon', e)
      }
    }

    // 3. Fallback to any client
    for (const client of clients) {
      if (!client.manifest) continue
      try {
        const cat = client.manifest.catalogs[0]
        if (cat) {
          const items = await client.getCatalog(cat.type, cat.id)
          if (items && items.length > 0) {
            return items.slice(0, 10)
          }
        }
      } catch (e) {
        // ignore
      }
    }
    
    return []
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

    // Prioritize TMDB addon for search
    const tmdbClient = clients.find(c => c.manifest?.id?.includes('tmdb') || c.manifest?.name?.toLowerCase().includes('tmdb') || c.manifestUrl === DEFAULT_TMDB_ADDON)

    if (tmdbClient && tmdbClient.manifest) {
      for (const cat of tmdbClient.manifest.catalogs) {
        const searchExtra = cat.extra?.find(e => e.name === 'search')
        if (searchExtra) {
          try {
            console.log(`[AddonManager] Searching TMDB catalog "${cat.id}" for "${query}"`)
            const items = await tmdbClient.getCatalog(cat.type, cat.id, { search: query })
            results.push(...items)
          } catch (e) {
            console.warn(`TMDB search failed for catalog ${cat.id}`, e)
          }
        }
      }
      // If we got results from TMDB, return them directly
      if (results.length > 0) {
        // Simple deduplication based on ID
        const uniqueResults = Array.from(new Map(results.map(item => [item.id, item])).values());
        return uniqueResults;
      }
    }

    // Fallback to searching all other addons if TMDB fails or isn't present
    console.log('[AddonManager] TMDB search yielded no results or TMDB addon not found. Falling back to all addons.')
    for (const client of clients) {
      // Skip the TMDB client if we already tried it
      if (client === tmdbClient) continue;

      if (!client.manifest) continue
      for (const cat of client.manifest.catalogs) {
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
    
    // Deduplicate final results from all sources
    const uniqueResults = Array.from(new Map(results.map(item => [item.id, item])).values());
    return uniqueResults;
  }

  async getCatalogItems(profileId: number, manifestUrl: string, type: string, id: string, skip?: number): Promise<{ title: string, items: MetaPreview[] } | null> {
    // Ensure clients are initialized for this profile
    await this.getClientsForProfile(profileId)
    
    const client = this.clientCache.get(manifestUrl)
    if (!client || !client.manifest) return null

    const catalog = client.manifest.catalogs.find(c => c.type === type && c.id === id)
    if (!catalog) return null

    try {
      const extra: Record<string, string> = {}
      if (skip) extra.skip = skip.toString()
      
      const items = await client.getCatalog(type, id, extra)
      return {
        title: `${client.manifest.name} - ${catalog.name || catalog.type}`,
        items
      }
    } catch (e) {
      console.error(`Failed to fetch catalog ${id} from ${manifestUrl}`, e)
      return null
    }
  }

  async getAvailableFilters(profileId: number): Promise<{ types: string[], genres: string[] }> {
    const clients = await this.getClientsForProfile(profileId)
    const types = new Set<string>()
    const genres = new Set<string>()

    for (const client of clients) {
      if (!client.manifest) continue
      
      // Collect types
      if (client.manifest.types) {
        client.manifest.types.forEach(t => types.add(t))
      }

      // Collect genres from catalogs
      for (const cat of client.manifest.catalogs) {
        if (cat.extra) {
          const genreExtra = cat.extra.find(e => e.name === 'genre')
          if (genreExtra && genreExtra.options) {
            genreExtra.options.forEach(g => {
              // Filter out years (4 digits)
              if (!/^\d{4}$/.test(g)) {
                genres.add(g)
              }
            })
          }
        }
      }
    }

    return {
      types: Array.from(types),
      genres: Array.from(genres).sort()
    }
  }

  async getFilteredItems(profileId: number, type: string, genre?: string, skip?: number): Promise<MetaPreview[]> {
    const clients = await this.getClientsForProfile(profileId)
    const results: MetaPreview[] = []

    for (const client of clients) {
      if (!client.manifest) continue
      
      // Find a catalog that supports this type and (optionally) genre
      const catalog = client.manifest.catalogs.find(c => {
        if (c.type !== type) return false
        if (genre) {
          return c.extra?.some(e => e.name === 'genre' && (!e.options || e.options.includes(genre)))
        }
        return true
      })

      if (catalog) {
        try {
          const extra: Record<string, string> = {}
          if (genre) extra.genre = genre
          if (skip) extra.skip = skip.toString()
          
          const items = await client.getCatalog(catalog.type, catalog.id, extra)
          results.push(...items)
        } catch (e) {
          console.warn(`Failed to fetch filtered items from ${client.manifest.name}`, e)
        }
      }
    }
    
    return results
  }

  async getStreams(type: string, id: string, profileId: number, season?: number, episode?: number): Promise<{ addon: Manifest, streams: Stream[] }[]> {
    const clients = await this.getClientsForProfile(profileId)
    const results: { addon: Manifest, streams: Stream[] }[] = []

    // For series, we generally need season and episode.
    // If they are missing, we might be requesting the whole series which some addons don't support and return 500.
    if (type === 'series' && (season === undefined || episode === undefined)) {
      console.warn(`[AddonManager] Skipping stream fetch for series ${id} without season/episode`)
      return []
    }

    const videoId = (type === 'series' && season !== undefined && episode !== undefined) ? `${id}:${season}:${episode}` : id

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
        console.log(`Requesting streams from ${client.manifest.name} for ${type}/${videoId}`)
        const streams = await client.getStreams(type, videoId)
        console.log(`Received ${streams ? streams.length : 0} streams from ${client.manifest.name}`)
        if (streams && streams.length > 0) {
          results.push({ addon: client.manifest, streams })
        }
      } catch (e) {
        console.warn(`Failed to fetch streams from ${client.manifest.name}`, e)
      }
    })

    await Promise.all(promises)

    const settings = streamDb.getSettings(profileId);
    if (!settings) return results;

    results.forEach(result => {
      result.streams.sort((a, b) => {
        const aTitle = a.title || a.name || '';
        const bTitle = b.title || b.name || '';

        // Quality scoring
        const aQualityIndex = settings.qualities.findIndex(q => aTitle.toLowerCase().includes(q.toLowerCase()));
        const bQualityIndex = settings.qualities.findIndex(q => bTitle.toLowerCase().includes(q.toLowerCase()));
        const aQualityScore = aQualityIndex === -1 ? settings.qualities.length : aQualityIndex;
        const bQualityScore = bQualityIndex === -1 ? settings.qualities.length : bQualityIndex;
        if (aQualityScore !== bQualityScore) return aQualityScore - bQualityScore;

        // Preferred keywords scoring
        const aPreferredScore = settings.preferredKeywords.filter(k => aTitle.toLowerCase().includes(k.toLowerCase())).length;
        const bPreferredScore = settings.preferredKeywords.filter(k => bTitle.toLowerCase().includes(k.toLowerCase())).length;
        if (aPreferredScore !== bPreferredScore) return bPreferredScore - aPreferredScore;

        // Required keywords filtering
        const aRequiredScore = settings.requiredKeywords.filter(k => aTitle.toLowerCase().includes(k.toLowerCase())).length;
        const bRequiredScore = settings.requiredKeywords.filter(k => bTitle.toLowerCase().includes(k.toLowerCase())).length;
        if (aRequiredScore !== bRequiredScore) return bRequiredScore - aRequiredScore;

        return 0;
      });
    });

    return results;
  }
}

export const addonManager = new AddonManager()