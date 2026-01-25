// Database Module Index
// Re-exports all database operations for backward compatibility
// This file ensures existing imports from '../services/database' continue to work

// Import connection and run migrations
import { db } from './connection'
import './migrations'

// Import all types
export * from './types'

// Import all utilities
export { hashPassword, verifyPassword, generateSessionToken, randomToken, sha256Hex } from './utils'

// Import all database operations
import { userDb, setProfileDb, setSettingsProfileDb, setProfileProxySettingsDb } from './user'
import { profileDb } from './profile'
import { settingsProfileDb, setAddonDb } from './settings-profile'
import { proxySessionDb, proxyLogDb, profileProxySettingsDb, proxyRateLimitDb } from './proxy'
import { watchHistoryDb } from './watch-history'
import { listDb } from './lists'
import { addonDb } from './addons'
import { streamDb } from './stream'
import { appearanceDb } from './appearance'
import { traktAccountDb, traktSyncStateDb } from './trakt'

// Wire up circular dependencies
setProfileDb(profileDb)
setSettingsProfileDb(settingsProfileDb)
setProfileProxySettingsDb(profileProxySettingsDb)
setAddonDb(addonDb)

// Export all database operations
export {
  db,
  userDb,
  profileDb,
  settingsProfileDb,
  proxySessionDb,
  proxyLogDb,
  profileProxySettingsDb,
  proxyRateLimitDb,
  watchHistoryDb,
  listDb,
  addonDb,
  streamDb,
  appearanceDb,
  traktAccountDb,
  traktSyncStateDb
}
