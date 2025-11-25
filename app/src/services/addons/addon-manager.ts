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

  async getTrending(profileId: number): Promise<MetaPreview | null> {
    const { TMDB_API_KEY } = getConfig()

    // 1. Try direct TMDB API if key is present (Most accurate "Trending Today")
    if (TMDB_API_KEY) {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/trending/all/day?api_key=${TMDB_API_KEY}`)
        if (res.ok) {
          const data = await res.json()
          const first = data.results?.[0]
          if (first) {
            const type = first.media_type === 'tv' ? 'series' : 'movie' // Stremio uses 'series' instead of 'tv'
            let id = first.id.toString()
            
            // Try to get IMDB ID for better compatibility with Stremio addons
            try {
              const extRes = await fetch(`https://api.themoviedb.org/3/${first.media_type}/${first.id}/external_ids?api_key=${TMDB_API_KEY}`)
              if (extRes.ok) {
                const extData = await extRes.json()
                if (extData.imdb_id) {
                  id = extData.imdb_id
                }
              }
            } catch (e) {
              // ignore external id fetch error, fallback to TMDB ID (might need prefixing for some addons)
            }

            return {
              id,
              type,
              name: first.title || first.name,
              description: first.overview,
              poster: first.poster_path ? `https://image.tmdb.org/t/p/w500${first.poster_path}` : undefined,
              background: first.backdrop_path ? `https://image.tmdb.org/t/p/original${first.backdrop_path}` : undefined,
              released: first.release_date || first.first_air_date,
              imdbRating: first.vote_average ? first.vote_average.toFixed(1) : undefined
            }
          }
        }
      } catch (e) {
        console.error('Failed to fetch trending from TMDB API', e)
      }
    } else {
      // 1b. Fallback to scraping TMDB trending page if no API key (as requested)
      try {
        const res = await fetch('https://www.themoviedb.org/remote/panel?panel=trending_scroller&group=today')
        if (res.ok) {
          const html = await res.text()
          // Extract first item data using regex
          // <div class="options" data-id="701387" data-object-id="..." data-media-type="movie">
          const match = html.match(/data-id="(\d+)"[^>]*data-media-type="(movie|tv)"/)
          if (match) {
            const tmdbId = match[1]
            const mediaType = match[2]
            const type = mediaType === 'tv' ? 'series' : 'movie'
            
            // We need more details (title, poster, backdrop) which are hard to reliably regex from the partial HTML
            // So we'll try to use the public API without key if possible, or just use the ID to fetch from our addons
            
            // Strategy: Use the ID found on the trending page to fetch details from our configured addons
            const clients = await this.getClientsForProfile(profileId)
            for (const client of clients) {
              if (!client.manifest) continue
              // Try to fetch meta from addon using TMDB ID (some support it directly or via prefix)
              // Most Stremio addons use IMDB ID, but Cinemeta supports TMDB IDs often
              try {
                // Try fetching with tmdb prefix which is common convention
                const meta = await client.getMeta(type, `tmdb:${tmdbId}`)
                if (meta) return meta
                
                // Try raw ID
                const metaRaw = await client.getMeta(type, tmdbId)
                if (metaRaw) return metaRaw
              } catch (e) {
                // ignore
              }
            }

            // If addons failed to resolve the item, try to extract basic info from the HTML directly
            // <a class="image" href="/movie/701387-bugonia" title="Bugonia">
            // <img ... src="https://media.themoviedb.org/t/p/w220_and_h330_face/..." ...>
            const titleMatch = html.match(/class="image" href="\/[^"]+" title="([^"]+)"/)
            const posterMatch = html.match(/src="(https:\/\/media\.themoviedb\.org\/t\/p\/[^"]+)"/)
            
            if (titleMatch) {
              return {
                id: `tmdb:${tmdbId}`,
                type,
                name: titleMatch[1],
                poster: posterMatch ? posterMatch[1].replace('w220_and_h330_face', 'original') : undefined,
                description: 'Trending on TMDB today',
                background: posterMatch ? posterMatch[1].replace('w220_and_h330_face', 'original') : undefined
              }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to scrape trending from TMDB', e)
      }
    }

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
            return items[0]
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
            return items[0]
          }
        }
      } catch (e) {
        // ignore
      }
    }
    
    return null
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

  async getStreams(type: string, id: string, profileId: number, season?: number, episode?: number): Promise<{ addon: Manifest, streams: Stream[] }[]> {
    const clients = await this.getClientsForProfile(profileId)
    const results: { addon: Manifest, streams: Stream[] }[] = []

    const videoId = (type === 'series' && season && episode) ? `${id}:${season}:${episode}` : id

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