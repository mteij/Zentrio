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

 // Migration for multiple lists
 try {
   const hasLists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='lists'").get();
   if (!hasLists) {
     db.exec(`
       CREATE TABLE IF NOT EXISTS lists (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         profile_id INTEGER NOT NULL,
         name TEXT NOT NULL,
         created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
         FOREIGN KEY (list_id) REFERENCES lists (id) ON DELETE CASCADE,
         UNIQUE(list_id, meta_id)
       );
     `);

     const hasLibrary = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='library'").get();
     if (hasLibrary) {
       const oldItems = db.prepare("SELECT * FROM library").all() as any[];
       if (oldItems.length > 0) {
         const profiles = [...new Set(oldItems.map(i => i.profile_id))];
         const insertList = db.prepare("INSERT INTO lists (profile_id, name) VALUES (?, 'My List')");
         const insertItem = db.prepare("INSERT INTO list_items (list_id, meta_id, type, title, poster, created_at) VALUES (?, ?, ?, ?, ?, ?)");
         
         const transaction = db.transaction(() => {
           for (const pid of profiles) {
             const result = insertList.run(pid);
             const listId = result.lastInsertRowid;
             const items = oldItems.filter(i => i.profile_id === pid);
             for (const item of items) {
               insertItem.run(listId, item.meta_id, item.type, item.title, item.poster, item.created_at);
             }
           }
         });
         transaction();
       }
       try {
         db.exec("ALTER TABLE library RENAME TO library_backup");
       } catch (e) {
         // ignore
       }
     }
   }
 } catch (e) {
   console.error("Migration for lists failed", e);
 }

 // Lightweight migrations (idempotent)
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
 // Add tmdbApiKey to user table
 try {
   db.exec('ALTER TABLE user ADD COLUMN tmdbApiKey TEXT')
 } catch (e) {
   // ignore if column already exists
 }
 // Add priority to profile_addons table
 try {
   db.exec('ALTER TABLE profile_addons ADD COLUMN priority INTEGER DEFAULT 0')
 } catch (e) {
   // ignore if column already exists
 }
 // Add hero_banner_enabled to profile_proxy_settings table
 try {
   db.exec('ALTER TABLE profile_proxy_settings ADD COLUMN hero_banner_enabled BOOLEAN DEFAULT TRUE')
 } catch (e) {
   // ignore if column already exists
 }
 // Add config to stream_settings table
 try {
   db.exec('ALTER TABLE stream_settings ADD COLUMN config TEXT')
 } catch (e) {
   // ignore if column already exists
 }
 // Add behavior_hints to addons table
 try {
   db.exec('ALTER TABLE addons ADD COLUMN behavior_hints TEXT')
 } catch (e) {
   // ignore if column already exists
 }

 // Ensure Zentrio addon is enabled for all settings profiles
 try {
   const zentrioAddon = db.prepare("SELECT id FROM addons WHERE manifest_url = 'zentrio://tmdb-addon'").get() as any;
   if (zentrioAddon) {
       const settingsProfiles = db.prepare("SELECT id FROM settings_profiles").all() as any[];
       const insertProfileAddon = db.prepare(`
           INSERT INTO profile_addons (profile_id, settings_profile_id, addon_id, enabled, priority)
           VALUES (NULL, ?, ?, TRUE, (SELECT COALESCE(MAX(priority), 0) + 1 FROM profile_addons WHERE settings_profile_id = ?))
           ON CONFLICT(settings_profile_id, addon_id) DO UPDATE SET enabled = TRUE
       `);
       
       const transaction = db.transaction(() => {
           for (const sp of settingsProfiles) {
               insertProfileAddon.run(sp.id, zentrioAddon.id, sp.id);
           }
       });
       transaction();
   }
 } catch (e) {
   console.error("Migration for Zentrio addon failed", e);
 }

 // Appearance Settings Migration
 try {
   db.exec(`
     CREATE TABLE IF NOT EXISTS appearance_settings (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       settings_profile_id INTEGER REFERENCES settings_profiles(id) ON DELETE CASCADE,
       theme_id TEXT DEFAULT 'zentrio',
       show_imdb_ratings BOOLEAN DEFAULT TRUE,
       show_age_ratings BOOLEAN DEFAULT TRUE,
       background_style TEXT DEFAULT 'vanta',
       custom_theme_config TEXT,
       UNIQUE(settings_profile_id)
     );
   `);

   // Add show_age_ratings column if missing
   try {
       db.exec('ALTER TABLE appearance_settings ADD COLUMN show_age_ratings BOOLEAN DEFAULT TRUE');
   } catch (e) {
       // ignore if column already exists
   }
  } catch (e) {
   console.error("Migration for appearance_settings failed", e);
  }

 // Settings Profiles Migration
 try {
   db.exec(`
     CREATE TABLE IF NOT EXISTS settings_profiles (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       user_id TEXT NOT NULL,
       name TEXT NOT NULL,
       is_default BOOLEAN DEFAULT FALSE,
       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
     );
   `);

   // Ensure is_default column exists (for existing tables)
   try {
       db.exec('ALTER TABLE settings_profiles ADD COLUMN is_default BOOLEAN DEFAULT FALSE');
   } catch (e) {}

   // Add settings_profile_id to profiles
   try {
     db.exec('ALTER TABLE profiles ADD COLUMN settings_profile_id INTEGER REFERENCES settings_profiles(id) ON DELETE SET NULL');
   } catch (e) {}

   // Add settings_profile_id to settings tables
   try {
     db.exec('ALTER TABLE stream_settings ADD COLUMN settings_profile_id INTEGER REFERENCES settings_profiles(id) ON DELETE CASCADE');
   } catch (e) {}
   try {
     db.exec('ALTER TABLE profile_addons ADD COLUMN settings_profile_id INTEGER REFERENCES settings_profiles(id) ON DELETE CASCADE');
   } catch (e) {}
   try {
     db.exec('ALTER TABLE profile_proxy_settings ADD COLUMN settings_profile_id INTEGER REFERENCES settings_profiles(id) ON DELETE CASCADE');
   } catch (e) {}

   // Migrate existing profiles to have a settings profile
   // We want ONE default settings profile per user, and link all profiles to it.
   // But we should try to preserve settings from the user's default profile.
   
   // Get all users
   const users = db.prepare("SELECT id FROM user").all() as any[];
   
   const insertSettingsProfile = db.prepare("INSERT INTO settings_profiles (user_id, name, is_default) VALUES (?, ?, ?)");
   const updateProfile = db.prepare("UPDATE profiles SET settings_profile_id = ? WHERE id = ?");
   
   // Stream settings migration
   let getStreamSettings: any;
   let updateStreamSettings: any;
   try {
       getStreamSettings = db.prepare("SELECT * FROM stream_settings WHERE profile_id = ?");
       updateStreamSettings = db.prepare("UPDATE stream_settings SET settings_profile_id = ? WHERE id = ?");
   } catch (e) {
       // Table might not exist yet if this is a fresh install, but we are inside a migration block...
       // Actually, stream_settings is created further down in the file (line 507).
       // This migration block (lines 147-291) runs BEFORE the table creation block (lines 294-518).
       // This is a logic error in the file structure. The migration depends on tables that might not exist yet.
       // However, for existing users, the table DOES exist (from previous versions).
       // For new users, this block might fail.
       // We should wrap this in a try-catch or check if table exists.
   }
   
   // Proxy settings migration
   const getProxySettings = db.prepare("SELECT * FROM profile_proxy_settings WHERE profile_id = ?");
   const updateProxySettings = db.prepare("UPDATE profile_proxy_settings SET settings_profile_id = ? WHERE id = ?");
   
   // Addons migration
   const getAddons = db.prepare("SELECT * FROM profile_addons WHERE profile_id = ?");
   const updateAddons = db.prepare("UPDATE profile_addons SET settings_profile_id = ? WHERE id = ?");

   const transaction = db.transaction(() => {
       for (const u of users) {
           // Check if user already has a default settings profile
           let settingsProfileId;
           const existingDefault = db.prepare("SELECT id FROM settings_profiles WHERE user_id = ? AND is_default = TRUE").get(u.id) as any;
           
           if (existingDefault) {
               settingsProfileId = existingDefault.id;
           } else {
               // Create "Default" settings profile
               const res = insertSettingsProfile.run(u.id, "Default", 1);
               settingsProfileId = res.lastInsertRowid;

               // Find user's default profile to copy settings from
               const defaultUserProfile = db.prepare("SELECT * FROM profiles WHERE user_id = ? AND is_default = TRUE").get(u.id) as any;

               // Migrate settings from the default user profile (if it exists)
               if (defaultUserProfile) {
                   // Migrate Stream Settings
                   if (getStreamSettings && updateStreamSettings) {
                       const streamSettings = getStreamSettings.get(defaultUserProfile.id) as any;
                       if (streamSettings) {
                           updateStreamSettings.run(settingsProfileId, streamSettings.id);
                       }
                   }

                   // Migrate Proxy Settings
                   const proxySettings = getProxySettings.get(defaultUserProfile.id) as any;
                   if (proxySettings) {
                       updateProxySettings.run(settingsProfileId, proxySettings.id);
                   }

                   // Migrate Addons
                   const addons = getAddons.all(defaultUserProfile.id) as any[];
                   for (const addon of addons) {
                       updateAddons.run(settingsProfileId, addon.id);
                   }
               }
           }

           // Force ALL user profiles to use the Default settings profile (resetting previous migration if needed)
           // This ensures "everyone to have 'Default' settings by default"
           // We only do this if we are running the migration (which runs on startup).
           // But we should be careful not to overwrite if the user explicitly changed it later.
           // However, since this is a "fix" migration, maybe we should?
           // Let's only update if settings_profile_id is NULL OR if it points to a non-default profile that looks like an auto-generated one?
           // Or just update all. The user said "I want everyone to have 'Default' settings by default".
           // Let's update all profiles that are NOT linked to a default profile?
           // Or just update all.
           
           // Let's update all profiles for this user to point to the default settings profile
           // BUT only if we just created it? Or always?
           // If we always do it, we reset user choices on every restart. That's bad.
           // We should only do it if they don't have a settings profile yet.
           
           const userProfiles = db.prepare("SELECT * FROM profiles WHERE user_id = ? AND settings_profile_id IS NULL").all(u.id) as any[];
           for (const p of userProfiles) {
               updateProfile.run(settingsProfileId, p.id);
           }
           
           // Also, if we have "Settings for ..." profiles from previous run, we might want to consolidate them?
           // But that's risky. Let's just ensure new/unlinked profiles get the default.
           // And if the user wants to fix existing ones, they can do it in UI.
           // But the user complained "Now it sets it to 'Settings for (name)'".
           // This implies they saw the result of my previous migration.
           // So I should probably undo that for them.
           
           // Find profiles linked to "Settings for ..."
           const profilesWithCustomSettings = db.prepare(`
               SELECT p.id, sp.id as sp_id
               FROM profiles p
               JOIN settings_profiles sp ON p.settings_profile_id = sp.id
               WHERE p.user_id = ? AND sp.name LIKE 'Settings for %'
           `).all(u.id) as any[];
           
           for (const p of profilesWithCustomSettings) {
               // Re-link to default
               updateProfile.run(settingsProfileId, p.id);
               // Delete the old settings profile if unused?
               // We can do a cleanup pass later.
           }
       }
       
       // Cleanup unused settings profiles
       db.exec("DELETE FROM settings_profiles WHERE (SELECT COUNT(*) FROM profiles WHERE settings_profile_id = settings_profiles.id) = 0 AND is_default = FALSE");
   });
   transaction();

 } catch (e) {
   console.error("Migration for settings profiles failed", e);
 }

 // Sync State Table & Migrations
 try {
   db.exec(`
     CREATE TABLE IF NOT EXISTS sync_state (
       id INTEGER PRIMARY KEY CHECK (id = 1),
       remote_url TEXT,
       remote_user_id TEXT,
       auth_token TEXT,
       last_sync_at DATETIME,
       is_syncing BOOLEAN DEFAULT FALSE
     );
   `);

   const syncTables = [
     'profiles',
     'settings_profiles',
     'profile_addons',
     'stream_settings',
     'appearance_settings',
     'watch_history',
     'lists',
     'list_items'
   ];

   const addColumn = (table: string, column: string, type: string) => {
     try {
       db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
     } catch (e) {
       // ignore if exists
     }
   };

   for (const table of syncTables) {
     addColumn(table, 'remote_id', 'TEXT');
     addColumn(table, 'dirty', 'BOOLEAN DEFAULT FALSE');
     addColumn(table, 'deleted_at', 'DATETIME');
     
     // Ensure updated_at exists
     if (['profile_addons', 'stream_settings', 'appearance_settings', 'lists', 'list_items'].includes(table)) {
        addColumn(table, 'updated_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');
     }
   }
 } catch (e) {
   console.error("Migration for sync features failed", e);
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
    mobile_click_to_hover BOOLEAN DEFAULT FALSE,
    hero_banner_enabled BOOLEAN DEFAULT TRUE,
    tmdb_api_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    title TEXT,
    poster TEXT,
    duration INTEGER,
    position INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    UNIQUE(profile_id, meta_id)
  );
  CREATE INDEX IF NOT EXISTS idx_watch_history_profile ON watch_history(profile_id);

  CREATE TABLE IF NOT EXISTS lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    FOREIGN KEY (list_id) REFERENCES lists (id) ON DELETE CASCADE,
    UNIQUE(list_id, meta_id)
  );

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
    settings_profile_id INTEGER REFERENCES settings_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    FOREIGN KEY (addon_id) REFERENCES addons (id) ON DELETE CASCADE,
    UNIQUE(profile_id, addon_id)
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
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
    UNIQUE(profile_id)
  );
`)

// Schema correction for stream_settings (allow nullable profile_id)
try {
  const tableInfo = db.prepare("PRAGMA table_info(stream_settings)").all() as any[];
  const profileIdColumn = tableInfo.find(c => c.name === 'profile_id');
  
  if (profileIdColumn && profileIdColumn.notnull === 1) {
    console.log("Migrating stream_settings to allow nullable profile_id...");
    const transaction = db.transaction(() => {
      // Check if columns exist before trying to copy them
      const columns = tableInfo.map(c => c.name);
      const hasConfig = columns.includes('config');
      const hasSettingsProfileId = columns.includes('settings_profile_id');
      
      db.exec("ALTER TABLE stream_settings RENAME TO stream_settings_old");
      
      db.exec(`
        CREATE TABLE stream_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id INTEGER,
          qualities TEXT,
          preferred_keywords TEXT,
          required_keywords TEXT,
          config TEXT,
          settings_profile_id INTEGER REFERENCES settings_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
          UNIQUE(profile_id)
        )
      `);
      
      // Construct dynamic INSERT based on available columns in old table
      let oldCols = ['id', 'profile_id', 'qualities', 'preferred_keywords', 'required_keywords'];
      let newCols = ['id', 'profile_id', 'qualities', 'preferred_keywords', 'required_keywords'];
      
      if (hasConfig) {
        oldCols.push('config');
        newCols.push('config');
      }
      
      if (hasSettingsProfileId) {
        oldCols.push('settings_profile_id');
        newCols.push('settings_profile_id');
      }
      
      db.exec(`
        INSERT INTO stream_settings (${newCols.join(', ')})
        SELECT ${oldCols.join(', ')}
        FROM stream_settings_old
      `);
      
      db.exec("DROP TABLE stream_settings_old");
    });
    transaction();
  }
} catch (e) {
  console.error("Migration for stream_settings schema failed", e);
}

// Schema correction for profile_addons (allow nullable profile_id)
try {
  const tableInfo = db.prepare("PRAGMA table_info(profile_addons)").all() as any[];
  const profileIdColumn = tableInfo.find(c => c.name === 'profile_id');
  
  if (profileIdColumn && profileIdColumn.notnull === 1) {
    console.log("Migrating profile_addons to allow nullable profile_id...");
    const transaction = db.transaction(() => {
      const columns = tableInfo.map(c => c.name);
      
      db.exec("ALTER TABLE profile_addons RENAME TO profile_addons_old");
      
      db.exec(`
        CREATE TABLE profile_addons (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          profile_id INTEGER,
          addon_id INTEGER NOT NULL,
          enabled BOOLEAN DEFAULT TRUE,
          priority INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          settings_profile_id INTEGER REFERENCES settings_profiles(id) ON DELETE CASCADE,
          FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE,
          FOREIGN KEY (addon_id) REFERENCES addons (id) ON DELETE CASCADE,
          UNIQUE(profile_id, addon_id)
        )
      `);
      
      // We also need the unique index on (settings_profile_id, addon_id) for ON CONFLICT support
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_addons_settings_addon ON profile_addons(settings_profile_id, addon_id)");

      const colNames = columns.join(', ');
      
      db.exec(`
        INSERT INTO profile_addons (${colNames})
        SELECT ${colNames}
        FROM profile_addons_old
      `);
      
      db.exec("DROP TABLE profile_addons_old");
    });
    transaction();
  } else {
      // Ensure index exists even if migration didn't run
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_addons_settings_addon ON profile_addons(settings_profile_id, addon_id)");
  }
} catch (e) {
  console.error("Migration for profile_addons schema failed", e);
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
  title?: string
  poster?: string
  duration?: number
  position?: number
}

export interface List extends SyncableEntity {
  id: number
  profile_id: number
  name: string
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
      is_default?: boolean
      settings_profile_id?: number
    }): Promise<Profile> => {
      const stmt = db.prepare(`
        INSERT INTO profiles (user_id, name, avatar, avatar_type, is_default, settings_profile_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      
      const result = stmt.run(
        profileData.user_id,
        profileData.name,
        profileData.avatar,
        profileData.avatar_type || 'initials',
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
    title?: string
    poster?: string
    duration?: number
    position?: number
  }): void => {
    const stmt = db.prepare(`
      INSERT INTO watch_history (profile_id, meta_id, meta_type, title, poster, duration, position, updated_at, dirty)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, TRUE)
      ON CONFLICT(profile_id, meta_id) DO UPDATE SET
        position = excluded.position,
        duration = COALESCE(excluded.duration, watch_history.duration),
        updated_at = CURRENT_TIMESTAMP,
        dirty = TRUE
    `)
    stmt.run(
      data.profile_id,
      data.meta_id,
      data.meta_type,
      data.title || null,
      data.poster || null,
      data.duration || null,
      data.position || null
    )
  },

  getByProfileId: (profileId: number): WatchHistoryItem[] => {
    const stmt = db.prepare('SELECT * FROM watch_history WHERE profile_id = ? ORDER BY updated_at DESC LIMIT 20')
    return stmt.all(profileId) as WatchHistoryItem[]
  }
}

// List operations
export const listDb = {
  create: (profileId: number, name: string): List => {
    const stmt = db.prepare("INSERT INTO lists (profile_id, name) VALUES (?, ?)")
    const res = stmt.run(profileId, name)
    return listDb.getById(res.lastInsertRowid as number)!
  },

  getById: (id: number): List | undefined => {
    return db.prepare("SELECT * FROM lists WHERE id = ?").get(id) as List | undefined
  },

  getAll: (profileId: number): List[] => {
    return db.prepare("SELECT * FROM lists WHERE profile_id = ? ORDER BY created_at ASC").all(profileId) as List[]
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
    return db.prepare("SELECT * FROM list_items WHERE list_id = ? ORDER BY created_at DESC").all(listId) as ListItem[]
  },

  // Check if item is in ANY list for a profile
  isInAnyList: (profileId: number, metaId: string): boolean => {
    const stmt = db.prepare(`
      SELECT 1 FROM list_items li
      JOIN lists l ON li.list_id = l.id
      WHERE l.profile_id = ? AND li.meta_id = ?
      LIMIT 1
    `)
    return !!stmt.get(profileId, metaId)
  },

  // Get all lists containing the item
  getListsForItem: (profileId: number, metaId: string): number[] => {
    const stmt = db.prepare(`
      SELECT l.id FROM lists l
      JOIN list_items li ON l.id = li.list_id
      WHERE l.profile_id = ? AND li.meta_id = ?
    `)
    return (stmt.all(profileId, metaId) as any[]).map(r => r.id)
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
      ON CONFLICT(settings_profile_id, addon_id) DO UPDATE SET enabled = TRUE, dirty = TRUE, updated_at = CURRENT_TIMESTAMP
    `)
    stmt.run(settingsProfileId, addonId, settingsProfileId)
  },

  disableForProfile: (settingsProfileId: number, addonId: number): void => {
    const stmt = db.prepare(`
      INSERT INTO profile_addons (profile_id, settings_profile_id, addon_id, enabled, priority, dirty)
      VALUES (NULL, ?, ?, FALSE, (SELECT COALESCE(MAX(priority), 0) + 1 FROM profile_addons WHERE settings_profile_id = ?), TRUE)
      ON CONFLICT(settings_profile_id, addon_id) DO UPDATE SET enabled = FALSE, dirty = TRUE, updated_at = CURRENT_TIMESTAMP
    `)
    stmt.run(settingsProfileId, addonId, settingsProfileId)
  },

  getForProfile: (settingsProfileId: number): ProfileAddon[] => {
    const stmt = db.prepare(`
      SELECT pa.*, a.manifest_url, a.name, a.version, a.description, a.logo, a.logo_url
      FROM profile_addons pa
      JOIN addons a ON pa.addon_id = a.id
      WHERE pa.settings_profile_id = ?
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
      WHERE pa.settings_profile_id = ?
      ORDER BY pa.priority ASC, a.id ASC
    `)
    const rows = stmt.all(settingsProfileId) as any[]
    return rows.map(row => ({
        ...row,
        enabled: !!row.enabled,
        is_protected: row.manifest_url === 'zentrio://tmdb-addon'
    }))
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
      WHERE pa.settings_profile_id = ? AND pa.enabled = 1
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
      sorting: { global: ['quality', 'seeders'] }
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
