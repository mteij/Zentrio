import { getClient, TMDBClient } from './client'
import { getMeta, getAgeRating } from './meta'
import { getCatalog } from './catalog'
import { getSearch } from './search'
import { getTrending } from './trending'
import { getEpisodes } from './episodes'
import { getLogo, getTvLogo } from './logo'
import { getGenreList } from './genres'
import { getLanguages } from './languages'

export { TMDBClient }

export const tmdbService = {
  getClient,
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
  
  // Backward compatibility (partial)
  // getAgeRating and getImdbRating are no longer exposed directly as they are integrated into getMeta
  // If needed, we can re-export them or create wrappers
}