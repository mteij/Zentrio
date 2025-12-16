/**
 * Portions of this code are derived from the TMDB Addon project.
 * Original source: https://github.com/mrcanelas/tmdb-addon
 * Licensed under Apache License 2.0
 */
import { TMDBClient } from './client'
import { Utils } from './utils'
import { getLogo, getTvLogo } from './logo'
import { getEpisodes } from './episodes'
import { getRating } from '../imdb'

const CACHE_TTL = 1000 * 60 * 60 // 1 hour
const blacklistLogoUrls = ["https://assets.fanart.tv/fanart/tv/0/hdtvlogo/-60a02798b7eea.png"]
const cache = new Map<string, { data: any; timestamp: number }>()
const ageRatingCache = new Map<string, { rating: string | null; timestamp: number }>()
 
const extractAgeRating = (res: any, type: string, language: string) => {
    const countryCode = language.split('-')[1]?.toUpperCase() || 'US' // Default to US if no country in language

    if (type === 'movie' && res.release_dates && res.release_dates.results) {
        // Helper to get cert from country result
        const getCert = (r: any) => {
             if (!r) return null
             if (r.release_dates) {
                 // Prefer theatrical (3)
                 let d = r.release_dates.find((x: any) => x.certification && x.type === 3)
                 if (!d) d = r.release_dates.find((x: any) => x.certification)
                 return d ? d.certification : null
             }
             return null
        }

        // 1. Try requested country
        let countryRelease = res.release_dates.results.find((r: any) => r.iso_3166_1 === countryCode)
        let cert = getCert(countryRelease)
        if (cert) return cert

        // 2. Try US fallback (if not already checked)
        if (countryCode !== 'US') {
            countryRelease = res.release_dates.results.find((r: any) => r.iso_3166_1 === 'US')
            cert = getCert(countryRelease)
            if (cert) return cert
        }

        // 3. Try Common Western Fallbacks
        const fallbacks = ['GB', 'NL', 'DE', 'FR', 'CA', 'AU', 'NZ', 'IE']
        for (const code of fallbacks) {
            if (code === countryCode) continue // Already checked
            if (code === 'US') continue // Already checked
            countryRelease = res.release_dates.results.find((r: any) => r.iso_3166_1 === code)
            cert = getCert(countryRelease)
            if (cert) return cert
        }
        
        // 4. Last resort: ANY certification found
        for (const r of res.release_dates.results) {
             cert = getCert(r)
             if (cert) return cert
        }

    } else if (type === 'series' && res.content_ratings && res.content_ratings.results) {
        // 1. Try requested country
        let ratingObj = res.content_ratings.results.find((r: any) => r.iso_3166_1 === countryCode)
        if (ratingObj && ratingObj.rating) return ratingObj.rating

        // 2. Try US fallback
        if (countryCode !== 'US') {
             ratingObj = res.content_ratings.results.find((r: any) => r.iso_3166_1 === 'US')
             if (ratingObj && ratingObj.rating) return ratingObj.rating
        }
        
        // 3. Try Common Fallbacks
        const fallbacks = ['GB', 'NL', 'DE', 'FR', 'CA', 'AU', 'NZ', 'IE']
        for (const code of fallbacks) {
             if (code === countryCode) continue
             ratingObj = res.content_ratings.results.find((r: any) => r.iso_3166_1 === code)
             if (ratingObj && ratingObj.rating) return ratingObj.rating
        }

        // 4. Last resort: Any
        ratingObj = res.content_ratings.results.find((r: any) => r.rating)
        if (ratingObj) return ratingObj.rating
    }
    return null
}
const normalizeConfig = (config: any) => {
  const {
    castCount,
    hideEpisodeThumbnails,
  } = config

  const enableAgeRating = config.enableAgeRating === true || config.enableAgeRating === "true"
  const showAgeRatingInGenres = config.showAgeRatingInGenres !== false && config.showAgeRatingInGenres !== "false"
  const showAgeRatingWithImdbRating = config.showAgeRatingWithImdbRating === true || config.showAgeRatingWithImdbRating === "true"
  const returnImdbId = config.returnImdbId === true || config.returnImdbId === "true"
  const hideInCinemaTag = config.hideInCinemaTag === true || config.hideInCinemaTag === "true"

  return {
    castCount,
    hideEpisodeThumbnails,
    enableAgeRating,
    showAgeRatingInGenres,
    showAgeRatingWithImdbRating,
    returnImdbId,
    hideInCinemaTag,
  }
}

const getCacheKey = (type: string, language: string, tmdbId: string, config: any) => {
  const { enableAgeRating, showAgeRatingInGenres, showAgeRatingWithImdbRating } = normalizeConfig(config)
  return `${type}-${language}-${tmdbId}-ageRating:${enableAgeRating}-${showAgeRatingInGenres}-${showAgeRatingWithImdbRating}`
}

const processLogo = (logo: string | null) => {
  if (!logo || typeof logo !== 'string' || blacklistLogoUrls.includes(logo)) return null
  return logo.replace("http://", "https://")
}

const buildLinks = (
  imdbRating: any,
  imdbId: string,
  title: string,
  type: string,
  genres: any[],
  credits: any,
  language: string,
  castCount: number | undefined,
  ageRating: string | null = null,
  showAgeRatingInGenres = true,
  showAgeRatingWithImdbRating = false,
  collObj: any
) => [
  Utils.parseImdbLink(imdbRating, imdbId, ageRating, showAgeRatingWithImdbRating),
  Utils.parseShareLink(title, imdbId, type),
  ...Utils.parseGenreLink(genres, type, language, imdbId, ageRating, showAgeRatingInGenres),
  ...Utils.parseCreditsLink(credits, castCount),
  ...Utils.parseCollection(collObj)
]

const addAgeRatingToGenres = (ageRating: string | null, genres: string[], showAgeRatingInGenres = true) => {
  if (!ageRating || !showAgeRatingInGenres) return genres
  return [ageRating, ...genres]
}

const fetchCollectionData = async (tmdbClient: TMDBClient, collTMDBId: string, language: string, tmdbId: string) => {
  return await tmdbClient.collectionInfo({
    id: collTMDBId,
    language
  }).then((res: any) => {
    if (!res.parts) {
      return null
    }
    res.parts = res.parts.filter((part: any) => part.id !== parseInt(tmdbId)) // remove self from collection
    return res
  })
}

async function getMovieAgeRating(tmdbClient: TMDBClient, tmdbId: string, language: string) {
  try {
    const releaseDates = await tmdbClient.movieReleaseDates({ id: tmdbId })
    const userRegion = language.split("-")[1] || "US"

    // Try user's region first
    let ageRating = Utils.parseCertification(releaseDates, language)

    // If no rating found for user's region, fallback to US
    if (!ageRating && userRegion !== "US") {
      ageRating = Utils.parseCertification(releaseDates, "en-US")
    }

    return ageRating || null
  } catch (error: any) {
    console.error(`Error fetching age rating for movie ${tmdbId}:`, error.message)
    return null
  }
}

async function getTvAgeRating(tmdbClient: TMDBClient, tmdbId: string, language: string) {
  try {
    const contentRatings = await tmdbClient.tvContentRatings({ id: tmdbId })
    const userRegion = language.split("-")[1] || "US"

    // Find rating for user's region
    let ageRating = null
    const userRegionRating = contentRatings.results.find(
      (rating: any) => rating.iso_3166_1 === userRegion
    )

    if (userRegionRating && userRegionRating.rating) {
      ageRating = userRegionRating.rating
    } else {
      // Fallback to US rating
      const usRating = contentRatings.results.find(
        (rating: any) => rating.iso_3166_1 === "US"
      )
      if (usRating && usRating.rating) {
        ageRating = usRating.rating
      }
    }

    return ageRating || null
  } catch (error: any) {
    console.error(`Error fetching age rating for TV show ${tmdbId}:`, error.message)
    return null
  }
}

export async function getAgeRating(tmdbClient: TMDBClient, tmdbId: string, type: string, language: string) {
  if (!tmdbId) return null

  const cacheKey = `${type}-${tmdbId}-${language}`
  const cached = ageRatingCache.get(cacheKey)

  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.rating
  }

  try {
    const rating = type === "movie"
      ? await getMovieAgeRating(tmdbClient, tmdbId, language)
      : await getTvAgeRating(tmdbClient, tmdbId, language)

    ageRatingCache.set(cacheKey, { rating, timestamp: Date.now() })
    return rating
  } catch (err: any) {
    console.error(`Error fetching age rating for ${type} ${tmdbId}:`, err.message)
    return null
  }
}

const buildMovieResponse = async (tmdbClient: TMDBClient, res: any, type: string, language: string, tmdbId: string, config: any = {}) => {
  const {
    castCount,
    enableAgeRating,
    showAgeRatingInGenres,
    showAgeRatingWithImdbRating,
    returnImdbId,
    hideInCinemaTag
  } = normalizeConfig(config)

  const logoFetcher = getLogo(tmdbClient, tmdbId, language, res.original_language)

  const logo = await logoFetcher.catch(e => {
    console.warn(`Error fetching logo for movie ${tmdbId}:`, e.message)
    return null
  })

  const [poster, collectionRaw] = await Promise.all([
    Utils.parseMediaImage(type, tmdbId, res.poster_path, language),
    (res.belongs_to_collection && res.belongs_to_collection.id)
      ? fetchCollectionData(tmdbClient, res.belongs_to_collection.id, language, tmdbId).catch((e) => {
        console.warn(`Error fetching collection data for movie ${tmdbId} and collection ${res.belongs_to_collection.id}:`, e.message)
        return null
      })
      : null
  ])

  // Use TMDB rating directly
  let imdbRating = res.vote_average?.toFixed(1) || "N/A"
  
  // Try to get official IMDb rating if available
  if (res.imdb_id) {
    const officialRating = getRating(res.imdb_id)
    if (officialRating) {
      imdbRating = officialRating.averageRating.toFixed(1)
    }
  }

  const parsedGenres = Utils.parseGenres(res.genres)
  const resolvedAgeRating = enableAgeRating ? extractAgeRating(res, type, language) : null

  const response: any = {
    imdb_id: res.imdb_id || res.external_ids?.imdb_id,
    country: Utils.parseCoutry(res.production_countries),
    description: res.overview,
    director: Utils.parseDirector(res.credits),
    genre: addAgeRatingToGenres(resolvedAgeRating, parsedGenres, showAgeRatingInGenres),
    imdbRating,
    name: res.title,
    released: res.release_date,
    slug: Utils.parseSlug(type, res.title, res.imdb_id),
    type,
    writer: Utils.parseWriter(res.credits),
    year: res.release_date ? res.release_date.substr(0, 4) : "",
    trailers: Utils.parseTrailers(res.videos),
    background: await Utils.parseMediaImage(type, tmdbId, res.backdrop_path, language, undefined, "backdrop"),
    poster,
    runtime: Utils.parseRunTime(res.runtime),
    id: returnImdbId ? res.imdb_id : `tmdb:${tmdbId}`,
    genres: addAgeRatingToGenres(resolvedAgeRating, parsedGenres, showAgeRatingInGenres),
    ageRating: resolvedAgeRating,
    releaseInfo: res.release_date ? res.release_date.substr(0, 4) : "",
    trailerStreams: Utils.parseTrailerStream(res.videos),
    links: buildLinks(
      imdbRating,
      res.imdb_id,
      res.title,
      type,
      res.genres,
      res.credits,
      language,
      castCount,
      resolvedAgeRating,
      showAgeRatingInGenres,
      showAgeRatingWithImdbRating,
      collectionRaw
    ),
    behaviorHints: {
      defaultVideoId: res.imdb_id ? res.imdb_id : `tmdb:${res.id}`,
      hasScheduledVideos: false
    },
    logo: processLogo(logo),
    app_extras: {
      cast: Utils.parseCast(res.credits, castCount)
    }
  }
  if (hideInCinemaTag) delete response.imdb_id
  return response
}

const buildTvResponse = async (tmdbClient: TMDBClient, res: any, type: string, language: string, tmdbId: string, config: any = {}) => {
  const {
    castCount,
    enableAgeRating,
    showAgeRatingInGenres,
    showAgeRatingWithImdbRating,
    returnImdbId,
    hideInCinemaTag,
    hideEpisodeThumbnails,
  } = normalizeConfig(config)

  const runtime = res.episode_run_time?.[0] ?? res.last_episode_to_air?.runtime ?? res.next_episode_to_air?.runtime ?? null

  const logoFetcher = getTvLogo(tmdbClient, res.external_ids?.tvdb_id, res.id, language, res.original_language)

  const logo = await logoFetcher.catch(e => {
    console.warn(`Error fetching logo for series ${tmdbId}:`, e.message)
    return null
  })

  const [poster, episodes, collectionRaw] = await Promise.all([
    Utils.parseMediaImage(type, tmdbId, res.poster_path, language),
    getEpisodes(tmdbClient, language, tmdbId, res.external_ids?.imdb_id, res.seasons, {
      hideEpisodeThumbnails
    }).catch(e => {
      console.warn(`Error fetching episodes for series ${tmdbId}:`, e.message)
      return []
    }),
    (res.belongs_to_collection && res.belongs_to_collection.id)
      ? fetchCollectionData(tmdbClient, res.belongs_to_collection.id, language, tmdbId).catch((e) => {
        console.warn(`Error fetching collection data for movie ${tmdbId} and collection ${res.belongs_to_collection.id}:`, e.message)
        return null
      })
      : null
  ])

  // Use TMDB rating directly
  let imdbRating = res.vote_average?.toFixed(1) || "N/A"

  // Try to get official IMDb rating if available
  if (res.external_ids?.imdb_id) {
    const officialRating = getRating(res.external_ids.imdb_id)
    if (officialRating) {
      imdbRating = officialRating.averageRating.toFixed(1)
    }
  }

  const parsedGenres = Utils.parseGenres(res.genres)
  const resolvedAgeRating = enableAgeRating ? extractAgeRating(res, type, language) : null

  const response: any = {
    country: Utils.parseCoutry(res.production_countries),
    description: res.overview,
    genre: addAgeRatingToGenres(resolvedAgeRating, parsedGenres, showAgeRatingInGenres),
    imdbRating,
    imdb_id: res.external_ids.imdb_id,
    name: res.name,
    poster,
    released: res.first_air_date,
    runtime: Utils.parseRunTime(runtime),
    status: res.status,
    type,
    writer: Utils.parseCreatedBy(res.created_by),
    year: Utils.parseYear(res.status, res.first_air_date, res.last_air_date),
    background: await Utils.parseMediaImage(type, tmdbId, res.backdrop_path, language, undefined, "backdrop"),
    slug: Utils.parseSlug(type, res.name, res.external_ids.imdb_id),
    id: returnImdbId ? res.imdb_id : `tmdb:${tmdbId}`,
    genres: addAgeRatingToGenres(resolvedAgeRating, parsedGenres, showAgeRatingInGenres),
    ageRating: resolvedAgeRating,
    releaseInfo: Utils.parseYear(res.status, res.first_air_date, res.last_air_date),
    videos: episodes || [],
    links: buildLinks(
      imdbRating,
      res.external_ids.imdb_id,
      res.name,
      type,
      res.genres,
      res.credits,
      language,
      castCount,
      resolvedAgeRating,
      showAgeRatingInGenres,
      showAgeRatingWithImdbRating,
      collectionRaw
    ),
    trailers: Utils.parseTrailers(res.videos),
    trailerStreams: Utils.parseTrailerStream(res.videos),
    behaviorHints: {
      defaultVideoId: null,
      hasScheduledVideos: true
    },
    logo: processLogo(logo),
    app_extras: {
      cast: Utils.parseCast(res.credits, castCount)
    }
  }
  if (hideInCinemaTag) delete response.imdb_id

  return response
}

export async function getMeta(tmdbClient: TMDBClient, type: string, language: string, tmdbId: string, config: any = {}) {
  const cacheKey = getCacheKey(type, language, tmdbId, config)
  const cachedData = cache.get(cacheKey)

  if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
    return Promise.resolve({ meta: cachedData.data })
  }

  try {
    const meta = await (type === "movie" ?
      tmdbClient.movieInfo({ id: tmdbId, language, append_to_response: "videos,credits,external_ids,release_dates" })
        .then(res => buildMovieResponse(tmdbClient, res, type, language, tmdbId, config)) :
      tmdbClient.tvInfo({ id: tmdbId, language, append_to_response: "videos,credits,external_ids,content_ratings" })
        .then(res => buildTvResponse(tmdbClient, res, type, language, tmdbId, config))
    )

    cache.set(cacheKey, { data: meta, timestamp: Date.now() })
    return Promise.resolve({ meta })
  } catch (error: any) {
    console.error(`Error in getMeta: ${error.message}`)
    throw error
  }
}