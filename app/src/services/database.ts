import { Database } from 'bun:sqlite'
import { auth } from './auth'
import * as bcrypt from 'bcryptjs'
import { join, dirname, isAbsolute } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { randomBytes, randomInt, createHash } from 'crypto'
import { encrypt } from './encryption'
import { getConfig } from './envParser'

// Initialize SQLite database (honor DATABASE_URL to support Docker volume persistence)
const cfg = getConfig()
let dbPath = cfg.DATABASE_URL || './data/zentrio.db'
// Normalize relative paths to be under current working dir
if (!isAbsolute(dbPath)) {
  dbPath = join(process.cwd(), dbPath)
}
// Ensure parent directory exists to avoid ephemeral failures and data loss
try {
  const dir = dirname(dbPath)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
} catch (_) { /* best-effort */ }
const db = new Database(dbPath)

 // Enable foreign keys
 db.exec('PRAGMA foreign_keys = ON')

 // Create tables with full schema
 db.exec(`
  CREATE TABLE IF NOT EXISTS user (
     id TEXT PRIMARY KEY,
     email TEXT UNIQUE NOT NULL,
     name TEXT NOT NULL,
     emailVerified BOOLEAN NOT NULL,
     image TEXT,
     createdAt DATETIME NOT NULL,
     updatedAt DATETIME NOT NULL,
     username TEXT,
     firstName TEXT,
     lastName TEXT,
     addonManagerEnabled BOOLEAN DEFAULT FALSE,
     hideCalendarButton BOOLEAN DEFAULT FALSE,
     hideAddonsButton BOOLEAN DEFAULT FALSE,
     hideCinemetaContent BOOLEAN DEFAULT FALSE,
     twoFactorEnabled BOOLEAN DEFAULT FALSE,
     heroBannerEnabled BOOLEAN DEFAULT TRUE,
     tmdbApiKey TEXT
   );

   CREATE TABLE IF NOT EXISTS session (
     id TEXT PRIMARY KEY,
     expiresAt DATETIME NOT NULL,
     token TEXT UNIQUE NOT NULL,
     createdAt DATETIME NOT NULL,
     updatedAt DATETIME NOT NULL,
     ipAddress TEXT,
     userAgent TEXT,
     userId TEXT NOT NULL REFERENCES user(id),
     lastActivity DATETIME,
     maxIdleMinutes INTEGER
   );

   CREATE TABLE IF NOT EXISTS account (
     id TEXT PRIMARY KEY,
     accountId TEXT NOT NULL,
     providerId TEXT NOT NULL,
     userId TEXT NOT NULL REFERENCES user(id),
     accessToken TEXT,
     refreshToken TEXT,
     idToken TEXT,
     accessTokenExpiresAt DATETIME,
     refreshTokenExpiresAt DATETIME,
     scope TEXT,
     password TEXT,
     createdAt DATETIME NOT NULL,
     updatedAt DATETIME NOT NULL
   );

   CREATE TABLE IF NOT EXISTS verification (
     id TEXT PRIMARY KEY,
     identifier TEXT NOT NULL,
     value TEXT NOT NULL,
     expiresAt DATETIME NOT NULL,
     createdAt DATETIME,
     updatedAt DATETIME
   );
   CREATE TABLE IF NOT EXISTS twoFactor (
     id TEXT PRIMARY KEY,
     secret TEXT NOT NULL,
     backupCodes TEXT NOT NULL,
     userId TEXT NOT NULL REFERENCES user(id)
   );

  CREATE TABLE IF NOT EXISTS settings_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    remote_id TEXT,
    dirty BOOLEAN DEFAULT FALSE,
    deleted_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      avatar_type TEXT DEFAULT 'initials',
      avatar_style TEXT DEFAULT 'bottts-neutral',
      is_default BOOLEAN DEFAULT FALSE,
      settings_profile_id INTEGER REFERENCES settings_profiles(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      remote_id TEXT,
      dirty BOOLEAN DEFAULT FALSE,
      deleted_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

  -- Proxy sessions for enhanced security tracking
  CREATE TABLE IF NOT EXISTS proxy_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    profile_id INTEGER,
    session_token TEXT UNIQUE NOT NULL,
    security_fingerprint TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE SET NULL
  );

  -- Proxy request logs (enhanced from existing proxy logger)
  CREATE TABLE IF NOT EXISTS proxy_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proxy_session_id INTEGER,
    method TEXT NOT NULL,
    url TEXT NOT NULL,
    target_url TEXT,
    request_headers TEXT,
    response_status INTEGER,
    response_headers TEXT,
    error_message TEXT,
    duration_ms INTEGER NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT NOT NULL,
    request_size INTEGER,
    response_size INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proxy_session_id) REFERENCES proxy_sessions (id) ON DELETE SET NULL
  );

  -- Profile settings for proxy features
  CREATE TABLE IF NOT EXISTS profile_proxy_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    settings_profile_id INTEGER REFERENCES settings_profiles(id) ON DELETE CASCADE,
    nsfw_filter_enabled BOOLEAN DEFAULT FALSE,
    nsfw_age_rating INTEGER DEFAULT 0,
    hide_calendar_button BOOLEAN DEFAULT FALSE,
    hide_addons_button BOOLEAN DEFAULT FALSE,
    mobile_click_to_hover BOOLEAN DEFAULT FALSE,
    hero_banner_enabled BOOLEAN DEFAULT TRUE,
    tmdb_api_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    remote_id TEXT,
    dirty BOOLEAN DEFAULT FALSE,
    deleted_at DATETIME,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
  );

  -- Rate limiting for proxy endpoints
  CREATE TABLE IF NOT EXISTS proxy_rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL, -- IP + User Agent hash
    endpoint_type TEXT NOT NULL, -- 'generic', 'addon', 'api'
    request_count INTEGER DEFAULT 1,
    window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
    blocked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Indexes for performance
  CREATE INDEX IF NOT EXISTS idx_proxy_sessions_user_id ON proxy_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_proxy_sessions_token ON proxy_sessions(session_token);
  CREATE INDEX IF NOT EXISTS idx_proxy_sessions_active ON proxy_sessions(is_active, expires_at);
  CREATE INDEX IF NOT EXISTS idx_proxy_logs_session_id ON proxy_logs(proxy_session_id);
  CREATE INDEX IF NOT EXISTS idx_proxy_logs_timestamp ON proxy_logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_profile_proxy_settings_profile_id ON profile_proxy_settings(profile_id);
  CREATE INDEX IF NOT EXISTS idx_proxy_rate_limits_identifier ON proxy_rate_limits(identifier, endpoint_type);

  CREATE TABLE IF NOT EXISTS watch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    meta_id TEXT NOT NULL,
    meta_type TEXT NOT NULL,
    season INTEGER NOT NULL DEFAULT -1,
    episode INTEGER NOT NULL DEFAULT -1,
    episode_id TEXT DEFAULT NULL,
    title TEXT,
    poster TEXT,
    duration INTEGER,
    position INTEGER,
    is_watched BOOLEAN DEFAULT FALSE,
    watched_at DATETIME DEFAULT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    remote_id TEXT,
    dirty BOOLEAN DEFAULT FALSE,
    deleted_at DATETIME,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    UNIQUE(profile_id, meta_id, season, episode)
  );
  CREATE INDEX IF NOT EXISTS idx_watch_history_profile ON watch_history(profile_id);
  CREATE INDEX IF NOT EXISTS idx_watch_history_meta ON watch_history(profile_id, meta_id);


  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    remote_id TEXT,
    dirty BOOLEAN DEFAULT FALSE,
    deleted_at DATETIME,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    UNIQUE(profile_id, name)
  );

  CREATE TABLE IF NOT EXISTS list_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    meta_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT,
    poster TEXT,
    imdb_rating REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    remote_id TEXT,
    dirty BOOLEAN DEFAULT FALSE,
    deleted_at DATETIME,
    FOREIGN KEY (list_id) REFERENCES lists (id) ON DELETE CASCADE,
    UNIQUE(list_id, meta_id)
  );

  CREATE TABLE IF NOT EXISTS list_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    shared_by_user_id TEXT NOT NULL,
    shared_to_email TEXT NOT NULL,
    shared_to_user_id TEXT,
    share_token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',
    permission TEXT DEFAULT 'read',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    accepted_at DATETIME,
    FOREIGN KEY (list_id) REFERENCES lists (id) ON DELETE CASCADE,
    FOREIGN KEY (shared_by_user_id) REFERENCES user (id),
    FOREIGN KEY (shared_to_user_id) REFERENCES user (id)
  );
  CREATE INDEX IF NOT EXISTS idx_list_shares_token ON list_shares(share_token);
  CREATE INDEX IF NOT EXISTS idx_list_shares_list ON list_shares(list_id);
  CREATE INDEX IF NOT EXISTS idx_list_shares_user ON list_shares(shared_to_user_id);

  -- Profile-level access to shared lists (junction table)
  CREATE TABLE IF NOT EXISTS profile_shared_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    list_share_id INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    FOREIGN KEY (list_share_id) REFERENCES list_shares (id) ON DELETE CASCADE,
    UNIQUE(profile_id, list_share_id)
  );
  CREATE INDEX IF NOT EXISTS idx_profile_shared_lists_profile ON profile_shared_lists(profile_id);
  CREATE INDEX IF NOT EXISTS idx_profile_shared_lists_share ON profile_shared_lists(list_share_id);

  -- Profile-to-profile sharing within same account
  CREATE TABLE IF NOT EXISTS profile_list_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    list_id INTEGER NOT NULL,
    owner_profile_id INTEGER NOT NULL,
    shared_to_profile_id INTEGER NOT NULL,
    permission TEXT DEFAULT 'read',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (list_id) REFERENCES lists (id) ON DELETE CASCADE,
    FOREIGN KEY (owner_profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    FOREIGN KEY (shared_to_profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    UNIQUE(list_id, shared_to_profile_id)
  );
  CREATE INDEX IF NOT EXISTS idx_profile_list_shares_owner ON profile_list_shares(owner_profile_id);
  CREATE INDEX IF NOT EXISTS idx_profile_list_shares_shared_to ON profile_list_shares(shared_to_profile_id);

  CREATE TABLE IF NOT EXISTS addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manifest_url TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    version TEXT,
    description TEXT,
    logo TEXT,
    logo_url TEXT,
    behavior_hints TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS profile_addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    addon_id INTEGER NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    remote_id TEXT,
    dirty BOOLEAN DEFAULT FALSE,
    deleted_at DATETIME,
    settings_profile_id INTEGER REFERENCES settings_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    FOREIGN KEY (addon_id) REFERENCES addons (id) ON DELETE CASCADE,
    UNIQUE(profile_id, addon_id),
    UNIQUE(settings_profile_id, addon_id)
  );
  CREATE INDEX IF NOT EXISTS idx_profile_addons_profile ON profile_addons(profile_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_addons_settings_addon ON profile_addons(settings_profile_id, addon_id);

  CREATE TABLE IF NOT EXISTS stream_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER,
    qualities TEXT,
    preferred_keywords TEXT,
    required_keywords TEXT,
    config TEXT,
    settings_profile_id INTEGER REFERENCES settings_profiles(id) ON DELETE CASCADE,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    remote_id TEXT,
    dirty BOOLEAN DEFAULT FALSE,
    deleted_at DATETIME,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    UNIQUE(profile_id)
  );

  CREATE TABLE IF NOT EXISTS appearance_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    settings_profile_id INTEGER REFERENCES settings_profiles(id) ON DELETE CASCADE,
    theme_id TEXT DEFAULT 'zentrio',
    show_imdb_ratings BOOLEAN DEFAULT TRUE,
    show_age_ratings BOOLEAN DEFAULT TRUE,
    background_style TEXT DEFAULT 'vanta',
    custom_theme_config TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    remote_id TEXT,
    dirty BOOLEAN DEFAULT FALSE,
    deleted_at DATETIME,
    UNIQUE(settings_profile_id)
  );
  
  CREATE TABLE IF NOT EXISTS sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    remote_url TEXT,
    remote_user_id TEXT,
    auth_token TEXT,
    last_sync_at DATETIME,
    is_syncing BOOLEAN DEFAULT FALSE
  );
 `);

 // Migrations: Add new columns to watch_history for existing databases
 // SQLite will error if column already exists, so we wrap each in try/catch
 const columnMigrations = [
   "ALTER TABLE watch_history ADD COLUMN season INTEGER DEFAULT NULL",
   "ALTER TABLE watch_history ADD COLUMN episode INTEGER DEFAULT NULL",
   "ALTER TABLE watch_history ADD COLUMN episode_id TEXT DEFAULT NULL",
   "ALTER TABLE watch_history ADD COLUMN is_watched BOOLEAN DEFAULT FALSE",
   "ALTER TABLE watch_history ADD COLUMN watched_at DATETIME DEFAULT NULL",
   "ALTER TABLE watch_history ADD COLUMN last_stream TEXT DEFAULT NULL",
   // List sharing support
   "ALTER TABLE lists ADD COLUMN is_default BOOLEAN DEFAULT FALSE"
 ]
 
 for (const sql of columnMigrations) {
   try {
     db.exec(sql)
   } catch (e) {
     // Column already exists, ignore
   }
 }

 // Migration: Update UNIQUE constraint from (profile_id, meta_id) to composite constraint
 // This allows per-episode tracking for series
 // Note: SQLite doesn't allow expressions in UNIQUE constraints, so we use -1 as default for movies
 try {
   // Check if we need to migrate by looking at the table structure
   const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='watch_history'").get() as { sql: string } | undefined
   
   // Check if old schema (has UNIQUE on just profile_id, meta_id without season/episode)
   const needsMigration = tableInfo && tableInfo.sql && 
     tableInfo.sql.includes('UNIQUE(profile_id, meta_id)') && 
     !tableInfo.sql.includes('season')
   
   if (needsMigration) {
     console.log('[Migration] Updating watch_history table for per-episode tracking...')
     
     // SQLite doesn't support modifying constraints, so we need to recreate the table
     // Using -1 as default for season/episode to allow simple UNIQUE constraint
     db.exec(`
       -- Create new table with proper constraint
       CREATE TABLE IF NOT EXISTS watch_history_new (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         profile_id INTEGER NOT NULL,
         meta_id TEXT NOT NULL,
         meta_type TEXT NOT NULL,
         season INTEGER NOT NULL DEFAULT -1,
         episode INTEGER NOT NULL DEFAULT -1,
         episode_id TEXT DEFAULT NULL,
         title TEXT,
         poster TEXT,
         duration INTEGER,
         position INTEGER,
         is_watched BOOLEAN DEFAULT FALSE,
         watched_at DATETIME DEFAULT NULL,
         updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
         remote_id TEXT,
         dirty BOOLEAN DEFAULT FALSE,
         deleted_at DATETIME,
         FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
         UNIQUE(profile_id, meta_id, season, episode)
       );
       
       -- Copy existing data, converting NULL to -1
       INSERT OR IGNORE INTO watch_history_new 
         (id, profile_id, meta_id, meta_type, season, episode, episode_id, title, poster, duration, position, is_watched, watched_at, updated_at, remote_id, dirty, deleted_at)
       SELECT 
         id, profile_id, meta_id, meta_type, 
         COALESCE(season, -1), COALESCE(episode, -1), 
         episode_id, title, poster, duration, position, 
         COALESCE(is_watched, FALSE), watched_at, updated_at, remote_id, dirty, deleted_at
       FROM watch_history;
       
       -- Drop old table and rename new one
       DROP TABLE watch_history;
       ALTER TABLE watch_history_new RENAME TO watch_history;
       
       -- Recreate indexes
       CREATE INDEX IF NOT EXISTS idx_watch_history_profile ON watch_history(profile_id);
       CREATE INDEX IF NOT EXISTS idx_watch_history_meta ON watch_history(profile_id, meta_id);
     `)
     
     console.log('[Migration] watch_history table migrated successfully!')
   }
 } catch (e) {
   console.error('[Migration] Failed to migrate watch_history table:', e)
 }

 // Helper block to backfill/init data (idempotent checks)
 try {
    // Ensure Zentrio addon is enabled for all settings profiles if no addon settings exist
    // This is strictly for initialization on a fresh DB if we want to pre-seed, 
    // but better to leave it to application logic or hooks.
    // We will leave the migration logic OUT as requested.
 } catch (e) {
    console.error("Initialization failed", e);
 }

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

import { StreamConfig } from './addons/stream-processor'

export interface StreamSettings extends StreamConfig, SyncableEntity {}

export interface AppearanceSettings extends SyncableEntity {
  id?: number
  settings_profile_id?: number
  theme_id: string
  show_imdb_ratings: boolean
  show_age_ratings: boolean
  background_style: string
  custom_theme_config?: string
}

// Hash password utility
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

// Verify password utility
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Secure random helpers
function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

// Generate session token
export function generateSessionToken(): string {
  return randomToken(32)
}

// User operations
export const userDb = {
  findByEmail: (email: string): User | undefined => {
    const stmt = db.prepare('SELECT * FROM user WHERE email = ?')
    return stmt.get(email) as User | undefined
  },

  findAccountsByUserId: (userId: string): any[] => {
    const stmt = db.prepare('SELECT * FROM account WHERE userId = ?')
    return stmt.all(userId) as any[]
  },

  hasPassword: (userId: string): boolean => {
    const stmt = db.prepare(
      "SELECT 1 FROM account WHERE userId = ? AND providerId = 'credential' AND password IS NOT NULL LIMIT 1"
    )
    return !!stmt.get(userId)
  },

  findById: (id: string): User | undefined => {
    const stmt = db.prepare('SELECT * FROM user WHERE id = ?')
    return stmt.get(id) as User | undefined
  },

  exists: (email: string): boolean => {
    const stmt = db.prepare('SELECT 1 FROM user WHERE email = ? LIMIT 1')
    return !!stmt.get(email)
  },

  list: (): User[] => {
    const stmt = db.prepare('SELECT * FROM user')
    return stmt.all() as User[]
  },

  update: async (id: string, updates: Partial<User>): Promise<User | undefined> => {
    // We'll use Better Auth's internal adapter for updates where possible,
    // but for custom fields we might need direct DB access if Better Auth doesn't expose a generic update
    // For now, let's implement a direct DB update for our custom fields
    const fields: string[] = []
    const values: any[] = []

    if (updates.username !== undefined) {
        fields.push('username = ?')
        values.push(updates.username)
    }
    if (updates.firstName !== undefined) {
        fields.push('firstName = ?')
        values.push(updates.firstName)
    }
    if (updates.lastName !== undefined) {
        fields.push('lastName = ?')
        values.push(updates.lastName)
    }
    if (updates.addonManagerEnabled !== undefined) {
        fields.push('addonManagerEnabled = ?')
        values.push(updates.addonManagerEnabled)
    }
    if (updates.hideCalendarButton !== undefined) {
        fields.push('hideCalendarButton = ?')
        values.push(updates.hideCalendarButton)
    }
    if (updates.hideAddonsButton !== undefined) {
        fields.push('hideAddonsButton = ?')
        values.push(updates.hideAddonsButton)
    }
    if (updates.hideCinemetaContent !== undefined) {
        fields.push('hideCinemetaContent = ?')
        values.push(updates.hideCinemetaContent)
    }
    if (updates.heroBannerEnabled !== undefined) {
        fields.push('heroBannerEnabled = ?')
        values.push(updates.heroBannerEnabled)
    }
    if (updates.tmdbApiKey !== undefined) {
        fields.push('tmdbApiKey = ?')
        values.push(updates.tmdbApiKey)
    }
    
    if (fields.length === 0) return userDb.findById(id)

    fields.push('updatedAt = CURRENT_TIMESTAMP')
    values.push(id)

    const stmt = db.prepare(`UPDATE user SET ${fields.join(', ')} WHERE id = ?`)
    const result = stmt.run(...values)

    return result.changes > 0 ? userDb.findById(id) : undefined
  }
}

// Profile operations
export const profileDb = {
  create: async (profileData: {
      user_id: string
      name: string
      avatar: string
      avatar_type?: 'initials' | 'avatar'
      avatar_style?: string
      is_default?: boolean
      settings_profile_id?: number
    }): Promise<Profile> => {
      const stmt = db.prepare(`
        INSERT INTO profiles (user_id, name, avatar, avatar_type, avatar_style, is_default, settings_profile_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      
      const result = stmt.run(
        profileData.user_id,
        profileData.name,
        profileData.avatar,
        profileData.avatar_type || 'initials',
        profileData.avatar_style || 'bottts-neutral',
        profileData.is_default || false,
        profileData.settings_profile_id || null
      )
      
      return profileDb.findById(result.lastInsertRowid as number)!
    },

  findById: (id: number): Profile | undefined => {
    const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?')
    return stmt.get(id) as Profile | undefined
  },

  getSettingsProfileId: (profileId: number): number | undefined => {
    const stmt = db.prepare('SELECT settings_profile_id FROM profiles WHERE id = ?')
    const res = stmt.get(profileId) as any
    return res ? res.settings_profile_id : undefined
  },

  findByUserId: (userId: string): (Profile & { settings?: ProfileProxySettings })[] => {
    const stmt = db.prepare(`
        SELECT p.*, s.nsfw_filter_enabled, s.nsfw_age_rating, s.hide_calendar_button, s.hide_addons_button, s.hero_banner_enabled
        FROM profiles p
        LEFT JOIN profile_proxy_settings s ON p.id = s.profile_id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
    `)
    return stmt.all(userId) as (Profile & { settings?: ProfileProxySettings })[]
  },

  findWithSettingsById: (id: number): (Profile & { settings?: ProfileProxySettings }) | undefined => {
    const stmt = db.prepare(`
        SELECT p.*, s.nsfw_filter_enabled, s.nsfw_age_rating, s.hide_calendar_button, s.hide_addons_button, s.hero_banner_enabled
        FROM profiles p
        LEFT JOIN profile_proxy_settings s ON p.id = s.profile_id
        WHERE p.id = ?
    `)
    return stmt.get(id) as (Profile & { settings?: ProfileProxySettings }) | undefined
    },

  update: async (id: number, updates: {
      name?: string
      avatar?: string
      avatar_type?: 'initials' | 'avatar'
      avatar_style?: string
      is_default?: boolean
      settings_profile_id?: number
    }): Promise<Profile | undefined> => {
      const fields: string[] = []
      const values: any[] = []
      
      if (updates.name !== undefined) {
        fields.push('name = ?')
        values.push(updates.name)
      }
      if (updates.avatar !== undefined) {
        fields.push('avatar = ?')
        values.push(updates.avatar)
      }
      if (updates.avatar_type !== undefined) {
        fields.push('avatar_type = ?')
        values.push(updates.avatar_type)
      }
      if (updates.avatar_style !== undefined) {
        fields.push('avatar_style = ?')
        values.push(updates.avatar_style)
      }
      if (updates.is_default !== undefined) {
        fields.push('is_default = ?')
        values.push(updates.is_default)
      }
      if (updates.settings_profile_id !== undefined) {
        fields.push('settings_profile_id = ?')
        values.push(updates.settings_profile_id)
      }
    if (fields.length === 0) return profileDb.findById(id)
    
    fields.push('updated_at = CURRENT_TIMESTAMP')
    fields.push('dirty = TRUE')
    values.push(id)
    
    const stmt = db.prepare(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`)
    const result = stmt.run(...values)
    
    return result.changes > 0 ? profileDb.findById(id) : undefined
  },

  delete: (id: number): boolean => {
    // Soft delete
    const stmt = db.prepare('UPDATE profiles SET deleted_at = CURRENT_TIMESTAMP, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  },

  setDefault: (userId: string, profileId: number): boolean => {
    const transaction = db.transaction(() => {
      // Remove default from all user profiles
      const clearStmt = db.prepare('UPDATE profiles SET is_default = FALSE WHERE user_id = ?')
      clearStmt.run(userId)
      
      // Set new default
      const setStmt = db.prepare('UPDATE profiles SET is_default = TRUE WHERE id = ? AND user_id = ?')
      const result = setStmt.run(profileId, userId)
      return result.changes > 0
    })
    
    return transaction()
  },

  getDefault: (userId: string): Profile | undefined => {
    const stmt = db.prepare('SELECT * FROM profiles WHERE user_id = ? AND is_default = TRUE LIMIT 1')
    return stmt.get(userId) as Profile | undefined
  },

}



// Proxy session operations
export const proxySessionDb = {
  create: (sessionData: {
    user_id: string
    profile_id?: number
    session_token: string
    security_fingerprint?: string
    ip_address?: string
    user_agent?: string
    expires_at: string
  }): ProxySession => {
    const stmt = db.prepare(`
      INSERT INTO proxy_sessions (user_id, profile_id, session_token, security_fingerprint, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      sessionData.user_id,
      sessionData.profile_id || null,
      sessionData.session_token,
      sessionData.security_fingerprint || null,
      sessionData.ip_address || null,
      sessionData.user_agent || null,
      sessionData.expires_at
    )
    
    return proxySessionDb.findById(result.lastInsertRowid as number)!
  },

  findById: (id: number): ProxySession | undefined => {
    const stmt = db.prepare('SELECT * FROM proxy_sessions WHERE id = ?')
    return stmt.get(id) as ProxySession | undefined
  },

  findByToken: (token: string): ProxySession | undefined => {
    const stmt = db.prepare('SELECT * FROM proxy_sessions WHERE session_token = ? AND is_active = TRUE AND expires_at > datetime("now")')
    return stmt.get(token) as ProxySession | undefined
  },

  updateActivity: (id: number): boolean => {
    const stmt = db.prepare('UPDATE proxy_sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  },

  deactivate: (id: number): boolean => {
    const stmt = db.prepare('UPDATE proxy_sessions SET is_active = FALSE WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  },

  deleteExpired: (): number => {
    const stmt = db.prepare('DELETE FROM proxy_sessions WHERE expires_at <= datetime("now")')
    const result = stmt.run()
    return result.changes
  }
}

// Proxy log operations
export const proxyLogDb = {
  log: (logData: {
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
  }): ProxyLog => {
    const stmt = db.prepare(`
      INSERT INTO proxy_logs (proxy_session_id, method, url, target_url, request_headers, response_status, response_headers, error_message, duration_ms, ip_address, user_agent, request_size, response_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      logData.proxy_session_id || null,
      logData.method,
      logData.url,
      logData.target_url || null,
      logData.request_headers || null,
      logData.response_status || null,
      logData.response_headers || null,
      logData.error_message || null,
      logData.duration_ms,
      logData.ip_address,
      logData.user_agent,
      logData.request_size || null,
      logData.response_size || null
    )
    
    return proxyLogDb.findById(result.lastInsertRowid as number)!
  },

  findById: (id: number): ProxyLog | undefined => {
    const stmt = db.prepare('SELECT * FROM proxy_logs WHERE id = ?')
    return stmt.get(id) as ProxyLog | undefined
  },

  getMetrics: (): any => {
    const stmt = db.prepare(`
      SELECT
        COUNT(*) as total_requests,
        AVG(duration_ms) as avg_duration,
        COUNT(CASE WHEN response_status >= 400 THEN 1 END) as error_count,
        COUNT(CASE WHEN response_status < 400 THEN 1 END) as success_count
      FROM proxy_logs
      WHERE timestamp >= datetime('now', '-24 hours')
    `)
    return stmt.get()
  }
}

// Profile proxy settings operations
export const profileProxySettingsDb = {
  create: (settingsData: {
    profile_id: number
    nsfw_filter_enabled?: boolean
    nsfw_age_rating?: number
    hide_calendar_button?: boolean
    hide_addons_button?: boolean
    mobile_click_to_hover?: boolean
    hero_banner_enabled?: boolean
    tmdb_api_key?: string | null
  }): ProfileProxySettings => {
    const stmt = db.prepare(`
      INSERT INTO profile_proxy_settings (profile_id, nsfw_filter_enabled, nsfw_age_rating, hide_calendar_button, hide_addons_button, mobile_click_to_hover, hero_banner_enabled, tmdb_api_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      settingsData.profile_id,
      settingsData.nsfw_filter_enabled || false,
      settingsData.nsfw_age_rating || 0,
      settingsData.hide_calendar_button || false,
      settingsData.hide_addons_button || false,
      settingsData.mobile_click_to_hover || false,
      settingsData.hero_banner_enabled !== undefined ? settingsData.hero_banner_enabled : true,
      settingsData.tmdb_api_key || null
    )
    
    return profileProxySettingsDb.findById(result.lastInsertRowid as number)!
  },

  findById: (id: number): ProfileProxySettings | undefined => {
    const stmt = db.prepare('SELECT * FROM profile_proxy_settings WHERE id = ?')
    return stmt.get(id) as ProfileProxySettings | undefined
  },

  findByProfileId: (profileId: number): ProfileProxySettings | undefined => {
    const stmt = db.prepare('SELECT * FROM profile_proxy_settings WHERE profile_id = ?')
    return stmt.get(profileId) as ProfileProxySettings | undefined
  },

  update: (profileId: number, updates: Partial<ProfileProxySettings> | { tmdb_api_key?: string | null }): ProfileProxySettings | undefined => {
    const fields: string[] = []
    const values: any[] = []
    
    Object.entries(updates).forEach(([key, value]) => {
      if (key !== 'id' && key !== 'profile_id' && key !== 'created_at' && value !== undefined) {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    })
    
    if (fields.length === 0) return profileProxySettingsDb.findByProfileId(profileId)
    
    fields.push('updated_at = CURRENT_TIMESTAMP')
    values.push(profileId)
    
    const stmt = db.prepare(`UPDATE profile_proxy_settings SET ${fields.join(', ')} WHERE profile_id = ?`)
    const result = stmt.run(...values)
    
    return result.changes > 0 ? profileProxySettingsDb.findByProfileId(profileId) : undefined
  }
}

// Proxy rate limit operations
export const proxyRateLimitDb = {
  findByIdentifier: (identifier: string, endpointType: string): ProxyRateLimit | undefined => {
    const stmt = db.prepare('SELECT * FROM proxy_rate_limits WHERE identifier = ? AND endpoint_type = ?')
    return stmt.get(identifier, endpointType) as ProxyRateLimit | undefined
  },

  create: (rateLimitData: {
    identifier: string
    endpoint_type: string
    request_count?: number
    window_start: Date
  }): ProxyRateLimit => {
    const stmt = db.prepare(`
      INSERT INTO proxy_rate_limits (identifier, endpoint_type, request_count, window_start)
      VALUES (?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      rateLimitData.identifier,
      rateLimitData.endpoint_type,
      rateLimitData.request_count || 1,
      rateLimitData.window_start.toISOString()
    )
    
    return proxyRateLimitDb.findById(result.lastInsertRowid as number)!
  },

  findById: (id: number): ProxyRateLimit | undefined => {
    const stmt = db.prepare('SELECT * FROM proxy_rate_limits WHERE id = ?')
    return stmt.get(id) as ProxyRateLimit | undefined
  },

  increment: (id: number): boolean => {
    const stmt = db.prepare('UPDATE proxy_rate_limits SET request_count = request_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    const result = stmt.run(id)
    return result.changes > 0
  },

  reset: (id: number, windowStart: Date): boolean => {
    const stmt = db.prepare('UPDATE proxy_rate_limits SET request_count = 1, window_start = ?, blocked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    const result = stmt.run(windowStart.toISOString(), id)
    return result.changes > 0
  },

  block: (id: number, blockedUntil: Date): boolean => {
    const stmt = db.prepare('UPDATE proxy_rate_limits SET blocked_until = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    const result = stmt.run(blockedUntil.toISOString(), id)
    return result.changes > 0
  }
}

// Periodic cleanup
setInterval(() => {
  proxySessionDb.deleteExpired()
}, 60 * 60 * 1000) // Every hour

// Watch History operations
export const watchHistoryDb = {
  upsert: (data: {
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
    last_stream?: any
  }): void => {
    // Use -1 for movies (no season/episode), actual values for series
    const seasonVal = data.season ?? -1
    const episodeVal = data.episode ?? -1
    const lastStreamStr = data.last_stream ? JSON.stringify(data.last_stream) : null
    
    // Check if record exists
    const checkStmt = db.prepare('SELECT id FROM watch_history WHERE profile_id = ? AND meta_id = ? AND season = ? AND episode = ?')
    const existing = checkStmt.get(data.profile_id, data.meta_id, seasonVal, episodeVal) as { id: number } | undefined
    
    if (existing) {
      // Update existing record
      const fields = [
        'position = ?',
        'duration = COALESCE(?, duration)',
        'title = COALESCE(?, title)',
        'poster = COALESCE(?, poster)',
        'episode_id = COALESCE(?, episode_id)',
        'updated_at = CURRENT_TIMESTAMP',
        'dirty = TRUE'
      ]
      
      const values = [
        data.position || null,
        data.duration || null,
        data.title || null,
        data.poster || null,
        data.episode_id || null
      ]

      if (lastStreamStr) {
        fields.push('last_stream = ?')
        values.push(lastStreamStr)
      }
      
      values.push(existing.id)
      
      const updateStmt = db.prepare(`UPDATE watch_history SET ${fields.join(', ')} WHERE id = ?`)
      updateStmt.run(...values)
    } else {
      // Insert new record
      const insertStmt = db.prepare(`
        INSERT INTO watch_history (profile_id, meta_id, meta_type, season, episode, episode_id, title, poster, duration, position, last_stream, updated_at, dirty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, TRUE)
      `)
      insertStmt.run(
        data.profile_id,
        data.meta_id,
        data.meta_type,
        seasonVal,
        episodeVal,
        data.episode_id || null,
        data.title || null,
        data.poster || null,
        data.duration || null,
        data.position || null,
        lastStreamStr
      )
    }
  },

  getByProfileId: (profileId: number): WatchHistoryItem[] => {
    const stmt = db.prepare('SELECT * FROM watch_history WHERE profile_id = ? AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 20')
    return stmt.all(profileId) as WatchHistoryItem[]
  },

  getProgress: (profileId: number, metaId: string, season?: number, episode?: number): WatchHistoryItem | undefined => {
    const seasonVal = season ?? -1
    const episodeVal = episode ?? -1
    const stmt = db.prepare('SELECT * FROM watch_history WHERE profile_id = ? AND meta_id = ? AND season = ? AND episode = ? AND deleted_at IS NULL')
    return stmt.get(profileId, metaId, seasonVal, episodeVal) as WatchHistoryItem | undefined
  },

  getSeriesProgress: (profileId: number, metaId: string): WatchHistoryItem[] => {
    // Get all episode progress for a series (season > -1 means it's an episode)
    const stmt = db.prepare('SELECT * FROM watch_history WHERE profile_id = ? AND meta_id = ? AND season > -1 AND deleted_at IS NULL ORDER BY season ASC, episode ASC')
    return stmt.all(profileId, metaId) as WatchHistoryItem[]
  },

  getLastWatchedEpisode: (profileId: number, metaId: string): WatchHistoryItem | undefined => {
    // Get last watched episode (season > -1 means it's an episode)
    const stmt = db.prepare('SELECT * FROM watch_history WHERE profile_id = ? AND meta_id = ? AND season > -1 AND episode > -1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1')
    return stmt.get(profileId, metaId) as WatchHistoryItem | undefined
  },

  markAsWatched: (profileId: number, metaId: string, metaType: string, watched: boolean, season?: number, episode?: number): void => {
    // Use -1 for movies (no season/episode), actual values for series
    const seasonVal = season ?? -1
    const episodeVal = episode ?? -1
    
    try {
      // Try upsert with the new UNIQUE constraint (profile_id, meta_id, season, episode)
      const stmt = db.prepare(`
        INSERT INTO watch_history (profile_id, meta_id, meta_type, season, episode, is_watched, watched_at, updated_at, dirty)
        VALUES (?, ?, ?, ?, ?, ?, ${watched ? 'CURRENT_TIMESTAMP' : 'NULL'}, CURRENT_TIMESTAMP, TRUE)
        ON CONFLICT(profile_id, meta_id, season, episode) DO UPDATE SET
          is_watched = excluded.is_watched,
          watched_at = ${watched ? 'CURRENT_TIMESTAMP' : 'NULL'},
          updated_at = CURRENT_TIMESTAMP,
          dirty = TRUE
      `)
      stmt.run(profileId, metaId, metaType, seasonVal, episodeVal, watched)
    } catch (e: any) {
      // If we hit the old UNIQUE constraint (profile_id, meta_id), update the existing record instead
      if (e?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        const updateStmt = db.prepare(`
          UPDATE watch_history 
          SET is_watched = ?, watched_at = ${watched ? 'CURRENT_TIMESTAMP' : 'NULL'}, 
              season = ?, episode = ?, updated_at = CURRENT_TIMESTAMP, dirty = TRUE
          WHERE profile_id = ? AND meta_id = ?
        `)
        updateStmt.run(watched, seasonVal, episodeVal, profileId, metaId)
      } else {
        throw e
      }
    }
  },

  markSeasonWatched: (profileId: number, metaId: string, metaType: string, season: number, watched: boolean, episodes: number[]): void => {
    const transaction = db.transaction(() => {
      for (const ep of episodes) {
        watchHistoryDb.markAsWatched(profileId, metaId, metaType, watched, season, ep)
      }
    })
    transaction()
  },

  autoMarkWatched: (profileId: number, metaId: string, season?: number, episode?: number): void => {
    // Mark as watched if position >= 90% of duration
    const seasonVal = season ?? -1
    const episodeVal = episode ?? -1
    const stmt = db.prepare(`
      UPDATE watch_history 
      SET is_watched = TRUE, watched_at = CURRENT_TIMESTAMP, dirty = TRUE
      WHERE profile_id = ? AND meta_id = ? AND season = ? AND episode = ?
        AND duration > 0 AND position >= (duration * 0.9) AND is_watched = FALSE
    `)
    stmt.run(profileId, metaId, seasonVal, episodeVal)
  }
  ,

  delete: (profileId: number, metaId: string, season?: number, episode?: number): boolean => {
    const seasonVal = season ?? -1
    const episodeVal = episode ?? -1
    
    // Soft delete
    const stmt = db.prepare(`
      UPDATE watch_history 
      SET deleted_at = CURRENT_TIMESTAMP, dirty = TRUE, updated_at = CURRENT_TIMESTAMP 
      WHERE profile_id = ? AND meta_id = ? AND season = ? AND episode = ?
    `)
    const result = stmt.run(profileId, metaId, seasonVal, episodeVal)
    
    // Also delete any specific episode progress if deleting a series container?
    // For now, let's keep it specific to the item requested.
    
    return result.changes > 0
  }
}

// List operations
export const listDb = {
  create: (profileId: number, name: string, isDefault: boolean = false): List => {
    // If this is the first list or marked as default, set is_default
    const existingLists = listDb.getAll(profileId)
    const shouldBeDefault = isDefault || existingLists.length === 0
    
    const stmt = db.prepare("INSERT INTO lists (profile_id, name, is_default) VALUES (?, ?, ?)")
    const res = stmt.run(profileId, name, shouldBeDefault ? 1 : 0)
    return listDb.getById(res.lastInsertRowid as number)!
  },

  getById: (id: number): List | undefined => {
    return db.prepare("SELECT * FROM lists WHERE id = ? AND deleted_at IS NULL").get(id) as List | undefined
  },

  getAll: (profileId: number): List[] => {
    return db.prepare("SELECT * FROM lists WHERE profile_id = ? AND deleted_at IS NULL ORDER BY is_default DESC, created_at ASC").all(profileId) as List[]
  },

  getDefault: (profileId: number): List | undefined => {
    // Try to get the default list; if none exists, get the first list
    let list = db.prepare("SELECT * FROM lists WHERE profile_id = ? AND is_default = TRUE AND deleted_at IS NULL").get(profileId) as List | undefined
    if (!list) {
      list = db.prepare("SELECT * FROM lists WHERE profile_id = ? AND deleted_at IS NULL ORDER BY created_at ASC LIMIT 1").get(profileId) as List | undefined
    }
    return list
  },

  setDefault: (profileId: number, listId: number): void => {
    // Unset current default
    db.prepare("UPDATE lists SET is_default = FALSE WHERE profile_id = ?").run(profileId)
    // Set new default
    db.prepare("UPDATE lists SET is_default = TRUE, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(listId)
  },

  delete: (id: number): void => {
    db.prepare("UPDATE lists SET deleted_at = CURRENT_TIMESTAMP, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id)
  },

  addItem: (data: { list_id: number, meta_id: string, type: string, title?: string, poster?: string, imdb_rating?: number }): void => {
    const stmt = db.prepare(`
      INSERT INTO list_items (list_id, meta_id, type, title, poster, imdb_rating, dirty)
      VALUES (?, ?, ?, ?, ?, ?, TRUE)
      ON CONFLICT(list_id, meta_id) DO UPDATE SET
        title = COALESCE(excluded.title, list_items.title),
        poster = COALESCE(excluded.poster, list_items.poster),
        imdb_rating = COALESCE(excluded.imdb_rating, list_items.imdb_rating),
        dirty = TRUE,
        updated_at = CURRENT_TIMESTAMP
    `)
    stmt.run(data.list_id, data.meta_id, data.type, data.title || null, data.poster || null, data.imdb_rating ? parseFloat(data.imdb_rating as any) : null)
  },

  removeItem: (listId: number, metaId: string): void => {
    db.prepare("UPDATE list_items SET deleted_at = CURRENT_TIMESTAMP, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE list_id = ? AND meta_id = ?").run(listId, metaId)
  },

  getItems: (listId: number): ListItem[] => {
    return db.prepare("SELECT * FROM list_items WHERE list_id = ? AND deleted_at IS NULL ORDER BY created_at DESC").all(listId) as ListItem[]
  },

  // Check if item is in ANY list for a profile
  isInAnyList: (profileId: number, metaId: string): boolean => {
    const stmt = db.prepare(`
      SELECT 1 FROM list_items li
      JOIN lists l ON li.list_id = l.id
      WHERE l.profile_id = ? AND li.meta_id = ? AND li.deleted_at IS NULL AND l.deleted_at IS NULL
      LIMIT 1
    `)
    return !!stmt.get(profileId, metaId)
  },

  // Get all lists containing the item
  getListsForItem: (profileId: number, metaId: string): number[] => {
    const stmt = db.prepare(`
      SELECT l.id FROM lists l
      JOIN list_items li ON l.id = li.list_id
      WHERE l.profile_id = ? AND li.meta_id = ? AND li.deleted_at IS NULL AND l.deleted_at IS NULL
    `)
    return (stmt.all(profileId, metaId) as any[]).map(r => r.id)
  },

  // ===== SHARING FUNCTIONS =====

  createShare: (listId: number, sharedByUserId: string, sharedToEmail: string, permission: 'read' | 'add' | 'full' = 'read'): ListShare => {
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30) // 30 day expiry

    const stmt = db.prepare(`
      INSERT INTO list_shares (list_id, shared_by_user_id, shared_to_email, share_token, permission, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const res = stmt.run(listId, sharedByUserId, sharedToEmail.toLowerCase(), token, permission, expiresAt.toISOString())
    return listDb.getShareById(res.lastInsertRowid as number)!
  },

  getShareById: (id: number): ListShare | undefined => {
    return db.prepare("SELECT * FROM list_shares WHERE id = ?").get(id) as ListShare | undefined
  },

  getShareByToken: (token: string): ListShare | undefined => {
    return db.prepare("SELECT * FROM list_shares WHERE share_token = ?").get(token) as ListShare | undefined
  },

  acceptShare: (token: string, userId: string, profileId?: number): boolean => {
    const share = listDb.getShareByToken(token)
    if (!share || share.status !== 'pending') return false
    if (share.expires_at && new Date(share.expires_at) < new Date()) return false

    db.prepare(`
      UPDATE list_shares SET 
        status = 'accepted', 
        shared_to_user_id = ?, 
        accepted_at = CURRENT_TIMESTAMP 
      WHERE share_token = ?
    `).run(userId, token)

    // If profileId provided, also link the share to that profile
    if (profileId) {
      const updatedShare = listDb.getShareByToken(token)
      if (updatedShare) {
        listDb.linkShareToProfile(updatedShare.id, profileId)
      }
    }

    return true
  },

  declineShare: (token: string): boolean => {
    const share = listDb.getShareByToken(token)
    if (!share || share.status !== 'pending') return false

    db.prepare("UPDATE list_shares SET status = 'declined' WHERE share_token = ?").run(token)
    return true
  },

  leaveShare: (shareId: number, userId: string): boolean => {
    // Only the recipient can leave
    const share = listDb.getShareById(shareId)
    if (!share || share.shared_to_user_id !== userId) return false

    db.prepare("DELETE FROM list_shares WHERE id = ?").run(shareId)
    return true
  },

  revokeShare: (shareId: number, ownerUserId: string): boolean => {
    // Only the owner can revoke
    const share = listDb.getShareById(shareId)
    if (!share || share.shared_by_user_id !== ownerUserId) return false

    db.prepare("DELETE FROM list_shares WHERE id = ?").run(shareId)
    return true
  },

  getSharesForList: (listId: number): ListShare[] => {
    return db.prepare("SELECT * FROM list_shares WHERE list_id = ? ORDER BY created_at DESC").all(listId) as ListShare[]
  },

  getSharedWithUser: (userId: string): (List & { share: ListShare, sharedByName?: string })[] => {
    const shares = db.prepare(`
      SELECT ls.*, l.*, u.name as sharedByName
      FROM list_shares ls
      JOIN lists l ON ls.list_id = l.id
      LEFT JOIN user u ON ls.shared_by_user_id = u.id
      WHERE ls.shared_to_user_id = ? AND ls.status = 'accepted' AND l.deleted_at IS NULL
      ORDER BY ls.accepted_at DESC
    `).all(userId) as any[]

    return shares.map(row => ({
      id: row.list_id,
      profile_id: row.profile_id,
      name: row.name,
      is_default: row.is_default,
      created_at: row.created_at,
      share: {
        id: row.id,
        list_id: row.list_id,
        shared_by_user_id: row.shared_by_user_id,
        shared_to_email: row.shared_to_email,
        shared_to_user_id: row.shared_to_user_id,
        share_token: row.share_token,
        status: row.status,
        permission: row.permission,
        created_at: row.created_at,
        expires_at: row.expires_at,
        accepted_at: row.accepted_at
      },
      sharedByName: row.sharedByName
    }))
  },

  getPendingSharesForEmail: (email: string): (ListShare & { listName: string, sharedByName?: string })[] => {
    return db.prepare(`
      SELECT ls.*, l.name as listName, u.name as sharedByName
      FROM list_shares ls
      JOIN lists l ON ls.list_id = l.id
      LEFT JOIN user u ON ls.shared_by_user_id = u.id
      WHERE LOWER(ls.shared_to_email) = LOWER(?) AND ls.status = 'pending' AND l.deleted_at IS NULL
      ORDER BY ls.created_at DESC
    `).all(email) as (ListShare & { listName: string, sharedByName?: string })[]
  },

  // Check if user has permission to modify a list
  canModifyList: (listId: number, userId: string, profileId?: number): { canAdd: boolean, canRemove: boolean, isOwner: boolean } => {
    // Check if owner (via profile)
    if (profileId) {
      const list = listDb.getById(listId)
      if (list) {
        const profile = db.prepare("SELECT user_id FROM profiles WHERE id = ?").get(list.profile_id) as { user_id: string } | undefined
        if (profile && profile.user_id === userId) {
          return { canAdd: true, canRemove: true, isOwner: true }
        }
      }
    }

    // Check shares
    const share = db.prepare(`
      SELECT permission FROM list_shares 
      WHERE list_id = ? AND shared_to_user_id = ? AND status = 'accepted'
    `).get(listId, userId) as { permission: string } | undefined

    if (!share) return { canAdd: false, canRemove: false, isOwner: false }

    return {
      canAdd: share.permission === 'add' || share.permission === 'full',
      canRemove: share.permission === 'full',
      isOwner: false
    }
  },

  // ===== PROFILE-LEVEL SHARE ACCESS =====

  linkShareToProfile: (shareId: number, profileId: number): boolean => {
    try {
      db.prepare(`
        INSERT OR IGNORE INTO profile_shared_lists (profile_id, list_share_id)
        VALUES (?, ?)
      `).run(profileId, shareId)
      return true
    } catch (e) {
      console.error('Failed to link share to profile:', e)
      return false
    }
  },

  unlinkShareFromProfile: (shareId: number, profileId: number): boolean => {
    const result = db.prepare(`
      DELETE FROM profile_shared_lists WHERE list_share_id = ? AND profile_id = ?
    `).run(shareId, profileId)
    return result.changes > 0
  },

  getProfilesWithShareAccess: (shareId: number): number[] => {
    const rows = db.prepare(`
      SELECT profile_id FROM profile_shared_lists WHERE list_share_id = ?
    `).all(shareId) as { profile_id: number }[]
    return rows.map(r => r.profile_id)
  },

  isShareLinkedToProfile: (shareId: number, profileId: number): boolean => {
    const row = db.prepare(`
      SELECT 1 FROM profile_shared_lists WHERE list_share_id = ? AND profile_id = ? LIMIT 1
    `).get(shareId, profileId)
    return !!row
  },

  getSharedListsForProfile: (profileId: number, userId: string): (List & { share: ListShare, sharedByName?: string, isLinkedToThisProfile: boolean })[] => {
    // Get all shares that the user has accepted
    const allShares = db.prepare(`
      SELECT ls.*, l.*, u.name as sharedByName,
             psl.id as profile_link_id
      FROM list_shares ls
      JOIN lists l ON ls.list_id = l.id
      LEFT JOIN user u ON ls.shared_by_user_id = u.id
      LEFT JOIN profile_shared_lists psl ON ls.id = psl.list_share_id AND psl.profile_id = ?
      WHERE ls.shared_to_user_id = ? AND ls.status = 'accepted' AND l.deleted_at IS NULL
      ORDER BY ls.accepted_at DESC
    `).all(profileId, userId) as any[]

    return allShares.map(row => ({
      id: row.list_id,
      profile_id: row.profile_id,
      name: row.name,
      is_default: row.is_default,
      created_at: row.created_at,
      share: {
        id: row.id,
        list_id: row.list_id,
        shared_by_user_id: row.shared_by_user_id,
        shared_to_email: row.shared_to_email,
        shared_to_user_id: row.shared_to_user_id,
        share_token: row.share_token,
        status: row.status,
        permission: row.permission,
        created_at: row.created_at,
        expires_at: row.expires_at,
        accepted_at: row.accepted_at
      },
      sharedByName: row.sharedByName,
      isLinkedToThisProfile: !!row.profile_link_id
    }))
  },

  getAvailableSharedListsFromOtherProfiles: (profileId: number, userId: string): (List & { share: ListShare, sharedByName?: string, linkedProfiles: number[] })[] => {
    // Get shares that are linked to OTHER profiles of this user but NOT this profile
    const shares = db.prepare(`
      SELECT ls.*, l.*, u.name as sharedByName
      FROM list_shares ls
      JOIN lists l ON ls.list_id = l.id
      LEFT JOIN user u ON ls.shared_by_user_id = u.id
      WHERE ls.shared_to_user_id = ? 
        AND ls.status = 'accepted' 
        AND l.deleted_at IS NULL
        AND ls.id NOT IN (SELECT list_share_id FROM profile_shared_lists WHERE profile_id = ?)
        AND ls.id IN (SELECT list_share_id FROM profile_shared_lists)
      ORDER BY ls.accepted_at DESC
    `).all(userId, profileId) as any[]

    return shares.map(row => ({
      id: row.list_id,
      profile_id: row.profile_id,
      name: row.name,
      is_default: row.is_default,
      created_at: row.created_at,
      share: {
        id: row.id,
        list_id: row.list_id,
        shared_by_user_id: row.shared_by_user_id,
        shared_to_email: row.shared_to_email,
        shared_to_user_id: row.shared_to_user_id,
        share_token: row.share_token,
        status: row.status,
        permission: row.permission,
        created_at: row.created_at,
        expires_at: row.expires_at,
        accepted_at: row.accepted_at
      },
      sharedByName: row.sharedByName,
      linkedProfiles: listDb.getProfilesWithShareAccess(row.id)
    }))
  },

  // ===== PROFILE LIST SHARES (same account, different profiles) =====
  
  createProfileShare: (listId: number, ownerProfileId: number, targetProfileId: number, permission: 'read' | 'add' | 'full' = 'read'): ProfileListShare => {
    const stmt = db.prepare(`
      INSERT INTO profile_list_shares (list_id, owner_profile_id, shared_to_profile_id, permission)
      VALUES (?, ?, ?, ?)
    `)
    const result = stmt.run(listId, ownerProfileId, targetProfileId, permission)
    return {
      id: result.lastInsertRowid as number,
      list_id: listId,
      owner_profile_id: ownerProfileId,
      shared_to_profile_id: targetProfileId,
      permission,
      created_at: new Date().toISOString()
    }
  },

  getProfileSharesForList: (listId: number): (ProfileListShare & { profile?: Profile })[] => {
    const rows = db.prepare(`
      SELECT pls.*, p.name as profile_name, p.avatar as profile_avatar, p.avatar_type
      FROM profile_list_shares pls
      JOIN profiles p ON pls.shared_to_profile_id = p.id
      WHERE pls.list_id = ?
      ORDER BY pls.created_at DESC
    `).all(listId) as any[]
    
    return rows.map(row => ({
      id: row.id,
      list_id: row.list_id,
      owner_profile_id: row.owner_profile_id,
      shared_to_profile_id: row.shared_to_profile_id,
      permission: row.permission,
      created_at: row.created_at,
      profile: {
        id: row.shared_to_profile_id,
        user_id: '',
        name: row.profile_name,
        avatar: row.profile_avatar,
        avatar_type: row.avatar_type,
        avatar_style: '',
        is_default: false,
        created_at: ''
      }
    }))
  },

  getProfileSharedListsForProfile: (profileId: number): (List & { profileShare: ProfileListShare, ownerName?: string })[] => {
    const rows = db.prepare(`
      SELECT l.*, pls.*, p.name as owner_name
      FROM profile_list_shares pls
      JOIN lists l ON pls.list_id = l.id
      JOIN profiles p ON pls.owner_profile_id = p.id
      WHERE pls.shared_to_profile_id = ? AND l.deleted_at IS NULL
      ORDER BY pls.created_at DESC
    `).all(profileId) as any[]
    
    return rows.map(row => ({
      id: row.list_id,
      profile_id: row.owner_profile_id,
      name: row.name,
      is_default: row.is_default,
      created_at: row.created_at,
      profileShare: {
        id: row.id,
        list_id: row.list_id,
        owner_profile_id: row.owner_profile_id,
        shared_to_profile_id: row.shared_to_profile_id,
        permission: row.permission,
        created_at: row.created_at
      },
      ownerName: row.owner_name
    }))
  },

  deleteProfileShare: (shareId: number): boolean => {
    const result = db.prepare(`DELETE FROM profile_list_shares WHERE id = ?`).run(shareId)
    return result.changes > 0
  },

  getProfileShareById: (shareId: number): ProfileListShare | undefined => {
    return db.prepare(`SELECT * FROM profile_list_shares WHERE id = ?`).get(shareId) as ProfileListShare | undefined
  },

  // Allow a profile to leave a share that was given to them
  leaveProfileShare: (shareId: number, profileId: number): boolean => {
    const share = listDb.getProfileShareById(shareId)
    // Only the recipient can leave
    if (!share || share.shared_to_profile_id !== profileId) return false
    
    const result = db.prepare(`DELETE FROM profile_list_shares WHERE id = ?`).run(shareId)
    return result.changes > 0
  }
}

// Addon operations
export const addonDb = {
  create: (data: {
    manifest_url: string
    name: string
    version?: string
    description?: string
    logo?: string
    logo_url?: string
    behavior_hints?: any
  }): Addon => {
    // Check if logo_url column exists (it might not in older DBs)
    // We can just try to insert with it, if it fails, fallback to without it?
    // Or we can check schema.
    // But for now, let's just assume it exists or handle the error?
    // Actually, the error "table addons has no column named logo_url" suggests it doesn't exist.
    // We should add a migration for it or just ignore it if it fails.
    // But wait, the schema definition includes it.
    // Maybe the migration didn't run or the table was created before it was added.
    // Let's try to add the column if it's missing.
    try {
        db.exec("ALTER TABLE addons ADD COLUMN logo_url TEXT");
    } catch (e) {}

    const stmt = db.prepare(`
      INSERT INTO addons (manifest_url, name, version, description, logo, logo_url, behavior_hints)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(manifest_url) DO UPDATE SET
        name = excluded.name,
        version = excluded.version,
        description = excluded.description,
        logo = excluded.logo,
        logo_url = excluded.logo_url,
        behavior_hints = excluded.behavior_hints
    `)
    const result = stmt.run(
      data.manifest_url,
      data.name,
      data.version || null,
      data.description || null,
      data.logo || null,
      data.logo_url || null,
      data.behavior_hints ? JSON.stringify(data.behavior_hints) : null
    )
    // If updated, we need to fetch by URL to get ID, as lastInsertRowid might not be accurate on update?
    // Actually lastInsertRowid works for INSERT OR REPLACE but ON CONFLICT UPDATE might not return it if no insert happened.
    // Safer to fetch by URL.
    return addonDb.findByUrl(data.manifest_url)!
  },

  findByUrl: (url: string): Addon | undefined => {
    const stmt = db.prepare('SELECT * FROM addons WHERE manifest_url = ?')
    return stmt.get(url) as Addon | undefined
  },

  findById: (id: number): Addon | undefined => {
    const stmt = db.prepare('SELECT * FROM addons WHERE id = ?')
    return stmt.get(id) as Addon | undefined
  },

  list: (): Addon[] => {
    const stmt = db.prepare('SELECT * FROM addons ORDER BY name ASC')
    return stmt.all() as Addon[]
  },

  delete: (id: number): void => {
    const addon = addonDb.findById(id);
    if (addon && addon.manifest_url === 'zentrio://tmdb-addon') {
        return;
    }
    const stmt = db.prepare('DELETE FROM addons WHERE id = ?')
    stmt.run(id)
  },

  // Profile Addon operations
  enableForProfile: (settingsProfileId: number, addonId: number): void => {
    // We use settings_profile_id now. profile_id is nullable.
    const stmt = db.prepare(`
      INSERT INTO profile_addons (profile_id, settings_profile_id, addon_id, enabled, priority, dirty)
      VALUES (NULL, ?, ?, TRUE, (SELECT COALESCE(MAX(priority), 0) + 1 FROM profile_addons WHERE settings_profile_id = ?), TRUE)
      ON CONFLICT(settings_profile_id, addon_id) DO UPDATE SET enabled = TRUE, deleted_at = NULL, dirty = TRUE, updated_at = CURRENT_TIMESTAMP
    `)
    stmt.run(settingsProfileId, addonId, settingsProfileId)
  },

  disableForProfile: (settingsProfileId: number, addonId: number): void => {
    const stmt = db.prepare(`
      INSERT INTO profile_addons (profile_id, settings_profile_id, addon_id, enabled, priority, dirty)
      VALUES (NULL, ?, ?, FALSE, (SELECT COALESCE(MAX(priority), 0) + 1 FROM profile_addons WHERE settings_profile_id = ?), TRUE)
      ON CONFLICT(settings_profile_id, addon_id) DO UPDATE SET enabled = FALSE, deleted_at = NULL, dirty = TRUE, updated_at = CURRENT_TIMESTAMP
    `)
    stmt.run(settingsProfileId, addonId, settingsProfileId)
  },

  getForProfile: (settingsProfileId: number): ProfileAddon[] => {
    const stmt = db.prepare(`
      SELECT pa.*, a.manifest_url, a.name, a.version, a.description, a.logo, a.logo_url
      FROM profile_addons pa
      JOIN addons a ON pa.addon_id = a.id
      WHERE pa.settings_profile_id = ? AND pa.deleted_at IS NULL
      ORDER BY pa.priority ASC, pa.id ASC
    `)
    const rows = stmt.all(settingsProfileId) as any[]
    return rows.map(row => ({
      id: row.id,
      profile_id: row.profile_id,
      settings_profile_id: row.settings_profile_id,
      addon_id: row.addon_id,
      enabled: !!row.enabled,
      created_at: row.created_at,
      addon: {
        id: row.addon_id,
        manifest_url: row.manifest_url,
        name: row.name,
        version: row.version,
        description: row.description,
        logo: row.logo,
        logo_url: row.logo_url,
        created_at: row.created_at
      }
    }));
  },

  getAllWithStatusForProfile: (settingsProfileId: number): (Addon & { enabled: boolean, priority: number, is_protected: boolean })[] => {
    const stmt = db.prepare(`
      SELECT a.*,
             pa.enabled,
             pa.priority
      FROM addons a
      JOIN profile_addons pa ON a.id = pa.addon_id
      WHERE pa.settings_profile_id = ? AND pa.deleted_at IS NULL
      ORDER BY pa.priority ASC, a.id ASC
    `)
    const rows = stmt.all(settingsProfileId) as any[]
    return rows.map(row => {
        let behaviorHints = null
        if (row.behavior_hints) {
            try {
                behaviorHints = JSON.parse(row.behavior_hints)
            } catch (e) {}
        }
        return {
            ...row,
            behavior_hints: behaviorHints,
            enabled: !!row.enabled,
            is_protected: row.manifest_url === 'zentrio://tmdb-addon'
        }
    })
  },

  updateProfileAddonOrder: (settingsProfileId: number, addonIds: number[]): void => {
    const transaction = db.transaction((ids: number[]) => {
      let priority = 0;
      for (const addonId of ids) {
        const stmt = db.prepare(`
          INSERT INTO profile_addons (profile_id, settings_profile_id, addon_id, enabled, priority, dirty)
          VALUES (NULL, ?, ?, TRUE, ?, TRUE)
          ON CONFLICT(settings_profile_id, addon_id) DO UPDATE SET priority = ?, dirty = TRUE, updated_at = CURRENT_TIMESTAMP
        `)
        stmt.run(settingsProfileId, addonId, priority, priority)
        priority++;
      }
    })
    transaction(addonIds)
  },

  getEnabledForProfile: (settingsProfileId: number): Addon[] => {
    const stmt = db.prepare(`
      SELECT a.*
      FROM addons a
      JOIN profile_addons pa ON a.id = pa.addon_id
      WHERE pa.settings_profile_id = ? AND pa.enabled = 1 AND pa.deleted_at IS NULL
      ORDER BY pa.priority ASC, a.id ASC
    `)
    return stmt.all(settingsProfileId) as Addon[]
  },

  removeFromProfile: (settingsProfileId: number, addonId: number): void => {
    // Ensure we have valid numbers to prevent accidental mass deletion
    if (!settingsProfileId || !addonId || isNaN(settingsProfileId) || isNaN(addonId)) {
        console.error(`[Database] Invalid parameters for removeFromProfile: settingsProfileId=${settingsProfileId}, addonId=${addonId}`);
        return;
    }

    // Prevent removing native addon
    const addon = addonDb.findById(addonId);
    if (addon && addon.manifest_url === 'zentrio://tmdb-addon') {
        return;
    }

    const stmt = db.prepare('UPDATE profile_addons SET deleted_at = CURRENT_TIMESTAMP, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE settings_profile_id = ? AND addon_id = ?')
    stmt.run(settingsProfileId, addonId)
  }
}

// Settings Profile operations
export const settingsProfileDb = {
    create: (userId: string, name: string, isDefault: boolean = false): SettingsProfile => {
        const stmt = db.prepare("INSERT INTO settings_profiles (user_id, name, is_default) VALUES (?, ?, ?)");
        const res = stmt.run(userId, name, isDefault ? 1 : 0);
        const id = res.lastInsertRowid as number;

        // Auto-enable Zentrio addon
        try {
            const zentrioAddon = db.prepare("SELECT id FROM addons WHERE manifest_url = 'zentrio://tmdb-addon'").get() as any;
            if (zentrioAddon) {
                addonDb.enableForProfile(id, zentrioAddon.id);
            }
        } catch (e) {
            console.error("Failed to auto-enable Zentrio addon for new profile", e);
        }

        return settingsProfileDb.findById(id)!;
    },
    findById: (id: number): SettingsProfile | undefined => {
        return db.prepare("SELECT * FROM settings_profiles WHERE id = ?").get(id) as SettingsProfile | undefined;
    },
    listByUserId: (userId: string): SettingsProfile[] => {
        return db.prepare("SELECT * FROM settings_profiles WHERE user_id = ? ORDER BY is_default DESC, name ASC").all(userId) as SettingsProfile[];
    },
    update: (id: number, name: string): void => {
        db.prepare("UPDATE settings_profiles SET name = ?, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(name, id);
    },
    delete: (id: number): void => {
        db.prepare("UPDATE settings_profiles SET deleted_at = CURRENT_TIMESTAMP, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    },
    isUsed: (id: number): boolean => {
        const count = db.prepare("SELECT COUNT(*) as count FROM profiles WHERE settings_profile_id = ?").get(id) as any;
        return count.count > 0;
    }
}

// Stream settings operations
export const streamDb = {
  getSettings: (settingsProfileId: number): StreamSettings => {
    // We now use settings_profile_id
    // Fallback to profile_id for backward compatibility if needed, but migration should have handled it
    const stmt = db.prepare('SELECT * FROM stream_settings WHERE settings_profile_id = ?');
    let row = stmt.get(settingsProfileId) as any;
    
    if (row && row.config) {
      try {
        return JSON.parse(row.config);
      } catch (e) {
        console.error('Failed to parse stream settings', e);
      }
    }
    // Default settings
    return {
      filters: {
        cache: { cached: true, uncached: true, applyMode: 'OR' },
        resolution: { preferred: ['4k', '1080p', '720p'], required: [], excluded: [] },
        encode: { preferred: [], required: [], excluded: [] },
        streamType: { preferred: [], required: [], excluded: [] },
        visualTag: { preferred: [], required: [], excluded: [] },
        audioTag: { preferred: [], required: [], excluded: [] },
        audioChannel: { preferred: [], required: [], excluded: [] },
        language: { preferred: [], required: [], excluded: [] },
        seeders: {},
        matching: { title: { enabled: true, mode: 'Partial' }, seasonEpisode: { enabled: true } },
        keyword: { preferred: [], required: [], excluded: [] },
        regex: { preferred: [], required: [], excluded: [] },
        size: {}
      },
      limits: { maxResults: 20 },
      deduplication: { mode: 'Per Addon', detection: { filename: true, infoHash: true, smartDetect: true } },
      sorting: { global: ['cached', 'resolution', 'quality', 'seeders', 'size'] },
      sortingConfig: {
        items: [
          { id: 'cached', enabled: true, direction: 'desc' },
          { id: 'resolution', enabled: true, direction: 'desc' },
          { id: 'quality', enabled: true, direction: 'desc' },
          { id: 'seeders', enabled: true, direction: 'desc' },
          { id: 'size', enabled: true, direction: 'desc' },
          { id: 'language', enabled: false, direction: 'desc' }
        ]
      }
    };
  },


  saveSettings: (settingsProfileId: number, settings: StreamSettings): void => {
    const existing = db.prepare("SELECT id FROM stream_settings WHERE settings_profile_id = ?").get(settingsProfileId) as any;
    
    if (existing) {
        const stmt = db.prepare("UPDATE stream_settings SET config = ?, dirty = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?");
        stmt.run(JSON.stringify(settings), existing.id);
    } else {
        const stmt = db.prepare("INSERT INTO stream_settings (profile_id, settings_profile_id, config, dirty) VALUES (NULL, ?, ?, TRUE)");
        stmt.run(settingsProfileId, JSON.stringify(settings));
    }
  }
};

// Appearance settings operations
export const appearanceDb = {
  getSettings: (settingsProfileId: number): AppearanceSettings => {
    const stmt = db.prepare('SELECT * FROM appearance_settings WHERE settings_profile_id = ?');
    const row = stmt.get(settingsProfileId) as any;
    
    if (row) {
  return {
    id: row.id,
    settings_profile_id: row.settings_profile_id,
    theme_id: row.theme_id,
    show_imdb_ratings: !!row.show_imdb_ratings,
    show_age_ratings: row.show_age_ratings !== null ? !!row.show_age_ratings : true,
    background_style: row.background_style,
    custom_theme_config: row.custom_theme_config
  };
}
    
    // Default settings
    return {
      theme_id: 'zentrio',
      show_imdb_ratings: true,
      show_age_ratings: true,
      background_style: 'vanta'
    };
  },

  saveSettings: (settingsProfileId: number, settings: Partial<AppearanceSettings>): void => {
    const existing = db.prepare("SELECT id FROM appearance_settings WHERE settings_profile_id = ?").get(settingsProfileId) as any;
    
    if (existing) {
        const fields: string[] = [];
        const values: any[] = [];
        
        if (settings.theme_id !== undefined) { fields.push("theme_id = ?"); values.push(settings.theme_id); }
        if (settings.show_imdb_ratings !== undefined) { fields.push("show_imdb_ratings = ?"); values.push(settings.show_imdb_ratings ? 1 : 0); }
        if (settings.show_age_ratings !== undefined) { fields.push("show_age_ratings = ?"); values.push(settings.show_age_ratings ? 1 : 0); }
        if (settings.background_style !== undefined) { fields.push("background_style = ?"); values.push(settings.background_style); }
        if (settings.custom_theme_config !== undefined) { fields.push("custom_theme_config = ?"); values.push(settings.custom_theme_config); }
        
        if (fields.length > 0) {
            fields.push('dirty = TRUE');
            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(existing.id);
            const stmt = db.prepare(`UPDATE appearance_settings SET ${fields.join(', ')} WHERE id = ?`);
            stmt.run(...values);
        }
    } else {
        const stmt = db.prepare(`
            INSERT INTO appearance_settings (settings_profile_id, theme_id, show_imdb_ratings, show_age_ratings, background_style, custom_theme_config, dirty)
            VALUES (?, ?, ?, ?, ?, ?, TRUE)
        `);
        stmt.run(
            settingsProfileId,
            settings.theme_id || 'zentrio',
            settings.show_imdb_ratings !== undefined ? (settings.show_imdb_ratings ? 1 : 0) : 1,
            settings.show_age_ratings !== undefined ? (settings.show_age_ratings ? 1 : 0) : 1,
            settings.background_style || 'vanta',
            settings.custom_theme_config || null
        );
    }
  }
};

// Export database instance for advanced queries if needed
export { db }
