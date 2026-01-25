// Content Filter Service
// Handles parental controls, content filtering, and enrichment
import { profileProxySettingsDb, watchHistoryDb } from '../database'
import { tmdbService } from '../tmdb/index'
import { toStandardAgeRating, AGE_RATINGS, type AgeRating } from '../tmdb/age-ratings'
import type { MetaPreview } from './types'

// ID resolution cache for IMDB -> TMDB mapping
const idResolutionCache = new Map<string, string>()

export function getParentalSettings(profileId: number): { enabled: boolean, ratingLimit: AgeRating } {
    const proxySettings = profileProxySettingsDb.findByProfileId(profileId);
    const ageMap: Record<number, AgeRating> = {
        0: 'AL',
        6: '6',
        9: '9',
        12: '12',
        16: '16',
        18: '18'
    };
    // Default to 18 if unknown, but respecting enabled flag
    const ratingLimit = proxySettings?.nsfw_age_rating ? (ageMap[proxySettings.nsfw_age_rating] || '18' as AgeRating) : '18' as AgeRating;
    
    return {
        enabled: proxySettings?.nsfw_filter_enabled ?? false,
        ratingLimit
    };
}

export async function filterContent(
    items: MetaPreview[], 
    parentalSettings: { enabled: boolean, ratingLimit: AgeRating }, 
    userId?: string
): Promise<MetaPreview[]> {
    const ratingLimit = parentalSettings.ratingLimit || '18' as AgeRating;
    const ratings = AGE_RATINGS;
    const limitIndex = ratings.indexOf(ratingLimit);
    
    // Initialize TMDB client if user ID is provided
    const tmdbClient = userId ? await tmdbService.getClient(userId) : null;

    const filteredItems = await Promise.all(items.map(async (item) => {
        const itemAny = item as Record<string, any>;
        
        // Try to find certification with country fallback (NL -> US -> GB)
        let cert = itemAny.ageRating || itemAny.certification || itemAny.rating || itemAny.contentRating || itemAny.info?.certification || itemAny.info?.rating;

        // If certification is an object (e.g. from TMDB sometimes), try to find by country
        if (typeof cert === 'object' && cert !== null) {
            cert = (cert as Record<string, any>)['NL'] || (cert as Record<string, any>)['US'] || (cert as Record<string, any>)['GB'] || Object.values(cert)[0];
        }
        
        // Also check releaseInfo if it contains certification
        if (!cert && itemAny.releaseInfo && typeof itemAny.releaseInfo === 'string') {
            const parts = itemAny.releaseInfo.split('|').map((s: string) => s.trim());
            const potentialRating = parts.find((p: string) => ratings.includes(p as AgeRating) || p.startsWith('TV-'));
            if (potentialRating) cert = potentialRating;
        }

        // If no cert found and we have TMDB client, try to fetch it
        if (!cert && tmdbClient && (parentalSettings.enabled || true)) {
            try {
                let tmdbId: string | null = null;
                let type: 'movie' | 'series' = item.type === 'movie' ? 'movie' : 'series';

                if (item.id.startsWith('tmdb:')) {
                    tmdbId = item.id.split(':')[1];
                } else if (item.id.startsWith('tt')) {
                     // Check cache first
                     const cachedTmdbId = idResolutionCache.get(item.id);
                     if (cachedTmdbId) {
                        tmdbId = cachedTmdbId;
                     } else {
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
                            // Fallback: try to guess type from results
                            if (findResults.movie_results?.length > 0) {
                                tmdbId = findResults.movie_results[0].id.toString();
                                type = 'movie';
                            } else if (findResults.tv_results?.length > 0) {
                                tmdbId = findResults.tv_results[0].id.toString();
                                type = 'series';
                            }
                        }
                         
                        // Cache the result if found
                        if (tmdbId) {
                            idResolutionCache.set(item.id, tmdbId);
                        }
                     }
                }

                if (tmdbId) {
                    cert = await tmdbService.getAgeRating(tmdbClient, tmdbId, type, 'en-US');
                }
            } catch (e) {
                // Silently fail
            }
        }

        if (cert) {
            // Convert to standard age rating format
            const ageRating = toStandardAgeRating(cert);
             
            if (ageRating) {
                // Assign back so the UI can see it
                itemAny.certification = ageRating;
                  
                const itemRatingIndex = ratings.indexOf(ageRating);
                 
                if (parentalSettings.enabled && limitIndex !== -1) {
                    if (itemRatingIndex > limitIndex) return false;
                }
            } else {
                // If conversion failed, strict mode: hide content
                if (parentalSettings.enabled) return false;
            }
        } else {
             // If no cert found, strict mode: hide content
             if (parentalSettings.enabled) return false;
        }
        
        return true;
    }));

    return items.filter((_, index) => filteredItems[index]);
}

export async function enrichContent(items: MetaPreview[], profileId: number): Promise<MetaPreview[]> {
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

// Export the cache for use by AddonManager
export { idResolutionCache }
