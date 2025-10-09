import { Database } from 'bun:sqlite'
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
   db.exec('ALTER TABLE users ADD COLUMN downloads_manager_enabled BOOLEAN DEFAULT TRUE')
 } catch (e) {
   // ignore if column already exists
 }
 // Add idle session tracking columns if missing
 try {
   db.exec('ALTER TABLE user_sessions ADD COLUMN last_activity DATETIME')
 } catch (e) {
   // ignore if column already exists
 }
 try {
   db.exec('ALTER TABLE user_sessions ADD COLUMN max_idle_minutes INTEGER')
 } catch (e) {
   // ignore if column already exists
 }

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    addon_manager_enabled BOOLEAN DEFAULT FALSE,
    hide_calendar_button BOOLEAN DEFAULT FALSE,
    hide_addons_button BOOLEAN DEFAULT FALSE,
    downloads_manager_enabled BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT NOT NULL,
      avatar_type TEXT DEFAULT 'initials',
      is_default BOOLEAN DEFAULT FALSE,
      stremio_email TEXT,
      stremio_password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    max_idle_minutes INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  -- OTP storage (hash at rest), one-time use
  CREATE TABLE IF NOT EXISTS auth_otp_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Magic link storage (token SHA-256 hash at rest), one-time use
  CREATE TABLE IF NOT EXISTS auth_magic_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    consumed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);

  CREATE INDEX IF NOT EXISTS idx_otp_email ON auth_otp_codes(email);
  CREATE INDEX IF NOT EXISTS idx_otp_expires ON auth_otp_codes(expires_at);
  CREATE INDEX IF NOT EXISTS idx_magic_token_hash ON auth_magic_links(token_hash);
  CREATE INDEX IF NOT EXISTS idx_magic_expires ON auth_magic_links(expires_at);
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
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
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
  id: number
  email: string
  username: string
  password_hash: string
  first_name?: string
  last_name?: string
  addon_manager_enabled: boolean
  hide_calendar_button: boolean
  hide_addons_button: boolean
  downloads_manager_enabled: boolean
  created_at: string
  updated_at: string
}

export interface Profile {
  id: number
  user_id: number
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
  user_id: number
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
  create: async (userData: { email: string; username: string; password: string; first_name?: string; last_name?: string }): Promise<User> => {
    const stmt = db.prepare(`
      INSERT INTO users (email, username, password_hash, first_name, last_name)
      VALUES (?, ?, ?, ?, ?)
    `)
    
    const passwordHash = await hashPassword(userData.password)
    const result = stmt.run(userData.email, userData.username, passwordHash, userData.first_name || null, userData.last_name || null)
    
    return userDb.findById(result.lastInsertRowid as number)!
  },

  findByEmail: (email: string): User | undefined => {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?')
    return stmt.get(email) as User | undefined
  },

  findById: (id: number): User | undefined => {
    const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
    return stmt.get(id) as User | undefined
  },

  findByUsername: (username: string): User | undefined => {
    const stmt = db.prepare('SELECT * FROM users WHERE username = ?')
    return stmt.get(username) as User | undefined
  },

  exists: (email: string): boolean => {
    const stmt = db.prepare('SELECT 1 FROM users WHERE email = ? LIMIT 1')
    return !!stmt.get(email)
  },

  updatePassword: async (userId: number, newPassword: string): Promise<boolean> => {
    const stmt = db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    const passwordHash = await hashPassword(newPassword)
    const result = stmt.run(passwordHash, userId)
    return result.changes > 0
  },

  updateEmail: (userId: number, newEmail: string): boolean => {
    const stmt = db.prepare('UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    const result = stmt.run(newEmail, userId)
    return result.changes > 0
  },

  update: (id: number, updates: Partial<Omit<User, 'id' | 'created_at' | 'updated_at'>>): User | undefined => {
    const fields: string[] = []
    const values: any[] = []

    if (updates.email) {
        fields.push('email = ?')
        values.push(updates.email)
    }
    if (updates.username) {
        fields.push('username = ?')
        values.push(updates.username)
    }
    if (updates.password_hash) {
        fields.push('password_hash = ?')
        values.push(updates.password_hash)
    }
    if (updates.first_name) {
        fields.push('first_name = ?')
        values.push(updates.first_name)
    }
    if (updates.last_name) {
        fields.push('last_name = ?')
        values.push(updates.last_name)
    }
    if (updates.addon_manager_enabled !== undefined) {
        fields.push('addon_manager_enabled = ?')
        values.push(updates.addon_manager_enabled)
    }
    if (updates.hide_calendar_button !== undefined) {
        fields.push('hide_calendar_button = ?')
        values.push(updates.hide_calendar_button)
    }
    if (updates.hide_addons_button !== undefined) {
        fields.push('hide_addons_button = ?')
        values.push(updates.hide_addons_button)
    }
    if (updates.downloads_manager_enabled !== undefined) {
        fields.push('downloads_manager_enabled = ?')
        values.push(updates.downloads_manager_enabled)
    }
    
    if (fields.length === 0) return userDb.findById(id)

    fields.push('updated_at = CURRENT_TIMESTAMP')
    values.push(id)

    const stmt = db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`)
    const result = stmt.run(...values)

    return result.changes > 0 ? userDb.findById(id) : undefined
  },

  getAll: (): User[] => {
    const stmt = db.prepare('SELECT * FROM users ORDER BY created_at DESC')
    return stmt.all() as User[]
  }
}

// Profile operations
export const profileDb = {
  create: async (profileData: {
      user_id: number
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

  findByUserId: (userId: number): (Profile & { settings?: ProfileProxySettings })[] => {
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

  setDefault: (userId: number, profileId: number): boolean => {
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

  getDefault: (userId: number): Profile | undefined => {
    const stmt = db.prepare('SELECT * FROM profiles WHERE user_id = ? AND is_default = TRUE LIMIT 1')
    return stmt.get(userId) as Profile | undefined
  },

}

// Session operations
export const sessionDb = {
  create: (userId: number, remember: boolean = false): UserSession => {
    const sessionToken = generateSessionToken()
    // Long-lived absolute expiry for remembered sessions, sliding idle timeout for non-remembered
    const expiresExpr = remember ? '+36500 days' : '+30 days'
    const maxIdle = remember ? null : 180 // minutes

    const stmt = db.prepare(`
      INSERT INTO user_sessions (user_id, session_token, expires_at, last_activity, max_idle_minutes)
      VALUES (?, ?, datetime('now', ?), CURRENT_TIMESTAMP, ?)
    `)

    const result = stmt.run(userId, sessionToken, expiresExpr, maxIdle)
    return sessionDb.findById(result.lastInsertRowid as number)!
  },

  findById: (id: number): UserSession | undefined => {
    const stmt = db.prepare('SELECT * FROM user_sessions WHERE id = ?')
    return stmt.get(id) as UserSession | undefined
  },

  findByToken: (token: string): UserSession | undefined => {
    const stmt = db.prepare(`
      SELECT * FROM user_sessions
      WHERE session_token = ?
        AND expires_at > datetime('now')
        AND (max_idle_minutes IS NULL OR last_activity > datetime('now', printf('-%d minutes', max_idle_minutes)))
    `)
    return stmt.get(token) as UserSession | undefined
  },

  // Touch last_activity for non-remembered sessions (those with a max_idle_minutes)
  touch: (token: string): boolean => {
    const stmt = db.prepare(`
      UPDATE user_sessions
      SET last_activity = CURRENT_TIMESTAMP
      WHERE session_token = ? AND max_idle_minutes IS NOT NULL
    `)
    const result = stmt.run(token)
    return result.changes > 0
  },
  
  delete: (token: string): boolean => {
    const stmt = db.prepare('DELETE FROM user_sessions WHERE session_token = ?')
    const result = stmt.run(token)
    return result.changes > 0
  },

  deleteExpired: (): number => {
    const stmt = db.prepare(`
      DELETE FROM user_sessions
      WHERE expires_at <= datetime('now')
         OR (max_idle_minutes IS NOT NULL AND (last_activity IS NULL OR last_activity <= datetime('now', printf('-%d minutes', max_idle_minutes))))
    `)
    const result = stmt.run()
    return result.changes
  },

  deleteAllForUser: (userId: number): number => {
    const stmt = db.prepare('DELETE FROM user_sessions WHERE user_id = ?')
    const result = stmt.run(userId)
    return result.changes
  }
}

// OTP operations
export const otpDb = {
  issue: async (email: string, ttlMinutes: number = 10): Promise<string> => {
    // Basic per-email rate limit: 1 per 30s, max 5 per hour
    const last = db.prepare("SELECT created_at FROM auth_otp_codes WHERE email = ? ORDER BY id DESC LIMIT 1").get(email) as { created_at: string } | undefined
    if (last) {
      const lastTs = new Date(last.created_at).getTime()
      if (Date.now() - lastTs < 30_000) {
        throw new Error('RATE_LIMITED')
      }
    }
    const countRow = db.prepare("SELECT COUNT(*) as cnt FROM auth_otp_codes WHERE email = ? AND created_at >= datetime('now','-1 hour')").get(email) as { cnt: number }
    if (countRow && (countRow.cnt as number) >= 5) {
      throw new Error('RATE_LIMITED')
    }

    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const codeHash = await bcrypt.hash(otp, 12)
    const stmt = db.prepare("INSERT INTO auth_otp_codes (email, code_hash, expires_at) VALUES (?, ?, datetime('now', ?))")
    stmt.run(email, codeHash, `+${ttlMinutes} minutes`)
    return otp
  },

  verifyAndConsume: async (email: string, otp: string): Promise<boolean> => {
    const row = db.prepare("SELECT id, code_hash, expires_at FROM auth_otp_codes WHERE email = ? AND consumed_at IS NULL AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1").get(email) as { id: number, code_hash: string, expires_at: string } | undefined
    if (!row) return false
    const ok = await bcrypt.compare(otp, row.code_hash)
    if (!ok) return false
    const update = db.prepare("UPDATE auth_otp_codes SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?")
    update.run(row.id)
    // Optionally, remove older pending codes for this email
    db.prepare("DELETE FROM auth_otp_codes WHERE email = ? AND (expires_at <= datetime('now') OR consumed_at IS NOT NULL) AND id != ?").run(email, row.id)
    return true
  },

  deleteExpired: (): number => {
    const stmt = db.prepare("DELETE FROM auth_otp_codes WHERE expires_at <= datetime('now')")
    const result = stmt.run()
    return result.changes
  }
}

// Magic link operations
export const magicLinkDb = {
  create: (email: string, ttlMinutes: number = 15): string => {
    // Basic per-email rate limit: 1 per 30s, max 5 per hour
    const last = db.prepare("SELECT created_at FROM auth_magic_links WHERE email = ? ORDER BY id DESC LIMIT 1").get(email) as { created_at: string } | undefined
    if (last) {
      const lastTs = new Date(last.created_at).getTime()
      if (Date.now() - lastTs < 30_000) {
        throw new Error('RATE_LIMITED')
      }
    }
    const countRow = db.prepare("SELECT COUNT(*) as cnt FROM auth_magic_links WHERE email = ? AND created_at >= datetime('now','-1 hour')").get(email) as { cnt: number }
    if (countRow && (countRow.cnt as number) >= 5) {
      throw new Error('RATE_LIMITED')
    }

    const token = randomToken(32)
    const tokenHash = sha256Hex(token)
    const stmt = db.prepare("INSERT INTO auth_magic_links (email, token_hash, expires_at) VALUES (?, ?, datetime('now', ?))")
    stmt.run(email, tokenHash, `+${ttlMinutes} minutes`)
    return token
  },

  consume: (token: string): string | null => {
    const tokenHash = sha256Hex(token)
    const row = db.prepare("SELECT id, email FROM auth_magic_links WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > datetime('now') LIMIT 1").get(tokenHash) as { id: number, email: string } | undefined
    if (!row) return null
    const update = db.prepare("UPDATE auth_magic_links SET consumed_at = CURRENT_TIMESTAMP WHERE id = ?")
    update.run(row.id)
    // Clean old entries
    db.prepare("DELETE FROM auth_magic_links WHERE consumed_at IS NOT NULL OR expires_at <= datetime('now')").run()
    return row.email
  },

  deleteExpired: (): number => {
    const stmt = db.prepare("DELETE FROM auth_magic_links WHERE expires_at <= datetime('now')")
    const result = stmt.run()
    return result.changes
  }
}

// Proxy session operations
export const proxySessionDb = {
  create: (sessionData: {
    user_id: number
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
    tmdb_api_key?: string
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

  update: (profileId: number, updates: Partial<ProfileProxySettings>): ProfileProxySettings | undefined => {
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
  sessionDb.deleteExpired()
  otpDb.deleteExpired()
  magicLinkDb.deleteExpired()
  proxySessionDb.deleteExpired()
}, 60 * 60 * 1000) // Every hour

// Export database instance for advanced queries if needed
export { db }
