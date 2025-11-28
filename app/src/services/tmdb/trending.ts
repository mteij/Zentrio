/**
 * Portions of this code are derived from the TMDB Addon project.
 * Original source: https://github.com/mrcanelas/tmdb-addon
 * Licensed under Apache License 2.0
 */
import { TMDBClient } from './client'
import { getMeta } from './meta'

export async function getTrending(tmdbClient: TMDBClient, type: string, language: string, page: number, genre: string, config: any) {
  const media_type = type === "series" ? "tv" : type
  const parameters = {
    media_type,
    time_window: genre ? genre.toLowerCase() : "day",
    language,
    page,
  }

  return await tmdbClient
    .trending(parameters)
    .then(async (res: any) => {
      const metaPromises = res.results.map((item: any) => 
        getMeta(tmdbClient, type, language, item.id, config)
          .then(result => result.meta)
          .catch((err: any) => {
            console.error(`Error fetching metadata for ${item.id}:`, err.message)
            return null
          })
      )

      const metas = (await Promise.all(metaPromises)).filter(Boolean)
      return { metas }
    })
    .catch(console.error)
}