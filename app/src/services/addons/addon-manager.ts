import { addonDb, appearanceDb, db, profileDb } from '../database'
import { type AgeRating } from '../tmdb/age-ratings'
import { tmdbService } from '../tmdb/index'
import { AddonClient } from './client'
import { Manifest, MetaDetail, MetaPreview, Subtitle } from './types'
import { DEFAULT_TMDB_CATALOG_CONFIG, type TmdbCatalogEntry, ZentrioAddonClient } from './zentrio-client'
// Extracted helper modules
import { logger } from '../logger'
import { enrichContent, filterContent, getParentalSettings } from './content-filter'
import {
    catalogSupportsBrowseGenre,
    isLanguageBrowseCatalog,
    isLanguageBrowseOption,
    itemMatchesBrowseGenre,
    normalizeBrowseGenreOption,
} from './genre-utils'
import { normalizeMetaVideos } from './meta-normalizer'
import { buildSearchQueryVariants, scoreSearchMatch } from '../../utils/search'

const log = logger.scope('AddonManager')

const DEFAULT_TMDB_ADDON = 'zentrio://tmdb-addon'

type AppearanceConfig = {
    enableAgeRating: boolean
    showAgeRatingInGenres: boolean
}

type ProfileContext = {
    profileId: number
    profile: ReturnType<typeof profileDb.findById>
    settingsProfileId: number | null
    parentalSettings: { enabled: boolean; ratingLimit: AgeRating }
    appearanceConfig: AppearanceConfig
    userId?: string
}

type SearchCatalogMetadata = {
    addon: { id: string; name: string; logo?: string }
    manifestUrl: string
    catalog: { type: string; id: string; name?: string }
    title: string
}

type SearchCatalogResult = SearchCatalogMetadata & {
    items: MetaPreview[]
}

export class AddonManager {
    private clientCache = new Map<string, AddonClient>()
    private tmdbToImdbCache = new Map<string, string>() // Cache for TMDB -> IMDB ID resolution

    private normalizeUrl(url: string): string {
        if (url.endsWith('manifest.json')) {
            return url
        }
        return `${url.replace(/\/$/, '')}/manifest.json`
    }

    private buildSearchCatalogTitle(addonName: string, catalogType: string, catalogName?: string): string {
        const typeLabel = catalogType === 'movie' ? 'Movies' : catalogType === 'series' ? 'Series' : catalogType
        return catalogName ? `${addonName} - ${catalogName}` : `${addonName} - ${typeLabel}`
    }

    private sortSearchItems(items: MetaPreview[], query: string): MetaPreview[] {
        return [...items].sort((a, b) => {
            const scoreDelta = scoreSearchMatch(b.name, query) - scoreSearchMatch(a.name, query)
            if (scoreDelta !== 0) return scoreDelta

            const popularityA = typeof a.popularity === 'number' ? a.popularity : 0
            const popularityB = typeof b.popularity === 'number' ? b.popularity : 0
            if (popularityB !== popularityA) return popularityB - popularityA

            const voteCountA = typeof a.voteCount === 'number' ? a.voteCount : 0
            const voteCountB = typeof b.voteCount === 'number' ? b.voteCount : 0
            if (voteCountB !== voteCountA) return voteCountB - voteCountA

            const ratingA = a.imdbRating ? parseFloat(a.imdbRating) : 0
            const ratingB = b.imdbRating ? parseFloat(b.imdbRating) : 0
            if (ratingB !== ratingA) return ratingB - ratingA

            const yearA = a.released ? new Date(a.released).getTime() : 0
            const yearB = b.released ? new Date(b.released).getTime() : 0
            return yearB - yearA
        })
    }

    private async searchCatalogWithVariants(
        client: AddonClient,
        catalog: { type: string; id: string; name?: string },
        query: string,
        context: ProfileContext
    ): Promise<MetaPreview[]> {
        const variants = buildSearchQueryVariants(query)
        const deduped = new Map<string, MetaPreview>()

        for (let index = 0; index < variants.length; index++) {
            const variant = variants[index]
            let items: MetaPreview[] = []
            try {
                items = await client.getCatalog(catalog.type, catalog.id, { search: variant }, context.appearanceConfig)
            } catch (e) {
                log.warn(`Search variant failed for ${client.manifest?.name}/${catalog.id} (${variant}): ${e instanceof Error ? e.message : String(e)}`)
                continue
            }

            for (const item of items) {
                const existing = deduped.get(item.id)
                if (!existing || scoreSearchMatch(item.name, query) > scoreSearchMatch(existing.name, query)) {
                    deduped.set(item.id, item)
                }
            }

            if (deduped.size > 0) {
                const hasStrongMatch = Array.from(deduped.values()).some(item => scoreSearchMatch(item.name, query) >= 850)
                if (hasStrongMatch || index >= 1) {
                    break
                }
            }
        }

        if (deduped.size === 0) return []

        const filtered = await this.applyParentalFilter(Array.from(deduped.values()), context)
        if (filtered.length === 0) return []

        const enriched = await this.enrichItems(filtered, context)
        return this.sortSearchItems(enriched, query)
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
                    behavior_hints: { configurationRequired: true }
                })
            }
        } catch (e) {
            log.warn(`Failed to init default addon: ${e instanceof Error ? e.message : String(e)}`)
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

    private getProfileContext(profileId: number): ProfileContext {
        const profile = profileDb.findById(profileId)
        const settingsProfileId = profileDb.getSettingsProfileId(profileId)
        const parentalSettings = getParentalSettings(profileId)
        let appearanceConfig: AppearanceConfig = {
            enableAgeRating: true,
            showAgeRatingInGenres: true
        }

        if (settingsProfileId) {
            const appearance = appearanceDb.getSettings(settingsProfileId)
            appearanceConfig = {
                enableAgeRating: appearance ? appearance.show_age_ratings : true,
                showAgeRatingInGenres: appearance ? appearance.show_age_ratings : true
            }
        }

        return {
            profileId,
            profile,
            settingsProfileId: settingsProfileId ?? null,
            parentalSettings,
            appearanceConfig,
            userId: profile?.user_id
        }
    }

    private async applyParentalFilter(items: MetaPreview[], context: ProfileContext): Promise<MetaPreview[]> {
        return filterContent(items, context.parentalSettings, context.userId)
    }

    private async enrichItems(items: MetaPreview[], context: ProfileContext): Promise<MetaPreview[]> {
        return enrichContent(items, context.profileId)
    }

    private selectFilteredCatalog(client: AddonClient, type: string, genre?: string) {
        const catalogs = client.manifest?.catalogs.filter(c => c.type === type) || []

        if (!genre) {
            return catalogs.find(c => !c.extra?.some(e => e.isRequired)) || catalogs[0]
        }

        const matchingCatalogs = catalogs.filter(c => catalogSupportsBrowseGenre(c, genre))
        if (matchingCatalogs.length === 0) return null

        return matchingCatalogs.find(c => !c.extra?.some(e => e.isRequired)) || matchingCatalogs[0]
    }

    private loadTmdbCatalogConfig(settingsProfileId: number): TmdbCatalogEntry[] {
        try {
            const row = db.prepare('SELECT tmdb_catalog_config FROM settings_profiles WHERE id = ?').get(settingsProfileId) as { tmdb_catalog_config: string | null } | null
            if (row?.tmdb_catalog_config) {
                const parsed = JSON.parse(row.tmdb_catalog_config) as TmdbCatalogEntry[]
                if (Array.isArray(parsed) && parsed.length > 0) return parsed
            }
        } catch {
            // fall through to defaults
        }
        return DEFAULT_TMDB_CATALOG_CONFIG
    }

    private async getClientsForProfile(profileId: number): Promise<AddonClient[]> {
        // Resolve settings profile ID
        const settingsProfileId = profileDb.getSettingsProfileId(profileId);
        if (!settingsProfileId) {
            log.warn(`No settings profile found for profile ${profileId}`);
            return [];
        }

        const addons = addonDb.getEnabledForProfile(settingsProfileId)

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
            // Use settings-profile-scoped cache key for Zentrio so each profile gets its own catalog config
            const cacheKey = addon.manifest_url === DEFAULT_TMDB_ADDON ? `${normalizedUrl}:${settingsProfileId}` : normalizedUrl
            let client = this.clientCache.get(cacheKey)
            if (!client) {
                if (addon.manifest_url === DEFAULT_TMDB_ADDON) {
                    const catalogConfig = this.loadTmdbCatalogConfig(settingsProfileId)
                    client = new ZentrioAddonClient(addon.manifest_url, userId, catalogConfig)
                } else {
                    client = new AddonClient(addon.manifest_url)
                }
                this.clientCache.set(cacheKey, client)
                // Only init if new or not ready
                initPromises.push(client.init().then(() => { }).catch(e => log.warn(`Failed to init ${addon.name}`, e)))
            } else if (!client.manifest) {
                // Retry init if failed previously or incomplete
                initPromises.push(client.init().then(() => { }).catch(e => log.warn(`Failed to re-init ${addon.name}`, e)))
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
            log.warn(`Failed to resolve TMDB ID ${tmdbId} to IMDB`, e)
        }
        return null
    }

    async getCatalogs(profileId: number): Promise<{ addon: Manifest, manifestUrl: string, catalog: any, items: MetaPreview[] }[]> {
        const clients = await this.getClientsForProfile(profileId)
        const results: { addon: Manifest, manifestUrl: string, catalog: any, items: MetaPreview[] }[] = []
        const context = this.getProfileContext(profileId)

        const fetchCatalog = async (client: AddonClient, cat: any) => {
            try {
                if (cat.extra?.some((e: any) => e.isRequired)) return null

                const items = await client.getCatalog(cat.type, cat.id, {}, context.appearanceConfig)
                let filteredItems = await this.applyParentalFilter(items, context)

                // Row filling logic: if not enough items, fetch more
                if (context.parentalSettings.enabled && filteredItems.length < 20 && items.length > 0) {
                    let currentSkip = items.length; // Start skipping what we just fetched
                    let attempts = 0;
                    const maxAttempts = 3; // Prevent infinite loops

                    while (filteredItems.length < 20 && attempts < maxAttempts) {
                        try {
                            // Some addons rely on 'skip', others might ignore it. 
                            // For standard Stremio addons, skip should work.
                            const nextItems = await client.getCatalog(cat.type, cat.id, { skip: currentSkip.toString() }, context.appearanceConfig)
                            if (!nextItems || nextItems.length === 0) break;

                            const nextFiltered = await this.applyParentalFilter(nextItems, context)
                            filteredItems = [...filteredItems, ...nextFiltered];
                            currentSkip += nextItems.length;
                            attempts++;

                            // Safety break if we aren't getting anything new (infinite loop of same items?)
                            // Standard addons shouldn't return same items for different skip, but who knows.
                        } catch (_e) {
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
                log.warn(`Failed to fetch catalog ${cat.id} from ${client.manifest!.name}`, e)
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
            log.debug(`No catalogs found. Falling back to default TMDB addon.`);
            const normalizedDefaultUrl = this.normalizeUrl(DEFAULT_TMDB_ADDON)
            const fallbackCacheKey = context.settingsProfileId ? `${normalizedDefaultUrl}:${context.settingsProfileId}` : normalizedDefaultUrl
            let defaultClient = this.clientCache.get(fallbackCacheKey);
            if (!defaultClient) {
                const catalogConfig = context.settingsProfileId ? this.loadTmdbCatalogConfig(context.settingsProfileId) : DEFAULT_TMDB_CATALOG_CONFIG
                defaultClient = new ZentrioAddonClient(DEFAULT_TMDB_ADDON, context.userId, catalogConfig)
                this.clientCache.set(fallbackCacheKey, defaultClient);
            }

            try {
                await defaultClient.init();
                if (defaultClient.manifest) {
                    for (const cat of defaultClient.manifest.catalogs) {
                        if (cat.extra?.some(e => e.isRequired)) continue;

                        const items = await defaultClient.getCatalog(cat.type, cat.id, {}, context.appearanceConfig)
                        let filteredItems = await this.applyParentalFilter(items, context)

                        // Row filling logic
                        if (context.parentalSettings.enabled && filteredItems.length < 20 && items.length > 0) {
                            let currentSkip = items.length;
                            let attempts = 0;
                            const maxAttempts = 3;
                            while (filteredItems.length < 20 && attempts < maxAttempts) {
                                try {
                                    const nextItems = await defaultClient.getCatalog(cat.type, cat.id, { skip: currentSkip.toString() }, context.appearanceConfig)
                                    if (!nextItems || nextItems.length === 0) break;
                                    const nextFiltered = await this.applyParentalFilter(nextItems, context)
                                    filteredItems = [...filteredItems, ...nextFiltered];
                                    currentSkip += nextItems.length;
                                    attempts++;
                                } catch (_e) { break; }
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
                log.error('Failed to fetch catalogs from default TMDB addon fallback.', e);
            }
        }

        return results
    }

    async getTrending(profileId: number): Promise<MetaPreview[]> {
        const clients = await this.getClientsForProfile(profileId)
        const context = this.getProfileContext(profileId)

        // 2. Try to find TMDB addon (Zentrio)
        const tmdbClient = clients.find(c => c.manifest?.id?.includes('tmdb') || c.manifest?.name?.toLowerCase().includes('tmdb') || c.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON))

        if (tmdbClient) {
            try {
                // Try to get both trending movies and series
                // We look for 'tmdb.trending' catalog ID, or 'tmdb.top' as fallback
                const trendingMovieCat = tmdbClient.manifest?.catalogs.find(c => c.type === 'movie' && (c.id === 'tmdb.trending' || c.id === 'tmdb.top'));
                const trendingSeriesCat = tmdbClient.manifest?.catalogs.find(c => c.type === 'series' && (c.id === 'tmdb.trending' || c.id === 'tmdb.top'));

                const promises: Promise<MetaPreview[]>[] = [];

                if (trendingMovieCat) {
                    promises.push(tmdbClient.getCatalog(trendingMovieCat.type, trendingMovieCat.id, {}, context.appearanceConfig)
                        .then(items => this.applyParentalFilter(items, context)));
                } else {
                    promises.push(Promise.resolve([]));
                }

                if (trendingSeriesCat) {
                    promises.push(tmdbClient.getCatalog(trendingSeriesCat.type, trendingSeriesCat.id, {}, context.appearanceConfig)
                        .then(items => this.applyParentalFilter(items, context)));
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
                    if (context.parentalSettings.enabled && combined.length < 10) {
                        let currentSkip = 20; // Start from where we left off (we fetched 20 initially)
                        let attempts = 0;
                        const maxAttempts = 5; // More attempts for trending to ensure we get enough

                        while (combined.length < 10 && attempts < maxAttempts) {
                            try {
                                const extraPromises: Promise<MetaPreview[]>[] = [];

                                if (trendingMovieCat) {
                                    extraPromises.push(tmdbClient.getCatalog(trendingMovieCat.type, trendingMovieCat.id, { skip: currentSkip.toString() }, context.appearanceConfig)
                                        .then(items => this.applyParentalFilter(items, context)));
                                } else {
                                    extraPromises.push(Promise.resolve([]));
                                }

                                if (trendingSeriesCat) {
                                    extraPromises.push(tmdbClient.getCatalog(trendingSeriesCat.type, trendingSeriesCat.id, { skip: currentSkip.toString() }, context.appearanceConfig)
                                        .then(items => this.applyParentalFilter(items, context)));
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
                            } catch (_e) {
                                break;
                            }
                        }
                    }

                    const final = combined.slice(0, 20); // Return top 20 items available for the UI
                    return this.enrichItems(final, context)
                }
            } catch (e) {
                log.warn('Failed to fetch mixed trending from TMDB addon', e)
            }
        }

        // 3. Fallback to any client (old behavior)
        // 3. Fallback to any client (old behavior) - parallelized
        const promises = clients.map(async (client) => {
            if (!client.manifest) return null;
            try {
                const cat = client.manifest.catalogs[0]
                if (cat) {
                    const items = await client.getCatalog(cat.type, cat.id, {}, context.appearanceConfig)
                    if (items && items.length > 0) {
                        const filtered = await this.applyParentalFilter(items, context)
                        // Note: enrichment here is fine as we only return one result set in the end
                        // But we are doing this for ALL clients concurrently, which is hefty but fast.
                        return filtered; // Defer enrichment until we pick one
                    }
                }
            } catch (_e) {
                // ignore
            }
            return null;
        });

        const allResults = await Promise.all(promises);

        // Find first valid result
        for (const res of allResults) {
            if (res && res.length > 0) {
                const enriched = await this.enrichItems(res, context)
                return enriched.slice(0, 10);
            }
        }

        return []
    }

    async getTrendingByType(profileId: number, type: 'movie' | 'series'): Promise<MetaPreview[]> {
        const clients = await this.getClientsForProfile(profileId)
        const context = this.getProfileContext(profileId)

        // Try to find TMDB addon (Zentrio)
        const tmdbClient = clients.find(c => c.manifest?.id?.includes('tmdb') || c.manifest?.name?.toLowerCase().includes('tmdb') || c.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON))

        if (tmdbClient) {
            try {
                const cat = tmdbClient.manifest?.catalogs.find(c => c.type === type && (c.id === 'tmdb.trending' || c.id === 'tmdb.top'));

                if (cat) {
                    const items = await tmdbClient.getCatalog(cat.type, cat.id, {}, context.appearanceConfig)
                    if (items && items.length > 0) {
                        let filtered = await this.applyParentalFilter(items, context)

                        // Row filling logic: if not enough items after filtering, fetch more
                        if (context.parentalSettings.enabled && filtered.length < 10) {
                            let currentSkip = items.length;
                            let attempts = 0;
                            const maxAttempts = 5;

                            while (filtered.length < 10 && attempts < maxAttempts) {
                                try {
                                    const nextItems = await tmdbClient.getCatalog(cat.type, cat.id, { skip: currentSkip.toString() }, context.appearanceConfig)
                                    if (!nextItems || nextItems.length === 0) break;

                                    const nextFiltered = await this.applyParentalFilter(nextItems, context)
                                    filtered = [...filtered, ...nextFiltered];
                                    currentSkip += nextItems.length;
                                    attempts++;
                                } catch (_e) {
                                    break;
                                }
                            }
                        }

                        return this.enrichItems(filtered.slice(0, 10), context)
                    }
                }
            } catch (e) {
                log.warn(`Failed to fetch trending ${type} from TMDB addon`, e)
            }
        }

        return [];
    }

    async getMeta(type: string, id: string, profileId: number): Promise<MetaDetail | null> {
        const clients = await this.getClientsForProfile(profileId)
        const context = this.getProfileContext(profileId)

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

        const config = context.appearanceConfig

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
                const meta = await client.getMeta(type, id, config)
                if (meta) {
                    if (Array.isArray((meta as any).videos)) {
                        ; (meta as any).videos = normalizeMetaVideos((meta as any).videos)
                    }
                    return meta
                }
            } catch (e) {
                log.debug(`getMeta failed for ${client.manifest.name}:`, e instanceof Error ? e.message : e)
            }
        }

        // Pass 2: For custom IDs, try ALL meta-capable addons (ignore prefix matching)
        // This catches addons that may have idPrefixes set but still handle content from other sources
        if (!isStandardId) {
            log.debug(`Custom ID ${primaryId} - trying all meta-capable addons without prefix filtering`);

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
                            ; (meta as any).videos = normalizeMetaVideos((meta as any).videos)
                        }
                        return meta
                    }
                } catch (e) {
                    log.debug(`getMeta (pass 2) failed for ${client.manifest.name}:`, e instanceof Error ? e.message : e)
                }
            }
        }

        // Pass 3: Fallback logic for orphaned or specific IDs
        // 3a. If ID is a TMDB ID (tmdb:...), try using Zentrio Addon explicitly, even if disabled
        if (primaryId.startsWith('tmdb:')) {
            log.debug(`TMDB ID ${primaryId} not resolved by enabled addons. Attempting fallback to Zentrio Client.`);

            // Use a dedicated cache key to avoid conflicts with the main client if it exists but is disabled
            const fallbackKey = context.settingsProfileId ? `fallback:${DEFAULT_TMDB_ADDON}:${context.settingsProfileId}` : `fallback:${DEFAULT_TMDB_ADDON}`;
            let zentrioClient = this.clientCache.get(fallbackKey);

            if (!zentrioClient) {
                const catalogConfig = context.settingsProfileId ? this.loadTmdbCatalogConfig(context.settingsProfileId) : DEFAULT_TMDB_CATALOG_CONFIG
                zentrioClient = new ZentrioAddonClient(DEFAULT_TMDB_ADDON, context.userId, catalogConfig);
                this.clientCache.set(fallbackKey, zentrioClient);
            }

            try {
                if (!zentrioClient.manifest) await zentrioClient.init();
                const meta = await zentrioClient.getMeta(type, id, config);
                if (meta) {
                    if (Array.isArray((meta as any).videos)) {
                        ; (meta as any).videos = normalizeMetaVideos((meta as any).videos)
                    }
                    return meta;
                }
            } catch (e) {
                log.warn(`Fallback to Zentrio Client failed for ${id}`, e);
            }
        }

        // 3b. Fallback to Cinemeta for standard IDs only (IMDB)
        if (isStandardId) {
            log.debug(`Meta not found in enabled addons for ${type}/${id}. Falling back to Cinemeta.`);

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
                                ; (meta as any).videos = normalizeMetaVideos((meta as any).videos)
                            }
                            return meta
                        }
                    }
                } catch (e) {
                    log.warn(`Fallback to Cinemeta failed for ${type}/${id}`, e);
                }
            }
        } else {
            log.debug(`Custom ID ${id} not found in any addon. This content may not have metadata available.`);
        }

        return null
    }

    async search(query: string, profileId: number, filters?: { type?: string, year?: string, sort?: string }): Promise<MetaPreview[]> {
        const clients = await this.getClientsForProfile(profileId)
        const results: MetaPreview[] = []
        const context = this.getProfileContext(profileId)

        // Prioritize TMDB addon for search
        const tmdbClient = clients.find(c => c.manifest?.id?.includes('tmdb') || c.manifest?.name?.toLowerCase().includes('tmdb') || c.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON))

        if (tmdbClient && tmdbClient.manifest) {
            for (const cat of tmdbClient.manifest.catalogs) {
                // If type filter is set, skip catalogs that don't match
                if (filters?.type && filters.type !== 'all' && cat.type !== filters.type) continue;

                const searchExtra = cat.extra?.find(e => e.name === 'search')
                if (searchExtra) {
                    try {
                        log.debug(`Searching TMDB catalog "${cat.id}" for "${query}" with filters`, filters)

                        const items = await tmdbClient.getCatalog(cat.type, cat.id, { search: query }, {
                            ...context.appearanceConfig,
                            ...(filters?.year ? { year: parseInt(filters.year) } : {})
                        })
                        results.push(...items)
                    } catch (e) {
                        log.warn(`TMDB search failed for catalog ${cat.id}`, e)
                    }
                }
            }
            // If we got results from TMDB, return them directly
            if (results.length > 0) {
                // Simple deduplication based on ID
                const uniqueResults = Array.from(new Map(results.map(item => [item.id, item])).values());
                return this.applyParentalFilter(uniqueResults, context)
            }
        }

        // Fallback to searching all other addons if TMDB fails or isn't present
        log.debug('TMDB search yielded no results or TMDB addon not found. Falling back to all addons.')
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
                        log.warn(`Search failed for ${client.manifest.name}`, e)
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

        const filtered = await this.applyParentalFilter(uniqueResults, context)
        return this.enrichItems(filtered, context)
    }

    /**
     * Stremio-style catalog-based search.
     * Queries all addons with search-enabled catalogs in parallel and returns results grouped by catalog.
     * This provides a cleaner UX by showing where each result comes from.
     */
    async getSearchCatalogMetadata(profileId: number, filters?: { type?: string }): Promise<SearchCatalogMetadata[]> {
        const clients = await this.getClientsForProfile(profileId)
        const results: SearchCatalogMetadata[] = []

        for (const client of clients) {
            if (!client.manifest) continue

            for (const cat of client.manifest.catalogs) {
                if (filters?.type && filters.type !== 'all' && cat.type !== filters.type) continue
                if (!cat.extra?.some(e => e.name === 'search')) continue
                if (cat.extra?.some(e => e.isRequired && e.name !== 'search')) continue

                results.push({
                    addon: {
                        id: client.manifest.id,
                        name: client.manifest.name,
                        logo: client.manifest.logo || client.manifest.logo_url
                    },
                    manifestUrl: client.manifestUrl,
                    catalog: {
                        type: cat.type,
                        id: cat.id,
                        name: cat.name
                    },
                    title: this.buildSearchCatalogTitle(client.manifest.name, cat.type, cat.name)
                })
            }
        }

        results.sort((a, b) => {
            const isZentrioA = a.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON) || a.addon.id === 'org.zentrio.tmdb'
            const isZentrioB = b.manifestUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON) || b.addon.id === 'org.zentrio.tmdb'
            if (isZentrioA && !isZentrioB) return -1
            if (!isZentrioA && isZentrioB) return 1
            return 0
        })

        // Deduplicate by (manifestUrl, catalogType): keep only the first search-capable catalog
        // per addon per content type. For TMDB this prevents multiple identical search rows since
        // all TMDB catalogs hit the same underlying search API regardless of catalog id.
        const seen = new Set<string>()
        return results.filter(entry => {
            const key = `${entry.manifestUrl}::${entry.catalog.type}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }

    async searchSingleCatalog(
        query: string,
        profileId: number,
        manifestUrl: string,
        catalogType: string,
        catalogId: string
    ): Promise<MetaPreview[]> {
        await this.getClientsForProfile(profileId)
        const context = this.getProfileContext(profileId)

        const normalizedUrl = this.normalizeUrl(manifestUrl)
        const settingsProfileId = context.settingsProfileId
        const cacheKey = (manifestUrl === DEFAULT_TMDB_ADDON || normalizedUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON)) && settingsProfileId
            ? `${normalizedUrl}:${settingsProfileId}`
            : normalizedUrl
        const client = this.clientCache.get(cacheKey) ?? this.clientCache.get(normalizedUrl)

        if (!client || !client.manifest) {
            log.warn(`Client not found for ${manifestUrl} (normalized: ${normalizedUrl})`)
            return []
        }

        const catalog = client.manifest.catalogs.find(c => c.type === catalogType && c.id === catalogId)
        if (!catalog || !catalog.extra?.some(e => e.name === 'search')) {
            return []
        }

        try {
            return await this.searchCatalogWithVariants(client, catalog, query, context)
        } catch (e) {
            log.warn(`Failed search for ${client.manifest.name}/${catalogId}:`, e)
            return []
        }
    }

    async searchByCatalog(query: string, profileId: number, filters?: { type?: string }): Promise<SearchCatalogResult[]> {
        const metadata = await this.getSearchCatalogMetadata(profileId, filters)
        const results = await Promise.all(
            metadata.map(async (entry) => {
                const items = await this.searchSingleCatalog(
                    query,
                    profileId,
                    entry.manifestUrl,
                    entry.catalog.type,
                    entry.catalog.id
                )

                if (items.length === 0) return null
                return { ...entry, items }
            })
        )

        return results.filter((entry): entry is SearchCatalogResult => entry !== null)
    }

    async getCatalogItems(profileId: number, manifestUrl: string, type: string, id: string, skip?: number): Promise<{ title: string, items: MetaPreview[] } | null> {
        // Ensure clients are initialized for this profile
        await this.getClientsForProfile(profileId)
        const context = this.getProfileContext(profileId)

        const normalizedUrl = this.normalizeUrl(manifestUrl)
        const settingsProfileId = context.settingsProfileId
        const cacheKey = (manifestUrl === DEFAULT_TMDB_ADDON || normalizedUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON)) && settingsProfileId
            ? `${normalizedUrl}:${settingsProfileId}`
            : normalizedUrl
        const client = this.clientCache.get(cacheKey) ?? this.clientCache.get(normalizedUrl)
        if (!client || !client.manifest) {
            log.warn(`Client not found for ${manifestUrl} (normalized: ${normalizedUrl})`)
            return null
        }

        const catalog = client.manifest.catalogs.find(c => c.type === type && c.id === id)
        if (!catalog) return null

        try {
            const extra: Record<string, string> = {}
            if (skip) extra.skip = skip.toString()

            const items = await client.getCatalog(type, id, extra, context.appearanceConfig)
            let filteredItems = await this.applyParentalFilter(items, context)

            // If we filtered out items and have less than expected (e.g. < 20), try fetching next page
            // @ts-ignore: runtime typing gap
            if (context.parentalSettings.enabled && filteredItems.length < 20 && items.length > 0) {
                const nextSkip = (skip || 0) + items.length;
                const extraNext = { ...extra, skip: nextSkip.toString() };
                try {
                    const nextItems = await client.getCatalog(type, id, extraNext, context.appearanceConfig)
                    if (nextItems.length > 0) {
                        const nextFiltered = await this.applyParentalFilter(nextItems, context)
                        filteredItems = [...filteredItems, ...nextFiltered];
                    }
                } catch (_e) {
                    // Ignore error on next page fetch
                }
            }

            return {
                title: `${client.manifest.name} - ${catalog.name || catalog.type}`,
                items: await this.enrichItems(filteredItems, context)
            }
        } catch (e) {
            const _errorMsg = e instanceof Error ? e.message : String(e)
            log.error(`Failed to fetch catalog ${id} from ${manifestUrl}`, e)
            if (e instanceof Error) {
                log.error(e.stack || e.message)
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
                if (isLanguageBrowseCatalog(cat)) continue

                if (cat.extra) {
                    const genreExtra = cat.extra.find(e => e.name === 'genre')
                    if (genreExtra && genreExtra.options) {
                        genreExtra.options.forEach(g => {
                            // Filter out years (4 digits)
                            if (!/^\d{4}$/.test(g)) {
                                const normalized = normalizeBrowseGenreOption(g)
                                if (!isLanguageBrowseOption(normalized)) {
                                    genres.add(normalized)
                                }
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
        const context = this.getProfileContext(profileId)

        const promises = clients.map(async (client) => {
            if (!client.manifest) return []

            const catalog = this.selectFilteredCatalog(client, type, genre)

            if (catalog) {
                try {
                    const extra: Record<string, string> = {}
                    if (genre) extra.genre = genre
                    if (skip) extra.skip = skip.toString()

                    const items = await client.getCatalog(catalog.type, catalog.id, extra, context.appearanceConfig)
                    return genre ? items.filter(item => itemMatchesBrowseGenre(item, genre)) : items
                } catch (e) {
                    log.warn(`Failed to fetch filtered items from ${client.manifest.name}`, e)
                    return []
                }
            }
            return []
        });

        const nestedResults = await Promise.all(promises);
        nestedResults.forEach(r => results.push(...r));


        const filtered = await this.applyParentalFilter(results, context)
        return this.enrichItems(filtered, context)
    }

    async getSubtitles(type: string, id: string, profileId: number, videoHash?: string): Promise<{ addon: Manifest, subtitles: Subtitle[] }[]> {
        const clients = await this.getClientsForProfile(profileId)
        const results: { addon: Manifest, subtitles: Subtitle[] }[] = []

        log.debug(`getSubtitles called for ${type}/${id}, videoHash: ${videoHash || 'none'}`)

        // Resolve IDs: We might have a TMDB ID (tmdb:123) but addons might need IMDB ID (tt123)
        let tmdbId: string | null = null
        let imdbId: string | null = null

        if (id.startsWith('tmdb:')) {
            tmdbId = id.replace('tmdb:', '')
            // Try to resolve to IMDB
            imdbId = await this.resolveTmdbToImdb(tmdbId, type, profileId)
            if (imdbId) log.debug(`Resolved TMDB ${tmdbId} to IMDB ${imdbId}`)
        } else if (id.startsWith('tt')) {
            imdbId = id
            // We could resolve to TMDB here if needed, but usually subtiles support tt
        }

        log.debug(`Available clients: ${clients.length}`)

        const promises = clients.map(async (client) => {
            if (!client.manifest) return

            // Use proper resource checking that handles object resources
            const supportsSubtitles = this.supportsResource(client.manifest, 'subtitles', type)
            if (!supportsSubtitles) {
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
                }
            }

            if (!canHandle) {
                return
            }

            try {
                const subtitles = await client.getSubtitles(type, targetId, videoHash)
                if (subtitles && subtitles.length > 0) {
                    results.push({ addon: client.manifest, subtitles })
                }
            } catch (e) {
                log.warn(`Failed to fetch subtitles from ${client.manifest.name}: ${e instanceof Error ? e.message : String(e)}`)
            }
        })

        await Promise.allSettled(promises)
        log.debug(`Total subtitle results before filtering: ${results.length} addon groups`)

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

        const _filteredResults: { addon: Manifest, subtitles: Subtitle[] }[] = []

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

        log.debug(`Filtered results.`)

        if (results.length === 0) {
            log.warn('No subtitle results from any addon. Consider installing a subtitle addon like:')
            log.warn('- OpenSubtitles: https://github.com/openSubtitles/stremio-addon')
            log.warn('Most torrent/video streaming addons do NOT provide subtitles.')
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

                // For the native Zentrio addon, respect the showOnHome setting
                if (client instanceof ZentrioAddonClient && !client.isCatalogOnHome(cat.id, cat.type)) continue

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
        const context = this.getProfileContext(profileId)

        const normalizedUrl = this.normalizeUrl(manifestUrl)
        // Zentrio client is cached with a settings-profile-scoped key; fall back to bare URL for other addons
        const settingsProfileId = context.settingsProfileId
        const cacheKey = (manifestUrl === DEFAULT_TMDB_ADDON || normalizedUrl === this.normalizeUrl(DEFAULT_TMDB_ADDON)) && settingsProfileId
            ? `${normalizedUrl}:${settingsProfileId}`
            : normalizedUrl
        const client = this.clientCache.get(cacheKey) ?? this.clientCache.get(normalizedUrl)

        if (!client || !client.manifest) {
            log.warn(`Client not found for ${manifestUrl}`)
            return []
        }

        const catalog = client.manifest.catalogs.find(c => c.type === catalogType && c.id === catalogId)
        if (!catalog) {
            log.warn(`Catalog ${catalogId} not found in ${client.manifest.name}`)
            return []
        }

        try {
            const items = await client.getCatalog(catalogType, catalogId, {}, context.appearanceConfig)
            let filteredItems = await this.applyParentalFilter(items, context)

            // Row filling logic if parental controls filter too many items
            if (context.parentalSettings.enabled && filteredItems.length < 20 && items.length > 0) {
                let currentSkip = items.length
                let attempts = 0
                const maxAttempts = 3

                while (filteredItems.length < 20 && attempts < maxAttempts) {
                    try {
                        const nextItems = await client.getCatalog(catalogType, catalogId, { skip: currentSkip.toString() }, context.appearanceConfig)
                        if (!nextItems || nextItems.length === 0) break

                        const nextFiltered = await this.applyParentalFilter(nextItems, context)
                        filteredItems = [...filteredItems, ...nextFiltered]
                        currentSkip += nextItems.length
                        attempts++
                    } catch (_e) {
                        break
                    }
                }
            }

            return this.enrichItems(filteredItems, context)
        } catch (e) {
            const _errorMsg = e instanceof Error ? e.message : String(e)
            log.error(`Failed to fetch catalog ${catalogId} from ${manifestUrl}`, e)
            return []
        }
    }

    /**
     * Invalidate the cached Zentrio client for a settings profile so the next request
     * picks up the updated catalog config.
     */
    invalidateZentrioClient(settingsProfileId: number): void {
        const normalizedUrl = this.normalizeUrl(DEFAULT_TMDB_ADDON)
        const keys = [
            `${normalizedUrl}:${settingsProfileId}`,
            `fallback:${DEFAULT_TMDB_ADDON}:${settingsProfileId}`,
        ]
        for (const key of keys) {
            this.clientCache.delete(key)
        }
    }
}

export const addonManager = new AddonManager()
