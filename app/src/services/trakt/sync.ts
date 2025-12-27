// Trakt Sync Service
// Handles bidirectional watch history synchronization

import { traktClient } from './client'
import { traktAccountDb, traktSyncStateDb, watchHistoryDb, type WatchHistoryItem } from '../database'
import type { TraktHistoryItem, TraktSyncRequest, TraktIds } from './types'

interface SyncResult {
  success: boolean
  pulled: { added: number; updated: number }
  pushed: { synced: number }
  error?: string
}

class TraktSyncService {
  // Main sync entry point - handles both pull and push
  async sync(profileId: number): Promise<SyncResult> {
    const result: SyncResult = {
      success: false,
      pulled: { added: 0, updated: 0 },
      pushed: { synced: 0 }
    }

    try {
      const accessToken = await this.getValidAccessToken(profileId)
      if (!accessToken) {
        return { ...result, error: 'Not connected to Trakt' }
      }

      const syncState = traktSyncStateDb.getOrCreate(profileId)

      // Pull from Trakt
      if (syncState.sync_enabled) {
        const pullResult = await this.pullHistory(profileId, accessToken, syncState.last_history_sync)
        result.pulled = pullResult
        traktSyncStateDb.updateLastHistorySync(profileId)
      }

      // Push to Trakt (if enabled)
      if (syncState.sync_enabled && syncState.push_to_trakt) {
        const pushResult = await this.pushHistory(profileId, accessToken, syncState.last_push_sync)
        result.pushed = pushResult
        traktSyncStateDb.updateLastPushSync(profileId)
      }

      result.success = true
      return result
    } catch (error) {
      console.error('[TraktSync] Sync failed:', error)
      return { ...result, error: error instanceof Error ? error.message : 'Sync failed' }
    }
  }

  // Get a valid access token, refreshing if needed
  private async getValidAccessToken(profileId: number): Promise<string | null> {
    const account = traktAccountDb.getByProfileId(profileId)
    if (!account) return null

    // Check if token needs refresh
    if (traktAccountDb.isTokenExpired(profileId)) {
      try {
        const newTokens = await traktClient.refreshAccessToken(account.refresh_token)
        const expiresAt = new Date((newTokens.created_at + newTokens.expires_in) * 1000)
        
        traktAccountDb.updateTokens(
          profileId,
          newTokens.access_token,
          newTokens.refresh_token,
          expiresAt
        )
        
        return newTokens.access_token
      } catch (error) {
        console.error('[TraktSync] Token refresh failed:', error)
        return null
      }
    }

    return account.access_token
  }

  // Pull watch history from Trakt → local
  private async pullHistory(
    profileId: number,
    accessToken: string,
    lastSync?: string | null
  ): Promise<{ added: number; updated: number }> {
    const result = { added: 0, updated: 0 }

    try {
      // Get history since last sync (or all if first sync)
      const startAt = lastSync ? new Date(lastSync) : undefined
      const history = await traktClient.getWatchedHistory(accessToken, undefined, startAt, 500)

      for (const item of history) {
        const localItem = this.convertTraktToLocal(item, profileId)
        if (!localItem) continue

        // Check if already exists
        const existing = watchHistoryDb.getProgress(
          profileId,
          localItem.meta_id,
          localItem.season,
          localItem.episode
        )

        if (existing) {
          // Update if Trakt watched_at is newer
          const traktWatchedAt = new Date(item.watched_at)
          const localUpdatedAt = existing.updated_at ? new Date(existing.updated_at) : null
          
          if (!localUpdatedAt || traktWatchedAt > localUpdatedAt) {
            // Use markAsWatched to update the record
            watchHistoryDb.markAsWatched(
              profileId,
              localItem.meta_id,
              localItem.meta_type,
              true,
              localItem.season !== -1 ? localItem.season : undefined,
              localItem.episode !== -1 ? localItem.episode : undefined
            )
            result.updated++
          }
        } else {
          // Add new entry using upsert
          watchHistoryDb.upsert({
            profile_id: profileId,
            meta_id: localItem.meta_id,
            meta_type: localItem.meta_type,
            season: localItem.season,
            episode: localItem.episode,
            title: localItem.title,
            duration: 0,
            position: 0
          })
          // Mark as watched
          watchHistoryDb.markAsWatched(
            profileId,
            localItem.meta_id,
            localItem.meta_type,
            true,
            localItem.season !== -1 ? localItem.season : undefined,
            localItem.episode !== -1 ? localItem.episode : undefined
          )
          result.added++
        }
      }

      console.log(`[TraktSync] Pulled ${result.added} new, ${result.updated} updated items from Trakt`)
      return result
    } catch (error) {
      console.error('[TraktSync] Pull failed:', error)
      throw error
    }
  }

  // Push local watch history → Trakt
  private async pushHistory(
    profileId: number,
    accessToken: string,
    lastPush?: string | null
  ): Promise<{ synced: number }> {
    const result = { synced: 0 }

    try {
      // Get local watched items - using getByProfileId which returns recent items
      const localHistory = watchHistoryDb.getByProfileId(profileId)
      
      console.log(`[TraktSync] Local history has ${localHistory.length} items`)
      
      // Filter to items that are marked as watched and newer than last push
      const toSync = localHistory.filter((item: WatchHistoryItem) => {
        if (!item.is_watched) return false
        if (!lastPush) return true
        
        const itemUpdated = new Date(item.updated_at || item.watched_at || 0)
        return itemUpdated > new Date(lastPush)
      })

      console.log(`[TraktSync] ${toSync.length} items marked as watched to potentially sync (lastPush: ${lastPush})`)

      if (toSync.length === 0) {
        return result
      }

      // Build sync request - using 'shows' format for episodes (with nested seasons)
      const movies: { watched_at: string; ids: TraktIds }[] = []
      
      // Group episodes by show, then by season
      const showMap = new Map<string, Map<number, { number: number; watched_at: string }[]>>()

      for (const item of toSync) {
        // Skip items without IMDB ID
        if (!item.meta_id?.startsWith('tt')) {
          console.log(`[TraktSync] Skipping item ${item.meta_id} - no IMDB ID`)
          continue
        }

        if (item.meta_type === 'movie') {
          movies.push({
            watched_at: item.watched_at || new Date().toISOString(),
            ids: { imdb: item.meta_id }
          })
        } else if (item.meta_type === 'series' && item.season !== undefined && item.episode !== undefined && item.episode > 0) {
          const showId = item.meta_id
          if (!showMap.has(showId)) {
            showMap.set(showId, new Map())
          }
          const seasonMap = showMap.get(showId)!
          if (!seasonMap.has(item.season)) {
            seasonMap.set(item.season, [])
          }
          seasonMap.get(item.season)!.push({
            number: item.episode,
            watched_at: item.watched_at || new Date().toISOString()
          })
          console.log(`[TraktSync] Adding episode ${item.meta_id} S${item.season}E${item.episode}`)
        }
      }

      // Build shows array from the map
      const shows: TraktSyncRequest['shows'] = []
      for (const [showId, seasonMap] of showMap) {
        const seasons: { number: number; episodes: { number: number; watched_at: string }[] }[] = []
        for (const [seasonNum, episodes] of seasonMap) {
          seasons.push({
            number: seasonNum,
            episodes: episodes
          })
        }
        shows.push({
          ids: { imdb: showId },
          seasons: seasons
        })
      }

      const syncRequest: TraktSyncRequest = { movies, shows }
      const totalEpisodes = Array.from(showMap.values()).reduce((sum, s) => 
        sum + Array.from(s.values()).reduce((eSum, eps) => eSum + eps.length, 0), 0)
      
      console.log(`[TraktSync] Request has ${movies.length} movies, ${shows.length} shows with ${totalEpisodes} episodes`)
      
      const hasItems = movies.length > 0 || shows.length > 0
      if (hasItems) {
        const response = await traktClient.addToHistory(accessToken, syncRequest)
        result.synced = (response.added?.movies || 0) + (response.added?.episodes || 0)
        console.log(`[TraktSync] Pushed ${result.synced} items to Trakt`, response)
      }

      return result
    } catch (error) {
      console.error('[TraktSync] Push failed:', error)
      throw error
    }
  }

  // Convert Trakt history item to local format
  private convertTraktToLocal(item: TraktHistoryItem, profileId: number): {
    meta_id: string
    meta_type: 'movie' | 'series'
    season: number
    episode: number
    title?: string
    duration?: number
  } | null {
    if (item.type === 'movie' && item.movie) {
      const imdbId = item.movie.ids.imdb
      if (!imdbId) return null

      return {
        meta_id: imdbId,
        meta_type: 'movie',
        title: item.movie.title,
        season: -1,
        episode: -1
      }
    } else if (item.type === 'episode' && item.episode && item.show) {
      const imdbId = item.show.ids.imdb
      if (!imdbId) return null

      return {
        meta_id: imdbId,
        meta_type: 'series',
        season: item.episode.season,
        episode: item.episode.number,
        title: item.episode.title
      }
    }

    return null
  }

  // Convert local watch history item to Trakt format
  private convertLocalToTrakt(item: WatchHistoryItem): { ids: TraktIds } | null {
    // Our meta_id should be an IMDB ID
    if (!item.meta_id?.startsWith('tt')) {
      return null
    }

    return {
      ids: {
        imdb: item.meta_id
      }
    }
  }
}

export const traktSyncService = new TraktSyncService()
