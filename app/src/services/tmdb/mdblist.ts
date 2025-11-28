/**
 * Portions of this code are derived from the TMDB Addon project.
 * Original source: https://github.com/mrcanelas/tmdb-addon
 * Licensed under Apache License 2.0
 */
import { TMDBClient } from './client'
import { getMeta } from './meta'

export async function fetchMDBListItems(listId: string, apiKey: string, language: string, page: number) {
  const offset = (page * 20) - 20
  try {
    const url = `https://api.mdblist.com/lists/${listId}/items?language=${language}&limit=20&offset=${offset}&apikey=${apiKey}&append_to_response=genre,poster`
    const response = await fetch(url)
    const data = await response.json()
    return [
      ...(data.movies || []),
      ...(data.shows || [])
    ]
  } catch (err: any) {
    console.error("Error retrieving MDBList items:", err.message, err)
    return []
  }
}

export async function parseMDBListItems(tmdbClient: TMDBClient, items: any[], type: string, genreFilter: string | undefined, language: string, config: any = {}) {
  const availableGenres = [
    ...new Set(
      items.flatMap(item =>
        (item.genre || [])
          .map((g: any) =>
            typeof g === "string"
              ? g.charAt(0).toUpperCase() + g.slice(1).toLowerCase()
              : null
          )
          .filter(Boolean)
      )
    )
  ].sort()

  let filteredItems = items
  if (genreFilter) {
    filteredItems = filteredItems.filter(item =>
      Array.isArray(item.genre) &&
      item.genre.some(
        (g: any) =>
          typeof g === "string" &&
          g.toLowerCase() === genreFilter.toLowerCase()
      )
    )
  }

  const filteredItemsByType = filteredItems
    .filter(item => {
      if (type === "series") return item.mediatype === "show"
      if (type === "movie") return item.mediatype === "movie"
      return false
    })
    .map(item => ({
      id: item.id,
      type: type
    }))

  const metaPromises = filteredItemsByType.map(item => 
    getMeta(tmdbClient, item.type, language, item.id, config)
      .then(result => result.meta)
      .catch(err => {
        console.error(`Error fetching metadata for ${item.id}:`, err.message)
        return null
      })
  )

  const metas = (await Promise.all(metaPromises)).filter(Boolean)

  return { metas, availableGenres }
}