// Database Types
// All TypeScript interfaces for database entities

export interface User {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image?: string
  createdAt: Date
  updatedAt: Date
  username?: string
  firstName?: string
  lastName?: string
  addonManagerEnabled: boolean
  hideCalendarButton: boolean
  hideAddonsButton: boolean
  hideCinemetaContent: boolean
  twoFactorEnabled: boolean
  heroBannerEnabled: boolean
  tmdbApiKey?: string
}

export interface SyncableEntity {
  remote_id?: string
  dirty?: boolean
  deleted_at?: string
  updated_at?: string
}

export interface Profile extends SyncableEntity {
  id: number
  user_id: string
  name: string
  avatar: string
  avatar_type: 'initials' | 'avatar'
  avatar_style: string
  is_default: boolean
  settings_profile_id?: number
  created_at: string
}

export interface SettingsProfile extends SyncableEntity {
  id: number
  user_id: string
  name: string
  is_default: boolean
  created_at: string
}

export interface UserSession {
  id: number
  user_id: number
  session_token: string
  expires_at: string
  created_at: string
  last_activity?: string
  max_idle_minutes?: number
}

export interface ProxySession {
  id: number
  user_id: string
  profile_id?: number
  session_token: string
  security_fingerprint?: string
  ip_address?: string
  user_agent?: string
  created_at: string
  last_activity: string
  expires_at: string
  is_active: boolean
}

export interface ProxyLog {
  id: number
  proxy_session_id?: number
  method: string
  url: string
  target_url?: string
  request_headers?: string
  response_status?: number
  response_headers?: string
  error_message?: string
  duration_ms: number
  ip_address: string
  user_agent: string
  request_size?: number
  response_size?: number
  timestamp: string
}

export interface ProfileProxySettings {
  id: number
  profile_id: number
  settings_profile_id?: number
  nsfw_filter_enabled: boolean
  nsfw_age_rating: number
  hide_calendar_button: boolean
  hide_addons_button: boolean
  mobile_click_to_hover: boolean
  hero_banner_enabled: boolean
  tmdb_api_key?: string
  created_at: string
  updated_at: string
}

export interface ProxyRateLimit {
  id: number
  identifier: string
  endpoint_type: string
  request_count: number
  window_start: string
  blocked_until?: string
  created_at: string
  updated_at: string
}

export interface WatchHistoryItem extends SyncableEntity {
  id: number
  profile_id: number
  meta_id: string
  meta_type: string
  season?: number
  episode?: number
  episode_id?: string
  title?: string
  poster?: string
  duration?: number
  position?: number
  is_watched?: boolean
  watched_at?: string
  last_stream?: any
}

export interface List extends SyncableEntity {
  id: number
  profile_id: number
  name: string
  is_default?: boolean
  created_at: string
}

export interface ListItem extends SyncableEntity {
  id: number
  list_id: number
  meta_id: string
  type: string
  title?: string
  poster?: string
  imdb_rating?: number
  created_at: string
}

export interface ListShare {
  id: number
  list_id: number
  shared_by_user_id: string
  shared_to_email: string
  shared_to_user_id?: string
  share_token: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  permission: 'read' | 'add' | 'full'
  created_at: string
  expires_at?: string
  accepted_at?: string
}

export interface ProfileSharedList {
  id: number
  profile_id: number
  list_share_id: number
  added_at: string
}

export interface ProfileListShare {
  id: number
  list_id: number
  owner_profile_id: number
  shared_to_profile_id: number
  permission: 'read' | 'add' | 'full'
  created_at: string
}

export interface Addon {
  id: number
  manifest_url: string
  name: string
  version?: string
  description?: string
  logo?: string
  logo_url?: string
  behavior_hints?: string
  created_at: string
}

export interface ProfileAddon extends SyncableEntity {
  id: number
  profile_id: number
  settings_profile_id?: number
  addon_id: number
  enabled: boolean
  created_at: string
  addon?: Addon
}

import { StreamConfig } from '../addons/stream-processor'

export interface StreamSettings extends StreamConfig, SyncableEntity {}

export interface AppearanceSettings extends SyncableEntity {
  id?: number
  settings_profile_id?: number
  show_imdb_ratings: boolean
  show_age_ratings: boolean
  background_style: string
}
