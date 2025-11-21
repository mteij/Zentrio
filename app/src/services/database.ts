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

 // Lightweight migrations (idempotent)
 try {
   db.exec('ALTER TABLE user ADD COLUMN downloadsManagerEnabled BOOLEAN DEFAULT TRUE')
 } catch (e) {
   // ignore if column already exists
 }
 // New setting: hideCinemetaContent (idempotent)
 try {
   db.exec('ALTER TABLE user ADD COLUMN hideCinemetaContent BOOLEAN DEFAULT FALSE')
 } catch (e) {
   // ignore if column already exists
 }
 // Add idle session tracking columns if missing
 try {
   db.exec('ALTER TABLE session ADD COLUMN lastActivity DATETIME')
 } catch (e) {
   // ignore if column already exists
 }
 try {
   db.exec('ALTER TABLE session ADD COLUMN maxIdleMinutes INTEGER')
 } catch (e) {
   // ignore if column already exists
 }

// Create tables
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
    downloadsManagerEnabled BOOLEAN DEFAULT TRUE,
    twoFactorEnabled BOOLEAN DEFAULT FALSE
  );

  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expiresAt DATETIME NOT NULL,
    token TEXT UNIQUE NOT NULL,
    createdAt DATETIME NOT NULL,
    updatedAt DATETIME NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL REFERENCES user(id)
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

  CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      avatar_type TEXT DEFAULT 'initials',
      is_default BOOLEAN DEFAULT FALSE,
      stremio_email TEXT,
      stremio_password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
  -- Proxy sessions for enhanced security tracking
  CREATE TABLE IF NOT EXISTS proxy_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    profile_id INTEGER,
    session_token TEXT UNIQUE NOT NULL,
    stremio_auth_key TEXT,
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
    nsfw_filter_enabled BOOLEAN DEFAULT FALSE,
    nsfw_age_rating INTEGER DEFAULT 0,
    hide_calendar_button BOOLEAN DEFAULT FALSE,
    hide_addons_button BOOLEAN DEFAULT FALSE,
    downloads_enabled BOOLEAN DEFAULT FALSE,
    mobile_click_to_hover BOOLEAN DEFAULT FALSE,
    tmdb_api_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
  );

  -- Rate limiting for proxy endpoints
  CREATE TABLE IF NOT EXISTS proxy_rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL, -- IP + User Agent hash
    endpoint_type TEXT NOT NULL, -- 'generic', 'stremio', 'api'
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
`)

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
  downloadsManagerEnabled: boolean
  twoFactorEnabled: boolean
}

export interface Profile {
  id: number
  user_id: string
  name: string
  avatar: string
  avatar_type: 'initials' | 'avatar'
  is_default: boolean
  stremio_email?: string
  stremio_password?: string
  created_at: string
  updated_at: string
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
  stremio_auth_key?: string
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
  nsfw_filter_enabled: boolean
  nsfw_age_rating: number
  hide_calendar_button: boolean
  hide_addons_button: boolean
  downloads_enabled: boolean
  mobile_click_to_hover: boolean
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

  findById: (id: string): User | undefined => {
    const stmt = db.prepare('SELECT * FROM user WHERE id = ?')
    return stmt.get(id) as User | undefined
  },

  exists: (email: string): boolean => {
    const stmt = db.prepare('SELECT 1 FROM user WHERE email = ? LIMIT 1')
    return !!stmt.get(email)
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
    if (updates.downloadsManagerEnabled !== undefined) {
        fields.push('downloadsManagerEnabled = ?')
        values.push(updates.downloadsManagerEnabled)
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
      is_default?: boolean
      stremio_email?: string
      stremio_password?: string
    }): Promise<Profile> => {
      const stmt = db.prepare(`
        INSERT INTO profiles (user_id, name, avatar, avatar_type, is_default, stremio_email, stremio_password)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      
      const encryptedPassword = profileData.stremio_password ? encrypt(profileData.stremio_password) : null;

      const result = stmt.run(
        profileData.user_id,
        profileData.name,
        profileData.avatar,
        profileData.avatar_type || 'initials',
        profileData.is_default || false,
        profileData.stremio_email || null,
        encryptedPassword
      )
      
      return profileDb.findById(result.lastInsertRowid as number)!
    },

  findById: (id: number): Profile | undefined => {
    const stmt = db.prepare('SELECT * FROM profiles WHERE id = ?')
    return stmt.get(id) as Profile | undefined
  },

  findByUserId: (userId: string): (Profile & { settings?: ProfileProxySettings })[] => {
    const stmt = db.prepare(`
        SELECT p.*, s.nsfw_filter_enabled, s.nsfw_age_rating, s.hide_calendar_button, s.hide_addons_button
        FROM profiles p
        LEFT JOIN profile_proxy_settings s ON p.id = s.profile_id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
    `)
    return stmt.all(userId) as (Profile & { settings?: ProfileProxySettings })[]
  },

  findWithSettingsById: (id: number): (Profile & { settings?: ProfileProxySettings }) | undefined => {
    const stmt = db.prepare(`
        SELECT p.*, s.nsfw_filter_enabled, s.nsfw_age_rating, s.hide_calendar_button, s.hide_addons_button
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
      is_default?: boolean
      stremio_email?: string
      stremio_password?: string
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
      if (updates.is_default !== undefined) {
        fields.push('is_default = ?')
        values.push(updates.is_default)
      }
      if (updates.stremio_email !== undefined) {
        fields.push('stremio_email = ?')
        values.push(updates.stremio_email)
      }
      if (updates.stremio_password !== undefined) {
        fields.push('stremio_password = ?')
        values.push(encrypt(updates.stremio_password))
      }
    
    if (fields.length === 0) return profileDb.findById(id)
    
    fields.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id)
    
    const stmt = db.prepare(`UPDATE profiles SET ${fields.join(', ')} WHERE id = ?`)
    const result = stmt.run(...values)
    
    return result.changes > 0 ? profileDb.findById(id) : undefined
  },

  delete: (id: number): boolean => {
    const stmt = db.prepare('DELETE FROM profiles WHERE id = ?')
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
    stremio_auth_key?: string
    security_fingerprint?: string
    ip_address?: string
    user_agent?: string
    expires_at: string
  }): ProxySession => {
    const stmt = db.prepare(`
      INSERT INTO proxy_sessions (user_id, profile_id, session_token, stremio_auth_key, security_fingerprint, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      sessionData.user_id,
      sessionData.profile_id || null,
      sessionData.session_token,
      sessionData.stremio_auth_key || null,
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
    downloads_enabled?: boolean
    mobile_click_to_hover?: boolean
    tmdb_api_key?: string | null
  }): ProfileProxySettings => {
    const stmt = db.prepare(`
      INSERT INTO profile_proxy_settings (profile_id, nsfw_filter_enabled, nsfw_age_rating, hide_calendar_button, hide_addons_button, downloads_enabled, mobile_click_to_hover, tmdb_api_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    
    const result = stmt.run(
      settingsData.profile_id,
      settingsData.nsfw_filter_enabled || false,
      settingsData.nsfw_age_rating || 0,
      settingsData.hide_calendar_button || false,
      settingsData.hide_addons_button || false,
      settingsData.downloads_enabled || false,
      settingsData.mobile_click_to_hover || false,
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

// Export database instance for advanced queries if needed
export { db }
