import { userDb } from '../database'
import { logger } from '../logger'
import { tmdbService } from '../tmdb/index'
import { AddonClient } from './client'
import { Manifest, MetaDetail, MetaPreview, Stream } from './types'

const log = logger.scope('Zentrio')

export interface TmdbCatalogEntry {
  id: string
  type: 'movie' | 'series'
  enabled: boolean
  showOnHome: boolean
}

export const DEFAULT_TMDB_CATALOG_CONFIG: TmdbCatalogEntry[] = [
  { id: 'tmdb.trending', type: 'movie',  enabled: true, showOnHome: true  },
  { id: 'tmdb.top',      type: 'movie',  enabled: true, showOnHome: true  },
  { id: 'tmdb.new',      type: 'movie',  enabled: true, showOnHome: false },
  { id: 'tmdb.year',     type: 'movie',  enabled: true, showOnHome: false },
  { id: 'tmdb.language', type: 'movie',  enabled: false, showOnHome: false },
  { id: 'tmdb.trending', type: 'series', enabled: true,  showOnHome: true  },
  { id: 'tmdb.top',      type: 'series', enabled: true,  showOnHome: true  },
  { id: 'tmdb.new',      type: 'series', enabled: true,  showOnHome: false },
  { id: 'tmdb.year',     type: 'series', enabled: true,  showOnHome: false },
  { id: 'tmdb.language', type: 'series', enabled: false, showOnHome: false },
]

export class ZentrioAddonClient extends AddonClient {
  private userId: string | null = null
  private idCache = new Map<string, string>()
  private catalogConfig: TmdbCatalogEntry[]

  constructor(url: string, userId?: string, catalogConfig?: TmdbCatalogEntry[]) {
    super(url)
    this.userId = userId || null
    this.catalogConfig = catalogConfig || DEFAULT_TMDB_CATALOG_CONFIG
  }

  async init(): Promise<Manifest> {
    const client = await this.getClient()
    let movieGenres: any[] = []
    let seriesGenres: any[] = []

    let languageOptions: string[] = []

    if (client) {
      try {
        const [mGenres, sGenres, langs] = await Promise.all([
          tmdbService.getGenreList(client, 'en-US', 'movie'),
          tmdbService.getGenreList(client, 'en-US', 'series'),
          tmdbService.getLanguages(client),
        ])
        movieGenres = mGenres || []
        seriesGenres = sGenres || []
        languageOptions = (langs || []).map((l: any) => l.name).filter(Boolean)
      } catch (e) {
        log.warn('Failed to load genres/languages for manifest', e)
      }
    }

    const movieGenreOptions = movieGenres.map((g: any) => g.name)
    const seriesGenreOptions = seriesGenres.map((g: any) => g.name)

    // Build all possible catalogs.
    // tmdb.top is listed first so it is preferred as the search source when deduplicating.
    // All catalogs include { name: 'search' } so search works regardless of which catalogs
    // the user has enabled on the home page.
    const ALL_CATALOG_DEFS: Array<{ id: string; type: 'movie' | 'series'; name: string; extra: any[] }> = [
      {
        type: 'movie',
        id: 'tmdb.top',
        name: 'Popular',
        extra: [{ name: 'genre', options: movieGenreOptions }, { name: 'skip' }, { name: 'search' }]
      },
      {
        type: 'series',
        id: 'tmdb.top',
        name: 'Popular',
        extra: [{ name: 'genre', options: seriesGenreOptions }, { name: 'skip' }, { name: 'search' }]
      },
      {
        type: 'movie',
        id: 'tmdb.trending',
        name: 'Trending',
        extra: [{ name: 'skip' }, { name: 'search' }]
      },
      {
        type: 'series',
        id: 'tmdb.trending',
        name: 'Trending',
        extra: [{ name: 'skip' }, { name: 'search' }]
      },
      {
        type: 'movie',
        id: 'tmdb.new',
        name: 'Latest Releases',
        extra: [{ name: 'genre', options: movieGenreOptions }, { name: 'skip' }, { name: 'search' }]
      },
      {
        type: 'series',
        id: 'tmdb.new',
        name: 'Latest Releases',
        extra: [{ name: 'genre', options: seriesGenreOptions }, { name: 'skip' }, { name: 'search' }]
      },
      {
        type: 'movie',
        id: 'tmdb.year',
        name: 'Year',
        extra: [{ name: 'genre', isRequired: true, options: movieGenreOptions }, { name: 'skip' }, { name: 'search' }]
      },
      {
        type: 'series',
        id: 'tmdb.year',
        name: 'Year',
        extra: [{ name: 'genre', isRequired: true, options: seriesGenreOptions }, { name: 'skip' }, { name: 'search' }]
      },
      {
        type: 'movie',
        id: 'tmdb.language',
        name: 'Language',
        extra: [{ name: 'genre', isRequired: true, options: languageOptions }, { name: 'skip' }, { name: 'search' }]
      },
      {
        type: 'series',
        id: 'tmdb.language',
        name: 'Language',
        extra: [{ name: 'genre', isRequired: true, options: languageOptions }, { name: 'skip' }, { name: 'search' }]
      },
    ]

    // Filter catalogs based on config
    const enabledCatalogs = ALL_CATALOG_DEFS.filter(def => {
      const entry = this.catalogConfig.find(c => c.id === def.id && c.type === def.type)
      return entry ? entry.enabled : true
    })

    this.manifest = {
      id: 'org.zentrio.tmdb',
      version: '1.0.0',
      name: 'Zentrio',
      description: 'Native TMDB integration for Zentrio',
      logo: 'https://app.zentrio.eu/static/logo/icon-192.png',
      resources: ['catalog', 'meta'],
      types: ['movie', 'series'],
      catalogs: enabledCatalogs,
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

  async getCatalog(type: string, id: string, extra: Record<string, string> = {}, config: Record<string, any> = {}): Promise<MetaPreview[]> {
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
    
    // Handle manual pagination offset properly to avoid duplicates
    if (extra.skip && res?.metas) {
        const skip = parseInt(extra.skip)
        const offset = skip % 20
        // If we are on the first page of the request (mathematically), we might need to skip some items
        // Example: Skip 15. Page = 1. Offset = 15. Return items 15-20.
        // Example: Skip 20. Page = 2. Offset = 0. Return items 0-20.
        // Example: Skip 30. Page = 2. Offset = 10. Return items 10-20.
        return res.metas.slice(offset)
    }

    return res?.metas || []
  }

  async getMeta(type: string, id: string, config: Record<string, any> = {}): Promise<MetaDetail> {
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
                    log.warn(`Could not resolve IMDb ID ${tmdbId} to TMDB ID`)
                    throw new Error(`Could not resolve IMDb ID ${tmdbId} to TMDB ID`)
                }
            } catch (e) {
                log.error(`Error resolving IMDb ID ${tmdbId}:`, e)
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

  isCatalogOnHome(id: string, type: string): boolean {
    const config = this.catalogConfig.length > 0 ? this.catalogConfig : DEFAULT_TMDB_CATALOG_CONFIG
    const entry = config.find(c => c.id === id && c.type === type)
    return entry ? entry.showOnHome : false
  }

  async getStreams(_type: string, _id: string): Promise<Stream[]> {
    // Zentrio addon doesn't provide streams itself, it relies on other addons or just metadata.
    // But if we want to support trailers as streams?
    return []
  }
}
