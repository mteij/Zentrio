/**
 * Portions of this code are derived from the TMDB Addon project.
 * Original source: https://github.com/mrcanelas/tmdb-addon
 * Licensed under Apache License 2.0
 */
import { userDb } from '../database'
import { decrypt } from '../encryption'

const TMDB_API_BASE = 'https://api.themoviedb.org/3'

export class TMDBClient {
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async fetch<T>(endpoint: string, params: Record<string, any> = {}): Promise<T> {
    const url = new URL(`${TMDB_API_BASE}${endpoint}`)
    url.searchParams.append('api_key', this.apiKey)
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value))
      }
    })

    const response = await fetch(url.toString())
    if (!response.ok) {
      throw new Error(`TMDB API Error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getMovieReleaseDates(id: string) {
    return this.fetch<any>(`/movie/${id}/release_dates`)
  }

  async getTvContentRatings(id: string) {
    return this.fetch<any>(`/tv/${id}/content_ratings`)
  }

  async getMovieInfo(id: string, language: string) {
    return this.fetch<any>(`/movie/${id}`, {
      language,
      append_to_response: 'videos,credits,external_ids'
    })
  }

  async getTvInfo(id: string, language: string) {
    return this.fetch<any>(`/tv/${id}`, {
      language,
      append_to_response: 'videos,credits,external_ids'
    })
  }

  async movieInfo(params: { id: string; language?: string; append_to_response?: string }) {
    return this.fetch<any>(`/movie/${params.id}`, {
      language: params.language,
      append_to_response: params.append_to_response
    })
  }

  async tvInfo(params: { id: string; language?: string; append_to_response?: string }) {
    return this.fetch<any>(`/tv/${params.id}`, {
      language: params.language,
      append_to_response: params.append_to_response
    })
  }

  async collectionInfo(params: { id: string; language?: string }) {
    return this.fetch<any>(`/collection/${params.id}`, {
      language: params.language
    })
  }

  async movieReleaseDates(params: { id: string }) {
    return this.fetch<any>(`/movie/${params.id}/release_dates`)
  }

  async tvContentRatings(params: { id: string }) {
    return this.fetch<any>(`/tv/${params.id}/content_ratings`)
  }

  async trending(params: { media_type: string; time_window: string; language?: string; page?: number }) {
    return this.fetch<any>(`/trending/${params.media_type}/${params.time_window}`, {
      language: params.language,
      page: params.page
    })
  }

  async searchMovie(params: { query: string; language?: string; include_adult?: boolean; page?: number; year?: number; primary_release_year?: number }) {
    return this.fetch<any>(`/search/movie`, params)
  }

  async searchTv(params: { query: string; language?: string; include_adult?: boolean; page?: number; first_air_date_year?: number }) {
    return this.fetch<any>(`/search/tv`, params)
  }

  async searchPerson(params: { query: string; language?: string; page?: number; include_adult?: boolean }) {
    return this.fetch<any>(`/search/person`, params)
  }

  async personMovieCredits(params: { id: string; language?: string }) {
    return this.fetch<any>(`/person/${params.id}/movie_credits`, {
      language: params.language
    })
  }

  async personTvCredits(params: { id: string; language?: string }) {
    return this.fetch<any>(`/person/${params.id}/tv_credits`, {
      language: params.language
    })
  }

  async movieImages(params: { id: string; language?: string; include_image_language?: string }) {
    return this.fetch<any>(`/movie/${params.id}/images`, {
      language: params.language,
      include_image_language: params.include_image_language
    })
  }

  async tvImages(params: { id: string; language?: string; include_image_language?: string }) {
    return this.fetch<any>(`/tv/${params.id}/images`, {
      language: params.language,
      include_image_language: params.include_image_language
    })
  }

  async episodeGroup(params: { id: string; language?: string }) {
    return this.fetch<any>(`/episode_group/${params.id}`, {
      language: params.language
    })
  }

  async discoverMovie(params: Record<string, any>) {
    return this.fetch<any>(`/discover/movie`, params)
  }

  async discoverTv(params: Record<string, any>) {
    return this.fetch<any>(`/discover/tv`, params)
  }

  async find(params: { id: string; external_source: string; language?: string }) {
    return this.fetch<any>(`/find/${params.id}`, {
      external_source: params.external_source,
      language: params.language
    })
  }

  async genreMovieList(params: { language?: string }) {
    return this.fetch<any>(`/genre/movie/list`, {
      language: params.language
    })
  }

  async genreTvList(params: { language?: string }) {
    return this.fetch<any>(`/genre/tv/list`, {
      language: params.language
    })
  }

  async primaryTranslations() {
    return this.fetch<any>(`/configuration/primary_translations`)
  }

  async languages() {
    return this.fetch<any>(`/configuration/languages`)
  }
}

export const getClient = async (userId: string): Promise<TMDBClient | null> => {
  const user = userDb.findById(userId)
  if (!user?.tmdbApiKey) return null

  try {
    const apiKey = decrypt(user.tmdbApiKey)
    return new TMDBClient(apiKey)
  } catch (error) {
    console.error('Failed to decrypt TMDB API key:', error)
    return null
  }
}