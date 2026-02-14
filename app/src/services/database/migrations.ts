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
  "ALTER TABLE addons ADD COLUMN logo_url TEXT"
]

for (const sql of columnMigrations) {
  try {
    db.exec(sql)
  } catch (e) {
    // Column already exists, ignore
  }
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
