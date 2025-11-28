/**
 * Portions of this code are derived from the TMDB Addon project.
 * Original source: https://github.com/mrcanelas/tmdb-addon
 * Licensed under Apache License 2.0
 */
import { TMDBClient } from './client'

const FANART_API_KEY = process.env.FANART_API_KEY || ''
const FANART_BASE_URL = "http://webservice.fanart.tv/v3/"

class FanartTvApi {
  private apiKey: string
  private baseUrl: string

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || FANART_BASE_URL
  }

  private async fetch(endpoint: string) {
    const url = `${this.baseUrl}${endpoint}?api_key=${this.apiKey}`
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Fanart API Error: ${response.status} ${response.statusText}`)
    }
    return response.json()
  }

  async getMovieImages(id: string) {
    return this.fetch(`movies/${id}`)
  }

  async getShowImages(id: string) {
    return this.fetch(`tv/${id}`)
  }
}

const fanart = new FanartTvApi({ apiKey: FANART_API_KEY })

function pickLogo(logos: any[], language: string, originalLanguage: string) {
  const lang = language.split("-")[0]

  return (
    logos.find(l => l.lang === lang) ||
    logos.find(l => l.lang === originalLanguage) ||
    logos.find(l => l.lang === "en") ||
    logos[0]
  )
}

export async function getLogo(tmdbClient: TMDBClient, tmdbId: string, language: string, originalLanguage: string) {
  if (!tmdbId) {
    throw new Error(`TMDB ID not available for logo: ${tmdbId}`)
  }

  const [fanartRes, tmdbRes] = await Promise.all([
    FANART_API_KEY ? fanart
      .getMovieImages(tmdbId)
      .then((res: any) => res.hdmovielogo || [])
      .catch(() => []) : Promise.resolve([]),

    tmdbClient
      .movieImages({ id: tmdbId })
      .then((res: any) => res.logos || [])
      .catch(() => [])
  ])

  const fanartLogos = fanartRes.map((l: any) => ({
    url: l.url,
    lang: l.lang || 'en',
    source: 'fanart'
  }))

  const tmdbLogos = tmdbRes.map((l: any) => ({
    url: `https://image.tmdb.org/t/p/original${l.file_path}`,
    lang: l.iso_639_1 || 'en',
    source: 'tmdb'
  }))

  const combined = [...fanartLogos, ...tmdbLogos]

  if (combined.length === 0) return ''

  const picked = pickLogo(combined, language, originalLanguage)
  return picked?.url || ''
}

export async function getTvLogo(tmdbClient: TMDBClient, tvdb_id: string | null, tmdbId: string, language: string, originalLanguage: string) {
  if (!tvdb_id && !tmdbId) {
    throw new Error(`TVDB ID and TMDB ID not available for logos.`)
  }

  const [fanartRes, tmdbRes] = await Promise.all([
    (tvdb_id && FANART_API_KEY)
      ? fanart
          .getShowImages(tvdb_id)
          .then((res: any) => res.hdtvlogo || [])
          .catch(() => [])
      : Promise.resolve([]),

    tmdbId
      ? tmdbClient
          .tvImages({ id: tmdbId })
          .then((res: any) => res.logos || [])
          .catch(() => [])
      : Promise.resolve([])
  ])

  const fanartLogos = fanartRes.map((l: any) => ({
    url: l.url,
    lang: l.lang || 'en',
    source: 'fanart'
  }))

  const tmdbLogos = tmdbRes.map((l: any) => ({
    url: `https://image.tmdb.org/t/p/original${l.file_path}`,
    lang: l.iso_639_1 || 'en',
    source: 'tmdb'
  }))

  const combined = [...fanartLogos, ...tmdbLogos]

  if (combined.length === 0) return ''

  const picked = pickLogo(combined, language, originalLanguage)
  return picked?.url || ''
}