// Database migrations
// Column additions and schema updates for existing databases
import { db } from './connection'

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
  "ALTER TABLE lists ADD COLUMN is_default BOOLEAN DEFAULT FALSE",
  // Addons: logo_url support
  "ALTER TABLE addons ADD COLUMN logo_url TEXT",
  // Better Auth admin plugin fields
  "ALTER TABLE user ADD COLUMN role TEXT DEFAULT 'user'",
  "ALTER TABLE user ADD COLUMN banned BOOLEAN DEFAULT FALSE",
  "ALTER TABLE user ADD COLUMN banReason TEXT",
  "ALTER TABLE user ADD COLUMN banExpires DATETIME",
  // Better Auth phone-number plugin fields
  "ALTER TABLE user ADD COLUMN phoneNumber TEXT",
  "ALTER TABLE user ADD COLUMN phoneNumberVerified BOOLEAN DEFAULT FALSE",
  // Admin audit log table (for existing databases)
  `CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    reason TEXT,
    before_json TEXT,
    after_json TEXT,
    ip_address TEXT,
    user_agent TEXT,
    hash_prev TEXT NOT NULL,
    hash_curr TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_id) REFERENCES user (id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log(actor_id)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log(target_type, target_id)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at)`,
  // Admin step-up challenges table (for existing databases)
  `CREATE TABLE IF NOT EXISTS admin_stepup_challenges (
    id TEXT PRIMARY KEY,
    admin_identity_id TEXT NOT NULL,
    challenge_type TEXT NOT NULL DEFAULT 'email_otp',
    otp_code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_identity_id) REFERENCES user (id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_stepup_identity ON admin_stepup_challenges(admin_identity_id)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_stepup_expires ON admin_stepup_challenges(expires_at)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_stepup_used ON admin_stepup_challenges(used_at)`,
  // RBAC tables (for existing databases)
  `CREATE TABLE IF NOT EXISTS admin_roles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS admin_permissions (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS admin_role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES admin_permissions(id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
  )`,
  `CREATE TABLE IF NOT EXISTS admin_user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE,
    UNIQUE(user_id, role_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_role ON admin_role_permissions(role_id)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_perm ON admin_role_permissions(permission_id)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_user_roles_user ON admin_user_roles(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_admin_user_roles_role ON admin_user_roles(role_id)`,
  // OTP brute-force protection: track failed verification attempts
  "ALTER TABLE admin_stepup_challenges ADD COLUMN failed_attempts INTEGER NOT NULL DEFAULT 0"
]

for (const sql of columnMigrations) {
  try {
    db.exec(sql)
  } catch (e) {
    // Column already exists, ignore
  }
}

// Unique index for phone number plugin (safe/idempotent)
try {
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_phone_number ON user(phoneNumber)')
} catch (e) {
  // Ignore for legacy databases with inconsistent states
}

// Backfill season/episode defaults for pre-migration rows
try {
  db.exec('UPDATE watch_history SET season = -1 WHERE season IS NULL')
  db.exec('UPDATE watch_history SET episode = -1 WHERE episode IS NULL')
} catch (e) {
  // Ignore if columns do not exist yet
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

export {}
