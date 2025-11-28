/**
 * Portions of this code are derived from the TMDB Addon project.
 * Original source: https://github.com/mrcanelas/tmdb-addon
 * Licensed under Apache License 2.0
 */
import { TMDBClient } from './client'

export async function getGenreList(tmdbClient: TMDBClient, language: string, type: string) {
  if (type === "movie") {
    const genre = await tmdbClient
      .genreMovieList({language})
      .then((res: any) => {
        return res.genres
      })
      .catch(console.error)
      return genre
  } else {
    const genre = await tmdbClient
      .genreTvList({language})
      .then((res: any) => {
        return res.genres
      })
      .catch(console.error)
    return genre
  }
}