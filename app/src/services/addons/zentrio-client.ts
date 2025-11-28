import { AddonClient } from './client'
import { Manifest, MetaPreview, MetaDetail, Stream, Subtitle } from './types'
import { tmdbService } from '../tmdb/index'
import { userDb } from '../database'

export class ZentrioAddonClient extends AddonClient {
  private userId: string | null = null
  private idCache = new Map<string, string>()

  constructor(url: string, userId?: string) {
    super(url)
    this.userId = userId || null
  }

  async init(): Promise<Manifest> {
    this.manifest = {
      id: 'org.zentrio.tmdb',
      version: '1.0.0',
      name: 'Zentrio',
      description: 'Native TMDB integration for Zentrio',
      logo: 'https://zentrio.eu/static/logo/icon-192.png',
      resources: ['catalog', 'meta', 'stream'],
      types: ['movie', 'series'],
      catalogs: [
        {
          type: 'movie',
          id: 'tmdb.top',
          name: 'Popular Movies',
          extra: [{ name: 'genre' }, { name: 'skip' }, { name: 'search' }]
        },
        {
          type: 'series',
          id: 'tmdb.top',
          name: 'Popular Series',
          extra: [{ name: 'genre' }, { name: 'skip' }, { name: 'search' }]
        },
        {
            type: 'movie',
            id: 'tmdb.year',
            name: 'Movies by Year',
            extra: [{ name: 'genre', isRequired: true }, { name: 'skip' }]
        },
        {
            type: 'series',
            id: 'tmdb.year',
            name: 'Series by Year',
            extra: [{ name: 'genre', isRequired: true }, { name: 'skip' }]
        },
        {
            type: 'movie',
            id: 'tmdb.language',
            name: 'Movies by Language',
            extra: [{ name: 'genre', isRequired: true }, { name: 'skip' }]
        },
        {
            type: 'series',
            id: 'tmdb.language',
            name: 'Series by Language',
            extra: [{ name: 'genre', isRequired: true }, { name: 'skip' }]
        },
        {
            type: 'movie',
            id: 'tmdb.trending',
            name: 'Trending Movies',
            extra: [{ name: 'genre' }, { name: 'skip' }]
        },
        {
            type: 'series',
            id: 'tmdb.trending',
            name: 'Trending Series',
            extra: [{ name: 'genre' }, { name: 'skip' }]
        }
      ],
      idPrefixes: ['tmdb:', 'tt']
    }
    return this.manifest
  }

  private async getClient() {
    // In a real scenario, we'd need the user ID to get the API key.
    // For now, we might need to pass it or assume a default/global one if available.
    // However, the addon manager might not have the user ID readily available in all contexts.
    // But we can try to find a user.
    
    // If userId is not set, try to find the first user (single user mode usually)
    if (!this.userId) {
        const users = userDb.list()
        if (users.length > 0) {
            this.userId = users[0].id
        }
    }

    if (!this.userId) return null
    return tmdbService.getClient(this.userId)
  }

  async getCatalog(type: string, id: string, extra: Record<string, string> = {}, config: any = {}): Promise<MetaPreview[]> {
    const client = await this.getClient()
    if (!client) return []

    const page = extra.skip ? Math.floor(parseInt(extra.skip) / 20) + 1 : 1
    const genre = extra.genre || ''
    const query = extra.search

    // Merge passed config with defaults
    const mergedConfig = {
        rpdbkey: '', // TODO: Get from settings
        enableAgeRating: config.enableAgeRating !== undefined ? config.enableAgeRating : true,
        showAgeRatingInGenres: config.showAgeRatingInGenres !== undefined ? config.showAgeRatingInGenres : true,
        ...config
    }

    if (query) {
        const res = await tmdbService.getSearch(client, id, type, 'en-US', query, mergedConfig)
        return res.metas
    }

    if (id === 'tmdb.trending') {
        const res = await tmdbService.getTrending(client, type, 'en-US', page, genre, mergedConfig)
        return res?.metas || []
    }

    const res = await tmdbService.getCatalog(client, type, 'en-US', page, id, genre, mergedConfig)
    return res?.metas || []
  }

  async getMeta(type: string, id: string, config: any = {}): Promise<MetaDetail> {
    const client = await this.getClient()
    if (!client) throw new Error('TMDB Client not available')

    let tmdbId = id.replace('tmdb:', '')
    
    // Handle IMDb IDs (tt...)
    if (tmdbId.startsWith('tt')) {
        // Check cache first
        if (this.idCache.has(tmdbId)) {
            tmdbId = this.idCache.get(tmdbId)!
        } else {
            try {
                const findRes = await client.find({ id: tmdbId, external_source: 'imdb_id' })
                let resolvedId: string | null = null

                if (type === 'movie' && findRes.movie_results?.length > 0) {
                    resolvedId = findRes.movie_results[0].id.toString()
                } else if (type === 'series' && findRes.tv_results?.length > 0) {
                    resolvedId = findRes.tv_results[0].id.toString()
                } else if (findRes.movie_results?.length > 0) {
                     // Fallback: try to guess type if mismatch or generic
                     resolvedId = findRes.movie_results[0].id.toString()
                } else if (findRes.tv_results?.length > 0) {
                     resolvedId = findRes.tv_results[0].id.toString()
                }

                if (resolvedId) {
                    this.idCache.set(tmdbId, resolvedId)
                    tmdbId = resolvedId
                } else {
                    console.warn(`Could not resolve IMDb ID ${tmdbId} to TMDB ID`)
                    throw new Error(`Could not resolve IMDb ID ${tmdbId} to TMDB ID`)
                }
            } catch (e) {
                console.error(`Error resolving IMDb ID ${tmdbId}:`, e)
                throw e
            }
        }
    }
    
    // Merge passed config with defaults
    const mergedConfig = {
        rpdbkey: '',
        enableAgeRating: config.enableAgeRating !== undefined ? config.enableAgeRating : true,
        showAgeRatingInGenres: config.showAgeRatingInGenres !== undefined ? config.showAgeRatingInGenres : true,
        castCount: 5,
        ...config
    }

    const res = await tmdbService.getMeta(client, type, 'en-US', tmdbId, mergedConfig)
    return res.meta
  }

  async getStreams(type: string, id: string): Promise<Stream[]> {
    // Zentrio addon doesn't provide streams itself, it relies on other addons or just metadata.
    // But if we want to support trailers as streams?
    return []
  }
}