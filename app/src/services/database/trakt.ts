// Trakt integration database operations
import { db } from './connection'
import { encrypt, decrypt } from '../encryption'
import type { TraktAccount, TraktSyncState } from '../trakt/types'

export const traktAccountDb = {
  // Get Trakt account for a profile
  getByProfileId: (profileId: number): TraktAccount | null => {
    const stmt = db.prepare('SELECT * FROM trakt_accounts WHERE profile_id = ?')
    const row = stmt.get(profileId) as any
    if (!row) return null
    
    // Decrypt tokens
    try {
      return {
        ...row,
        access_token: decrypt(row.access_token),
        refresh_token: decrypt(row.refresh_token)
      }
    } catch (e) {
      console.error('Failed to decrypt Trakt tokens:', e)
      return null
    }
  },

  // Create or update Trakt account for a profile
  upsert: (profileId: number, data: {
    access_token: string
    refresh_token: string
    expires_at: Date
    trakt_user_id?: string
    trakt_username?: string
  }): TraktAccount => {
    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(data.access_token)
    const encryptedRefreshToken = encrypt(data.refresh_token)
    const expiresAt = data.expires_at.toISOString()

    const existing = db.prepare('SELECT id FROM trakt_accounts WHERE profile_id = ?').get(profileId) as any

    if (existing) {
      const stmt = db.prepare(`
        UPDATE trakt_accounts 
        SET access_token = ?, refresh_token = ?, expires_at = ?, 
            trakt_user_id = ?, trakt_username = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      stmt.run(
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt,
        data.trakt_user_id || null,
        data.trakt_username || null,
        existing.id
      )
    } else {
      const stmt = db.prepare(`
        INSERT INTO trakt_accounts (profile_id, access_token, refresh_token, expires_at, trakt_user_id, trakt_username)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      stmt.run(
        profileId,
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt,
        data.trakt_user_id || null,
        data.trakt_username || null
      )
    }

    return traktAccountDb.getByProfileId(profileId)!
  },

  // Update tokens (after refresh)
  updateTokens: (profileId: number, accessToken: string, refreshToken: string, expiresAt: Date): void => {
    const encryptedAccessToken = encrypt(accessToken)
    const encryptedRefreshToken = encrypt(refreshToken)

    const stmt = db.prepare(`
      UPDATE trakt_accounts 
      SET access_token = ?, refresh_token = ?, expires_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE profile_id = ?
    `)
    stmt.run(encryptedAccessToken, encryptedRefreshToken, expiresAt.toISOString(), profileId)
  },

  // Delete Trakt account (disconnect)
  delete: (profileId: number): void => {
    db.prepare('DELETE FROM trakt_accounts WHERE profile_id = ?').run(profileId)
    // Also delete sync state
    db.prepare('DELETE FROM trakt_sync_state WHERE profile_id = ?').run(profileId)
  },

  // Check if token is expired or about to expire (within 1 hour)
  isTokenExpired: (profileId: number): boolean => {
    const account = traktAccountDb.getByProfileId(profileId)
    if (!account) return true

    const expiresAt = new Date(account.expires_at)
    const oneHourFromNow = new Date(Date.now() + 60 * 60 * 1000)
    return expiresAt <= oneHourFromNow
  }
}

export const traktSyncStateDb = {
  // Get sync state for a profile
  getByProfileId: (profileId: number): TraktSyncState | null => {
    const stmt = db.prepare('SELECT * FROM trakt_sync_state WHERE profile_id = ?')
    const row = stmt.get(profileId) as any
    if (!row) return null

    return {
      id: row.id,
      profile_id: row.profile_id,
      last_history_sync: row.last_history_sync,
      last_push_sync: row.last_push_sync,
      sync_enabled: !!row.sync_enabled,
      push_to_trakt: !!row.push_to_trakt
    }
  },

  // Get or create sync state with defaults
  getOrCreate: (profileId: number): TraktSyncState => {
    const existing = traktSyncStateDb.getByProfileId(profileId)
    if (existing) return existing

    const stmt = db.prepare(`
      INSERT INTO trakt_sync_state (profile_id, sync_enabled, push_to_trakt)
      VALUES (?, TRUE, TRUE)
    `)
    stmt.run(profileId)

    return traktSyncStateDb.getByProfileId(profileId)!
  },

  // Update sync settings
  updateSettings: (profileId: number, settings: { sync_enabled?: boolean; push_to_trakt?: boolean }): void => {
    const fields: string[] = []
    const values: any[] = []

    if (settings.sync_enabled !== undefined) {
      fields.push('sync_enabled = ?')
      values.push(settings.sync_enabled ? 1 : 0)
    }
    if (settings.push_to_trakt !== undefined) {
      fields.push('push_to_trakt = ?')
      values.push(settings.push_to_trakt ? 1 : 0)
    }

    if (fields.length === 0) return

    // Ensure record exists
    traktSyncStateDb.getOrCreate(profileId)

    values.push(profileId)
    const stmt = db.prepare(`UPDATE trakt_sync_state SET ${fields.join(', ')} WHERE profile_id = ?`)
    stmt.run(...values)
  },

  // Update last history sync timestamp
  updateLastHistorySync: (profileId: number): void => {
    traktSyncStateDb.getOrCreate(profileId)
    const stmt = db.prepare('UPDATE trakt_sync_state SET last_history_sync = CURRENT_TIMESTAMP WHERE profile_id = ?')
    stmt.run(profileId)
  },

  // Update last push sync timestamp
  updateLastPushSync: (profileId: number): void => {
    traktSyncStateDb.getOrCreate(profileId)
    const stmt = db.prepare('UPDATE trakt_sync_state SET last_push_sync = CURRENT_TIMESTAMP WHERE profile_id = ?')
    stmt.run(profileId)
  }
}
