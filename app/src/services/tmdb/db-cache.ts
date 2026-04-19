import { db } from '../database/connection'
import { logger } from '../logger'

const log = logger.scope('TMDB:DbCache')

export const dbTmdbCache = {
  get<T>(key: string): T | null {
    try {
      const row = db.prepare('SELECT data, expires_at FROM tmdb_cache WHERE key = ?').get(key) as
        | { data: string; expires_at: number }
        | undefined

      if (!row) return null

      if (Date.now() > row.expires_at) {
        db.prepare('DELETE FROM tmdb_cache WHERE key = ?').run(key)
        return null
      }

      return JSON.parse(row.data) as T
    } catch (e) {
      log.warn('Cache read error:', e)
      return null
    }
  },

  set(key: string, data: unknown, expiresAt: number): void {
    try {
      db.prepare('INSERT OR REPLACE INTO tmdb_cache (key, data, expires_at) VALUES (?, ?, ?)').run(
        key,
        JSON.stringify(data),
        expiresAt
      )
    } catch (e) {
      log.warn('Cache write error:', e)
    }
  },

  cleanup(): void {
    try {
      const deleted = db.prepare('DELETE FROM tmdb_cache WHERE expires_at < ?').run(Date.now())
      if (deleted.changes > 0) log.debug(`Evicted ${deleted.changes} expired entries`)
    } catch {}
  },
}

setInterval(() => dbTmdbCache.cleanup(), 10 * 60 * 1000).unref()
