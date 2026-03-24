/**
 * Portions of this code are derived from the TMDB Addon project.
 * Original source: https://github.com/mrcanelas/tmdb-addon
 * Licensed under Apache License 2.0
 */
import { logger } from '../logger'
import { TMDBClient } from './client'

const log = logger.scope('TMDB:Genres')

export async function getGenreList(tmdbClient: TMDBClient, language: string, type: string) {
  if (type === "movie") {
    const genre = await tmdbClient
      .genreMovieList({language})
      .then((res: any) => {
        return res.genres
      })
      .catch((err: any) => log.error('TMDB genre list fetch failed:', err))
      return genre
  } else {
    const genre = await tmdbClient
      .genreTvList({language})
      .then((res: any) => {
        return res.genres
      })
      .catch((err: any) => log.error('TMDB genre list fetch failed:', err))
    return genre
  }
}