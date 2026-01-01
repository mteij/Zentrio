import { getClient, getGlobalClient, hasGlobalTmdbKey, TMDBClient } from './client'
import { getMeta, getAgeRating } from './meta'
import { getCatalog } from './catalog'
import { getSearch } from './search'
import { getTrending } from './trending'
import { getEpisodes } from './episodes'
import { getLogo, getTvLogo } from './logo'
import { getGenreList } from './genres'
import { getLanguages } from './languages'
import { tmdbCache } from './cache'

export { TMDBClient }

export const tmdbService = {
  getClient,
  getGlobalClient,
  hasGlobalTmdbKey,
  getMeta,
  getAgeRating,
  getCatalog,
  getSearch,
  getTrending,
  getEpisodes,
  getLogo,
  getTvLogo,
  getGenreList,
  getLanguages,
  cache: tmdbCache,
}