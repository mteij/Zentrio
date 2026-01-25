// Watch History database operations
import { db } from './connection'
import type { WatchHistoryItem } from './types'

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
    // Mark as watched if position >= 80% of duration (matches Trakt's threshold)
    const seasonVal = season ?? -1
    const episodeVal = episode ?? -1
    const stmt = db.prepare(`
      UPDATE watch_history 
      SET is_watched = TRUE, watched_at = CURRENT_TIMESTAMP, dirty = TRUE
      WHERE profile_id = ? AND meta_id = ? AND season = ? AND episode = ?
        AND duration > 0 AND position >= (duration * 0.8) AND is_watched = FALSE
    `)
    stmt.run(profileId, metaId, seasonVal, episodeVal)
  },

  getBatchStatus: (profileId: number, metaIds: string[]): Record<string, { isWatched: boolean, progress: number, duration: number, lastStream?: any }> => {
    if (metaIds.length === 0) return {}

    const placeHolders = metaIds.map(() => '?').join(',')
    const stmt = db.prepare(`SELECT * FROM watch_history WHERE profile_id = ? AND meta_id IN (${placeHolders}) AND deleted_at IS NULL`)
    
    // @ts-ignore
    const rows = stmt.all(profileId, ...metaIds) as WatchHistoryItem[]
    const result: Record<string, { isWatched: boolean, progress: number, duration: number, lastStream?: any }> = {}
    
    for (const row of rows) {
        if (!result[row.meta_id]) {
            result[row.meta_id] = { isWatched: false, progress: 0, duration: 0 }
        }
        
        // For Movies (root items)
        if (row.season === -1 && row.episode === -1) {
            result[row.meta_id].isWatched = Boolean(row.is_watched)
            if (row.duration && row.position) {
                 result[row.meta_id].progress = (row.position / row.duration) * 100
                 result[row.meta_id].duration = row.duration
            }
            if (row.last_stream) {
                 try {
                    result[row.meta_id].lastStream = JSON.parse(row.last_stream)
                 } catch (e) {}
            }
        } else {
             // For Series: Find the most recently updated "In Progress" episode
             if (result[row.meta_id].isWatched) continue;

             const progressPercent = (row.duration && row.position) ? (row.position / row.duration) * 100 : 0;
             const isCompleted = row.is_watched || progressPercent >= 90;
             const meetsMinThreshold = (row.position && row.position >= 120) || progressPercent >= 5;

             if (!isCompleted && meetsMinThreshold) {
                 const currentRowDate = row.updated_at ? new Date(row.updated_at).getTime() : 0;
                 const existingLastDate = (result[row.meta_id] as any)._lastUpdate || 0;

                 if (currentRowDate > existingLastDate) {
                     (result[row.meta_id] as any)._lastUpdate = currentRowDate;
                     result[row.meta_id].progress = progressPercent;
                     // @ts-ignore
                     result[row.meta_id].episodeDisplay = `S${row.season}:E${row.episode}`;
                     result[row.meta_id].lastStream = row.last_stream ? JSON.parse(row.last_stream) : undefined;
                 }
             }
        }
    }
    // Cleanup temporary _lastUpdate
    for (const key in result) {
        delete (result[key] as any)._lastUpdate;
    }
    return result
  },

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
    
    return result.changes > 0
  },

  deleteAllForSeries: (profileId: number, metaId: string): void => {
    // Soft delete all entries for this series (including 0-progress ones)
    const stmt = db.prepare(`
      UPDATE watch_history 
      SET deleted_at = CURRENT_TIMESTAMP, dirty = TRUE, updated_at = CURRENT_TIMESTAMP 
      WHERE profile_id = ? AND meta_id = ?
    `)
    stmt.run(profileId, metaId)
  },
}
