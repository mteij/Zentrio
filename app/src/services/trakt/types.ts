// Trakt API Types
// Reference: https://trakt.docs.apiary.io/

// ============================================================================
// Authentication Types
// ============================================================================

export interface DeviceCodeResponse {
  device_code: string
  user_code: string
  verification_url: string
  expires_in: number
  interval: number
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  created_at: number
  token_type: 'Bearer'
  scope: string
}

export interface OAuthError {
  error: string
  error_description?: string
}

// ============================================================================
// ID Types
// ============================================================================

export interface TraktIds {
  trakt?: number
  slug?: string
  imdb?: string
  tmdb?: number
  tvdb?: number
}

// ============================================================================
// Media Types
// ============================================================================

export interface TraktMovie {
  title: string
  year: number
  ids: TraktIds
}

export interface TraktShow {
  title: string
  year: number
  ids: TraktIds
}

export interface TraktSeason {
  number: number
  ids: TraktIds
}

export interface TraktEpisode {
  season: number
  number: number
  title: string
  ids: TraktIds
}

// ============================================================================
// History Types
// ============================================================================

export interface TraktHistoryItem {
  id: number
  watched_at: string
  action: 'scrobble' | 'watch' | 'checkin'
  type: 'movie' | 'episode'
  movie?: TraktMovie
  episode?: TraktEpisode
  show?: TraktShow
}

export interface TraktSyncMovieItem {
  watched_at?: string
  ids: TraktIds
}

export interface TraktSyncEpisodeItem {
  watched_at?: string
  ids: TraktIds
}

export interface TraktSyncShowItem {
  watched_at?: string
  ids: TraktIds
  seasons?: {
    number: number
    episodes?: { number: number; watched_at?: string }[]
  }[]
}

export interface TraktSyncRequest {
  movies?: TraktSyncMovieItem[]
  shows?: TraktSyncShowItem[]
  episodes?: TraktSyncEpisodeItem[]
}

export interface TraktSyncResponse {
  added?: { movies: number; episodes: number }
  deleted?: { movies: number; episodes: number }
  not_found?: {
    movies: { ids: TraktIds }[]
    shows: { ids: TraktIds }[]
    episodes: { ids: TraktIds }[]
  }
}

// ============================================================================
// Recommendation Types
// ============================================================================

export interface TraktMovieRecommendation {
  movie: TraktMovie
}

export interface TraktShowRecommendation {
  show: TraktShow
}

// ============================================================================
// User Types
// ============================================================================

export interface TraktUser {
  username: string
  private: boolean
  name: string
  vip: boolean
  ids: {
    slug: string
    uuid?: string
  }
  images?: {
    avatar?: {
      full?: string
    }
  }
}

// ============================================================================
// Database Types (for local storage)
// ============================================================================

export interface TraktAccount {
  id: number
  profile_id: number
  access_token: string
  refresh_token: string
  expires_at: string
  trakt_user_id?: string
  trakt_username?: string
  created_at: string
  updated_at: string
}

export interface TraktSyncState {
  id: number
  profile_id: number
  last_history_sync?: string
  last_push_sync?: string
  sync_enabled: boolean
  push_to_trakt: boolean
}
