export interface Manifest {
  id: string
  name: string
  version: string
  description: string
  resources: (string | { name: string; types?: string[]; idPrefixes?: string[] })[]
  types: string[]
  catalogs: Catalog[]
  idPrefixes?: string[]
  background?: string
  logo?: string
  logo_url?: string
  contactEmail?: string
  behaviorHints?: {
    configurable?: boolean
    configurationRequired?: boolean
  }
}

export interface Catalog {
  type: string
  id: string
  name?: string
  extra?: {
    name: string
    isRequired?: boolean
    options?: string[]
    optionsLimit?: number
  }[]
}

export interface MetaPreview {
  id: string
  type: string
  name: string
  poster?: string
  background?: string
  logo?: string
  description?: string
  releaseInfo?: string
  imdbRating?: string
  released?: string
  posterShape?: 'regular' | 'square' | 'landscape'
  links?: {
    name: string
    category: string
    url: string
  }[]
}

export interface MetaDetail extends MetaPreview {
  genres?: string[]
  director?: string[]
  cast?: string[]
  runtime?: string
  country?: string
  imdb_id?: string
  videos?: MetaVideo[]
}

export interface MetaVideo {
  id: string
  title: string
  released: string
  thumbnail?: string
  streams?: Stream[]
  available?: boolean
  episode?: number
  season?: number
  trailer?: string
  overview?: string
}

export interface Stream {
  url?: string
  ytId?: string
  infoHash?: string
  fileIdx?: number
  title?: string
  name?: string
  description?: string
  subtitles?: Array<{ url: string; lang: string }>
  behaviorHints?: {
    notWebReady?: boolean
    bingeGroup?: string
    proxyHeaders?: {
      request?: Record<string, string>
      response?: Record<string, string>
    }
  }
}

export interface Subtitle {
  id: string
  url: string
  lang: string
}

export interface AddonResponse<T> {
  metas?: T[]
  meta?: T
  streams?: T[]
  subtitles?: T[]
  addons?: Manifest[]
  err?: string
}

export interface AddonConfig {
  rpdbkey?: string
  enableAgeRating?: boolean
  showAgeRatingInGenres?: boolean
  castCount?: number
  [key: string]: any
}

export interface StreamSettings {
  parental?: {
    enabled: boolean
    ratingLimit?: string
  }
  [key: string]: any
}