// Database connection and schema initialization
import { Database } from 'bun:sqlite'
import { join, dirname, isAbsolute } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { getConfig } from '../envParser'

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

export const db = new Database(dbPath)

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
     role TEXT DEFAULT 'user',
     banned BOOLEAN DEFAULT FALSE,
     banReason TEXT,
     banExpires DATETIME,
     phoneNumber TEXT UNIQUE,
     phoneNumberVerified BOOLEAN DEFAULT FALSE,
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
    show_imdb_ratings BOOLEAN DEFAULT TRUE,
    show_age_ratings BOOLEAN DEFAULT TRUE,
    background_style TEXT DEFAULT 'vanta',
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

  -- Trakt Integration Tables
  CREATE TABLE IF NOT EXISTS trakt_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    trakt_user_id TEXT,
    trakt_username TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS trakt_sync_state (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL UNIQUE,
    last_history_sync DATETIME,
    last_push_sync DATETIME,
    sync_enabled BOOLEAN DEFAULT TRUE,
    push_to_trakt BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (profile_id) REFERENCES profiles (id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_trakt_accounts_profile ON trakt_accounts(profile_id);
  CREATE INDEX IF NOT EXISTS idx_trakt_sync_state_profile ON trakt_sync_state(profile_id);

  -- Admin Audit Log with hash chaining for tamper evidence
  CREATE TABLE IF NOT EXISTS admin_audit_log (
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
  );

  -- Indexes for audit log queries
  CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_log(actor_id);
  CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action);
  CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log(target_type, target_id);
  CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at);

  -- Admin Step-up Challenges for sensitive operations
  CREATE TABLE IF NOT EXISTS admin_stepup_challenges (
    id TEXT PRIMARY KEY,
    admin_identity_id TEXT NOT NULL,
    challenge_type TEXT NOT NULL DEFAULT 'email_otp',
    otp_code TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    used_at DATETIME,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_identity_id) REFERENCES user (id) ON DELETE CASCADE
  );

  -- Indexes for step-up challenges
  CREATE INDEX IF NOT EXISTS idx_admin_stepup_identity ON admin_stepup_challenges(admin_identity_id);
  CREATE INDEX IF NOT EXISTS idx_admin_stepup_expires ON admin_stepup_challenges(expires_at);
  CREATE INDEX IF NOT EXISTS idx_admin_stepup_used ON admin_stepup_challenges(used_at);

  -- RBAC: Admin roles
  CREATE TABLE IF NOT EXISTS admin_roles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- RBAC: Admin permissions catalog
  CREATE TABLE IF NOT EXISTS admin_permissions (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'general',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- RBAC: Role-Permission mappings
  CREATE TABLE IF NOT EXISTS admin_role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES admin_permissions(id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
  );

  -- RBAC: User-Role mappings (additional to the role field on user table)
  CREATE TABLE IF NOT EXISTS admin_user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    role_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES admin_roles(id) ON DELETE CASCADE,
    UNIQUE(user_id, role_id)
  );

  -- Indexes for RBAC
  CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_role ON admin_role_permissions(role_id);
  CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_perm ON admin_role_permissions(permission_id);
  CREATE INDEX IF NOT EXISTS idx_admin_user_roles_user ON admin_user_roles(user_id);
  CREATE INDEX IF NOT EXISTS idx_admin_user_roles_role ON admin_user_roles(role_id);

  -- Seed default admin role if not exists
  INSERT OR IGNORE INTO admin_roles (id, name, description, is_system) VALUES 
    ('role_superadmin', 'superadmin', 'Full system access', TRUE),
    ('role_admin', 'admin', 'Standard admin access', TRUE),
    ('role_moderator', 'moderator', 'Limited moderation access', TRUE),
    ('role_readonly', 'readonly', 'Read-only access', TRUE);

  -- Seed permission catalog
  INSERT OR IGNORE INTO admin_permissions (id, key, description, category) VALUES
    -- Stats & Monitoring
    ('perm_stats_read', 'admin.stats.read', 'View system statistics', 'monitoring'),
    ('perm_activity_read', 'admin.activity.read', 'View live activity feeds', 'monitoring'),
    ('perm_audit_read', 'admin.audit.read', 'View audit logs', 'monitoring'),
    
    -- User Management
    ('perm_users_read', 'admin.users.read', 'View user list and details', 'users'),
    ('perm_users_write_role', 'admin.users.write.role', 'Change user roles', 'users'),
    ('perm_users_write_ban', 'admin.users.write.ban', 'Ban/unban users', 'users'),
    ('perm_users_write_email', 'admin.users.write.email', 'Change user email', 'users'),
    ('perm_users_write_password', 'admin.users.write.password', 'Reset user password', 'users'),
    ('perm_users_write_accounts', 'admin.users.write.accounts', 'Manage linked accounts', 'users'),
    ('perm_users_write_sessions', 'admin.users.write.sessions', 'Revoke user sessions', 'users'),
    
    -- System Configuration
    ('perm_system_bootstrap', 'admin.system.bootstrap', 'Access bootstrap claim', 'system'),
    ('perm_system_settings', 'admin.system.settings', 'Modify system settings', 'system'),
    ('perm_system_maintenance', 'admin.system.maintenance', 'Enable maintenance mode', 'system');

  -- Assign all permissions to superadmin
  INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_id)
  SELECT 'role_superadmin', id FROM admin_permissions;

  -- Assign standard permissions to admin role
  INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_id) VALUES
    ('role_admin', 'perm_stats_read'),
    ('role_admin', 'perm_activity_read'),
    ('role_admin', 'perm_audit_read'),
    ('role_admin', 'perm_users_read'),
    ('role_admin', 'perm_users_write_ban'),
    ('role_admin', 'perm_users_write_sessions');

  -- Assign read-only permissions to moderator
  INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_id) VALUES
    ('role_moderator', 'perm_stats_read'),
    ('role_moderator', 'perm_activity_read'),
    ('role_moderator', 'perm_users_read'),
    ('role_moderator', 'perm_users_write_ban');

  -- Assign read-only permissions
  INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_id) VALUES
    ('role_readonly', 'perm_stats_read'),
    ('role_readonly', 'perm_activity_read'),
    ('role_readonly', 'perm_users_read');
 `)
