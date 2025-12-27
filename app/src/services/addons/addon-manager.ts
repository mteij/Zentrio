import { AddonClient, RetryableError } from './client'
import { ZentrioAddonClient } from './zentrio-client'
import { Manifest, MetaPreview, MetaDetail, Stream, Subtitle } from './types'
import { addonDb, streamDb, profileDb, profileProxySettingsDb, watchHistoryDb } from '../database'
import { getConfig } from '../envParser'
import { StreamProcessor, ParsedStream } from './stream-processor'
import { tmdbService } from '../tmdb/index'

const DEFAULT_TMDB_ADDON = 'zentrio://tmdb-addon'

export class AddonManager {
  private clientCache = new Map<string, AddonClient>()

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
    console.log(`[AddonManager] Found ${addons.length} enabled addons for profile ${profileId} (settings: ${settingsProfileId}):`, addons.map(a => a.name))
    
    // If no addons enabled, check if we should enable default for this profile automatically
    if (addons.length === 0) {
      const defaultAddon = addonDb.findByUrl(DEFAULT_TMDB_ADDON)
      if (defaultAddon) {
          // Only auto-enable if user has TMDB key
          const profile = profileDb.findById(profileId)
          if (profile?.user_id) {
             const tmdbClient = await tmdbService.getClient(profile.user_id)
             if (tmdbClient) {
                addonDb.enableForProfile(settingsProfileId, defaultAddon.id)
                addons.push(defaultAddon)
             }
          }
      }
    }

    const clients: AddonClient[] = []
    const initPromises: Promise<any>[] = []

    const profile = profileDb.findById(profileId)
    const userId = profile?.user_id
    
    // Check for TMDB Key
    const tmdbClient = userId ? await tmdbService.getClient(userId) : null
    const hasTmdbKey = !!tmdbClient

    for (const addon of addons) {
      // Force disable Zentrio if no key
      if (addon.manifest_url === DEFAULT_TMDB_ADDON && !hasTmdbKey) {
          console.warn(`[AddonManager] Zentrio addon enabled but no TMDB key found. Forcefully disabling.`);
          try {
             addonDb.disableForProfile(settingsProfileId, addon.id)
          } catch (e) {
             console.error('Failed to auto-disable Zentrio addon', e)
          }
          continue;
      }

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

  async getCatalogs(profileId: number): Promise<{ addon: Manifest, manifestUrl: string, catalog: any, items: MetaPreview[] }[]> {
    const clients = await this.getClientsForProfile(profileId)
    let results: { addon: Manifest, manifestUrl: string, catalog: any, items: MetaPreview[] }[] = []

    const profile = profileDb.findById(profileId)
    const tmdbClient = profile?.user_id ? await tmdbService.getClient(profile.user_id) : null
    const hasTmdbKey = !!tmdbClient

    for (const client of clients) {
      if (!client.manifest) continue
      for (const cat of client.manifest.catalogs) {
        try {
          if (cat.extra?.some(e => e.isRequired)) continue
          
          const settingsProfileId = profileDb.getSettingsProfileId(profileId);
          const { appearanceDb } = require('../database');
          const appearance = settingsProfileId ? appearanceDb.getSettings(settingsProfileId) : undefined;
          const config = {
              enableAgeRating: appearance ? appearance.show_age_ratings : true,
              showAgeRatingInGenres: appearance ? appearance.show_age_ratings : true
          };

          let items = await client.getCatalog(cat.type, cat.id, {}, config)
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

          results.push({
            addon: client.manifest,
            manifestUrl: client.manifestUrl,
            catalog: cat,
            items: filteredItems
          })
        } catch (e) {
          console.warn(`Failed to fetch catalog ${cat.id} from ${client.manifest.name}`, e)
        }
      }
    }

    // Sort results to prioritize Zentrio (TMDB) addon
    results.sort((a, b) => {
        const isZentrioA = a.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON) || a.addon.id === 'org.zentrio.tmdb';
        const isZentrioB = b.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON) || b.addon.id === 'org.zentrio.tmdb';
        if (isZentrioA && !isZentrioB) return -1;
        if (!isZentrioA && isZentrioB) return 1;
        return 0;
    });

    // If no catalogs are found after checking all enabled addons, fallback logic
    if (results.length === 0) {
      // 1. Try default Zentrio addon IF user has a key
      if (hasTmdbKey) {
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

                let items = await defaultClient.getCatalog(cat.type, cat.id, {}, config);
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

      // 2. If default TMDB addon also failed or skipped (no key), fallback to Cinemeta
      if (results.length === 0) {
          console.log(`[AddonManager] No content available. Falling back to Cinemeta.`);
          const cinemetaUrl = 'https://v3-cinemeta.strem.io/manifest.json';
          let cinemetaClient = this.clientCache.get(cinemetaUrl);
          if (!cinemetaClient) {
              cinemetaClient = new AddonClient(cinemetaUrl);
              this.clientCache.set(cinemetaUrl, cinemetaClient);
          }

          try {
              await cinemetaClient.init();
              if (cinemetaClient.manifest) {
                  for (const cat of cinemetaClient.manifest.catalogs) {
                      // Cinemeta has 'top' and 'year' catalogs usually.
                      // We only want simple ones to avoid clutter or errors.
                      if (cat.extra?.some(e => e.isRequired)) continue;

                      let items = await cinemetaClient.getCatalog(cat.type, cat.id, {});
                      const parentalSettings = this.getParentalSettings(profileId);
                      let filteredItems = await this.filterContent(items, parentalSettings, profile?.user_id);
                      
                      // Row filling logic
                      if (parentalSettings.enabled && filteredItems.length < 20 && items.length > 0) {
                          let currentSkip = items.length;
                          let attempts = 0;
                          const maxAttempts = 3;
                          while (filteredItems.length < 20 && attempts < maxAttempts) {
                              try {
                                  // Cinemeta definitely supports skip
                                  const nextItems = await cinemetaClient.getCatalog(cat.type, cat.id, { skip: currentSkip.toString() });
                                  if (!nextItems || nextItems.length === 0) break;
                                  const nextFiltered = await this.filterContent(nextItems, parentalSettings, profile?.user_id);
                                  filteredItems = [...filteredItems, ...nextFiltered];
                                  currentSkip += nextItems.length;
                                  attempts++;
                              } catch (e) { break; }
                          }
                      }

                      results.push({
                          addon: cinemetaClient.manifest,
                          manifestUrl: cinemetaClient.manifestUrl,
                          catalog: cat,
                          items: filteredItems
                      });
                  }
              }
          } catch (e) {
              console.error('Failed to fetch catalogs from Cinemeta fallback.', e);
          }
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
            const final = combined.slice(0, 20); // Return top 20 items available for the UI
            return this.enrichContent(final, profileId);
        }
      } catch (e) {
        console.warn('Failed to fetch mixed trending from TMDB addon', e)
      }
    }

    // 3. Fallback to any client (old behavior)
    for (const client of clients) {
      if (!client.manifest) continue
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
            const enriched = await this.enrichContent(filtered, profileId);
            return enriched.slice(0, 10)
          }
        }
      } catch (e) {
        // ignore
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
                 const filtered = await this.filterContent(items, parentalSettings, profile?.user_id);
                 return this.enrichContent(filtered.slice(0, 10), profileId);
             }
        }
      } catch (e) {
        console.warn(`Failed to fetch trending ${type} from TMDB addon`, e)
      }
    }
    
    return [];
  }

  private getParentalSettings(profileId: number) {
      const proxySettings = profileProxySettingsDb.findByProfileId(profileId);
      const ageMap: Record<number, string> = {
          6: 'G',
          9: 'PG',
          12: 'PG-13',
          16: 'R',
          18: 'NC-17'
      };
      // Default to R if unknown, but respecting enabled flag
      const ratingLimit = proxySettings?.nsfw_age_rating ? (ageMap[proxySettings.nsfw_age_rating] || 'R') : 'R';
      
      return {
          enabled: proxySettings?.nsfw_filter_enabled ?? false,
          ratingLimit
      };
  }

   private async filterContent(items: MetaPreview[], parentalSettings: { enabled: boolean, ratingLimit: string }, userId?: string): Promise<MetaPreview[]> {
    // If filtering is disabled, we still want to try to populate age ratings if they are missing
    // But fetching them for ALL items might be slow if we do it here. 
    // However, the user complained "Badges are missing".
    // If we only fetch when filtering is enabled, then badges will be missing when filtering is disabled.
    // Ideally we should separate "enrichment" from "filtering".
    // But for now, let's just make sure that IF we find it, we save it.
    
    // We ALWAYS want to normalize/find ratings if we can, to show badges?
    // Or only if filtering is enabled? 
    // The user has age limit set, so passing parentalSettings.enabled = true.
    
    const ratingLimit = parentalSettings.ratingLimit || 'R';
    const ratings = ['G', 'PG', 'PG-13', 'R', 'NC-17'];
    const limitIndex = ratings.indexOf(ratingLimit);
    
    // Initialize TMDB client if user ID is provided
    const tmdbClient = userId ? await tmdbService.getClient(userId) : null;

    const filteredItems = await Promise.all(items.map(async (item) => {
        const itemAny = item as Record<string, any>;
        
        // Try to find certification with country fallback (US -> GB -> NL)
        let cert = itemAny.ageRating || itemAny.certification || itemAny.rating || itemAny.contentRating || itemAny.info?.certification || itemAny.info?.rating;

        // If certification is an object (e.g. from TMDB sometimes), try to find by country
        if (typeof cert === 'object' && cert !== null) {
            cert = (cert as Record<string, any>)['US'] || (cert as Record<string, any>)['GB'] || (cert as Record<string, any>)['NL'] || Object.values(cert)[0];
        }
        
        // Also check releaseInfo if it contains certification
        if (!cert && itemAny.releaseInfo && typeof itemAny.releaseInfo === 'string') {
            const parts = itemAny.releaseInfo.split('|').map((s: string) => s.trim());
            const potentialRating = parts.find((p: string) => ratings.includes(p) || p.startsWith('TV-'));
            if (potentialRating) cert = potentialRating;
        }

        // If no cert found and we have TMDB client, try to fetch it
        // We do this regardless of filtering enabled, so we can show badges?
        // But doing this for every item in every catalog might be too slow on dashboard load.
        // Let's restrict to: if filtering enabled OR if we are enriching (maybe add a flag?)
        // For now, assume if we are here, we want to try our best.
        if (!cert && tmdbClient && (parentalSettings.enabled || true)) { 
             // We enable this always for now to fix "no badges" issue, effectively enriching on the fly.
            try {
                let tmdbId: string | null = null;
                let type: 'movie' | 'series' = item.type === 'movie' ? 'movie' : 'series';

                console.log('[Enrichment] Checking item:', item.id, item.type, 'Has cert:', !!cert);

                if (item.id.startsWith('tmdb:')) {
                    tmdbId = item.id.split(':')[1];
                } else if (item.id.startsWith('tt')) {
                     // Resolve IMDB ID to TMDB ID
                     const findResults = await tmdbClient.find({
                         id: item.id,
                         external_source: 'imdb_id'
                     });
                     
                     if (type === 'movie' && findResults.movie_results?.length > 0) {
                         tmdbId = findResults.movie_results[0].id.toString();
                     } else if (type === 'series' && findResults.tv_results?.length > 0) {
                         tmdbId = findResults.tv_results[0].id.toString();
                     } else {
                         // Fallback: try to guess type from results if type is ambiguous or we want to be robust
                         if (findResults.movie_results?.length > 0) {
                             tmdbId = findResults.movie_results[0].id.toString();
                             type = 'movie';
                         } else if (findResults.tv_results?.length > 0) {
                             tmdbId = findResults.tv_results[0].id.toString();
                             type = 'series';
                         }
                     }
                     console.log('[Enrichment] Resolved tt to tmdb:', item.id, '->', tmdbId);
                }

                if (tmdbId) {
                    // Use 'en-US' as default language for rating check
                    cert = await tmdbService.getAgeRating(tmdbClient, tmdbId, type, 'en-US');
                    console.log('[Enrichment] Fetched cert for', tmdbId, ':', cert);
                }
            } catch (e) {
                console.warn('[Enrichment] Failed:', e);
            }
        }

        if (cert) {
            // Normalize cert
            let certStr = String(cert).toUpperCase();
            
            // Map common variations
            let mappedCert = certStr;
            if (certStr.startsWith('TV-')) mappedCert = certStr.replace('TV-', '');
            if (mappedCert === 'MA') mappedCert = 'NC-17';
            if (mappedCert === '14') mappedCert = 'PG-13';
            if (mappedCert === 'Y' || mappedCert === 'Y7') mappedCert = 'G';
            
            // UK (BBFC)
            if (mappedCert === 'U') mappedCert = 'G';
            if (mappedCert === '12' || mappedCert === '12A') mappedCert = 'PG-13';
            if (mappedCert === '15') mappedCert = 'R';
            if (mappedCert === '18' || mappedCert === 'R18' || mappedCert === 'CAUTION') mappedCert = 'NC-17';
            if (mappedCert === 'E') mappedCert = 'G';

            // UK (Non-BBFC / Additional)
            if (mappedCert === 'ALL' || mappedCert === '0+') mappedCert = 'G';
            if (mappedCert === '6+') mappedCert = 'PG';
            if (mappedCert === '7+') mappedCert = 'PG';
            if (mappedCert === '9+') mappedCert = 'PG';
            if (mappedCert === '12+') mappedCert = 'PG-13';
            if (mappedCert === '13+' || mappedCert === 'TEEN') mappedCert = 'PG-13';
            if (mappedCert === '14+') mappedCert = 'PG-13';
            if (mappedCert === '16') mappedCert = 'R';
            if (mappedCert === 'MATURE' || mappedCert === 'ADULT') mappedCert = 'NC-17';

            // Netherlands
            if (mappedCert === 'AL') mappedCert = 'G';
            if (mappedCert === '6') mappedCert = 'PG';
            if (mappedCert === '9') mappedCert = 'PG';
            if (mappedCert === '12') mappedCert = 'PG-13';
            if (mappedCert === '14') mappedCert = 'PG-13';
            if (mappedCert === '16') mappedCert = 'R';
            if (mappedCert === '18') mappedCert = 'NC-17';
            
            // USA (MPA)
            if (mappedCert === 'APPROVED') mappedCert = 'G';
            
            // ASSIGN BACK so the UI can see it! 
            itemAny.certification = mappedCert; // Standardize on one property if possible, or update the one used in UI
            // The UI looks for certification || rating || contentRating
            
            const itemRatingIndex = ratings.indexOf(mappedCert);
            
            if (parentalSettings.enabled && limitIndex !== -1) {
                if (itemRatingIndex > limitIndex) return false;
            }
        } else {
             // If no cert found, strict mode: hide content
             if (parentalSettings.enabled) return false;
        }
        
        return true;
    }));

    return items.filter((_, index) => filteredItems[index]);
  }

  private async enrichContent(items: MetaPreview[], profileId: number): Promise<MetaPreview[]> {
    if (items.length === 0) return items;
    
    // Get unique IDs and potential aliases (e.g. without tmdb: prefix)
    const distinctIds = new Set<string>();
    items.forEach(i => {
        distinctIds.add(i.id);
        if (i.id.startsWith('tmdb:')) {
            distinctIds.add(i.id.replace('tmdb:', ''));
        }
    });

    const ids = Array.from(distinctIds);
    
    try {
        const statusMap = watchHistoryDb.getBatchStatus(profileId, ids);
        
        return items.map(item => {
            // Try exact match, then stripped match
            let status = statusMap[item.id];
            if (!status && item.id.startsWith('tmdb:')) {
                status = statusMap[item.id.replace('tmdb:', '')];
            }
            
            if (status) {
                // console.log('[EnrichContent] Match found for', item.id, status);
                const enriched = { ...item } as any;
                if (status.isWatched) enriched.isWatched = true;
                if (status.progress > 0) enriched.progressPercent = status.progress;
                if (status.lastStream) enriched.lastStream = status.lastStream;
                if ((status as any).episodeDisplay) enriched.episodeDisplay = (status as any).episodeDisplay;
                return enriched;
            }
            return item;
        });
    } catch (e) {
        console.warn('Failed to enrich content with watch status', e);
        return items;
    }
  }

  async getMeta(type: string, id: string, profileId: number): Promise<MetaDetail | null> {
    const clients = await this.getClientsForProfile(profileId)
    const settingsProfileId = profileDb.getSettingsProfileId(profileId);
    const settings = settingsProfileId ? streamDb.getSettings(settingsProfileId) : undefined;
    const profile = profileDb.findById(profileId);
    
    // Check for TMDB Key
    const tmdbClient = profile?.user_id ? await tmdbService.getClient(profile.user_id) : null
    const hasTmdbKey = !!tmdbClient

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
    
    // Pass 1: Try addons that support meta for this type and can handle this ID
    for (const client of sortedClients) {
      if (!client.manifest) continue
      
      // Skip Zentrio if no key
      const isZentrio = client.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON) || client.manifest.id === 'org.zentrio.tmdb';
      if (isZentrio && !hasTmdbKey) continue;

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
                   if (primaryId.startsWith('tt') && isZentrio) {
                      shouldQuery = true;
                   }
               }
          }
      }

      if (!shouldQuery) continue;

      try {
        console.log(`[AddonManager] Trying ${client.manifest.name} for meta ${type}/${primaryId}`)
        const meta = await client.getMeta(type, id, config)
        if (meta) {
          console.log(`[AddonManager] Got meta from ${client.manifest.name} for ${type}/${primaryId}`)
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
                if (meta) return meta
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
             if (meta) return meta;
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
                     if (meta) return meta
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
    let uniqueResults = Array.from(new Map(results.map(item => [item.id, item])).values());

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

      let items = await client.getCatalog(type, id, extra, config)
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

    for (const client of clients) {
      if (!client.manifest) continue
      
      // Find a catalog that supports this type and (optionally) genre
      const catalog = client.manifest.catalogs.find(c => {
        if (c.type !== type) return false
        if (genre) {
          // Check if genre is supported. 
          // Note: some addons use 'genre' extra without options (means any genre allowed)
          // others specify options.
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
          results.push(...items)
        } catch (e) {
          console.warn(`Failed to fetch filtered items from ${client.manifest.name}`, e)
        }
      }
    }
    
    
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

    const videoId = (type === 'series' && season !== undefined && episode !== undefined) ? `${id}:${season}:${episode}` : id

    // Helper function to fetch streams with retry support
    const fetchStreamsWithRetry = async (client: AddonClient, maxRetries: number = 3): Promise<void> => {
      if (!client.manifest) return
      
      // Use proper resource checking that handles object resources
      if (!this.supportsResource(client.manifest, 'stream', type)) return
      
      // Check ID prefixes using the proper per-resource or manifest-level prefixes
      if (!this.canHandleId(client.manifest, 'stream', id)) return

      let attempt = 0
      while (attempt < maxRetries) {
        try {
          console.log(`[${client.manifest.name}] Requesting streams for ${type}/${videoId}${attempt > 0 ? ` (attempt ${attempt + 1}/${maxRetries})` : ''}`)
          const streams = await client.getStreams(type, videoId)
          console.log(`[${client.manifest.name}] Received ${streams ? streams.length : 0} streams`)
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

    const videoId = (type === 'series' && season !== undefined && episode !== undefined) 
      ? `${id}:${season}:${episode}` : id

    // Fetch streams from each addon and callback as they complete
    const fetchFromAddon = async (client: AddonClient): Promise<void> => {
      if (!client.manifest) return

      // Use proper resource checking that handles object resources
      if (!this.supportsResource(client.manifest, 'stream', type)) return
      
      // Check ID prefixes using the proper per-resource or manifest-level prefixes
      if (!this.canHandleId(client.manifest, 'stream', id)) return

      // Notify that this addon is starting
      callbacks?.onAddonStart?.(client.manifest)

      const maxRetries = 3
      let attempt = 0

      while (attempt < maxRetries) {
        try {
          console.log(`[${client.manifest.name}] Requesting streams for ${type}/${videoId}${attempt > 0 ? ` (attempt ${attempt + 1}/${maxRetries})` : ''}`)
          const streams = await client.getStreams(type, videoId)
          console.log(`[${client.manifest.name}] Received ${streams ? streams.length : 0} streams`)
          
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

    const promises = clients.map(async (client) => {
      if (!client.manifest) return

      // Use proper resource checking that handles object resources
      if (!this.supportsResource(client.manifest, 'subtitles', type)) return
      
      // Check ID prefixes using the proper per-resource or manifest-level prefixes
      if (!this.canHandleId(client.manifest, 'subtitles', id)) return

      try {
        console.log(`Requesting subtitles from ${client.manifest.name} for ${type}/${id}`)
        const subtitles = await client.getSubtitles(type, id, videoHash)
        console.log(`Received ${subtitles ? subtitles.length : 0} subtitles from ${client.manifest.name}`)
        if (subtitles && subtitles.length > 0) {
          results.push({ addon: client.manifest, subtitles })
        }
      } catch (e) {
        console.warn(`Failed to fetch subtitles from ${client.manifest.name}`, e)
      }
    })

    await Promise.allSettled(promises)
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

      let items = await client.getCatalog(catalogType, catalogId, {}, config)
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