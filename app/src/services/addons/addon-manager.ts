import { AddonClient, RetryableError } from './client'
import { ZentrioAddonClient } from './zentrio-client'
import { Manifest, MetaPreview, MetaDetail, Stream, Subtitle } from './types'
import { addonDb, streamDb, profileDb } from '../database'
import { getConfig } from '../envParser'
import { StreamProcessor, ParsedStream } from './stream-processor'
import { tmdbService } from '../tmdb/index'
import { type AgeRating } from '../tmdb/age-ratings'
// Extracted helper modules
import { getParentalSettings, filterContent, enrichContent, idResolutionCache } from './content-filter'
import { normalizeMetaVideos } from './meta-normalizer'

const DEFAULT_TMDB_ADDON = 'zentrio://tmdb-addon'

export class AddonManager {
  private clientCache = new Map<string, AddonClient>()
  private tmdbToImdbCache = new Map<string, string>() // Cache for TMDB -> IMDB ID resolution

  private normalizeUrl(url: string): string {
    if (url.endsWith('manifest.json')) {
      return url
    }
    return `${url.replace(/\/$/, '')}/manifest.json`
  }

  constructor() {
    // Ensure default addon exists in DB
    try {
      const existing = addonDb.findByUrl(DEFAULT_TMDB_ADDON)
      if (!existing) {
        addonDb.create({
          manifest_url: DEFAULT_TMDB_ADDON,
          name: 'Zentrio',
          description: 'Native TMDB integration for Zentrio',
          version: '1.0.0',
          logo_url: 'https://zentrio.eu/static/logo/icon-192.png',
          behavior_hints: JSON.stringify({ configurationRequired: true })
        })
      }
    } catch (e) {
      console.warn('Failed to init default addon', e)
    }
  }

  /**
   * Check if a manifest supports a specific resource (meta, stream, etc.) for a given type.
   * Resources can be strings or objects per Stremio protocol.
   */
  private supportsResource(manifest: Manifest, resourceName: string, contentType: string): boolean {
    for (const resource of manifest.resources) {
      if (typeof resource === 'string') {
        // Simple string resource - check against manifest.types
        if (resource === resourceName && manifest.types.includes(contentType)) {
          return true
        }
      } else if (resource && typeof resource === 'object') {
        // Object resource with its own types
        const r = resource as { name: string; types?: string[]; idPrefixes?: string[] }
        if (r.name === resourceName) {
          // Check if this resource supports the content type
          const resourceTypes = r.types || manifest.types
          if (resourceTypes.includes(contentType)) {
            return true
          }
        }
      }
    }
    return false
  }

  /**
   * Get the idPrefixes for a specific resource from a manifest.
   * Returns the resource-level idPrefixes if defined, otherwise manifest-level, or empty array if none.
   * Per Stremio protocol: if idPrefixes is not defined, addon handles ALL IDs.
   */
  private getResourceIdPrefixes(manifest: Manifest, resourceName: string): string[] | null {
    // First check if there's a resource-level idPrefixes
    for (const resource of manifest.resources) {
      if (typeof resource === 'object' && resource !== null) {
        const r = resource as { name: string; types?: string[]; idPrefixes?: string[] }
        if (r.name === resourceName) {
          // If resource is an object, check its idPrefixes
          if (r.idPrefixes && r.idPrefixes.length > 0) {
            return r.idPrefixes
          }
          // If resource is an object without idPrefixes, it handles ALL IDs
          return null
        }
      }
    }
    // Resource is a string - fall back to manifest-level idPrefixes
    return manifest.idPrefixes && manifest.idPrefixes.length > 0 ? manifest.idPrefixes : null
  }

  /**
   * Check if an addon can handle a specific ID for a resource.
   * Returns true if idPrefixes is not defined (handles all) or if ID matches a prefix.
   */
  private canHandleId(manifest: Manifest, resourceName: string, id: string): boolean {
    const prefixes = this.getResourceIdPrefixes(manifest, resourceName)
    // If no prefixes defined, addon handles ALL IDs
    if (prefixes === null) {
      return true
    }
    // Check if ID matches any prefix
    const primaryId = id.includes(',') ? id.split(',')[0] : id
    return prefixes.some(p => primaryId.startsWith(p))
  }

  private async getClientsForProfile(profileId: number): Promise<AddonClient[]> {
    // Resolve settings profile ID
    const settingsProfileId = profileDb.getSettingsProfileId(profileId);
    if (!settingsProfileId) {
        console.warn(`[AddonManager] No settings profile found for profile ${profileId}`);
        return [];
    }

    const addons = addonDb.getEnabledForProfile(settingsProfileId)
    // console.log(`[AddonManager] Found ${addons.length} enabled addons for profile ${profileId} (settings: ${settingsProfileId}):`, addons.map(a => a.name))
    
    // If no addons enabled, auto-enable the default Zentrio addon
    // (global TMDB key is always available)
    if (addons.length === 0) {
      const defaultAddon = addonDb.findByUrl(DEFAULT_TMDB_ADDON)
      if (defaultAddon) {
        addonDb.enableForProfile(settingsProfileId, defaultAddon.id)
        addons.push(defaultAddon)
      }
    }

    const clients: AddonClient[] = []
    const initPromises: Promise<any>[] = []

    const profile = profileDb.findById(profileId)
    const userId = profile?.user_id

    for (const addon of addons) {

      const normalizedUrl = this.normalizeUrl(addon.manifest_url)
      let client = this.clientCache.get(normalizedUrl)
      if (!client) {
        if (addon.manifest_url === DEFAULT_TMDB_ADDON) {
            client = new ZentrioAddonClient(addon.manifest_url, userId)
        } else {
            client = new AddonClient(addon.manifest_url)
        }
        this.clientCache.set(normalizedUrl, client)
        // Only init if new or not ready
        initPromises.push(client.init().then(() => {}).catch(e => console.warn(`Failed to init ${addon.name}`, e)))
      } else if (!client.manifest) {
         // Retry init if failed previously or incomplete
         initPromises.push(client.init().then(() => {}).catch(e => console.warn(`Failed to re-init ${addon.name}`, e)))
      }
      clients.push(client)
    }
    
    // Wait for all inits to complete or fail, but don't block if some fail
    if (initPromises.length > 0) {
        await Promise.allSettled(initPromises)
    }
    
    return clients
  }

  private async resolveTmdbToImdb(tmdbId: string, type: string, profileId: number): Promise<string | null> {
      // Check cache
      const cached = this.tmdbToImdbCache.get(tmdbId)
      if (cached) return cached

      try {
          const profile = profileDb.findById(profileId)
          const tmdbClient = await tmdbService.getClient(profile?.user_id)
          
          let imdbId: string | null = null
          
          if (type === 'movie') {
              const res = await tmdbClient.getMovieInfo(tmdbId, 'en-US')
              if (res.external_ids?.imdb_id) imdbId = res.external_ids.imdb_id
          } else if (type === 'series') {
              const res = await tmdbClient.getTvInfo(tmdbId, 'en-US')
              if (res.external_ids?.imdb_id) imdbId = res.external_ids.imdb_id
          }
          
          if (imdbId) {
              this.tmdbToImdbCache.set(tmdbId, imdbId)
              return imdbId
          }
      } catch (e) {
          console.warn(`[AddonManager] Failed to resolve TMDB ID ${tmdbId} to IMDB`, e)
      }
      return null
  }

  async getCatalogs(profileId: number): Promise<{ addon: Manifest, manifestUrl: string, catalog: any, items: MetaPreview[] }[]> {
    const clients = await this.getClientsForProfile(profileId)
    const results: { addon: Manifest, manifestUrl: string, catalog: any, items: MetaPreview[] }[] = []
    const profile = profileDb.findById(profileId)

    const fetchCatalog = async (client: AddonClient, cat: any) => {
        try {
            if (cat.extra?.some((e: any) => e.isRequired)) return null

            const settingsProfileId = profileDb.getSettingsProfileId(profileId);
            const { appearanceDb } = require('../database');
            const appearance = settingsProfileId ? appearanceDb.getSettings(settingsProfileId) : undefined;
            const config = {
                enableAgeRating: appearance ? appearance.show_age_ratings : true,
                showAgeRatingInGenres: appearance ? appearance.show_age_ratings : true
            };

            const items = await client.getCatalog(cat.type, cat.id, {}, config)
            const parentalSettings = this.getParentalSettings(profileId);
            let filteredItems = await this.filterContent(items, parentalSettings, profile?.user_id);

            // Row filling logic: if not enough items, fetch more
            if (parentalSettings.enabled && filteredItems.length < 20 && items.length > 0) {
                let currentSkip = items.length; // Start skipping what we just fetched
                let attempts = 0;
                const maxAttempts = 3; // Prevent infinite loops

                while (filteredItems.length < 20 && attempts < maxAttempts) {
                    try {
                        // Some addons rely on 'skip', others might ignore it. 
                        // For standard Stremio addons, skip should work.
                        const nextItems = await client.getCatalog(cat.type, cat.id, { skip: currentSkip.toString() }, config);
                        if (!nextItems || nextItems.length === 0) break;

                        const nextFiltered = await this.filterContent(nextItems, parentalSettings, profile?.user_id);
                        filteredItems = [...filteredItems, ...nextFiltered];
                        currentSkip += nextItems.length;
                        attempts++;

                        // Safety break if we aren't getting anything new (infinite loop of same items?)
                        // Standard addons shouldn't return same items for different skip, but who knows.
                    } catch (e) {
                        break; // Stop on error
                    }
                }
            }

            return {
                addon: client.manifest!,
                manifestUrl: client.manifestUrl,
                catalog: cat,
                items: filteredItems
            }
        } catch (e) {
            console.warn(`Failed to fetch catalog ${cat.id} from ${client.manifest!.name}`, e)
            return null
        }
    }
    
    // Parallelize catalog fetching across all clients and catalogs
    const promises: Promise<any>[] = []
    
    for (const client of clients) {
        if (!client.manifest) continue
        for (const cat of client.manifest.catalogs) {
             const p = fetchCatalog(client, cat);
             promises.push(p);
        }
    }
    
    const fetchedResults = await Promise.all(promises);
    
    // Filter out nulls
    fetchedResults.forEach(r => {
        if (r) results.push(r);
    });

    // Sort results to prioritize Zentrio (TMDB) addon
    results.sort((a, b) => {
        const isZentrioA = a.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON) || a.addon.id === 'org.zentrio.tmdb';
        const isZentrioB = b.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON) || b.addon.id === 'org.zentrio.tmdb';
        if (isZentrioA && !isZentrioB) return -1;
        if (!isZentrioA && isZentrioB) return 1;
        return 0;
    });

    // If no catalogs are found after checking all enabled addons, fallback to Zentrio addon
    // (global TMDB key is always available, so this should always work)
    if (results.length === 0) {
      console.log(`[AddonManager] No catalogs found. Falling back to default TMDB addon.`);
      const normalizedDefaultUrl = this.normalizeUrl(DEFAULT_TMDB_ADDON);
      let defaultClient = this.clientCache.get(normalizedDefaultUrl);
      if (!defaultClient) {
        defaultClient = new ZentrioAddonClient(DEFAULT_TMDB_ADDON, profile?.user_id);
        this.clientCache.set(normalizedDefaultUrl, defaultClient);
      }
      
      try {
        await defaultClient.init();
        if (defaultClient.manifest) {
          for (const cat of defaultClient.manifest.catalogs) {
            if (cat.extra?.some(e => e.isRequired)) continue;
            
            const settingsProfileId = profileDb.getSettingsProfileId(profileId);
            const { appearanceDb } = require('../database');
            const appearance = settingsProfileId ? appearanceDb.getSettings(settingsProfileId) : undefined;
            const config = {
                enableAgeRating: appearance ? appearance.show_age_ratings : true,
                showAgeRatingInGenres: appearance ? appearance.show_age_ratings : true
            };

            const items = await defaultClient.getCatalog(cat.type, cat.id, {}, config);
            const parentalSettings = this.getParentalSettings(profileId);
            let filteredItems = await this.filterContent(items, parentalSettings, profile?.user_id);
            
            // Row filling logic
            if (parentalSettings.enabled && filteredItems.length < 20 && items.length > 0) {
               let currentSkip = items.length;
               let attempts = 0;
               const maxAttempts = 3;
               while (filteredItems.length < 20 && attempts < maxAttempts) {
                   try {
                       const nextItems = await defaultClient.getCatalog(cat.type, cat.id, { skip: currentSkip.toString() }, config);
                       if (!nextItems || nextItems.length === 0) break;
                       const nextFiltered = await this.filterContent(nextItems, parentalSettings, profile?.user_id);
                       filteredItems = [...filteredItems, ...nextFiltered];
                       currentSkip += nextItems.length;
                       attempts++;
                   } catch (e) { break; }
               }
            }

            results.push({
              addon: defaultClient.manifest,
              manifestUrl: defaultClient.manifestUrl,
              catalog: cat,
              items: filteredItems
            });
          }
        }
      } catch (e) {
        console.error('Failed to fetch catalogs from default TMDB addon fallback.', e);
      }
    }

    return results
  }

  async getTrending(profileId: number): Promise<MetaPreview[]> {
    const clients = await this.getClientsForProfile(profileId)
    const settingsProfileId = profileDb.getSettingsProfileId(profileId);
    
    // Use User Profile settings for content filtering
    const parentalSettings = this.getParentalSettings(profileId);
    const profile = profileDb.findById(profileId);
    
    // 2. Try to find TMDB addon (Zentrio)
    const tmdbClient = clients.find(c => c.manifest?.id?.includes('tmdb') || c.manifest?.name?.toLowerCase().includes('tmdb') || c.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON))
    
    if (tmdbClient) {
      try {
        const { appearanceDb } = require('../database');
        const appearance = settingsProfileId ? appearanceDb.getSettings(settingsProfileId) : undefined;
        const config = {
            enableAgeRating: appearance ? appearance.show_age_ratings : true,
            showAgeRatingInGenres: appearance ? appearance.show_age_ratings : true
        };

        // Try to get both trending movies and series
        // We look for 'tmdb.trending' catalog ID, or 'tmdb.top' as fallback
        const trendingMovieCat = tmdbClient.manifest?.catalogs.find(c => c.type === 'movie' && (c.id === 'tmdb.trending' || c.id === 'tmdb.top'));
        const trendingSeriesCat = tmdbClient.manifest?.catalogs.find(c => c.type === 'series' && (c.id === 'tmdb.trending' || c.id === 'tmdb.top'));

        const promises: Promise<MetaPreview[]>[] = [];
        
        if (trendingMovieCat) {
             promises.push(tmdbClient.getCatalog(trendingMovieCat.type, trendingMovieCat.id, {}, config)
                .then(items => this.filterContent(items, parentalSettings, profile?.user_id)));
        } else {
            promises.push(Promise.resolve([]));
        }

        if (trendingSeriesCat) {
             promises.push(tmdbClient.getCatalog(trendingSeriesCat.type, trendingSeriesCat.id, {}, config)
                .then(items => this.filterContent(items, parentalSettings, profile?.user_id)));
        } else {
            promises.push(Promise.resolve([]));
        }

        const [movies, series] = await Promise.all(promises);
        
        // Interleave valid results
        const combined: MetaPreview[] = [];
        const maxLen = Math.max(movies.length, series.length);
        
        for (let i = 0; i < maxLen; i++) {
            if (i < movies.length) combined.push(movies[i]);
            if (i < series.length) combined.push(series[i]);
        }
        
        if (combined.length > 0) {
            // Row filling logic: if not enough items after filtering, fetch more
            if (parentalSettings.enabled && combined.length < 10) {
                let currentSkip = 20; // Start from where we left off (we fetched 20 initially)
                let attempts = 0;
                const maxAttempts = 5; // More attempts for trending to ensure we get enough

                while (combined.length < 10 && attempts < maxAttempts) {
                    try {
                        const extraPromises: Promise<MetaPreview[]>[] = [];
                        
                        if (trendingMovieCat) {
                            extraPromises.push(tmdbClient.getCatalog(trendingMovieCat.type, trendingMovieCat.id, { skip: currentSkip.toString() }, config)
                                .then(items => this.filterContent(items, parentalSettings, profile?.user_id)));
                        } else {
                            extraPromises.push(Promise.resolve([]));
                        }

                        if (trendingSeriesCat) {
                            extraPromises.push(tmdbClient.getCatalog(trendingSeriesCat.type, trendingSeriesCat.id, { skip: currentSkip.toString() }, config)
                                .then(items => this.filterContent(items, parentalSettings, profile?.user_id)));
                        } else {
                            extraPromises.push(Promise.resolve([]));
                        }

                        const [extraMovies, extraSeries] = await Promise.all(extraPromises);
                        
                        // Interleave the new results
                        const extraCombined: MetaPreview[] = [];
                        const extraMaxLen = Math.max(extraMovies.length, extraSeries.length);
                        
                        for (let i = 0; i < extraMaxLen; i++) {
                            if (i < extraMovies.length) extraCombined.push(extraMovies[i]);
                            if (i < extraSeries.length) extraCombined.push(extraSeries[i]);
                        }
                        
                        if (extraCombined.length === 0) break;
                        
                        combined.push(...extraCombined);
                        currentSkip += 20; // We fetch 20 items per batch (10 movies + 10 series)
                        attempts++;
                    } catch (e) {
                        break;
                    }
                }
            }
            
            const final = combined.slice(0, 20); // Return top 20 items available for the UI
            return this.enrichContent(final, profileId);
        }
      } catch (e) {
        console.warn('Failed to fetch mixed trending from TMDB addon', e)
      }
    }

    // 3. Fallback to any client (old behavior)
    // 3. Fallback to any client (old behavior) - parallelized
    const promises = clients.map(async (client) => {
        if (!client.manifest) return null;
        try {
            const cat = client.manifest.catalogs[0]
            if (cat) {
              const { appearanceDb } = require('../database');
              const appearance = settingsProfileId ? appearanceDb.getSettings(settingsProfileId) : undefined;
              const config = {
                  enableAgeRating: appearance ? appearance.show_age_ratings : true,
                  showAgeRatingInGenres: appearance ? appearance.show_age_ratings : true
              };
    
              const items = await client.getCatalog(cat.type, cat.id, {}, config)
              if (items && items.length > 0) {
                const filtered = await this.filterContent(items, parentalSettings, profile?.user_id);
                // Note: enrichment here is fine as we only return one result set in the end
                // But we are doing this for ALL clients concurrently, which is hefty but fast.
                return filtered; // Defer enrichment until we pick one
              }
            }
        } catch (e) {
            // ignore
        }
        return null;
    });

    const allResults = await Promise.all(promises);
    
    // Find first valid result
    for (const res of allResults) {
        if (res && res.length > 0) {
            const enriched = await this.enrichContent(res, profileId);
            return enriched.slice(0, 10);
        }
    }
    
    return []
  }

  async getTrendingByType(profileId: number, type: 'movie' | 'series'): Promise<MetaPreview[]> {
    const clients = await this.getClientsForProfile(profileId)
    const settingsProfileId = profileDb.getSettingsProfileId(profileId);
    
    const parentalSettings = this.getParentalSettings(profileId);
    const profile = profileDb.findById(profileId);
    
    // Try to find TMDB addon (Zentrio)
    const tmdbClient = clients.find(c => c.manifest?.id?.includes('tmdb') || c.manifest?.name?.toLowerCase().includes('tmdb') || c.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON))
    
    if (tmdbClient) {
      try {
        const { appearanceDb } = require('../database');
        const appearance = settingsProfileId ? appearanceDb.getSettings(settingsProfileId) : undefined;
        const config = {
            enableAgeRating: appearance ? appearance.show_age_ratings : true,
            showAgeRatingInGenres: appearance ? appearance.show_age_ratings : true
        };

        const cat = tmdbClient.manifest?.catalogs.find(c => c.type === type && (c.id === 'tmdb.trending' || c.id === 'tmdb.top'));
        
        if (cat) {
             const items = await tmdbClient.getCatalog(cat.type, cat.id, {}, config);
             if (items && items.length > 0) {
                 let filtered = await this.filterContent(items, parentalSettings, profile?.user_id);
                 
                 // Row filling logic: if not enough items after filtering, fetch more
                 if (parentalSettings.enabled && filtered.length < 10) {
                     let currentSkip = items.length;
                     let attempts = 0;
                     const maxAttempts = 5;
                     
                     while (filtered.length < 10 && attempts < maxAttempts) {
                         try {
                             const nextItems = await tmdbClient.getCatalog(cat.type, cat.id, { skip: currentSkip.toString() }, config);
                             if (!nextItems || nextItems.length === 0) break;
                             
                             const nextFiltered = await this.filterContent(nextItems, parentalSettings, profile?.user_id);
                             filtered = [...filtered, ...nextFiltered];
                             currentSkip += nextItems.length;
                             attempts++;
                         } catch (e) {
                             break;
                         }
                     }
                 }
                 
                 return this.enrichContent(filtered.slice(0, 10), profileId);
             }
        }
      } catch (e) {
        console.warn(`Failed to fetch trending ${type} from TMDB addon`, e)
      }
    }
    
    return [];
  }

  // Delegate to extracted content-filter module
  private getParentalSettings(profileId: number) {
    return getParentalSettings(profileId);
  }

  // Delegate to extracted content-filter module
  private async filterContent(items: MetaPreview[], parentalSettings: { enabled: boolean, ratingLimit: AgeRating }, userId?: string): Promise<MetaPreview[]> {
    return filterContent(items, parentalSettings, userId);
  }

  // Delegate to extracted content-filter module
  private async enrichContent(items: MetaPreview[], profileId: number): Promise<MetaPreview[]> {
    return enrichContent(items, profileId);
  }

  async getMeta(type: string, id: string, profileId: number): Promise<MetaDetail | null> {
    const clients = await this.getClientsForProfile(profileId)
    const settingsProfileId = profileDb.getSettingsProfileId(profileId);
    const settings = settingsProfileId ? streamDb.getSettings(settingsProfileId) : undefined;
    const profile = profileDb.findById(profileId);

    // Determine if this is a "standard" ID (IMDB/TMDB) or a custom addon ID
    // Standard IDs: tt* (IMDB), tmdb:* (TMDB)
    // Custom IDs: anything else (e.g., tbm:*, mg_*, kitsu:*, etc.)
    // Handle compound IDs (comma-separated) - use first segment for detection
    const primaryId = id.includes(',') ? id.split(',')[0] : id
    const isStandardId = primaryId.startsWith('tt') || primaryId.startsWith('tmdb:')

    // Sort clients to prioritize Zentrio/TMDB for standard IDs
    const sortedClients = [...clients].sort((a, b) => {
        const isZentrioA = a.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON) || a.manifest?.id === 'org.zentrio.tmdb';
        const isZentrioB = b.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON) || b.manifest?.id === 'org.zentrio.tmdb';
        
        // For standard IDs, prioritize Zentrio/TMDB
        if (isStandardId) {
            if (isZentrioA && !isZentrioB) return -1;
            if (!isZentrioA && isZentrioB) return 1;
        } else {
            // For custom IDs, de-prioritize Zentrio/TMDB (they won't have custom content)
            if (isZentrioA && !isZentrioB) return 1;
            if (!isZentrioA && isZentrioB) return -1;
        }
        return 0;
    });

    const { appearanceDb } = require('../database');
    const appearance = settingsProfileId ? appearanceDb.getSettings(settingsProfileId) : undefined;
    const config = {
        enableAgeRating: appearance ? appearance.show_age_ratings : true,
        showAgeRatingInGenres: appearance ? appearance.show_age_ratings : true
    };

    // Stremio can show addon-provided duplicates, but the list should still be ordered S1..SX, E1..EX.
    // We therefore:
    // - keep duplicates (no dedupe),
    // - sanitize stream/release blobs that some addons wrongly embed into meta videos,
    // - apply a stable sort by (season, episode), pushing unknowns (0/NaN) to the end.
    const normalizeMetaVideos = (videos: any[]): any[] => {
      if (!Array.isArray(videos) || videos.length === 0) return []

      const looksLikeStreamText = (text: unknown): boolean => {
        if (typeof text !== 'string') return false
        const t = text.toLowerCase()
        if (t.includes('full title:')) return true
        if (t.includes('size:')) return true
        if (/\b\d+(?:\.\d+)?\s*(gb|mb)\b/i.test(text)) return true
        if (t.includes('seeders') || t.includes('magnet:') || t.includes('infohash') || t.includes('hash:')) return true
        return false
      }

      const getSeason = (v: any) => {
        const n = Number(v?.season ?? 0)
        return Number.isFinite(n) ? n : 0
      }

      const getEpisode = (v: any) => {
        const n = Number(v?.episode ?? v?.number ?? 0)
        return Number.isFinite(n) ? n : 0
      }

      const sanitized = videos.map((v: any, idx: number) => {
        const out: any = { ...(v || {}) }

        // Streams must come from the /stream resource per Stremio protocol.
        if ('streams' in out) delete out.streams

        // Drop obvious stream/release blobs that sometimes appear in meta video overviews.
        if (looksLikeStreamText(out.overview)) delete out.overview
        if (looksLikeStreamText(out.description)) delete out.description

        out.__zentrioOrder = idx
        return out
      })

      // Stable sort: season asc (0 last), episode asc (0 last), then original order.
      sanitized.sort((a: any, b: any) => {
        const sa = getSeason(a)
        const sb = getSeason(b)
        if (sa === 0 && sb !== 0) return 1
        if (sb === 0 && sa !== 0) return -1
        if (sa !== sb) return sa - sb

        const ea = getEpisode(a)
        const eb = getEpisode(b)
        if (ea === 0 && eb !== 0) return 1
        if (eb === 0 && ea !== 0) return -1
        if (ea !== eb) return ea - eb

        return Number(a.__zentrioOrder ?? 0) - Number(b.__zentrioOrder ?? 0)
      })

      return sanitized.map(({ __zentrioOrder, ...rest }: any) => rest)
    }
    
    // Pass 1: Try addons that support meta for this type and can handle this ID
    for (const client of sortedClients) {
      if (!client.manifest) continue

      // Check ID prefixes using the proper per-resource or manifest-level prefixes
      const idPrefixes = this.getResourceIdPrefixes(client.manifest, 'meta');
      // If we have specific prefixes, check if ID matches one of them
      const hasPrefixMatch = idPrefixes && idPrefixes.some(p => primaryId.startsWith(p));
      
      let shouldQuery = false;

      if (hasPrefixMatch) {
          // STRONG MATCH: Addon explicitly claims this ID prefix.
          // We assume the addon CAN handle it regardless of declared types if it supports 'meta' resource at all.
          // Check if 'meta' resource is present (ignoring type restriction)
          const hasMetaResource = client.manifest.resources.some(r => {
              if (typeof r === 'string') return r === 'meta';
              return r.name === 'meta';
          });
          
          if (hasMetaResource) {
              shouldQuery = true;
          }
      } else {
          // WEAK MATCH: No specific prefix claim (or didn't match).
          // Fall back to standard strict checking:
          // 1. Must support resource AND type
          // 2. Must pass canHandleId check (which passes if no prefixes defined)
          
          // Use proper resource checking that handles object resources AND types
          if (this.supportsResource(client.manifest, 'meta', type)) {
               // Check ID eligibility (will pass if no prefixes, or if matched - though if matched we caught it above usually, 
               // but canHandleId also handles the "no prefixes = all" case)
               if (this.canHandleId(client.manifest, 'meta', id)) {
                   shouldQuery = true;
               } else {
                   // Special case: Zentrio can handle IMDB IDs even if not explicitly in some lists
                   const isZentrio = client.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON) || client.manifest.id === 'org.zentrio.tmdb';
                   if (primaryId.startsWith('tt') && isZentrio) {
                      shouldQuery = true;
                   }
               }
          }
      }

      if (!shouldQuery) continue;

      try {
        // console.log(`[AddonManager] Trying ${client.manifest.name} for meta ${type}/${primaryId}`)
        const meta = await client.getMeta(type, id, config)
        if (meta) {
          if (Array.isArray((meta as any).videos)) {
            ;(meta as any).videos = normalizeMetaVideos((meta as any).videos)
          }
          // console.log(`[AddonManager] Got meta from ${client.manifest.name} for ${type}/${primaryId}`)
          return meta
        }
      } catch (e) {
        console.debug(`[AddonManager] getMeta failed for ${client.manifest.name}:`, e instanceof Error ? e.message : e)
      }
    }

    // Pass 2: For custom IDs, try ALL meta-capable addons (ignore prefix matching)
    // This catches addons that may have idPrefixes set but still handle content from other sources
    if (!isStandardId) {
        console.log(`[AddonManager] Custom ID ${primaryId} - trying all meta-capable addons without prefix filtering`);
        
        for (const client of sortedClients) {
            if (!client.manifest) continue
            
            const isZentrio = client.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON) || client.manifest.id === 'org.zentrio.tmdb';
            if (isZentrio) continue; // Skip Zentrio for custom IDs - it won't have them
            
            if (!client.manifest.resources.includes('meta')) continue
            if (!client.manifest.types.includes(type)) continue
            
            // Skip if already tried in Pass 1 (matched prefix or had no prefix restriction)
            const alreadyTried = !client.manifest.idPrefixes || 
                client.manifest.idPrefixes.length === 0 || 
                client.manifest.idPrefixes.some(p => primaryId.startsWith(p))
            if (alreadyTried) continue

            try {
                const meta = await client.getMeta(type, id, config)
                if (meta) {
                  if (Array.isArray((meta as any).videos)) {
                    ;(meta as any).videos = normalizeMetaVideos((meta as any).videos)
                  }
                  return meta
                }
            } catch (e) {
                console.debug(`[AddonManager] getMeta (pass 2) failed for ${client.manifest.name}:`, e instanceof Error ? e.message : e)
            }
        }
    }

    // Pass 3: Fallback logic for orphaned or specific IDs
    // 3a. If ID is a TMDB ID (tmdb:...), try using Zentrio Addon explicitly, even if disabled
    if (primaryId.startsWith('tmdb:')) {
         console.log(`[AddonManager] TMDB ID ${primaryId} not resolved by enabled addons. Attempting fallback to Zentrio Client.`);
         
         const profile = profileDb.findById(profileId);
         // Use a dedicated cache key to avoid conflicts with the main client if it exists but is disabled
         const fallbackKey = `fallback:${DEFAULT_TMDB_ADDON}`;
         let zentrioClient = this.clientCache.get(fallbackKey);
         
         if (!zentrioClient) {
             zentrioClient = new ZentrioAddonClient(DEFAULT_TMDB_ADDON, profile?.user_id);
             this.clientCache.set(fallbackKey, zentrioClient);
         }
         
         try {
             if (!zentrioClient.manifest) await zentrioClient.init();
             const meta = await zentrioClient.getMeta(type, id, config);
             if (meta) {
               if (Array.isArray((meta as any).videos)) {
                 ;(meta as any).videos = normalizeMetaVideos((meta as any).videos)
               }
               return meta;
             }
         } catch (e) {
             console.warn(`Fallback to Zentrio Client failed for ${id}`, e);
         }
    }

    // 3b. Fallback to Cinemeta for standard IDs only (IMDB)
    if (isStandardId) {
        console.log(`[AddonManager] Meta not found in enabled addons for ${type}/${id}. Falling back to Cinemeta.`);
        
        const cinemetaUrl = 'https://v3-cinemeta.strem.io/manifest.json';
        const alreadyTried = sortedClients.some(c => this.normalizeUrl(c.manifestUrl) === this.normalizeUrl(cinemetaUrl) && c.manifest);
        
        if (!alreadyTried) {
            let cinemetaClient = this.clientCache.get(cinemetaUrl);
            if (!cinemetaClient) {
                cinemetaClient = new AddonClient(cinemetaUrl);
                this.clientCache.set(cinemetaUrl, cinemetaClient);
            }
            
            try {
                if (!cinemetaClient.manifest) await cinemetaClient.init();
                
                if (cinemetaClient.manifest?.resources.includes('meta') && cinemetaClient.manifest?.types.includes(type)) {
                     const meta = await cinemetaClient.getMeta(type, id)
                     if (meta) {
                       if (Array.isArray((meta as any).videos)) {
                         ;(meta as any).videos = normalizeMetaVideos((meta as any).videos)
                       }
                       return meta
                     }
                }
            } catch (e) {
                console.warn(`Fallback to Cinemeta failed for ${type}/${id}`, e);
            }
        }
    } else {
        console.log(`[AddonManager] Custom ID ${id} not found in any addon. This content may not have metadata available.`);
    }

    return null
  }

  async search(query: string, profileId: number, filters?: { type?: string, year?: string, sort?: string }): Promise<MetaPreview[]> {
    const clients = await this.getClientsForProfile(profileId)
    const results: MetaPreview[] = []
    const profile = profileDb.findById(profileId);

    // Prioritize TMDB addon for search
    const tmdbClient = clients.find(c => c.manifest?.id?.includes('tmdb') || c.manifest?.name?.toLowerCase().includes('tmdb') || c.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON))

    if (tmdbClient && tmdbClient.manifest) {
      for (const cat of tmdbClient.manifest.catalogs) {
        // If type filter is set, skip catalogs that don't match
        if (filters?.type && filters.type !== 'all' && cat.type !== filters.type) continue;

        const searchExtra = cat.extra?.find(e => e.name === 'search')
        if (searchExtra) {
          try {
            console.log(`[AddonManager] Searching TMDB catalog "${cat.id}" for "${query}" with filters`, filters)
            
            const settingsProfileId = profileDb.getSettingsProfileId(profileId);
            const { appearanceDb } = require('../database');
            const appearance = settingsProfileId ? appearanceDb.getSettings(settingsProfileId) : undefined;
            const config = {
                enableAgeRating: appearance ? appearance.show_age_ratings : true,
                showAgeRatingInGenres: appearance ? appearance.show_age_ratings : true,
                ...(filters?.year ? { year: parseInt(filters.year) } : {})
            };

            const items = await tmdbClient.getCatalog(cat.type, cat.id, { search: query }, config)
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
        const parentalSettings = this.getParentalSettings(profileId);
        return this.filterContent(uniqueResults, parentalSettings, profile?.user_id);
      }
    }

    // Fallback to searching all other addons if TMDB fails or isn't present
    console.log('[AddonManager] TMDB search yielded no results or TMDB addon not found. Falling back to all addons.')
    for (const client of clients) {
      // Skip the TMDB client if we already tried it
      if (client === tmdbClient) continue;

      if (!client.manifest) continue
      for (const cat of client.manifest.catalogs) {
        // If type filter is set, skip catalogs that don't match
        if (filters?.type && filters.type !== 'all' && cat.type !== filters.type) continue;

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

    // Apply client-side sorting if requested
    if (filters?.sort && filters.sort !== 'relevance') {
        uniqueResults.sort((a, b) => {
            if (filters.sort === 'newest') {
                const dateA = a.released ? new Date(a.released).getTime() : 0
                const dateB = b.released ? new Date(b.released).getTime() : 0
                return dateB - dateA
            } else if (filters.sort === 'oldest') {
                const dateA = a.released ? new Date(a.released).getTime() : 0
                const dateB = b.released ? new Date(b.released).getTime() : 0
                // Push items without date to the end for oldest sort
                if (dateA === 0 && dateB !== 0) return 1
                if (dateB === 0 && dateA !== 0) return -1
                return dateA - dateB
            } else if (filters.sort === 'rating') {
                const rateA = a.imdbRating ? parseFloat(a.imdbRating) : 0
                const rateB = b.imdbRating ? parseFloat(b.imdbRating) : 0
                return rateB - rateA
            }
            return 0
        })
    }

    const parentalSettings = this.getParentalSettings(profileId);
    const filtered = await this.filterContent(uniqueResults, parentalSettings, profile?.user_id);
    return this.enrichContent(filtered, profileId);
  }

  /**
   * Stremio-style catalog-based search.
   * Queries all addons with search-enabled catalogs in parallel and returns results grouped by catalog.
   * This provides a cleaner UX by showing where each result comes from.
   */
  async searchByCatalog(query: string, profileId: number, filters?: { type?: string }): Promise<{
    addon: { id: string; name: string; logo?: string };
    catalog: { type: string; id: string; name?: string };
    items: MetaPreview[];
  }[]> {
    const clients = await this.getClientsForProfile(profileId)
    const profile = profileDb.findById(profileId)
    const parentalSettings = this.getParentalSettings(profileId)
    
    const settingsProfileId = profileDb.getSettingsProfileId(profileId)
    const { appearanceDb } = require('../database')
    const appearance = settingsProfileId ? appearanceDb.getSettings(settingsProfileId) : undefined
    const config = {
      enableAgeRating: appearance ? appearance.show_age_ratings : true,
      showAgeRatingInGenres: appearance ? appearance.show_age_ratings : true
    }

    // Collect all search promises from all catalogs that support search
    const searchPromises: Promise<{
      addon: { id: string; name: string; logo?: string };
      catalog: { type: string; id: string; name?: string };
      items: MetaPreview[];
    } | null>[] = []

    for (const client of clients) {
      if (!client.manifest) continue

      for (const cat of client.manifest.catalogs) {
        // Skip if type filter doesn't match
        if (filters?.type && filters.type !== 'all' && cat.type !== filters.type) continue

        // Check if catalog supports search
        const searchExtra = cat.extra?.find(e => e.name === 'search')
        if (!searchExtra) continue

        // Create a promise for this catalog search
        const searchPromise = (async () => {
          try {
            const items = await client.getCatalog(cat.type, cat.id, { search: query }, config)
            if (items.length === 0) return null

            // Apply parental filtering
            const filtered = await this.filterContent(items, parentalSettings, profile?.user_id)
            if (filtered.length === 0) return null

            // Enrich with watch status
            const enriched = await this.enrichContent(filtered, profileId)

            return {
              addon: {
                id: client.manifest!.id,
                name: client.manifest!.name,
                logo: client.manifest!.logo || client.manifest!.logo_url
              },
              catalog: {
                type: cat.type,
                id: cat.id,
                name: cat.name
              },
              items: enriched
            }
          } catch (e) {
            console.warn(`[searchByCatalog] Failed for ${client.manifest?.name}/${cat.id}:`, e)
            return null
          }
        })()

        searchPromises.push(searchPromise)
      }
    }

    // Execute all searches in parallel
    const results = await Promise.all(searchPromises)
    
    // Filter out null results and return
    return results.filter((r): r is NonNullable<typeof r> => r !== null)
  }

  async getCatalogItems(profileId: number, manifestUrl: string, type: string, id: string, skip?: number): Promise<{ title: string, items: MetaPreview[] } | null> {
    // Ensure clients are initialized for this profile
    await this.getClientsForProfile(profileId)
    
    const normalizedUrl = this.normalizeUrl(manifestUrl)
    const client = this.clientCache.get(normalizedUrl)
    if (!client || !client.manifest) {
        console.warn(`[AddonManager] Client not found for ${manifestUrl} (normalized: ${normalizedUrl})`)
        return null
    }

    const catalog = client.manifest.catalogs.find(c => c.type === type && c.id === id)
    if (!catalog) return null

    try {
      const extra: Record<string, string> = {}
      if (skip) extra.skip = skip.toString()
      
      const settingsProfileId = profileDb.getSettingsProfileId(profileId);
      const parentalSettings = this.getParentalSettings(profileId);
      const profile = profileDb.findById(profileId);
      
      const { appearanceDb } = require('../database');
      const appearance = settingsProfileId ? appearanceDb.getSettings(settingsProfileId) : undefined;
      const config = {
          enableAgeRating: appearance ? appearance.show_age_ratings : true,
          showAgeRatingInGenres: appearance ? appearance.show_age_ratings : true
      };

      const items = await client.getCatalog(type, id, extra, config)
      let filteredItems = await this.filterContent(items, parentalSettings, profile?.user_id);
      
      // If we filtered out items and have less than expected (e.g. < 20), try fetching next page
      // @ts-ignore
      if (parentalSettings.enabled && filteredItems.length < 20 && items.length > 0) {
          const nextSkip = (skip || 0) + items.length;
          const extraNext = { ...extra, skip: nextSkip.toString() };
          try {
              const nextItems = await client.getCatalog(type, id, extraNext, config);
              if (nextItems.length > 0) {
                  const nextFiltered = await this.filterContent(nextItems, parentalSettings, profile?.user_id);
                  filteredItems = [...filteredItems, ...nextFiltered];
              }
          } catch (e) {
              // Ignore error on next page fetch
          }
      }
      
      return {
        title: `${client.manifest.name} - ${catalog.name || catalog.type}`,
        items: await this.enrichContent(filteredItems, profileId)
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      console.error(`Failed to fetch catalog ${id} from ${manifestUrl}`, e)
      if (e instanceof Error) {
        console.error(e.stack)
      }
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
                // Normalize TV genres to Movie genres for the dropdown
                let finalGenre = g
                if (g === 'Action & Adventure') finalGenre = 'Action'
                else if (g === 'Sci-Fi & Fantasy') finalGenre = 'Science Fiction'
                else if (g === 'War & Politics') finalGenre = 'War'
                
                genres.add(finalGenre)
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
    // Handle multiple types (e.g. "movie,series")
    if (type.includes(',')) {
        const types = type.split(',').map(t => t.trim());
        const promises = types.map(t => this.getFilteredItems(profileId, t, genre, skip));
        const results = await Promise.all(promises);
        
        // Interleave results
        const combined: MetaPreview[] = [];
        const maxLen = Math.max(...results.map(r => r.length));
        
        for (let i = 0; i < maxLen; i++) {
            for (const list of results) {
                if (i < list.length) combined.push(list[i]);
            }
        }
        return combined;
    }

    const clients = await this.getClientsForProfile(profileId)
    const results: MetaPreview[] = []

    const promises = clients.map(async (client) => {
      if (!client.manifest) return []
      
      // Find a catalog that supports this type and (optionally) genre
      const catalog = client.manifest.catalogs.find(c => {
        if (c.type !== type) return false
        if (genre) {
          // Check if genre is supported. 
          return c.extra?.some(e => e.name === 'genre' && (!e.options || e.options.includes(genre)))
        }
        return true
      })

      if (catalog) {
        try {
          const extra: Record<string, string> = {}
          if (genre) extra.genre = genre
          if (skip) extra.skip = skip.toString()
          
          const settingsProfileId = profileDb.getSettingsProfileId(profileId);
          const { appearanceDb } = require('../database');
          const appearance = settingsProfileId ? appearanceDb.getSettings(settingsProfileId) : undefined;
          const config = {
              enableAgeRating: appearance ? appearance.show_age_ratings : true,
              showAgeRatingInGenres: appearance ? appearance.show_age_ratings : true
          };

          const items = await client.getCatalog(catalog.type, catalog.id, extra, config)
          return items;
        } catch (e) {
          console.warn(`Failed to fetch filtered items from ${client.manifest.name}`, e)
          return []
        }
      }
      return []
    });

    const nestedResults = await Promise.all(promises);
    nestedResults.forEach(r => results.push(...r));
    
    
    const parentalSettings = this.getParentalSettings(profileId);
    const profile = profileDb.findById(profileId);
    const filtered = await this.filterContent(results, parentalSettings, profile?.user_id);
    return this.enrichContent(filtered, profileId);
  }

  async getStreams(type: string, id: string, profileId: number, season?: number, episode?: number, platform?: string): Promise<{ addon: Manifest, streams: Stream[] }[]> {
    const clients = await this.getClientsForProfile(profileId)
    const rawResults: { addon: Manifest, streams: Stream[] }[] = []

    // For series, we generally need season and episode.
    // If they are missing, we might be requesting the whole series which some addons don't support and return 500.
    if (type === 'series' && (season === undefined || episode === undefined)) {
      console.warn(`[AddonManager] Skipping stream fetch for series ${id} without season/episode`)
      return []
    }

    // Resolve meta once so we can:
    // - Prefer addon-compatible base IDs (custom id vs imdb_id) per addon idPrefixes
    // - For series, resolve the *episode video id* via meta.videos[].id (Stremio-style)
    let metaForId: MetaDetail | null = null
    try {
      metaForId = await this.getMeta(type, id, profileId)
    } catch {
      metaForId = null
    }

    const candidateBaseIds = Array.from(new Set(
      [id, metaForId?.id, metaForId?.imdb_id].filter(Boolean)
    )) as string[]

    const resolveSeriesVideoId = (baseId: string): string => {
      if (type !== 'series' || season === undefined || episode === undefined) return baseId

      // If we're using the same base id we fetched meta for, attempt to resolve via meta.videos[].id
      if (
        metaForId &&
        (baseId === id || baseId === metaForId.id) &&
        Array.isArray((metaForId as any).videos)
      ) {
        const match = (metaForId.videos as any[]).find(v => {
          const vSeason = Number(v.season ?? 0)
          const vEpisode = Number(v.episode ?? v.number ?? 0)
          return vSeason === season && vEpisode === episode
        })
        if (match?.id) return String(match.id)
      }

      // Fallback to the conventional scheme used by many addons (Cinemeta, etc.)
      return `${baseId}:${season}:${episode}`
    }

    const getMovieVideoIdsFromAddonMeta = async (client: AddonClient, baseId: string): Promise<string[]> => {
      // Some addons implement "movie selection" via meta.videos and/or behaviorHints.defaultVideoId.
      // In those cases, /stream must be called with the *video id*, not the parent meta id.
      if (type !== 'movie') return []
      if (!client.manifest) return []

      try {
        if (!this.supportsResource(client.manifest, 'meta', 'movie')) return []
        if (!this.canHandleId(client.manifest, 'meta', baseId)) return []

        const addonMeta = await client.getMeta('movie', baseId)
        if (!addonMeta) return []

        const ids: string[] = []
        const defaultVideoId = (addonMeta as any)?.behaviorHints?.defaultVideoId
        if (typeof defaultVideoId === 'string' && defaultVideoId.trim()) ids.push(defaultVideoId.trim())

        if (Array.isArray((addonMeta as any).videos)) {
          for (const v of (addonMeta as any).videos) {
            if (v?.id) ids.push(String(v.id))
          }
        }

        // unique, keep order
        return Array.from(new Set(ids)).filter(Boolean)
      } catch {
        return []
      }
    }

    // Helper function to fetch streams with retry support
    const fetchStreamsWithRetry = async (client: AddonClient, maxRetries: number = 3): Promise<void> => {
      if (!client.manifest) return

      // Use proper resource checking that handles object resources
      if (!this.supportsResource(client.manifest, 'stream', type)) return

      // Pick the first candidate base ID that this addon can handle
      const baseId = candidateBaseIds.find(cid => this.canHandleId(client.manifest!, 'stream', cid))
      if (!baseId) return

      const resolvedVideoId = resolveSeriesVideoId(baseId)

      let attempt = 0
      while (attempt < maxRetries) {
        try {
          console.log(`[${client.manifest.name}] Requesting streams for ${type}/${resolvedVideoId}${attempt > 0 ? ` (attempt ${attempt + 1}/${maxRetries})` : ''}`)
          let streams = await client.getStreams(type, resolvedVideoId)
          console.log(`[${client.manifest.name}] Received ${streams ? streams.length : 0} streams`)

          // Movie-selection fallback: if base-id stream call returns empty, try video ids from addon meta
          if (type === 'movie' && (!streams || streams.length === 0)) {
            const altVideoIds = await getMovieVideoIdsFromAddonMeta(client, baseId)
            for (const vid of altVideoIds) {
              try {
                console.log(`[${client.manifest.name}] Retrying movie streams via meta video id: ${vid}`)
                const s2 = await client.getStreams('movie', vid)
                if (s2 && s2.length > 0) {
                  streams = [...(streams || []), ...s2]
                }
              } catch {
                // ignore per-id failures; continue
              }
            }
          }

          if (streams && streams.length > 0) {
            rawResults.push({ addon: client.manifest, streams })
          }
          return // Success, exit the retry loop
        } catch (e) {
          if (e instanceof RetryableError && attempt < maxRetries - 1) {
            // Addon is busy, wait and retry
            console.log(`[${client.manifest.name}] ${e.message} - retrying in ${e.retryAfterMs}ms...`)
            await new Promise(resolve => setTimeout(resolve, e.retryAfterMs))
            attempt++
          } else {
            // Non-retryable error or max retries exceeded
            const errorMsg = e instanceof Error ? e.message : String(e)
            console.warn(`[${client.manifest.name}] Failed to fetch streams:`, errorMsg)
            return
          }
        }
      }
    }

    const promises = clients.map(client => fetchStreamsWithRetry(client))

    // Wait for all promises to settle, but don't block if some fail or timeout
    await Promise.allSettled(promises)

    const settingsProfileId = profileDb.getSettingsProfileId(profileId);
    const settings = settingsProfileId ? streamDb.getSettings(settingsProfileId) : undefined;
    
    if (!settings) return rawResults;

    // Apply platform-specific overrides
    if (platform === 'web') {
        if (!settings.filters) (settings.filters as any) = {};
        if (!settings.filters.audioTag) (settings.filters.audioTag as any) = {};
        if (!settings.filters.audioTag.preferred) settings.filters.audioTag.preferred = [];
        
        // Add AAC/MP3/Opus/FLAC/AC3/EAC3/Multi to preferred if not present, at the beginning
        // We are permissive here to avoid false positives. If it's AC3/EAC3 it might work or be transcoded.
        if (!settings.filters.audioTag.preferred.includes('multi')) settings.filters.audioTag.preferred.unshift('multi');
        if (!settings.filters.audioTag.preferred.includes('eac3')) settings.filters.audioTag.preferred.unshift('eac3');
        if (!settings.filters.audioTag.preferred.includes('ac3')) settings.filters.audioTag.preferred.unshift('ac3');
        if (!settings.filters.audioTag.preferred.includes('flac')) settings.filters.audioTag.preferred.unshift('flac');
        if (!settings.filters.audioTag.preferred.includes('opus')) settings.filters.audioTag.preferred.unshift('opus');
        if (!settings.filters.audioTag.preferred.includes('mp3')) settings.filters.audioTag.preferred.unshift('mp3');
        if (!settings.filters.audioTag.preferred.includes('aac')) settings.filters.audioTag.preferred.unshift('aac');
    }

    // Fetch meta for filtering context (e.g. type, year, etc.)
    // We need basic meta info. We can try to fetch it or construct a minimal one.
    // Ideally we should have passed meta to getStreams, but for now let's fetch it if possible or use minimal info.
    let meta: MetaDetail | null = null
    try {
        meta = await this.getMeta(type, id, profileId)
    } catch (e) {
        console.warn('Failed to fetch meta for stream processing', e)
    }

    if (!meta) {
        // Fallback minimal meta
        meta = {
            id,
            type,
            name: 'Unknown',
        }
    }

    console.log('[AddonManager] Settings sortingConfig:', JSON.stringify(settings?.sortingConfig))
    const processor = new StreamProcessor(settings, platform)
    
    // Flatten results for processing
    const flatStreams = rawResults.flatMap(r => r.streams.map(s => ({ stream: s, addon: r.addon })))
    
    const processedStreams = processor.process(flatStreams, meta)

    // Re-group by addon for frontend compatibility (or return flat list if frontend supports it?)
    // The frontend expects { addon: Manifest, streams: Stream[] }[]
    // But since we deduplicated and sorted globally, grouping back by addon might lose the sort order if we just list addons.
    // However, the frontend likely renders groups.
    // If we want to respect the global sort order, we might need to change the return type or how frontend renders.
    // For now, let's group them back but keep the order within groups?
    // Actually, if we deduplicated "Single Result", we might have streams from different addons.
    
    // If we want to support the "Single Result" deduplication where we might pick one stream from Addon A and another from Addon B,
    // and we want to present them in a unified list, the current return type structure is a bit limiting if it forces grouping by addon.
    // But let's try to map it back.
    
    const groupedResults: { addon: Manifest, streams: Stream[] }[] = []
    const addonMap = new Map<string, Manifest>()
    
    // Collect all addons involved
    rawResults.forEach(r => addonMap.set(r.addon.id, r.addon)) // Use ID as key
    
    // We need to preserve the global sort order.
    // If the frontend renders addon groups sequentially, we can't easily preserve global sort order across addons.
    // BUT, if we return a single "Virtual" addon group or if we just return the streams and let frontend handle it?
    // The current frontend iterates over groups.
    
    // Let's group by addon, but maybe we can sort the groups themselves?
    // Or just return what we have.
    
    // Wait, if we use "Single Result" deduplication, we only have unique streams.
    // If we group them back by addon, we are just organizing them.
    
    // Add sortIndex to each stream so frontend can reconstruct global sort order
    processedStreams.forEach((parsedStream, index) => {
        if (!parsedStream.original.behaviorHints) {
            parsedStream.original.behaviorHints = {}
        }
        // Store the global sort index
        (parsedStream.original.behaviorHints as any).sortIndex = index
    })
    
    // Let's just group them back by addon for now to maintain compatibility.
    const streamsByAddon = new Map<string, Stream[]>()
    
    processedStreams.forEach(parsedStream => {
        const addonId = parsedStream.addon.id
        if (!streamsByAddon.has(addonId)) {
            streamsByAddon.set(addonId, [])
        }
        streamsByAddon.get(addonId)!.push(parsedStream.original)
    })
    
    // Create result
    for (const [addonId, streams] of streamsByAddon) {
        const addon = addonMap.get(addonId)
        if (addon) {
            groupedResults.push({ addon, streams })
        }
    }
    
    return groupedResults
  }

  /**
   * Progressive stream loading - calls back as each addon completes.
   * Used for SSE streaming to update UI in real-time.
   */
  async getStreamsProgressive(
    type: string, 
    id: string, 
    profileId: number, 
    season?: number, 
    episode?: number, 
    platform?: string,
    callbacks?: {
      onAddonStart?: (addon: Manifest) => void
      onAddonResult?: (addon: Manifest, streams: Stream[]) => void
      onAddonError?: (addon: Manifest, error: string) => void
    }
  ): Promise<void> {
    const clients = await this.getClientsForProfile(profileId)

    // For series, we need season and episode
    if (type === 'series' && (season === undefined || episode === undefined)) {
      console.warn(`[AddonManager] Skipping stream fetch for series ${id} without season/episode`)
      return
    }

    // Resolve meta once so we can:
    // - Prefer addon-compatible base IDs (custom id vs imdb_id) per addon idPrefixes
    // - For series, resolve the *episode video id* via meta.videos[].id (Stremio-style)
    let metaForId: MetaDetail | null = null
    try {
      metaForId = await this.getMeta(type, id, profileId)
    } catch {
      metaForId = null
    }

    const candidateBaseIds = Array.from(new Set(
      [id, metaForId?.id, metaForId?.imdb_id].filter(Boolean)
    )) as string[]

    const resolveSeriesVideoId = (baseId: string): string => {
      if (type !== 'series' || season === undefined || episode === undefined) return baseId

      if (
        metaForId &&
        (baseId === id || baseId === metaForId.id) &&
        Array.isArray((metaForId as any).videos)
      ) {
        const match = (metaForId.videos as any[]).find(v => {
          const vSeason = Number(v.season ?? 0)
          const vEpisode = Number(v.episode ?? v.number ?? 0)
          return vSeason === season && vEpisode === episode
        })
        if (match?.id) return String(match.id)
      }

      return `${baseId}:${season}:${episode}`
    }

    const getMovieVideoIdsFromAddonMeta = async (client: AddonClient, baseId: string): Promise<string[]> => {
      if (type !== 'movie') return []
      if (!client.manifest) return []

      try {
        if (!this.supportsResource(client.manifest, 'meta', 'movie')) return []
        if (!this.canHandleId(client.manifest, 'meta', baseId)) return []

        const addonMeta = await client.getMeta('movie', baseId)
        if (!addonMeta) return []

        const ids: string[] = []
        const defaultVideoId = (addonMeta as any)?.behaviorHints?.defaultVideoId
        if (typeof defaultVideoId === 'string' && defaultVideoId.trim()) ids.push(defaultVideoId.trim())

        if (Array.isArray((addonMeta as any).videos)) {
          for (const v of (addonMeta as any).videos) {
            if (v?.id) ids.push(String(v.id))
          }
        }

        return Array.from(new Set(ids)).filter(Boolean)
      } catch {
        return []
      }
    }

    // Fetch streams from each addon and callback as they complete
    const fetchFromAddon = async (client: AddonClient): Promise<void> => {
      if (!client.manifest) return

      // Use proper resource checking that handles object resources
      if (!this.supportsResource(client.manifest, 'stream', type)) return

      // Pick the first candidate base ID that this addon can handle
      const baseId = candidateBaseIds.find(cid => this.canHandleId(client.manifest!, 'stream', cid))
      if (!baseId) return

      const resolvedVideoId = resolveSeriesVideoId(baseId)

      // Notify that this addon is starting
      callbacks?.onAddonStart?.(client.manifest)

      const maxRetries = 3
      let attempt = 0

      while (attempt < maxRetries) {
        try {
          console.log(`[${client.manifest.name}] Requesting streams for ${type}/${resolvedVideoId}${attempt > 0 ? ` (attempt ${attempt + 1}/${maxRetries})` : ''}`)
          let streams = await client.getStreams(type, resolvedVideoId)
          console.log(`[${client.manifest.name}] Received ${streams ? streams.length : 0} streams`)

          if (type === 'movie' && (!streams || streams.length === 0)) {
            const altVideoIds = await getMovieVideoIdsFromAddonMeta(client, baseId)
            for (const vid of altVideoIds) {
              try {
                console.log(`[${client.manifest.name}] Retrying movie streams via meta video id: ${vid}`)
                const s2 = await client.getStreams('movie', vid)
                if (s2 && s2.length > 0) {
                  streams = [...(streams || []), ...s2]
                }
              } catch {
                // ignore per-id failures
              }
            }
          }
          
          // Callback with results (even if empty)
          callbacks?.onAddonResult?.(client.manifest, streams || [])
          return
        } catch (e) {
          if (e instanceof RetryableError && attempt < maxRetries - 1) {
            console.log(`[${client.manifest.name}] ${e.message} - retrying in ${e.retryAfterMs}ms...`)
            await new Promise(resolve => setTimeout(resolve, e.retryAfterMs))
            attempt++
          } else {
            const errorMsg = e instanceof Error ? e.message : String(e)
            console.warn(`[${client.manifest.name}] Failed to fetch streams:`, errorMsg)
            callbacks?.onAddonError?.(client.manifest, errorMsg)
            return
          }
        }
      }
    }

    // Launch all addon fetches in parallel
    const promises = clients.map(client => fetchFromAddon(client))
    await Promise.allSettled(promises)
  }

  async getSubtitles(type: string, id: string, profileId: number, videoHash?: string): Promise<{ addon: Manifest, subtitles: Subtitle[] }[]> {
    const clients = await this.getClientsForProfile(profileId)
    const results: { addon: Manifest, subtitles: Subtitle[] }[] = []

    console.log(`[AddonManager] getSubtitles called for ${type}/${id}, videoHash: ${videoHash || 'none'}`)
    
    // Resolve IDs: We might have a TMDB ID (tmdb:123) but addons might need IMDB ID (tt123)
    let tmdbId: string | null = null
    let imdbId: string | null = null
    
    if (id.startsWith('tmdb:')) {
      tmdbId = id.replace('tmdb:', '')
      // Try to resolve to IMDB
      imdbId = await this.resolveTmdbToImdb(tmdbId, type, profileId)
      if (imdbId) console.log(`[AddonManager] Resolved TMDB ${tmdbId} to IMDB ${imdbId}`)
    } else if (id.startsWith('tt')) {
      imdbId = id
      // We could resolve to TMDB here if needed, but usually subtiles support tt
    }

    console.log(`[AddonManager] Available clients: ${clients.length}`)

    const promises = clients.map(async (client) => {
      if (!client.manifest) return

      // Use proper resource checking that handles object resources
      const supportsSubtitles = this.supportsResource(client.manifest, 'subtitles', type)
      if (!supportsSubtitles) {
        // console.log(`[AddonManager] ${client.manifest.name} does NOT support subtitles resource`)
        return
      }
      
      // Determine which ID to use for this addon
      let targetId = id
      let canHandle = this.canHandleId(client.manifest, 'subtitles', id)
      
      // If addon can't handle original ID (e.g. tmdb:...) but we have resolved IMDB ID, check that
      if (!canHandle && imdbId && id.startsWith('tmdb:')) {
          if (this.canHandleId(client.manifest, 'subtitles', imdbId)) {
              targetId = imdbId
              canHandle = true
              // console.log(`[AddonManager] Using resolved IMDB ID ${targetId} for ${client.manifest.name}`)
          }
      }

      if (!canHandle) {
        // console.log(`[AddonManager] ${client.manifest.name} cannot handle ID ${id}`)
        return
      }

      try {
        // console.log(`[AddonManager] Requesting subtitles from ${client.manifest.name} for ${type}/${targetId}`)
        const subtitles = await client.getSubtitles(type, targetId, videoHash)
        // console.log(`[AddonManager] Received ${subtitles ? subtitles.length : 0} subtitles from ${client.manifest.name}`)
        if (subtitles && subtitles.length > 0) {
          results.push({ addon: client.manifest, subtitles })
        }
      } catch (e) {
        console.warn(`[AddonManager] Failed to fetch subtitles from ${client.manifest.name}:`, e)
      }
    })

    await Promise.allSettled(promises)
    console.log(`[AddonManager] Total subtitle results before filtering: ${results.length} addon groups`)

    // Post-process results: Deduplicate and Flatten
    const allSubtitles: Subtitle[] = []
    
    // Track unique IDs to prevent duplicates across addons (if same source) or within addons
    const seenIds = new Set<string>()
    const seenUrls = new Set<string>()

    for (const group of results) {
        for (const sub of group.subtitles) {
             // Create unique ID for dedup
             const uniqueId = sub.id || sub.url
             if (!uniqueId) continue

             if (seenIds.has(uniqueId)) continue
             if (seenUrls.has(sub.url)) continue
             
             seenIds.add(uniqueId)
             seenUrls.add(sub.url)

             // Enrich with addon name if missing
             if (!sub.addonName) sub.addonName = group.addon.name

             allSubtitles.push(sub)
        }
    }

    // Filter and Sort
    // 1. Prioritize hash matches if videoHash is provided
    // 2. Group by language
    // 3. Limit per language
    
    const byLang: Record<string, Subtitle[]> = {}
    allSubtitles.forEach(sub => {
        const lang = sub.lang || 'unknown' // normalize lang codes
        if (!byLang[lang]) byLang[lang] = []
        byLang[lang].push(sub)
    })

    const filteredResults: { addon: Manifest, subtitles: Subtitle[] }[] = []
    
    // Re-group for the return format (which expects grouped by addon, but we can return a single "Combined" group or keep original structure but filtered)
    // The current return type is { addon: Manifest, subtitles: Subtitle[] }[]
    // But we just flattened them. 
    // Actually, the caller (streaming.ts) flattens them anyway.
    // So modifying the original 'results' in place or creating new list is fine.
    
    // Let's filter the 'results' list in place by modifying grouped subtitles
    results.forEach(group => {
        // We only want to keep subtitles that survived the global dedup and limit
        // But the global dedup above lost the addon context partially (though we added addonName).
        
        // Simpler approach: Filter duplicates within the aggregation loop or just return allSubtitles if we change the signature?
        // The signature is public, better not change it.
        // Let's just limit the *total* count and per-language count to avoid UI crash.
        
        // We'll trust the 'allSubtitles' list which is deduped.
        // We need to map them back to their addons or just return them as a "virtual" addon result?
        // streaming.ts flattens results.flatMap, so grouping doesn't strictly matter for the API response 
        // EXCEPT that streaming.ts debug info relies on it.
        
        // Minimal invasive fix: Limit the subtitles INSIDE each group, after global check?
        // Global dedup is tricky if we keep groups.
        
        // Let's just do per-group filtering for now, and maybe a global limit?
        // The user issue is 961 subtitles. Even 50 per language is plenty.
        
        const langCounts: Record<string, number> = {}
        const MAX_PER_LANG = 20
        
        group.subtitles = group.subtitles.filter(sub => {
             const lang = sub.lang || 'unknown'
             if (!langCounts[lang]) langCounts[lang] = 0
             
             if (langCounts[lang] >= MAX_PER_LANG) return false
             
             langCounts[lang]++
             return true
        })
    })
    
    console.log(`[AddonManager] Filtered results.`)
    
    if (results.length === 0) {
      console.warn('[AddonManager] No subtitle results from any addon. Consider installing a subtitle addon like:')
      console.warn('[AddonManager] - OpenSubtitles: https://github.com/openSubtitles/stremio-addon')
      console.warn('[AddonManager] Most torrent/video streaming addons do NOT provide subtitles.')
    }
    
    return results
  }

  /**
   * Get catalog metadata without fetching items - used for lazy loading UI
   * Returns catalog shells that can be used to render skeleton rows immediately
   */
  async getCatalogMetadata(profileId: number): Promise<{ 
    addon: { id: string; name: string; logo?: string }; 
    manifestUrl: string; 
    catalog: { type: string; id: string; name?: string };
    title: string;
    seeAllUrl: string;
  }[]> {
    const clients = await this.getClientsForProfile(profileId)
    const results: { 
      addon: { id: string; name: string; logo?: string }; 
      manifestUrl: string; 
      catalog: { type: string; id: string; name?: string };
      title: string;
      seeAllUrl: string;
    }[] = []

    for (const client of clients) {
      if (!client.manifest) continue
      for (const cat of client.manifest.catalogs) {
        // Skip catalogs that require extra params
        if (cat.extra?.some(e => e.isRequired)) continue
        
        const typeName = cat.type === 'movie' ? 'Movies' : (cat.type === 'series' ? 'Series' : 'Other')
        const manifestUrl = client.manifestUrl
        
        results.push({
          addon: { 
            id: client.manifest.id, 
            name: client.manifest.name, 
            logo: client.manifest.logo || (client.manifest as any).logo_url 
          },
          manifestUrl,
          catalog: { type: cat.type, id: cat.id, name: cat.name },
          title: `${typeName} - ${cat.name || cat.type}`,
          seeAllUrl: `/streaming/${profileId}/catalog/${encodeURIComponent(manifestUrl)}/${cat.type}/${cat.id}`
        })
      }
    }

    // Sort to prioritize Zentrio (TMDB) addon
    results.sort((a, b) => {
      const isZentrioA = a.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON) || a.addon.id === 'org.zentrio.tmdb'
      const isZentrioB = b.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON) || b.addon.id === 'org.zentrio.tmdb'
      if (isZentrioA && !isZentrioB) return -1
      if (!isZentrioA && isZentrioB) return 1
      return 0
    })

    return results
  }

  /**
   * Fetch items for a single catalog - used for lazy loading individual rows
   */
  async getSingleCatalog(
    profileId: number, 
    manifestUrl: string, 
    catalogType: string, 
    catalogId: string
  ): Promise<MetaPreview[]> {
    // Ensure clients are initialized for this profile
    await this.getClientsForProfile(profileId)
    
    const normalizedUrl = this.normalizeUrl(manifestUrl)
    const client = this.clientCache.get(normalizedUrl)
    
    if (!client || !client.manifest) {
      console.warn(`[AddonManager] Client not found for ${manifestUrl}`)
      return []
    }

    const catalog = client.manifest.catalogs.find(c => c.type === catalogType && c.id === catalogId)
    if (!catalog) {
      console.warn(`[AddonManager] Catalog ${catalogId} not found in ${client.manifest.name}`)
      return []
    }

    try {
      const settingsProfileId = profileDb.getSettingsProfileId(profileId)
      const { appearanceDb } = require('../database')
      const appearance = settingsProfileId ? appearanceDb.getSettings(settingsProfileId) : undefined
      const config = {
        enableAgeRating: appearance ? appearance.show_age_ratings : true,
        showAgeRatingInGenres: appearance ? appearance.show_age_ratings : true
      }

      const items = await client.getCatalog(catalogType, catalogId, {}, config)
      const parentalSettings = this.getParentalSettings(profileId)
      const profile = profileDb.findById(profileId)
      let filteredItems = await this.filterContent(items, parentalSettings, profile?.user_id)
      
      // Row filling logic if parental controls filter too many items
      if (parentalSettings.enabled && filteredItems.length < 20 && items.length > 0) {
        let currentSkip = items.length
        let attempts = 0
        const maxAttempts = 3
        
        while (filteredItems.length < 20 && attempts < maxAttempts) {
          try {
            const nextItems = await client.getCatalog(catalogType, catalogId, { skip: currentSkip.toString() }, config)
            if (!nextItems || nextItems.length === 0) break
            
            const nextFiltered = await this.filterContent(nextItems, parentalSettings, profile?.user_id)
            filteredItems = [...filteredItems, ...nextFiltered]
            currentSkip += nextItems.length
            attempts++
          } catch (e) {
            break
          }
        }
      }

      return this.enrichContent(filteredItems, profileId)
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      console.error(`[AddonManager] Failed to fetch catalog ${catalogId} from ${manifestUrl}`, e)
      return []
    }
  }
}

export const addonManager = new AddonManager()