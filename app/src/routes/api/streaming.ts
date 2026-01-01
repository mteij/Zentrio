import { Hono } from 'hono'
import { addonManager } from '../../services/addons/addon-manager'
import { streamDb, watchHistoryDb, profileDb, addonDb, listDb, userDb, type User } from '../../services/database'
import { sessionMiddleware, optionalSessionMiddleware } from '../../middleware/session'
import { ok, err } from '../../utils/api'
import { streamCache, StreamCache } from '../../services/addons/stream-cache'

const streaming = new Hono<{
  Variables: {
    user: User | null
    guestMode: boolean
    session: any
  }
}>()

// Helper to find and add next episode to continue watching
async function ensureNextEpisodeInContinueWatching(
  profileId: number, 
  metaId: string, 
  currentSeason: number, 
  currentEpisode: number
) {
  try {
    console.log(`[NextEpisode] Checking next episode for ${metaId} after S${currentSeason}E${currentEpisode}`)
    
    // 1. Get metadata to find next episode
    // We assume 'series' type because only series have next episodes
    const meta = await addonManager.getMeta('series', metaId, profileId)
    if (!meta) {
        console.log(`[NextEpisode] No metadata found for ${metaId}`)
        return
    }
    if (!meta.videos || meta.videos.length === 0) {
        console.log(`[NextEpisode] No videos found in metadata for ${metaId}`)
        return
    }

    // 2. Find current video index
    const sortedVideos = meta.videos.sort((a: any, b: any) => {
      if (a.season !== b.season) return a.season - b.season
      return a.episode - b.episode
    })

    const currentIndex = sortedVideos.findIndex((v: any) => v.season === currentSeason && v.episode === currentEpisode)
    console.log(`[NextEpisode] Current index: ${currentIndex} / ${sortedVideos.length}`)
    
    // 3. Get next video if exists
    if (currentIndex !== -1 && currentIndex < sortedVideos.length - 1) {
      const nextVideo = sortedVideos[currentIndex + 1]
      console.log(`[NextEpisode] Found next video: S${nextVideo.season}E${nextVideo.episode}`)
      
      // 4. Check if next video is already in history (started or watched)
      const existingProgress = watchHistoryDb.getProgress(
        profileId, 
        metaId, 
        nextVideo.season, 
        nextVideo.episode
      )

      // Only insert if NO progress exists OR if it exists but is effectively empty (not watched, no position)
      // This ensures we bump it to the top of "Continue Watching" even if a placeholder existed
      if (!existingProgress || (!existingProgress.is_watched && !existingProgress.position)) {
        
        watchHistoryDb.upsert({
          profile_id: profileId,
          meta_id: metaId,
          meta_type: 'series',
          season: nextVideo.season,
          episode: nextVideo.episode,
          episode_id: nextVideo.id,
          title: nextVideo.title || `Episode ${nextVideo.episode}`,
          poster: meta.poster, // Series poster
          duration: 0,
          position: 0,
          last_stream: null
        })
      }
    } else {
        console.log(`[NextEpisode] No next video found (last episode?)`)
    }
  } catch (e) {
    console.error('[NextEpisode] Failed to ensure next episode:', e)
  }
}

streaming.get('/settings', sessionMiddleware, async (c) => {
  try {
    const { profileId, settingsProfileId: querySettingsProfileId } = c.req.query()
    const user = c.get('user')
    if (!user) return err(c, 401, 'UNAUTHORIZED', 'Authentication required')

    let settingsProfileId: number;

    if (querySettingsProfileId) {
        settingsProfileId = parseInt(querySettingsProfileId);
    } else {
        let pId: number;
        if (profileId) {
            pId = parseInt(profileId)
        } else {
            // Fallback to default profile
            let profile = profileDb.getDefault(user.id)
            if (!profile) {
                const profiles = profileDb.findByUserId(user.id)
                if (profiles && profiles.length > 0) {
                    profile = profiles[0]
                }
            }
            if (!profile) return err(c, 404, 'PROFILE_NOT_FOUND', 'No profile found')
            pId = profile.id
        }
        
        const resolved = profileDb.getSettingsProfileId(pId);
        if (!resolved) return err(c, 404, 'SETTINGS_PROFILE_NOT_FOUND', 'Settings profile not found')
        settingsProfileId = resolved;
    }

    const settings = streamDb.getSettings(settingsProfileId)
    return c.json({ data: settings })
  } catch (e) {
    console.error('Failed to get streaming settings', e)
    return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
  }
})

streaming.put('/settings', sessionMiddleware, async (c) => {
  try {
    const { profileId, settingsProfileId: querySettingsProfileId } = c.req.query()
    const user = c.get('user')
    if (!user) return err(c, 401, 'UNAUTHORIZED', 'Authentication required')

    let settingsProfileId: number;

    if (querySettingsProfileId) {
        settingsProfileId = parseInt(querySettingsProfileId);
    } else {
        let pId: number;
        if (profileId) {
            pId = parseInt(profileId)
        } else {
            // Fallback to default profile
            let profile = profileDb.getDefault(user.id)
            if (!profile) {
                const profiles = profileDb.findByUserId(user.id)
                if (profiles && profiles.length > 0) {
                    profile = profiles[0]
                }
            }
            if (!profile) return err(c, 404, 'PROFILE_NOT_FOUND', 'No profile found')
            pId = profile.id
        }
        
        const resolved = profileDb.getSettingsProfileId(pId);
        if (!resolved) return err(c, 404, 'SETTINGS_PROFILE_NOT_FOUND', 'Settings profile not found')
        settingsProfileId = resolved;
    }

    const settings = await c.req.json()
    streamDb.saveSettings(settingsProfileId, settings)
    return c.json({ success: true })
  } catch (e) {
    console.error('Failed to save streaming settings', e)
    return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
  }
})

streaming.get('/streams/:type/:id', async (c) => {
  const { type, id } = c.req.param()
  const { profileId, season, episode } = c.req.query()
  const userAgent = c.req.header('user-agent') || ''
  const isApp = userAgent.includes('Tauri') || userAgent.includes('Capacitor') || userAgent.includes('ZentrioApp')
  const platform = isApp ? 'app' : 'web'
  
  const streams = await addonManager.getStreams(type, id, parseInt(profileId), season ? parseInt(season) : undefined, episode ? parseInt(episode) : undefined, platform)
  return c.json({ streams })
})

/**
 * SSE endpoint for progressive stream loading.
 * Streams addon results as they arrive instead of waiting for all addons.
 * Uses StreamProcessor for proper filtering, sorting, and deduplication.
 * 
 * Events:
 * - addon-start: { addon: { id, name, logo } } - Addon started loading
 * - addon-result: { addon: { id, name, logo }, count, allStreams: [...] } - Addon returned streams
 * - addon-error: { addon: { id, name, logo }, error: string } - Addon failed
 * - complete: { allStreams: [...], totalCount } - All addons finished
 */
streaming.get('/streams-live/:type/:id', async (c) => {
  const { type, id } = c.req.param()
  const { profileId, season, episode, refresh } = c.req.query()
  const userAgent = c.req.header('user-agent') || ''
  const isApp = userAgent.includes('Tauri') || userAgent.includes('Capacitor') || userAgent.includes('ZentrioApp')
  const platform = isApp ? 'app' : 'web'

  // Set SSE headers
  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')
  c.header('Connection', 'keep-alive')
  c.header('X-Accel-Buffering', 'no') // Disable nginx buffering

  // Get stream processor settings for this profile
  const settingsProfileId = profileDb.getSettingsProfileId(parseInt(profileId))
  const settings = settingsProfileId ? streamDb.getSettings(settingsProfileId) : undefined
  
  // Build cache key
  const cacheKey = StreamCache.buildKey(
    type, 
    id, 
    parseInt(profileId), 
    season ? parseInt(season) : undefined, 
    episode ? parseInt(episode) : undefined
  )
  
  // Check cache unless refresh=true
  const forceRefresh = refresh === 'true'
  if (forceRefresh) {
    streamCache.invalidate(cacheKey)
  }

  // Create a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      let isClosed = false
      
      const sendEvent = (event: string, data: any) => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch (e) {
          isClosed = true
        }
      }
      
      const closeController = () => {
        if (isClosed) return
        isClosed = true
        try {
          controller.close()
        } catch (e) {
          // Already closed
        }
      }
      
      // Check for cached results first
      const cached = streamCache.get(cacheKey)
      if (cached && cached.isComplete) {
        const cacheAge = streamCache.getAge(cacheKey) || 0
        sendEvent('cache-status', { fromCache: true, cacheAgeMs: cacheAge })
        sendEvent('complete', {
          allStreams: cached.streams,
          totalCount: cached.streams.length,
          fromCache: true
        })
        closeController()
        return
      }
      
      // Collect all raw results as they come in
      const rawResults: { addon: { id: string, name: string, logo?: string }, streams: any[] }[] = []
      
      // Meta for processing
      let meta: any = null
      try {
        meta = await addonManager.getMeta(type, id, parseInt(profileId))
      } catch (e) {
        // Fallback minimal meta
        meta = { id, type, name: 'Unknown' }
      }
      
      // Send cache-status event for fresh fetch
      sendEvent('cache-status', { fromCache: false, cacheAgeMs: 0 })
      
      // Process all collected streams using StreamProcessor
      const processStreams = () => {
        if (!settings) {
          // No settings - just flatten and assign sortIndex
          const allStreams: any[] = []
          rawResults.forEach(r => {
            r.streams.forEach(s => {
              allStreams.push({ stream: s, addon: r.addon })
            })
          })
          return allStreams.map((item, index) => {
            if (!item.stream.behaviorHints) item.stream.behaviorHints = {}
            item.stream.behaviorHints.sortIndex = index
            return { stream: item.stream, addon: item.addon }
          })
        }

        // Use StreamProcessor for proper filtering, sorting, deduplication
        const { StreamProcessor } = require('../../services/addons/stream-processor')
        const processor = new StreamProcessor(settings, platform)
        
        // Flatten all streams for processing
        const flatStreams = rawResults.flatMap(r => 
          r.streams.map(s => ({ 
            stream: s, 
            addon: { id: r.addon.id, name: r.addon.name, logo: r.addon.logo, version: '', description: '', resources: [], types: [], catalogs: [] }
          }))
        )
        
        // Process through StreamProcessor (filter, sort, dedupe, limit)
        const processed = processor.process(flatStreams, meta)
        
        // Assign sortIndex and format for frontend with parsed metadata
        return processed.map((p: any, index: number) => {
          if (!p.original.behaviorHints) p.original.behaviorHints = {}
          p.original.behaviorHints.sortIndex = index
          return {
            stream: p.original,
            addon: { id: p.addon.id, name: p.addon.name, logo: p.addon.logo || p.addon.logo_url },
            parsed: {
              resolution: p.parsed.resolution,
              encode: p.parsed.encode,
              audioTags: p.parsed.audioTags,
              audioChannels: p.parsed.audioChannels,
              visualTags: p.parsed.visualTags,
              sourceType: p.parsed.sourceType,
              seeders: p.parsed.seeders,
              size: p.parsed.size,
              languages: p.parsed.languages,
              isCached: p.parsed.isCached
            }
          }
        })
      }

      try {
        await addonManager.getStreamsProgressive(
          type,
          id,
          parseInt(profileId),
          season ? parseInt(season) : undefined,
          episode ? parseInt(episode) : undefined,
          platform,
          {
            onAddonStart: (addon) => {
              sendEvent('addon-start', {
                addon: { id: addon.id, name: addon.name, logo: addon.logo || addon.logo_url }
              })
            },
            onAddonResult: (addon, streams) => {
              // Add to collected results
              rawResults.push({
                addon: { id: addon.id, name: addon.name, logo: addon.logo || addon.logo_url },
                streams
              })
              
              // Process ALL collected streams using StreamProcessor
              const sortedStreams = processStreams()
              
              sendEvent('addon-result', {
                addon: { id: addon.id, name: addon.name, logo: addon.logo || addon.logo_url },
                count: streams.length,
                // Send the full sorted stream list
                allStreams: sortedStreams
              })
            },
            onAddonError: (addon, error) => {
              sendEvent('addon-error', {
                addon: { id: addon.id, name: addon.name, logo: addon.logo || addon.logo_url },
                error
              })
            }
          }
        )

        // All addons finished - send final processed list
        const finalStreams = processStreams()
        
        // Store in cache
        streamCache.set(
          cacheKey, 
          finalStreams, 
          true, 
          rawResults.map(r => r.addon.id)
        )
        
        sendEvent('complete', { 
          allStreams: finalStreams,
          totalCount: finalStreams.length,
          fromCache: false
        })
        closeController()
      } catch (e) {
        console.error('SSE stream error:', e)
        sendEvent('error', { message: e instanceof Error ? e.message : 'Unknown error' })
        closeController()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
})

streaming.get('/subtitles/:type/:id', async (c) => {
  const { type, id } = c.req.param()
  const { profileId, videoHash } = c.req.query()
  
  if (!profileId) {
    return c.json({ subtitles: [] })
  }
  
  try {
    const results = await addonManager.getSubtitles(type, id, parseInt(profileId), videoHash)
    // Flatten subtitles from all addons into a single list with addon info
    const subtitles = results.flatMap(r => 
      r.subtitles.map(s => ({
        ...s,
        addonName: r.addon.name
      }))
    )
    return c.json({ subtitles })
  } catch (e) {
    console.error('Subtitles API error:', e)
    return c.json({ subtitles: [] })
  }
})

streaming.get('/search', async (c) => {
  const { q, profileId, type, year, sort } = c.req.query()
  if (!q || !profileId) return c.json({ results: [] })
  
  try {
    const filters = {
        type: type !== 'undefined' ? type : undefined,
        year: year !== 'undefined' ? year : undefined,
        sort: sort !== 'undefined' ? sort : undefined
    }
    const results = await addonManager.search(q, parseInt(profileId), filters)
    return c.json({ results })
  } catch (e) {
    console.error('Search API error:', e)
    return c.json({ results: [] })
  }
})

streaming.get('/catalog', async (c) => {
  const { profileId, manifestUrl, type, id, skip, genre } = c.req.query()
  const pId = parseInt(profileId)
  const skipNum = skip ? parseInt(skip) : 0

  try {
    let items: any[] = []
    if (manifestUrl && type && id) {
      const result = await addonManager.getCatalogItems(pId, decodeURIComponent(manifestUrl), type, id, skipNum)
      items = result ? result.items : []
      const title = result ? result.title : ''
      return c.json({ items, title })
    } else if (type || genre) {
      const targetType = type || 'movie,series'
      items = await addonManager.getFilteredItems(pId, targetType, genre, skipNum)
      return c.json({ items })
    }
    return c.json({ items })
  } catch (e) {
    console.error('Failed to fetch catalog items', e)
    return c.json({ items: [] })
  }
})

/**
 * Lazy loading endpoint - fetches items for a single catalog
 * Used by LazyCatalogRow component to load each catalog independently
 */
streaming.get('/catalog-items', async (c) => {
  const { profileId, manifestUrl, type, id } = c.req.query()
  
  if (!profileId || !manifestUrl || !type || !id) {
    return c.json({ items: [], error: 'Missing required parameters' })
  }

  try {
    const items = await addonManager.getSingleCatalog(
      parseInt(profileId),
      manifestUrl,
      type,
      id
    )
    return c.json({ items })
  } catch (e) {
    console.error(`Failed to fetch catalog items for ${id}`, e)
    return c.json({ items: [] })
  }
})


streaming.post('/progress', async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, metaId, metaType, season, episode, episodeId, title, poster, duration, position } = body
    
    if (!profileId || !metaId || !metaType) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    watchHistoryDb.upsert({
      profile_id: parseInt(profileId),
      meta_id: metaId,
      meta_type: metaType,
      season: season !== undefined ? parseInt(season) : undefined,
      episode: episode !== undefined ? parseInt(episode) : undefined,
      episode_id: episodeId,
      title,
      poster,
      duration,
      position,
      last_stream: body.lastStream
    })

    // Auto-mark as watched if position >= 80% of duration (matches Trakt's threshold)
    if (duration && position && position >= duration * 0.8) {
      watchHistoryDb.autoMarkWatched(
        parseInt(profileId),
        metaId,
        season !== undefined ? parseInt(season) : undefined,
        episode !== undefined ? parseInt(episode) : undefined
      )

      // Auto-add next episode if this is a series
      if (metaType === 'series' && season !== undefined && episode !== undefined) {
         // Run in background
         ensureNextEpisodeInContinueWatching(
            parseInt(profileId),
            metaId,
            parseInt(season),
            parseInt(episode)
         )
      }
    }

    return c.json({ success: true })
  } catch (e) {
    console.error('Failed to save progress', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

streaming.delete('/progress/:type/:id', async (c) => {
  try {
    const { type, id } = c.req.param()
    const { profileId, season, episode } = c.req.query()
    
    if (!profileId) {
      return c.json({ error: 'Missing defined profileId' }, 400)
    }

    const pId = parseInt(profileId)

    if (type === 'series' && season === undefined && episode === undefined) {
      // Delete ALL history for this series
      watchHistoryDb.deleteAllForSeries(pId, id)
    } else {
      watchHistoryDb.delete(
        pId,
        id,
        season ? parseInt(season) : undefined,
        episode ? parseInt(episode) : undefined
      )
    }

    return c.json({ success: true })
  } catch (e) {
    console.error('Failed to delete progress', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get watch progress for a specific item
streaming.get('/progress/:type/:id', async (c) => {
  try {
    const { type, id } = c.req.param()
    const { profileId, season, episode } = c.req.query()
    
    if (!profileId) {
      return c.json({ error: 'profileId required' }, 400)
    }

    const progress = watchHistoryDb.getProgress(
      parseInt(profileId),
      id,
      season ? parseInt(season) : undefined,
      episode ? parseInt(episode) : undefined
    )

    return c.json({ progress: progress || null })
  } catch (e) {
    console.error('Failed to get progress', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get series watch progress (all episodes)
streaming.get('/series-progress/:id', async (c) => {
  try {
    const { id } = c.req.param()
    const { profileId } = c.req.query()
    
    if (!profileId) {
      return c.json({ error: 'profileId required' }, 400)
    }

    const pId = parseInt(profileId)
    const episodeProgress = watchHistoryDb.getSeriesProgress(pId, id)
    const lastWatched = watchHistoryDb.getLastWatchedEpisode(pId, id)

    return c.json({
      episodeProgress,
      lastWatched: lastWatched ? { season: lastWatched.season, episode: lastWatched.episode } : null
    })
  } catch (e) {
    console.error('Failed to get series progress', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Mark item as watched/unwatched
streaming.post('/mark-watched', async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, metaId, metaType, season, episode, watched } = body
    
    if (!profileId || !metaId || !metaType || watched === undefined) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const pId = parseInt(profileId)
    
    watchHistoryDb.markAsWatched(
      pId,
      metaId,
      metaType,
      watched,
      episode !== undefined ? parseInt(episode) : undefined
    )

    // If unmarking an episode, ensure the SERIES container is also unmarked
    if (!watched && metaType === 'series') {
        watchHistoryDb.markAsWatched(pId, metaId, 'series', false, -1, -1)
    }

    // Auto-add next episode if marking as watched for a series episode
    if (watched && metaType === 'series' && season !== undefined && episode !== undefined) {
        ensureNextEpisodeInContinueWatching(
            pId,
            metaId,
            parseInt(season),
            parseInt(episode)
        )
    }

    // Sync to Trakt if connected and item has IMDB ID
    let traktSynced = false
    if (metaId.startsWith('tt')) {
      const { traktAccountDb } = await import('../../services/database')
      const account = traktAccountDb.getByProfileId(pId)
      
      if (account) {
        try {
          let accessToken = account.access_token
          
          // Refresh token if expired
          if (traktAccountDb.isTokenExpired(pId)) {
            const { traktClient } = await import('../../services/trakt')
            const newTokens = await traktClient.refreshAccessToken(account.refresh_token)
            const expiresAt = new Date((newTokens.created_at + newTokens.expires_in) * 1000)
            traktAccountDb.updateTokens(pId, newTokens.access_token, newTokens.refresh_token, expiresAt)
            accessToken = newTokens.access_token
          }

          const { traktClient } = await import('../../services/trakt')
          
          if (watched) {
            // Add to Trakt history
            if (metaType === 'movie') {
              await traktClient.addToHistory(accessToken, {
                movies: [{ ids: { imdb: metaId }, watched_at: new Date().toISOString() }]
              })
            } else if (metaType === 'series' && season !== undefined && episode !== undefined) {
              await traktClient.addToHistory(accessToken, {
                shows: [{
                  ids: { imdb: metaId },
                  seasons: [{
                    number: parseInt(season),
                    episodes: [{ number: parseInt(episode), watched_at: new Date().toISOString() }]
                  }]
                }]
              })
            }
            traktSynced = true
            console.log(`[Trakt] Pushed watched: ${metaId} S${season}E${episode}`)
          } else {
            // Remove from Trakt history
            if (metaType === 'movie') {
              await traktClient.removeFromHistory(accessToken, {
                movies: [{ ids: { imdb: metaId } }]
              })
            } else if (metaType === 'series' && season !== undefined && episode !== undefined) {
              await traktClient.removeFromHistory(accessToken, {
                shows: [{
                  ids: { imdb: metaId },
                  seasons: [{
                    number: parseInt(season),
                    episodes: [{ number: parseInt(episode) }]
                  }]
                }]
              })
            }
            traktSynced = true
            console.log(`[Trakt] Removed unwatched: ${metaId} S${season}E${episode}`)
          }
        } catch (e) {
          console.error('[Trakt] Failed to sync mark-watched:', e)
          // Don't fail the request, local change still succeeded
        }
      }
    }

    return c.json({ success: true, traktSynced })
  } catch (e) {
    console.error('Failed to mark as watched', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Mark entire season as watched/unwatched
streaming.post('/mark-season-watched', async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, metaId, metaType, season, watched, episodes } = body
    
    if (!profileId || !metaId || !metaType || season === undefined || watched === undefined || !episodes) {
      return c.json({ error: 'Missing required fields (need episodes array)' }, 400)
    }

    const pId = parseInt(profileId)
    
    watchHistoryDb.markSeasonWatched(
      pId,
      metaId,
      metaType,
      parseInt(season),
      watched,
      episodes.map((e: number) => parseInt(String(e)))
    )

    // Sync to Trakt if connected
    let traktSynced = false
    if (metaId.startsWith('tt')) {
      const { traktAccountDb } = await import('../../services/database')
      const account = traktAccountDb.getByProfileId(pId)
      
      if (account) {
        try {
          let accessToken = account.access_token
          if (traktAccountDb.isTokenExpired(pId)) {
            const { traktClient } = await import('../../services/trakt')
            const newTokens = await traktClient.refreshAccessToken(account.refresh_token)
            const expiresAt = new Date((newTokens.created_at + newTokens.expires_in) * 1000)
            traktAccountDb.updateTokens(pId, newTokens.access_token, newTokens.refresh_token, expiresAt)
            accessToken = newTokens.access_token
          }

          const { traktClient } = await import('../../services/trakt')
          const seasonData = {
            number: parseInt(season),
            episodes: episodes.map((ep: number) => ({ number: parseInt(String(ep)), watched_at: new Date().toISOString() }))
          }
          
          if (watched) {
            await traktClient.addToHistory(accessToken, {
              shows: [{ ids: { imdb: metaId }, seasons: [seasonData] }]
            })
          } else {
            await traktClient.removeFromHistory(accessToken, {
              shows: [{ ids: { imdb: metaId }, seasons: [{ number: parseInt(season), episodes: episodes.map((ep: number) => ({ number: parseInt(String(ep)) })) }] }]
            })
          }
          traktSynced = true
          console.log(`[Trakt] ${watched ? 'Pushed' : 'Removed'} season ${season} (${episodes.length} episodes)`)
        } catch (e) {
          console.error('[Trakt] Failed to sync season watched:', e)
        }
      }
    }

    return c.json({ success: true, traktSynced })
  } catch (e) {
    console.error('Failed to mark season as watched', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Mark entire series as watched/unwatched (all episodes)
streaming.post('/mark-series-watched', async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, metaId, watched, allEpisodes } = body
    
    if (!profileId || !metaId || watched === undefined || !allEpisodes) {
      return c.json({ error: 'Missing required fields (need allEpisodes array)' }, 400)
    }

    const pId = parseInt(profileId)
    
    // Mark each episode
    for (const ep of allEpisodes) {
      watchHistoryDb.markAsWatched(
        pId,
        metaId,
        'series',
        watched,
        ep.season,
        ep.episode
      )
    }

    // Also mark the SERIES container as watched/unwatched
    // This allows showing the checkmark on the series card itself
    watchHistoryDb.markAsWatched(
        pId, 
        metaId, 
        'series', 
        watched, 
        -1, 
        -1
    )

    // Sync to Trakt if connected
    let traktSynced = false
    if (metaId.startsWith('tt') && allEpisodes.length > 0) {
      const { traktAccountDb } = await import('../../services/database')
      const account = traktAccountDb.getByProfileId(pId)
      
      if (account) {
        try {
          let accessToken = account.access_token
          if (traktAccountDb.isTokenExpired(pId)) {
            const { traktClient } = await import('../../services/trakt')
            const newTokens = await traktClient.refreshAccessToken(account.refresh_token)
            const expiresAt = new Date((newTokens.created_at + newTokens.expires_in) * 1000)
            traktAccountDb.updateTokens(pId, newTokens.access_token, newTokens.refresh_token, expiresAt)
            accessToken = newTokens.access_token
          }

          const { traktClient } = await import('../../services/trakt')
          
          // Group episodes by season
          const seasonMap = new Map<number, { number: number; watched_at?: string }[]>()
          for (const ep of allEpisodes) {
            if (!seasonMap.has(ep.season)) seasonMap.set(ep.season, [])
            seasonMap.get(ep.season)!.push(watched ? { number: ep.episode, watched_at: new Date().toISOString() } : { number: ep.episode })
          }
          
          const seasons = Array.from(seasonMap.entries()).map(([num, eps]) => ({ number: num, episodes: eps }))
          
          if (watched) {
            await traktClient.addToHistory(accessToken, {
              shows: [{ ids: { imdb: metaId }, seasons }]
            })
          } else {
            await traktClient.removeFromHistory(accessToken, {
              shows: [{ ids: { imdb: metaId }, seasons }]
            })
          }
          traktSynced = true
          console.log(`[Trakt] ${watched ? 'Pushed' : 'Removed'} entire series (${allEpisodes.length} episodes)`)
        } catch (e) {
          console.error('[Trakt] Failed to sync series watched:', e)
        }
      }
    }

    return c.json({ success: true, traktSynced, episodesUpdated: allEpisodes.length })
  } catch (e) {
    console.error('Failed to mark series as watched', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Mark all episodes before a specific episode as watched
streaming.post('/mark-episodes-before', async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, metaId, season, episode, watched, allEpisodes } = body
    
    if (!profileId || !metaId || season === undefined || episode === undefined || watched === undefined || !allEpisodes) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const pId = parseInt(profileId)
    
    // Filter episodes that come before the target episode
    const episodesToMark = allEpisodes.filter((ep: { season: number; episode: number }) => {
      if (ep.season < season) return true
      if (ep.season === season && ep.episode < episode) return true
      return false
    })
    
    // Mark each episode
    for (const ep of episodesToMark) {
      watchHistoryDb.markAsWatched(
        pId,
        metaId,
        'series',
        watched,
        ep.season,
        ep.episode
      )
    }

    // If unmarking episodes, ensure the SERIES container is also unmarked
    if (!watched) {
        watchHistoryDb.markAsWatched(pId, metaId, 'series', false, -1, -1)
    }

    // Sync to Trakt if connected
    let traktSynced = false
    if (metaId.startsWith('tt') && episodesToMark.length > 0) {
      const { traktAccountDb } = await import('../../services/database')
      const account = traktAccountDb.getByProfileId(pId)
      
      if (account) {
        try {
          let accessToken = account.access_token
          if (traktAccountDb.isTokenExpired(pId)) {
            const { traktClient } = await import('../../services/trakt')
            const newTokens = await traktClient.refreshAccessToken(account.refresh_token)
            const expiresAt = new Date((newTokens.created_at + newTokens.expires_in) * 1000)
            traktAccountDb.updateTokens(pId, newTokens.access_token, newTokens.refresh_token, expiresAt)
            accessToken = newTokens.access_token
          }

          const { traktClient } = await import('../../services/trakt')
          
          // Group episodes by season
          const seasonMap = new Map<number, { number: number; watched_at?: string }[]>()
          for (const ep of episodesToMark) {
            if (!seasonMap.has(ep.season)) seasonMap.set(ep.season, [])
            seasonMap.get(ep.season)!.push(watched ? { number: ep.episode, watched_at: new Date().toISOString() } : { number: ep.episode })
          }
          
          const seasons = Array.from(seasonMap.entries()).map(([num, eps]) => ({ number: num, episodes: eps }))
          
          if (watched) {
            await traktClient.addToHistory(accessToken, {
              shows: [{ ids: { imdb: metaId }, seasons }]
            })
          } else {
            await traktClient.removeFromHistory(accessToken, {
              shows: [{ ids: { imdb: metaId }, seasons }]
            })
          }
          traktSynced = true
          console.log(`[Trakt] ${watched ? 'Pushed' : 'Removed'} ${episodesToMark.length} episodes before S${season}E${episode}`)
        } catch (e) {
          console.error('[Trakt] Failed to sync episodes before:', e)
        }
      }
    }

    return c.json({ success: true, traktSynced, episodesUpdated: episodesToMark.length })
  } catch (e) {
    console.error('Failed to mark episodes before', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})


streaming.get('/details/:type/:id', sessionMiddleware, async (c) => {
  const { type, id } = c.req.param()
  const { profileId, metaFallback } = c.req.query()
  const pId = parseInt(profileId)
  
  try {
    let meta = await addonManager.getMeta(type, id, pId)
    
    // If getMeta returns null and we have fallback data from catalog, use it
    if (!meta && metaFallback) {
      try {
        const fallbackData = JSON.parse(decodeURIComponent(metaFallback))
        // Construct minimal MetaDetail from catalog item data
        meta = {
          id: fallbackData.id || id,
          type: fallbackData.type || type,
          name: fallbackData.name || 'Unknown',
          poster: fallbackData.poster,
          background: fallbackData.background,
          description: fallbackData.description,
          releaseInfo: fallbackData.releaseInfo,
          imdbRating: fallbackData.imdbRating,
          // Add any other fields from catalog item
          ...(fallbackData.genres && { genres: fallbackData.genres }),
          ...(fallbackData.released && { released: fallbackData.released }),
        }
        console.log(`[Streaming] Using fallback meta for ${type}/${id}:`, meta.name)
      } catch (e) {
        console.warn('Failed to parse metaFallback:', e)
      }
    }
    
    if (!meta) return err(c, 404, 'NOT_FOUND', 'Content not found')
    
    const inLibrary = listDb.isInAnyList(pId, id)
    
    // For movies, get watch progress
    let watchProgress = null
    let seriesProgress = null
    let lastWatchedEpisode = null
    
    if (type === 'movie') {
      const progress = watchHistoryDb.getProgress(pId, id)
      if (progress) {
        watchProgress = {
          position: progress.position,
          duration: progress.duration,
          progressPercent: progress.duration && progress.duration > 0 && progress.position 
            ? Math.min(100, Math.round((progress.position / progress.duration) * 100)) 
            : 0,
          isWatched: progress.is_watched
        }
      }
    } else if (type === 'series') {
      // Get all episode progress for series
      const episodeProgress = watchHistoryDb.getSeriesProgress(pId, id)
      const lastWatched = watchHistoryDb.getLastWatchedEpisode(pId, id)
      
      // Create a map of episode progress keyed by "season-episode"
      seriesProgress = episodeProgress.reduce((acc, ep) => {
        if (ep.season !== undefined && ep.episode !== undefined) {
          const key = `${ep.season}-${ep.episode}`
          acc[key] = {
            position: ep.position,
            duration: ep.duration,
            progressPercent: ep.duration && ep.duration > 0 && ep.position 
              ? Math.min(100, Math.round((ep.position / ep.duration) * 100)) 
              : 0,
            isWatched: ep.is_watched
          }
        }
        return acc
      }, {} as Record<string, any>)
      
      if (lastWatched) {
        lastWatchedEpisode = {
          season: lastWatched.season,
          episode: lastWatched.episode
        }
      }
    }
    
    return c.json({ meta, inLibrary, watchProgress, seriesProgress, lastWatchedEpisode })
  } catch (e) {
    console.error('Streaming details error:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to load content')
  }
})

streaming.get('/filters', sessionMiddleware, async (c) => {
  const { profileId } = c.req.query()
  const pId = parseInt(profileId)
  
  try {
    const filters = await addonManager.getAvailableFilters(pId)
    return c.json({ filters })
  } catch (e) {
    console.error('Streaming filters error:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to load filters')
  }
})
streaming.get('/dashboard', optionalSessionMiddleware, async (c) => {
  try {
    const { profileId } = c.req.query()
    const isGuestMode = c.get('guestMode') as boolean
    const user = c.get('user')
    
    // Guest mode handling: get/create the guest user's default profile
    if (isGuestMode || profileId === 'guest') {
      // Ensure guest user and default profile exist
      const guestDefaultProfile = await userDb.ensureGuestDefaultProfile()
      const pId = guestDefaultProfile.id
      
      const profile = profileDb.findWithSettingsById(pId)
      if (!profile) return err(c, 404, 'PROFILE_NOT_FOUND', 'Guest profile not found')

      // Get real data for the guest profile
      const rawHistory = watchHistoryDb.getByProfileId(pId)
      
      // Apply same history filtering as connected mode
      const MIN_SECONDS_THRESHOLD = 120
      const MIN_PERCENT_THRESHOLD = 5
      const COMPLETED_PERCENT_THRESHOLD = 90
      
      const filteredHistory = rawHistory.filter(h => {
        if (h.is_watched) return false
        const progressPercent = h.duration && h.duration > 0 && h.position 
          ? (h.position / h.duration) * 100 
          : 0
        if (progressPercent >= COMPLETED_PERCENT_THRESHOLD) return false
        const meetsMinSeconds = h.position && h.position >= MIN_SECONDS_THRESHOLD
        const meetsMinPercent = progressPercent >= MIN_PERCENT_THRESHOLD
        
        
        // Allow series episodes with 0 progress (auto-added next episodes)
        const isNextEpisode = h.meta_type === 'series' && (!h.position || h.position === 0)

        // EXCLUDE S1E1 with 0 progress (unstarted shows shouldn't be in Continue Watching)
        if (h.meta_type === 'series' && h.season === 1 && h.episode === 1 && (!h.position || h.position === 0)) {
            return false
        }

        return meetsMinSeconds || meetsMinPercent || isNextEpisode
      })
      
      const deduplicatedHistory: typeof rawHistory = []
      const seenSeries = new Set<string>()
      for (const h of filteredHistory) {
        if (h.meta_type === 'series') {
          if (!seenSeries.has(h.meta_id)) {
            seenSeries.add(h.meta_id)
            deduplicatedHistory.push(h)
          }
        } else {
          deduplicatedHistory.push(h)
        }
      }
      
      const history = deduplicatedHistory.map(h => ({
        ...h,
        season: h.season !== undefined && h.season >= 0 ? h.season : null,
        episode: h.episode !== undefined && h.episode >= 0 ? h.episode : null,
        progressPercent: h.duration && h.duration > 0 && h.position ? Math.min(100, Math.round((h.position / h.duration) * 100)) : 0,
        episodeDisplay: h.meta_type === 'series' && h.season !== undefined && h.season >= 0 && h.episode !== undefined && h.episode >= 0 ? `S${h.season}:E${h.episode}` : null,
        lastStream: h.last_stream ? JSON.parse(h.last_stream) : null
      }))
      
      // Get catalog metadata for the guest profile (uses Cinemeta fallback if no addons)
      const catalogMetadata = await addonManager.getCatalogMetadata(pId)
      const trending = await addonManager.getTrending(pId)
      const trendingMovies = await addonManager.getTrendingByType(pId, 'movie')
      const trendingSeries = await addonManager.getTrendingByType(pId, 'series')
      
      const enabledAddons = profileDb.getSettingsProfileId(pId) ? addonDb.getEnabledForProfile(profileDb.getSettingsProfileId(pId)!) : [];
      const showFallbackToast = enabledAddons.length === 0 && catalogMetadata.length === 0;
      
      return c.json({
        catalogMetadata,
        history,
        trending,
        trendingMovies,
        trendingSeries,
        showFallbackToast,
        profile
      })
    }
    
    // Connected mode: require authentication
    if (!user) return err(c, 401, 'UNAUTHORIZED', 'Authentication required')

    let pId: number;
    if (profileId) {
        pId = parseInt(profileId)
    } else {
        // Fallback to default profile
        let profile = profileDb.getDefault(user.id)
        if (!profile) {
            const profiles = profileDb.findByUserId(user.id)
            if (profiles && profiles.length > 0) {
                profile = profiles[0]
            }
        }
        if (!profile) return err(c, 404, 'PROFILE_NOT_FOUND', 'No profile found')
        pId = profile.id
    }

    const profile = profileDb.findWithSettingsById(pId)
    if (!profile) return err(c, 404, 'PROFILE_NOT_FOUND', 'Profile not found')

    const rawHistory = watchHistoryDb.getByProfileId(pId)
    
    // Thresholds for "Continue Watching" section:
    // - MINIMUM: Must have watched at least 2 minutes OR 5% to appear (prevents misclick clutter)
    // - MAXIMUM: Once 90%+ watched, consider it finished and hide (accounts for outro skipping)
    const MIN_SECONDS_THRESHOLD = 120 // 2 minutes
    const MIN_PERCENT_THRESHOLD = 5
    const COMPLETED_PERCENT_THRESHOLD = 90
    
    // Filter by thresholds, then deduplicate series
    const filteredHistory = rawHistory.filter(h => {
      // Skip if marked as fully watched
      if (h.is_watched) return false
      
      // Calculate progress percentage
      const progressPercent = h.duration && h.duration > 0 && h.position 
        ? (h.position / h.duration) * 100 
        : 0
      
      // Skip if completed (90%+)
      if (progressPercent >= COMPLETED_PERCENT_THRESHOLD) return false
      
      // Must meet minimum threshold (2 min OR 5%)
      const meetsMinSeconds = h.position && h.position >= MIN_SECONDS_THRESHOLD
      const meetsMinPercent = progressPercent >= MIN_PERCENT_THRESHOLD
      
      // Allow series episodes with 0 progress (auto-added next episodes)
      const isNextEpisode = h.meta_type === 'series' && (!h.position || h.position === 0)

      // EXCLUDE S1E1 with 0 progress (unstarted shows shouldn't be in Continue Watching)
      if (h.meta_type === 'series' && h.season === 1 && h.episode === 1 && (!h.position || h.position === 0)) {
          return false
      }

      return meetsMinSeconds || meetsMinPercent || isNextEpisode
    })
    
      const deduplicatedHistory: typeof rawHistory = []
      const seenSeries = new Set<string>()
      
      // filteredHistory is already sorted by updated_at DESC, so first occurrence is the latest
      for (const h of filteredHistory) {
        if (h.meta_type === 'series') {
          if (!seenSeries.has(h.meta_id)) {
            seenSeries.add(h.meta_id)
            deduplicatedHistory.push(h)
          }
        } else {
          // Movies and other types - include as-is
          deduplicatedHistory.push(h)
        }
      }
    
    // Enhance history with progress percentage
    const history = deduplicatedHistory.map(h => ({
      ...h,
      season: h.season !== undefined && h.season >= 0 ? h.season : null,
      episode: h.episode !== undefined && h.episode >= 0 ? h.episode : null,
      progressPercent: h.duration && h.duration > 0 && h.position ? Math.min(100, Math.round((h.position / h.duration) * 100)) : 0,
      // For series, include season/episode display info
      episodeDisplay: h.meta_type === 'series' && h.season !== undefined && h.season >= 0 && h.episode !== undefined && h.episode >= 0 ? `S${h.season}:E${h.episode}` : null,
      lastStream: h.last_stream ? JSON.parse(h.last_stream) : null
    }))
    
    // Use catalog metadata for lazy loading - don't fetch items here
    const catalogMetadata = await addonManager.getCatalogMetadata(pId)
    const trending = await addonManager.getTrending(pId)
    const trendingMovies = await addonManager.getTrendingByType(pId, 'movie')
    const trendingSeries = await addonManager.getTrendingByType(pId, 'series')
    
    // Determine if the fallback was used by checking enabled addons
    const enabledAddons = profileDb.getSettingsProfileId(pId) ? addonDb.getEnabledForProfile(profileDb.getSettingsProfileId(pId)!) : [];
    const showFallbackToast = enabledAddons.length === 0 && catalogMetadata.length === 0;

    return c.json({
      catalogMetadata,
      history,
      trending,
      trendingMovies,
      trendingSeries,
      showFallbackToast,
      profile
    })
  } catch (e) {
    console.error('Streaming dashboard error:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to load dashboard')
  }
})

export default streaming