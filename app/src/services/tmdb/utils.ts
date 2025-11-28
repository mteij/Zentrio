/**
 * Portions of this code are derived from the TMDB Addon project.
 * Original source: https://github.com/mrcanelas/tmdb-addon
 * Licensed under Apache License 2.0
 */
import { decompressFromEncodedURIComponent } from 'lz-string'

export const Utils = {
  parseCertification(release_dates: any, language: string) {
    const userRegion = language.split("-")[1] || "US"
    const release = release_dates.results.find(
      (r: any) => r.iso_3166_1 === userRegion
    )
    
    if (release && release.release_dates && release.release_dates.length > 0) {
      return release.release_dates[0].certification
    }
    
    return null
  },

  parseCast(credits: any, count?: number) {
    if (!credits?.cast) return []
    
    const cast = count === undefined || count === null 
      ? credits.cast 
      : credits.cast.slice(0, count)

    return cast.map((el: any) => ({
      name: el.name,
      character: el.character,
      photo: el.profile_path ? `https://image.tmdb.org/t/p/w276_and_h350_face${el.profile_path}` : null
    }))
  },

  parseDirector(credits: any) {
    if (!credits?.crew) return []
    return credits.crew
      .filter((x: any) => x.job === "Director")
      .map((el: any) => el.name)
  },

  parseWriter(credits: any) {
    if (!credits?.crew) return []
    return credits.crew
      .filter((x: any) => x.job === "Writer")
      .map((el: any) => el.name)
  },

  parseSlug(type: string, title: string, imdb_id?: string) {
    return `${type}/${title.toLowerCase().replace(/ /g, "-")}-${imdb_id ? imdb_id.replace("tt", "") : ""}`
  },

  parseTrailers(videos: any) {
    if (!videos?.results) return []
    return videos.results
      .filter((el: any) => el.site === "YouTube" && el.type === "Trailer")
      .map((el: any) => ({
        source: `${el.key}`,
        type: `${el.type}`,
      }))
  },

  parseTrailerStream(videos: any) {
    if (!videos?.results) return []
    return videos.results
      .filter((el: any) => el.site === "YouTube" && el.type === "Trailer")
      .map((el: any) => ({
        title: `${el.name}`,
        ytId: `${el.key}`,
      }))
  },

  parseImdbLink(vote_average: any, imdb_id: string, ageRating: string | null = null, showAgeRatingWithImdbRating = false) {
    return {
      name: showAgeRatingWithImdbRating && ageRating ? `${ageRating}\u2003\u2003${vote_average}` : vote_average,
      category: "imdb",
      url: `https://imdb.com/title/${imdb_id}`,
    }
  },

  parseShareLink(title: string, imdb_id: string, type: string) {
    return {
      name: title,
      category: "share",
      url: `https://www.strem.io/s/${Utils.parseSlug(type, title, imdb_id)}`,
    }
  },

  parseImdbParentalGuideLink(imdbId: string, ageRating: string | null) {
    if (!imdbId || !ageRating) return null

    return {
      name: ageRating,
      category: "Genres",
      url: `https://www.imdb.com/title/${imdbId}/parentalguide`
    }
  },

  parseGenreLink(genres: any[], type: string, language: string, imdbId: string | null = null, ageRating: string | null = null, showAgeRatingInGenres = true) {
    const genreLinks = genres.map((genre) => ({
      name: genre.name,
      category: "Genres",
      url: `stremio:///discover/${encodeURIComponent(
        'http://127.0.0.1:11470' // Default host, should be configurable
      )}%2F${language}%2Fmanifest.json/${type}/tmdb.top?genre=${encodeURIComponent(
        genre.name
      )}`,
    }))

    if (showAgeRatingInGenres && imdbId && ageRating) {
      const parentalGuideLink = Utils.parseImdbParentalGuideLink(imdbId, ageRating)
      if (parentalGuideLink) {
        return [parentalGuideLink, ...genreLinks]
      }
    }

    return genreLinks
  },

  parseCreditsLink(credits: any, castCount?: number) {
    const castData = Utils.parseCast(credits, castCount)
    const Cast = castData.map((actor: any) => ({
      name: actor.name,
      category: "Cast",
      url: `stremio:///search?search=${encodeURIComponent(actor.name)}`
    }))
    
    const Director = Utils.parseDirector(credits).map((director: string) => ({
      name: director,
      category: "Directors",
      url: `stremio:///search?search=${encodeURIComponent(director)}`,
    }))
    
    const Writer = Utils.parseWriter(credits).map((writer: string) => ({
      name: writer,
      category: "Writers",
      url: `stremio:///search?search=${encodeURIComponent(writer)}`,
    }))
    
    return [...Cast, ...Director, ...Writer]
  },

  parseCoutry(production_countries: any[]) {
    if (!production_countries) return ""
    return production_countries.map((country) => country.name).join(", ")
  },

  parseGenres(genres: any[]) {
    if (!genres) return []
    return genres.map((el) => el.name)
  },

  parseYear(status: string, first_air_date: string, last_air_date: string) {
    if (status === "Ended") {
      return first_air_date && last_air_date
        ? first_air_date.substr(0, 5) + last_air_date.substr(0, 4)
        : ""
    } else {
      return first_air_date ? first_air_date.substr(0, 5) : ""
    }
  },

  parseRunTime(runtime: number) {
    if (runtime === 0 || !runtime) {
      return ""
    }

    const hours = Math.floor(runtime / 60)
    const minutes = runtime % 60

    if (runtime > 60) {
      return hours > 0 ? `${hours}h${minutes}min` : `${minutes}min`
    } else {
      return `${runtime}min`
    }
  },

  parseCreatedBy(created_by: any[]) {
    if (!created_by) return []
    return created_by.map((el) => el.name)
  },

  parseConfig(catalogChoices: string) {
    let config: any = {}

    if (!catalogChoices) {
      return config
    }

    try {
      const decoded = decompressFromEncodedURIComponent(catalogChoices)
      config = JSON.parse(decoded)
    } catch (e) {
      try {
        config = JSON.parse(catalogChoices)
      } catch {
        if (catalogChoices) {
          config.language = catalogChoices
        }
      }
    }
    return config
  },

  async parseMediaImage(type: string, id: string, imagePath: string | null, language: string, rpdbkey?: string, mediaType: string = "poster", rpdbMediaTypes: any = null) {
    const tmdbSize = mediaType === "backdrop" || mediaType === "logo" ? "original" : "w500"
    const tmdbImage = imagePath ? `https://image.tmdb.org/t/p/${tmdbSize}${imagePath}` : null
    return tmdbImage
  },

  parseMedia(el: any, type: string, genreList: any[] = []) {
    const genres = Array.isArray(el.genre_ids)
      ? el.genre_ids.map((genre: number) => genreList.find((x) => x.id === genre)?.name || 'Unknown')
      : []

    return {
      id: `tmdb:${el.id}`,
      name: type === 'movie' ? el.title : el.name,
      genre: genres,
      poster: el.poster_path ? `https://image.tmdb.org/t/p/w500${el.poster_path}` : null,
      background: el.backdrop_path ? `https://image.tmdb.org/t/p/original${el.backdrop_path}` : null,
      posterShape: "regular",
      imdbRating: el.vote_average ? el.vote_average.toFixed(1) : 'N/A',
      year: type === 'movie' ? (el.release_date ? el.release_date.substr(0, 4) : "") : (el.first_air_date ? el.first_air_date.substr(0, 4) : ""),
      type: type === 'movie' ? type : 'series',
      description: el.overview,
    }
  },

  parseCollection(collObj: any) {
    if (!collObj || !collObj.parts || collObj.parts.length === 0) {
      return []
    }
    return collObj.parts.map((el: any) => ({
      name: el.title,
      category: collObj.name,
      url: `stremio:///detail/${el.media_type}/tmdb:${el.id}`
    }))
  }
}