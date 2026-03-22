import { TMDBClient } from './client'
import { getLanguages } from './languages'

const TV_GENRE_MAP: Record<string, string> = {
  Action: 'Action & Adventure',
  Adventure: 'Action & Adventure',
  'Science Fiction': 'Sci-Fi & Fantasy',
  Fantasy: 'Sci-Fi & Fantasy',
  War: 'War & Politics',
}

export function findGenreId(genreName: string, genreList: any[]) {
  let genreData = genreList.find((genre) => genre.name === genreName)

  if (!genreData && TV_GENRE_MAP[genreName]) {
    const mappedName = TV_GENRE_MAP[genreName]
    genreData = genreList.find((genre) => genre.name === mappedName)
  }

  return genreData ? genreData.id : undefined
}

function findLanguageCode(genre: string, languages: any[]) {
  const language = languages.find((lang) => lang.name === genre)
  return language ? language.iso_639_1.split('-')[0] : ''
}

export function resolveTrendingTimeWindow(value: string): 'day' | 'week' {
  const normalized = value.trim().toLowerCase()
  return normalized === 'week' ? 'week' : 'day'
}

export async function buildCatalogParameters(
  tmdbClient: TMDBClient,
  type: string,
  language: string,
  page: number,
  id: string,
  genre: string,
  genreList: any[],
  config: any,
) {
  const languages = await getLanguages(tmdbClient)
  const parameters: any = { language, page, 'vote_count.gte': 10 }

  if (config.ageRating) {
    parameters.certification_country = 'NL|US'

    switch (config.ageRating) {
      case 'AL':
        parameters.certification = 'AL'
        break
      case '6':
        parameters.certification = type === 'movie' ? ['AL', '6', 'G', 'TV-G'].join('|') : ['AL', '6', 'TV-G'].join('|')
        break
      case '9':
        parameters.certification = type === 'movie'
          ? ['AL', '6', '9', 'G', 'PG', 'TV-G', 'TV-PG'].join('|')
          : ['AL', '6', '9', 'TV-G', 'TV-PG'].join('|')
        break
      case '12':
        parameters.certification = type === 'movie'
          ? ['AL', '6', '9', '12', 'G', 'PG', 'PG-13', 'TV-G', 'TV-PG', 'TV-14'].join('|')
          : ['AL', '6', '9', '12', 'TV-G', 'TV-PG', 'TV-14'].join('|')
        break
      case '16':
        parameters.certification = type === 'movie'
          ? ['AL', '6', '9', '12', '16', 'G', 'PG', 'PG-13', 'R', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'].join('|')
          : ['AL', '6', '9', '12', '16', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'].join('|')
        break
      case '18':
        parameters.certification = type === 'movie'
          ? ['AL', '6', '9', '12', '16', '18', 'G', 'PG', 'PG-13', 'R', 'NC-17', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'].join('|')
          : ['AL', '6', '9', '12', '16', '18', 'TV-G', 'TV-PG', 'TV-14', 'TV-MA'].join('|')
        break
    }
  }

  switch (id) {
    case 'tmdb.top': {
      const matched = genre ? findGenreId(genre, genreList) : undefined
      parameters.with_genres = matched
      if (type === 'series') {
        parameters.watch_region = language.split('-')[1]
        parameters.with_watch_monetization_types = 'flatrate|free|ads|rent|buy'
      }
      break
    }
    case 'tmdb.new': {
      const threeMonthsAgo = new Date()
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
      const dateStr = threeMonthsAgo.toISOString().split('T')[0]
      parameters.with_genres = genre ? findGenreId(genre, genreList) : undefined
      if (type === 'movie') {
        parameters['primary_release_date.gte'] = dateStr
        parameters.sort_by = 'release_date.desc'
      } else {
        parameters['first_air_date.gte'] = dateStr
        parameters.sort_by = 'first_air_date.desc'
      }
      break
    }
    case 'tmdb.year': {
      const year = genre ? parseInt(genre) : new Date().getFullYear()
      if (type === 'movie') {
        parameters.primary_release_year = year
      } else {
        parameters.first_air_date_year = year
      }
      break
    }
    case 'tmdb.language': {
      const findGenre = genre ? findLanguageCode(genre, languages) : language.split('-')[0]
      parameters.with_original_language = findGenre
      break
    }
    default:
      break
  }

  return parameters
}
