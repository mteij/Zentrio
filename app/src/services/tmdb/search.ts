/**
 * Portions of this code are derived from the TMDB Addon project.
 * Original source: https://github.com/mrcanelas/tmdb-addon
 * Licensed under Apache License 2.0
 */
import { TMDBClient } from './client'
import { Utils } from './utils'
import { getGenreList } from './genres'
import { transliterate } from 'transliteration'

function isNonLatin(text: string) {
  return /[^\u0000-\u007F]/.test(text)
}

export async function getSearch(tmdbClient: TMDBClient, id: string, type: string, language: string, query: string, config: any) {
  let searchQuery = query
  if (isNonLatin(searchQuery)) {
    searchQuery = transliterate(searchQuery)
  }

  // AI Search skipped as per plan (requires gemini service)
  
  let searchResults: any[] = []
  const genreList = await getGenreList(tmdbClient, language, type)

  const parameters: any = {
    query: query,
    language,
    include_adult: config.includeAdult
  }

  if (config.ageRating) {
    parameters.certification_country = "US"
    switch(config.ageRating) {
      case "G":
        parameters.certification = type === "movie" ? "G" : "TV-G"
        break
      case "PG":
        parameters.certification = type === "movie" ? ["G", "PG"].join("|") : ["TV-G", "TV-PG"].join("|")
        break
      case "PG-13":
        parameters.certification = type === "movie" ? ["G", "PG", "PG-13"].join("|") : ["TV-G", "TV-PG", "TV-14"].join("|")
        break
      case "R":
        parameters.certification = type === "movie" ? ["G", "PG", "PG-13", "R"].join("|") : ["TV-G", "TV-PG", "TV-14", "TV-MA"].join("|")
        break
    }
  }

  if (type === "movie") {
    await tmdbClient
      .searchMovie(parameters)
      .then((res: any) => {
        res.results.map((el: any) => {searchResults.push(Utils.parseMedia(el, 'movie', genreList))})
      })
      .catch(console.error)

    if (searchResults.length === 0) {
      await tmdbClient
        .searchMovie({ query: searchQuery, language, include_adult: config.includeAdult })
        .then((res: any) => {
          res.results.map((el: any) => {searchResults.push(Utils.parseMedia(el, 'movie', genreList))})
        })
        .catch(console.error)
    }

    await tmdbClient.searchPerson({ query: query, language }).then(async (res: any) => {
      if (res.results[0]) {
        await tmdbClient
          .personMovieCredits({ id: res.results[0].id, language })
          .then((credits: any) => {
            credits.cast.map((el: any) => {
              if (!searchResults.find((meta) => meta.id === `tmdb:${el.id}`)) {
                searchResults.push(Utils.parseMedia(el, 'movie', genreList))
              }
            })
            credits.crew.map((el: any) => {
              if (el.job === "Director" || el.job === "Writer") {
                if (!searchResults.find((meta) => meta.id === `tmdb:${el.id}`)) {
                  searchResults.push(Utils.parseMedia(el, 'movie', genreList))
                }
              }
            })
          })
      }
    })
  } else {
    await tmdbClient
      .searchTv(parameters)
      .then((res: any) => {
        res.results.map((el: any) => {searchResults.push(Utils.parseMedia(el, 'tv', genreList))})
      })
      .catch(console.error)

    if (searchResults.length === 0) {
      await tmdbClient
        .searchTv({ query: searchQuery, language, include_adult: config.includeAdult })
        .then((res: any) => {
          res.results.map((el: any) => {searchResults.push(Utils.parseMedia(el, 'tv', genreList))})
        })
        .catch(console.error)
    }

    await tmdbClient.searchPerson({ query: query, language }).then(async (res: any) => {
      if (res.results[0]) {
        await tmdbClient
          .personTvCredits({ id: res.results[0].id, language })
          .then((credits: any) => {
            credits.cast.map((el: any) => {
              if (el.episode_count >= 5) {
                if (!searchResults.find((meta) => meta.id === `tmdb:${el.id}`)) {
                  searchResults.push(Utils.parseMedia(el, 'tv', genreList))
                }
              }
            })
            credits.crew.map((el: any) => {
              if (el.job === "Director" || el.job === "Writer") {
                if (!searchResults.find((meta) => meta.id === `tmdb:${el.id}`)) {
                  searchResults.push(Utils.parseMedia(el, 'tv', genreList))
                }
              }
            })
          })
      }
    })
  }

  return Promise.resolve({ query, metas: searchResults })
}