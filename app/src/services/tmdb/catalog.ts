/**
 * Portions of this code are derived from the TMDB Addon project.
 * Original source: https://github.com/mrcanelas/tmdb-addon
 * Licensed under Apache License 2.0
 */
import { TMDBClient } from './client'
import { getGenreList } from './genres'
import { getLanguages } from './languages'
import { getMeta } from './meta'
import { fetchMDBListItems, parseMDBListItems } from './mdblist'

const CATALOG_TYPES: any = {
  "default": {
    "top": {
      "nameKey": "popular",
      "extraSupported": ["genre", "skip"]
    },
    "year": {
      "nameKey": "year",
      "extraSupported": ["genre", "skip"]
    },
    "language": {
      "nameKey": "language",
      "extraSupported": ["genre", "skip"]
    },
    "trending": {
      "nameKey": "trending",
      "extraSupported": ["genre", "skip"],
      "defaultOptions": ["Day", "Week"]
    }
  },
  "auth": {
    "favorites": {
      "nameKey": "favorites",
      "extraSupported": ["genre", "skip"],
      "requiresAuth": true,
      "defaultOptions": [
        "added_date.desc",
        "added_date.asc",
        "popularity.desc",
        "popularity.asc",
        "release_date.desc",
        "release_date.asc",
        "random"
      ]
    },
    "watchlist": {
      "nameKey": "watchlist",
      "extraSupported": ["genre", "skip"],
      "requiresAuth": true,
      "defaultOptions": [
        "added_date.desc",
        "added_date.asc",
        "popularity.desc",
        "popularity.asc",
        "release_date.desc",
        "release_date.asc",
        "random"
      ]
    }
  },
 "streaming": {
    "nfx": {
      "nameKey": "nfx",
      "watchProviderId": 8,
      "country": "GB",
      "extraSupported": ["genre", "skip"]
    },
    "nfk": {
      "nameKey": "nfk",
      "watchProviderId": 175,
      "country": "US",
      "extraSupported": ["genre", "skip"]
    },
    "hbm": {
      "nameKey": "hbm",
      "watchProviderId": 1899,
      "country": "NL",
      "extraSupported": ["genre", "skip"]
    },
    "dnp": {
      "nameKey": "dnp",
      "watchProviderId": 337,
      "country": "GB",
      "extraSupported": ["genre", "skip"]
    },
    "amp": {
      "nameKey": "amp",
      "watchProviderId": 9,
      "country": "US",
      "extraSupported": ["genre", "skip"]
    },
    "atp": {
      "nameKey": "atp",
      "watchProviderId": 350,
      "country": "GB",
      "extraSupported": ["genre", "skip"]
    },
    "pmp": {
      "nameKey": "pmp",
      "watchProviderId": 531,
      "country": "US",
      "extraSupported": ["genre", "skip"]
    },
    "pcp": {
      "nameKey": "pcp",
      "watchProviderId": 386,
      "country": "US",
      "extraSupported": ["genre", "skip"]
    },
    "hlu": {
      "nameKey": "hlu",
      "watchProviderId": 15,
      "country": "US",
      "extraSupported": ["genre", "skip"]
    },
    "cts": {
      "nameKey": "cts",
      "watchProviderId": 190,
      "country": "US",
      "extraSupported": ["genre", "skip"]
    },
    "mgl": {
      "nameKey": "mgl",
      "watchProviderId": 551,
      "country": "US",
      "extraSupported": ["genre", "skip"]
    },
    "cru": {
      "nameKey": "cru",
      "watchProviderId": 283,
      "country": "US",
      "extraSupported": ["genre", "skip"]
    },
    "hay": {
      "nameKey": "hay",
      "watchProviderId": 223,
      "country": "GB",
      "extraSupported": ["genre", "skip"]
    },
    "clv": {
      "nameKey": "clv",
      "watchProviderId": 167,
      "country": "BR",
      "extraSupported": ["genre", "skip"]
    },
    "gop": {
      "nameKey": "gop",
      "watchProviderId": 307,
      "country": "BR",
      "extraSupported": ["genre", "skip"]
    },
    "hst": {
      "nameKey": "hst",
      "watchProviderId": 122,
      "country": "IN",
      "extraSupported": ["genre", "skip"]
    },
    "zee": {
      "nameKey": "zee",
      "watchProviderId": 232,
      "country": "IN",
      "extraSupported": ["genre", "skip"]
    },
    "nlz": {
      "nameKey": "nlz",
      "watchProviderId": 472,
      "country": "NL",
      "extraSupported": ["genre", "skip"]
    },
    "vil": {
      "nameKey": "vil",
      "watchProviderId": 72,
      "country": "NL",
      "extraSupported": ["genre", "skip"]
    },
    "sst": {
      "nameKey": "sst",
      "watchProviderId": 1773,
      "country": "NL",
      "extraSupported": ["genre", "skip"]
    },
    "blv": {
      "nameKey": "blv",
      "watchProviderId": 341,
      "country": "TR",
      "extraSupported": ["genre", "skip"]
    },
    "cpd": {
      "nameKey": "cpd",
      "watchProviderId": 381,
      "country": "FR",
      "extraSupported": ["genre", "skip"]
    },
    "dpe": {
      "nameKey": "dpe",
      "watchProviderId": 510,
      "country": "GB",
      "extraSupported": ["genre", "skip"]
    }
  }
}

function findProvider(providerId: string) {
  const provider = CATALOG_TYPES.streaming[providerId]
  if (!provider) throw new Error(`Could not find provider: ${providerId}`)
  return provider
}

function findGenreId(genreName: string, genreList: any[]) {
  const genreData = genreList.find(genre => genre.name === genreName)
  return genreData ? genreData.id : undefined
}

function findLanguageCode(genre: string, languages: any[]) {
  const language = languages.find((lang) => lang.name === genre)
  return language ? language.iso_639_1.split("-")[0] : ""
}

async function buildParameters(tmdbClient: TMDBClient, type: string, language: string, page: number, id: string, genre: string, genreList: any[], config: any) {
  const languages = await getLanguages(tmdbClient)
  const parameters: any = { language, page, 'vote_count.gte': 10 }

  if (config.ageRating) {
    switch (config.ageRating) {
      case "G":
        parameters.certification_country = "US"
        parameters.certification = type === "movie" ? "G" : "TV-G"
        break
      case "PG":
        parameters.certification_country = "US"
        parameters.certification = type === "movie" ? ["G", "PG"].join("|") : ["TV-G", "TV-PG"].join("|")
        break
      case "PG-13":
        parameters.certification_country = "US"
        parameters.certification = type === "movie" ? ["G", "PG", "PG-13"].join("|") : ["TV-G", "TV-PG", "TV-14"].join("|")
        break
      case "R":
        parameters.certification_country = "US"
        parameters.certification = type === "movie" ? ["G", "PG", "PG-13", "R"].join("|") : ["TV-G", "TV-PG", "TV-14", "TV-MA"].join("|")
        break
      case "NC-17":
        break
    }
  }

  if (id.includes("streaming")) {
    const provider = findProvider(id.split(".")[1])

    parameters.with_genres = genre ? findGenreId(genre, genreList) : undefined
    parameters.with_watch_providers = provider.watchProviderId
    parameters.watch_region = provider.country
    parameters.with_watch_monetization_types = "flatrate|free|ads"
  } else {
    switch (id) {
      case "tmdb.top":
        parameters.with_genres = genre ? findGenreId(genre, genreList) : undefined
        if (type === "series") {
          parameters.watch_region = language.split("-")[1]
          parameters.with_watch_monetization_types = "flatrate|free|ads|rent|buy"
        }
        break
      case "tmdb.year":
        const year = genre ? parseInt(genre) : new Date().getFullYear()
        if (type === "movie") {
            parameters.primary_release_year = year
        } else {
            parameters.first_air_date_year = year
        }
        break
      case "tmdb.language":
        const findGenre = genre ? findLanguageCode(genre, languages) : language.split("-")[0]
        parameters.with_original_language = findGenre
        break
      default:
        break
    }
  }
  return parameters
}

export async function getCatalog(tmdbClient: TMDBClient, type: string, language: string, page: number, id: string, genre: string, config: any) {
  const mdblistKey = config.mdblistkey

  if (id.startsWith("mdblist.")) {
    const listId = id.split(".")[1]
    const results = await fetchMDBListItems(listId, mdblistKey, language, page)
    const parseResults = await parseMDBListItems(tmdbClient, results, type, genre, language, config)

    return parseResults
  }

  const genreList = await getGenreList(tmdbClient, language, type)
  const parameters = await buildParameters(tmdbClient, type, language, page, id, genre, genreList, config)

  const fetchFunction = type === "movie" ? tmdbClient.discoverMovie.bind(tmdbClient) : tmdbClient.discoverTv.bind(tmdbClient)

  return fetchFunction(parameters)
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