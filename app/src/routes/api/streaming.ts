import { optionalSessionMiddleware, sessionMiddleware } from '../../middleware/session'
import { addonManager } from '../../services/addons/addon-manager'
import { enrichContent, filterContent, getParentalSettings } from '../../services/addons/content-filter'
import { addonDb, listDb, profileDb, streamDb, userDb, watchHistoryDb, type User } from '../../services/database'
import { logger } from '../../services/logger'
import { traktSyncService } from '../../services/trakt'
import { err } from '../../utils/api'
import { createTaggedOpenAPIApp } from './openapi-route'

const log = logger.scope('API:Streaming')

const streaming = createTaggedOpenAPIApp<{
  Variables: {
    user: User | null
    guestMode: boolean
    session: any
  }
}>('Streaming')

// Helper to find and add next episode to continue watching
async function ensureNextEpisodeInContinueWatching(
  profileId: number, 
  metaId: string, 
  currentSeason: number, 
  currentEpisode: number
) {
  try {
    log.debug(`Checking next episode for ${metaId} after S${currentSeason}E${currentEpisode}`)
    
    // 1. Get metadata to find next episode
    // We assume 'series' type because only series have next episodes
    const meta = await addonManager.getMeta('series', metaId, profileId)
    if (!meta) {
        log.debug(`No metadata found for ${metaId}`)
        return
    }
    if (!meta.videos || meta.videos.length === 0) {
        log.debug(`No videos found in metadata for ${metaId}`)
        return
    }

    // 2. Find current video index
    const sortedVideos = meta.videos.sort((a: any, b: any) => {
      if (a.season !== b.season) return a.season - b.season
      return a.episode - b.episode
    })

    const currentIndex = sortedVideos.findIndex((v: any) => v.season === currentSeason && v.episode === currentEpisode)
    log.debug(`Current index: ${currentIndex} / ${sortedVideos.length}`)
    
    // 3. Get next video if exists
    if (currentIndex !== -1 && currentIndex < sortedVideos.length - 1) {
      const nextVideo = sortedVideos[currentIndex + 1]
      log.debug(`Found next video: S${nextVideo.season}E${nextVideo.episode}`)
      
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
        log.debug(`No next video found (last episode?)`)
    }
  } catch (e) {
    log.error('Failed to ensure next episode:', e)
  }
}

streaming.get('/settings', optionalSessionMiddleware, async (c) => {
  try {
    const { profileId, settingsProfileId: querySettingsProfileId } = c.req.query()
    const user = c.get('user')
    const isGuestMode = c.get('guestMode') as boolean

    // Resolve effective user for guest mode
    const effectiveUser = isGuestMode ? userDb.getOrCreateGuestUser() : user
    if (!effectiveUser) return err(c, 401, 'UNAUTHORIZED', 'Authentication required')

    let settingsProfileId: number;

    if (querySettingsProfileId) {
        settingsProfileId = parseInt(querySettingsProfileId);
    } else {
        let pId: number;
        if (profileId && profileId !== 'guest') {
            pId = parseInt(profileId)
        } else if (isGuestMode || profileId === 'guest') {
            const guestDefaultProfile = await userDb.ensureGuestDefaultProfile()
            pId = guestDefaultProfile.id
        } else {
            // Fallback to default profile
            let profile = profileDb.getDefault(effectiveUser.id)
            if (!profile) {
                const profiles = profileDb.findByUserId(effectiveUser.id)
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
    log.error('Failed to get streaming settings', e)
    return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
  }
})

streaming.put('/settings', optionalSessionMiddleware, async (c) => {
  try {
    const { profileId, settingsProfileId: querySettingsProfileId } = c.req.query()
    const user = c.get('user')
    const isGuestMode = c.get('guestMode') as boolean

    // Resolve effective user for guest mode
    const effectiveUser = isGuestMode ? userDb.getOrCreateGuestUser() : user
    if (!effectiveUser) return err(c, 401, 'UNAUTHORIZED', 'Authentication required')

    let settingsProfileId: number;

    if (querySettingsProfileId) {
        settingsProfileId = parseInt(querySettingsProfileId);
    } else {
        let pId: number;
        if (profileId && profileId !== 'guest') {
            pId = parseInt(profileId)
        } else if (isGuestMode || profileId === 'guest') {
            const guestDefaultProfile = await userDb.ensureGuestDefaultProfile()
            pId = guestDefaultProfile.id
        } else {
            // Fallback to default profile
            let profile = profileDb.getDefault(effectiveUser.id)
            if (!profile) {
                const profiles = profileDb.findByUserId(effectiveUser.id)
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
    log.error('Failed to save streaming settings', e)
    return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
  }
})


streaming.get('/subtitles/:type/:id', async (c) => {
  const { type, id } = c.req.param()
  const { profileId, videoHash } = c.req.query()
  
  if (!profileId) {
    log.debug('No profileId provided')
    return c.json({ subtitles: [] })
  }
  
  const debugInfo: any = {
    profileId,
    type,
    id,
    videoHash,
    timestamp: new Date().toISOString()
  }
  
  try {
    log.debug(`Fetching for ${type}/${id} with videoHash: ${videoHash || 'none'}`)
    const results = await addonManager.getSubtitles(type, id, parseInt(profileId), videoHash)
    
    debugInfo.addonsQueried = results.length
    debugInfo.addonResults = results.map(r => ({
      name: r.addon.name,
      count: r.subtitles.length,
      supportsSubtitles: r.addon.resources?.includes('subtitles') || r.addon.resources?.some((res: any) => res?.name === 'subtitles')
    }))
    
    log.debug(`Received ${results.length} addon results`)
    results.forEach(r => {
      log.debug(`${r.addon.name}: ${r.subtitles.length} subtitles`)
    })
    
    // Flatten subtitles from all addons into a single list with addon info
    const subtitles = results.flatMap(r =>
      r.subtitles.map(s => ({
        ...s,
        addonName: r.addon.name
      }))
    )
    
    debugInfo.totalSubtitles = subtitles.length
    
    log.debug(`Total subtitles: ${subtitles.length}`)
    if (subtitles.length === 0) {
      log.warn('No subtitles available. Consider installing a subtitle addon like OpenSubtitles.')
      debugInfo.message = 'No subtitle results from any addon'
    }
    
    // Include debug info in response
    return c.json({ subtitles, debug: debugInfo })
  } catch (e) {
    log.error('API error:', e)
    debugInfo.error = e instanceof Error ? e.message : String(e)
    return c.json({ subtitles: [], debug: debugInfo })
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
    log.error('Search API error:', e)
    return c.json({ results: [] })
  }
})

/**
 * Catalog-based search endpoint (Stremio-style).
 * Returns results grouped by catalog source for row-based display.
 */
streaming.get('/search-catalog-metadata', async (c) => {
  const { profileId, type } = c.req.query()
  if (!profileId) return c.json({ catalogs: [] })

  try {
    const filters = {
      type: type !== 'undefined' ? type : undefined
    }
    const catalogs = await addonManager.getSearchCatalogMetadata(parseInt(profileId), filters)
    return c.json({ catalogs })
  } catch (e) {
    log.error('Catalog metadata search API error:', e)
    return c.json({ catalogs: [] })
  }
})

streaming.get('/search-catalog-items', async (c) => {
  const { q, profileId, manifestUrl, type, id } = c.req.query()
  if (!q || !profileId || !manifestUrl || !type || !id) return c.json({ items: [] })

  try {
    const items = await addonManager.searchSingleCatalog(
      q,
      parseInt(profileId),
      manifestUrl,
      type,
      id
    )
    return c.json({ items })
  } catch (e) {
    log.error('Catalog search items API error:', e)
    return c.json({ items: [] })
  }
})

streaming.get('/search-catalogs', async (c) => {
  const { q, profileId, type } = c.req.query()
  if (!q || !profileId) return c.json({ catalogs: [] })
  
  try {
    const filters = {
      type: type !== 'undefined' ? type : undefined
    }
    const catalogs = await addonManager.searchByCatalog(q, parseInt(profileId), filters)
    return c.json({ catalogs })
  } catch (e) {
    log.error('Catalog search API error:', e)
    return c.json({ catalogs: [] })
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
    log.error('Failed to fetch catalog items', e)
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
    log.error(`Failed to fetch catalog items for ${id}`, e)
    return c.json({ items: [] })
  }
})


streaming.post('/progress', optionalSessionMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, metaId, metaType, season, episode, episodeId, title, poster, duration, position } = body

    if (!profileId || !metaId || !metaType) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const isGuestMode = c.get('guestMode') as boolean
    const sessionUser = c.get('user')

    let pId: number
    if (profileId === 'guest' || isGuestMode) {
      const guestDefaultProfile = await userDb.ensureGuestDefaultProfile()
      pId = guestDefaultProfile.id
    } else {
      pId = parseInt(profileId)
      if (Number.isNaN(pId)) {
        return c.json({ error: 'Invalid profileId' }, 400)
      }
      // Verify the authenticated user owns this profile
      if (sessionUser) {
        const profile = profileDb.findById(pId)
        if (!profile || profile.user_id !== sessionUser.id) {
          return c.json({ error: 'Forbidden' }, 403)
        }
      }
    }

    watchHistoryDb.upsert({
      profile_id: pId,
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
        pId,
        metaId,
        season !== undefined ? parseInt(season) : undefined,
        episode !== undefined ? parseInt(episode) : undefined
      )

      // Auto-add next episode if this is a series
      if (metaType === 'series' && season !== undefined && episode !== undefined) {
         // Run in background
         ensureNextEpisodeInContinueWatching(
            pId,
            metaId,
            parseInt(season),
            parseInt(episode)
         )
      }
    }

    return c.json({ success: true })
  } catch (e) {
    log.error('Failed to save progress', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

streaming.delete('/progress/:type/:id', optionalSessionMiddleware, async (c) => {
  try {
    const { type, id } = c.req.param()
    const { profileId, season, episode } = c.req.query()

    if (!profileId) {
      return c.json({ error: 'Missing defined profileId' }, 400)
    }

    const isGuestMode = c.get('guestMode') as boolean
    const sessionUser = c.get('user')

    let pId: number
    if (profileId === 'guest' || isGuestMode) {
      const guestDefaultProfile = await userDb.ensureGuestDefaultProfile()
      pId = guestDefaultProfile.id
    } else {
      pId = parseInt(profileId)
      if (Number.isNaN(pId)) {
        return c.json({ error: 'Invalid profileId' }, 400)
      }
      if (sessionUser) {
        const profile = profileDb.findById(pId)
        if (!profile || profile.user_id !== sessionUser.id) {
          return c.json({ error: 'Forbidden' }, 403)
        }
      }
    }

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
    log.error('Failed to delete progress', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Get series watch progress (all episodes)
// Get single item progress (specifically for initializing the video player)
streaming.get('/progress/:type/:id', optionalSessionMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const { profileId, season, episode } = c.req.query()

    if (!profileId) {
      return c.json({ error: 'profileId required' }, 400)
    }

    const isGuestMode = c.get('guestMode') as boolean
    const sessionUser = c.get('user')

    let pId: number
    if (profileId === 'guest' || isGuestMode) {
      const guestDefaultProfile = await userDb.ensureGuestDefaultProfile()
      pId = guestDefaultProfile.id
    } else {
      pId = parseInt(profileId)
      if (Number.isNaN(pId)) {
        return c.json({ error: 'Invalid profileId' }, 400)
      }
      if (sessionUser) {
        const profile = profileDb.findById(pId)
        if (!profile || profile.user_id !== sessionUser.id) {
          return c.json({ error: 'Forbidden' }, 403)
        }
      }
    }
    const progress = watchHistoryDb.getProgress(
      pId, 
      id, 
      season ? parseInt(season) : undefined, 
      episode ? parseInt(episode) : undefined
    )

    return c.json({
      position: progress?.position || 0,
      duration: progress?.duration || 0,
      isWatched: progress?.is_watched || false
    })
  } catch (e) {
    log.error('Failed to get item progress', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

streaming.get('/series-progress/:id', optionalSessionMiddleware, async (c) => {
  try {
    const { id } = c.req.param()
    const { profileId } = c.req.query()

    if (!profileId) {
      return c.json({ error: 'profileId required' }, 400)
    }

    const isGuestMode = c.get('guestMode') as boolean
    const sessionUser = c.get('user')
    const pId = parseInt(profileId)
    if (!isGuestMode && sessionUser) {
      const profile = profileDb.findById(pId)
      if (!profile || profile.user_id !== sessionUser.id) {
        return c.json({ error: 'Forbidden' }, 403)
      }
    }
    const episodeProgress = watchHistoryDb.getSeriesProgress(pId, id)
    const lastWatched = watchHistoryDb.getLastWatchedEpisode(pId, id)

    return c.json({
      episodeProgress,
      lastWatched: lastWatched ? { season: lastWatched.season, episode: lastWatched.episode } : null
    })
  } catch (e) {
    log.error('Failed to get series progress', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Mark item as watched/unwatched
streaming.post('/mark-watched', optionalSessionMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, metaId, metaType, season, episode, watched } = body

    if (!profileId || !metaId || !metaType || watched === undefined) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const isGuestMode = c.get('guestMode') as boolean
    const sessionUser = c.get('user')
    const pId = parseInt(profileId)
    if (!isGuestMode && sessionUser) {
      const profile = profileDb.findById(pId)
      if (!profile || profile.user_id !== sessionUser.id) {
        return c.json({ error: 'Forbidden' }, 403)
      }
    }
    
    watchHistoryDb.markAsWatched(
      pId,
      metaId,
      metaType,
      watched,
      season !== undefined ? parseInt(season) : undefined,
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

    // Sync to Trakt if connected
    let traktSynced = false
    try {
      traktSynced = await traktSyncService.pushWatchedItem(
        pId, metaType, metaId, watched,
        season !== undefined ? parseInt(season) : undefined,
        episode !== undefined ? parseInt(episode) : undefined
      )
    } catch (e) {
      log.error('Failed to sync mark-watched to Trakt:', e)
    }

    return c.json({ success: true, traktSynced })
  } catch (e) {
    log.error('Failed to mark as watched', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Mark entire season as watched/unwatched
streaming.post('/mark-season-watched', optionalSessionMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, metaId, metaType, season, watched, episodes } = body

    if (!profileId || !metaId || !metaType || season === undefined || watched === undefined || !episodes) {
      return c.json({ error: 'Missing required fields (need episodes array)' }, 400)
    }

    const isGuestMode = c.get('guestMode') as boolean
    const sessionUser = c.get('user')
    const pId = parseInt(profileId)
    if (!isGuestMode && sessionUser) {
      const profile = profileDb.findById(pId)
      if (!profile || profile.user_id !== sessionUser.id) {
        return c.json({ error: 'Forbidden' }, 403)
      }
    }
    
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
    try {
      traktSynced = await traktSyncService.pushEpisodesWatched(
        pId, metaId,
        episodes.map((ep: number) => ({ season: parseInt(season), episode: parseInt(String(ep)) })),
        watched
      )
    } catch (e) {
      log.error('Failed to sync season watched to Trakt:', e)
    }

    return c.json({ success: true, traktSynced })
  } catch (e) {
    log.error('Failed to mark season as watched', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Mark entire series as watched/unwatched (all episodes)
streaming.post('/mark-series-watched', optionalSessionMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, metaId, watched, allEpisodes: providedEpisodes } = body
    let allEpisodes = providedEpisodes

    if (!profileId || !metaId || watched === undefined) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const isGuestMode = c.get('guestMode') as boolean
    const sessionUser = c.get('user')
    const pId = parseInt(profileId)
    if (!isGuestMode && sessionUser) {
      const profile = profileDb.findById(pId)
      if (!profile || profile.user_id !== sessionUser.id) {
        return c.json({ error: 'Forbidden' }, 403)
      }
    }

    // If allEpisodes is missing, fetch from metadata
    if (!allEpisodes || !Array.isArray(allEpisodes)) {
        try {
            log.debug(`allEpisodes missing for ${metaId}, fetching metadata...`)
            const meta = await addonManager.getMeta('series', metaId, pId)
            if (meta && meta.videos) {
                allEpisodes = meta.videos.map((v: any) => ({
                    season: v.season,
                    episode: v.number || v.episode
                }))
                log.debug(`Retrieved ${allEpisodes.length} episodes from metadata`)
            } else {
                log.warn(`No metadata or videos found for ${metaId}`)
                allEpisodes = []
            }
        } catch (e) {
            log.error(`Failed to fetch metadata for ${metaId}:`, e)
            return c.json({ error: 'Failed to retrieve series episodes' }, 500)
        }
    }
    
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
    try {
      traktSynced = await traktSyncService.pushEpisodesWatched(pId, metaId, allEpisodes, watched)
    } catch (e) {
      log.error('Failed to sync series watched to Trakt:', e)
    }

    return c.json({ success: true, traktSynced, episodesUpdated: allEpisodes.length })
  } catch (e) {
    log.error('Failed to mark series as watched', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Mark all episodes before a specific episode as watched
streaming.post('/mark-episodes-before', optionalSessionMiddleware, async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, metaId, season, episode, watched, allEpisodes } = body

    if (!profileId || !metaId || season === undefined || episode === undefined || watched === undefined || !allEpisodes) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    const isGuestMode = c.get('guestMode') as boolean
    const sessionUser = c.get('user')
    const pId = parseInt(profileId)
    if (!isGuestMode && sessionUser) {
      const profile = profileDb.findById(pId)
      if (!profile || profile.user_id !== sessionUser.id) {
        return c.json({ error: 'Forbidden' }, 403)
      }
    }
    
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
    try {
      traktSynced = await traktSyncService.pushEpisodesWatched(pId, metaId, episodesToMark, watched)
    } catch (e) {
      log.error('Failed to sync episodes-before to Trakt:', e)
    }

    return c.json({ success: true, traktSynced, episodesUpdated: episodesToMark.length })
  } catch (e) {
    log.error('Failed to mark episodes before', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})


streaming.get('/details/:type/:id', optionalSessionMiddleware, async (c) => {
  const { type, id } = c.req.param()
  const { profileId, metaFallback } = c.req.query()
  const isGuestMode = c.get('guestMode') as boolean
  
  let pId: number
  if (isGuestMode || profileId === 'guest') {
    const guestDefaultProfile = await userDb.ensureGuestDefaultProfile()
    pId = guestDefaultProfile.id
  } else {
    pId = parseInt(profileId)
  }
  
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
        log.debug(`Using fallback meta for ${type}/${id}:`, meta?.name ?? 'Unknown')
      } catch (e) {
        log.warn('Failed to parse metaFallback:', e)
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
    log.error('Streaming details error:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to load content')
  }
})

streaming.get('/filters', optionalSessionMiddleware, async (c) => {
  const { profileId } = c.req.query()
  const isGuestMode = c.get('guestMode') as boolean

  let pId: number
  if (isGuestMode || profileId === 'guest') {
    const guestDefaultProfile = await userDb.ensureGuestDefaultProfile()
    pId = guestDefaultProfile.id
  } else {
    pId = parseInt(profileId)
  }
  
  try {
    const filters = await addonManager.getAvailableFilters(pId)
    return c.json({ filters })
  } catch (e) {
    log.error('Streaming filters error:', e)
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
      
      const thresholdHistory = rawHistory.filter(h => {
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

      // Apply strict parental filtering to Continue Watching candidates.
      // We map history entries to lightweight MetaPreview-shaped objects so the same filtering
      // rules used across catalogs are applied here as well.
      let filteredHistory = thresholdHistory
      const parentalSettings = getParentalSettings(pId)
      if (parentalSettings.enabled && thresholdHistory.length > 0) {
        try {
          const candidateItems = thresholdHistory.map((h) => {
            const season = h.season !== undefined && h.season >= 0 ? h.season : null
            const episode = h.episode !== undefined && h.episode >= 0 ? h.episode : null
            return {
              id: h.meta_id,
              type: h.meta_type,
              name: h.title || 'Unknown',
              poster: h.poster || undefined,
              _historyKey: `${h.meta_id}:${h.meta_type}:${season ?? 'x'}:${episode ?? 'x'}`
            }
          }) as any[]

          const allowed = await filterContent(candidateItems as any, parentalSettings, profile?.user_id)
          const allowedKeys = new Set(allowed.map((item: any) => item._historyKey))

          filteredHistory = thresholdHistory.filter((h) => {
            const season = h.season !== undefined && h.season >= 0 ? h.season : null
            const episode = h.episode !== undefined && h.episode >= 0 ? h.episode : null
            const key = `${h.meta_id}:${h.meta_type}:${season ?? 'x'}:${episode ?? 'x'}`
            return allowedKeys.has(key)
          })
        } catch (e) {
          log.warn('Failed to apply parental filtering on history (guest mode)', e)
          // Strict fallback: if filtering fails and parental controls are enabled, hide the list.
          filteredHistory = []
        }
      }
      
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

      // Kick off all external addon calls in parallel
      const heroCandidate = deduplicatedHistory.length > 0 ? deduplicatedHistory[0] : null
      const heroMeta = heroCandidate
        ? addonManager.getMeta(heroCandidate.meta_type, heroCandidate.meta_id, pId).catch(() => null)
        : Promise.resolve(null)

      const [catalogMetadata, trending, trendingMovies, trendingSeries, resolvedHeroMeta] = await Promise.all([
        addonManager.getCatalogMetadata(pId),
        addonManager.getTrending(pId),
        addonManager.getTrendingByType(pId, 'movie'),
        addonManager.getTrendingByType(pId, 'series'),
        heroMeta,
      ])

      // Continue Watching Hero (enriched via addonManager -> uses global TMDB key fallback)
      let continueWatchingHero: any = null
      if (heroCandidate) {
        const h = heroCandidate
        const season = h.season !== undefined && h.season >= 0 ? h.season : null
        const episode = h.episode !== undefined && h.episode >= 0 ? h.episode : null
        const episodeDisplay = h.meta_type === 'series' && season !== null && episode !== null ? `S${season}:E${episode}` : null
        let lastStream: any = null
        try {
          lastStream = h.last_stream ? JSON.parse(h.last_stream) : null
        } catch (_) {
          lastStream = null
        }

        const meta = resolvedHeroMeta
        if (meta) {
          continueWatchingHero = {
            id: (meta as any).id,
            type: (meta as any).type,
            name: (meta as any).name,
            poster: (meta as any).poster || h.poster,
            background: (meta as any).background || (meta as any).poster || h.poster,
            logo: (meta as any).logo,
            description: (meta as any).description,
            releaseInfo: (meta as any).releaseInfo,
            imdbRating: (meta as any).imdbRating,
            season,
            episode,
            episodeDisplay,
            lastStream
          }
        }

        if (!continueWatchingHero) {
          continueWatchingHero = {
            id: h.meta_id,
            type: h.meta_type,
            name: h.title || 'Unknown',
            poster: h.poster,
            background: h.poster,
            season,
            episode,
            episodeDisplay,
            lastStream
          }
        }
      }
      
      const enabledAddons = profileDb.getSettingsProfileId(pId) ? addonDb.getEnabledForProfile(profileDb.getSettingsProfileId(pId)!) : [];
      const showFallbackToast = enabledAddons.length === 0 && catalogMetadata.length === 0;
      
      return c.json({
        catalogMetadata,
        history,
        continueWatchingHero,
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
      const thresholdHistory = rawHistory.filter(h => {
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

    // Apply strict parental filtering to Continue Watching candidates.
    let filteredHistory = thresholdHistory
    const parentalSettings = getParentalSettings(pId)
    if (parentalSettings.enabled && thresholdHistory.length > 0) {
      try {
        const candidateItems = thresholdHistory.map((h) => {
          const season = h.season !== undefined && h.season >= 0 ? h.season : null
          const episode = h.episode !== undefined && h.episode >= 0 ? h.episode : null
          return {
            id: h.meta_id,
            type: h.meta_type,
            name: h.title || 'Unknown',
            poster: h.poster || undefined,
            _historyKey: `${h.meta_id}:${h.meta_type}:${season ?? 'x'}:${episode ?? 'x'}`
          }
        }) as any[]

        const allowed = await filterContent(candidateItems as any, parentalSettings, profile?.user_id)
        const allowedKeys = new Set(allowed.map((item: any) => item._historyKey))

        filteredHistory = thresholdHistory.filter((h) => {
          const season = h.season !== undefined && h.season >= 0 ? h.season : null
          const episode = h.episode !== undefined && h.episode >= 0 ? h.episode : null
          const key = `${h.meta_id}:${h.meta_type}:${season ?? 'x'}:${episode ?? 'x'}`
          return allowedKeys.has(key)
        })
      } catch (e) {
        log.warn('Failed to apply parental filtering on history', e)
        // Strict fallback: if filtering fails and parental controls are enabled, hide the list.
        filteredHistory = []
      }
    }
    
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

    // Kick off all external addon calls in parallel
    const heroCandidate = deduplicatedHistory.length > 0 ? deduplicatedHistory[0] : null
    const heroMeta = heroCandidate
      ? addonManager.getMeta(heroCandidate.meta_type, heroCandidate.meta_id, pId).catch((e) => {
          log.warn('Failed to build continueWatchingHero:', e)
          return null
        })
      : Promise.resolve(null)

    const [catalogMetadata, trending, trendingMovies, trendingSeries, resolvedHeroMeta] = await Promise.all([
      addonManager.getCatalogMetadata(pId),
      addonManager.getTrending(pId),
      addonManager.getTrendingByType(pId, 'movie'),
      addonManager.getTrendingByType(pId, 'series'),
      heroMeta,
    ])

    // Continue Watching Hero (enriched via addonManager -> uses global TMDB key fallback)
    let continueWatchingHero: any = null
    if (heroCandidate) {
      const h = heroCandidate
      const season = h.season !== undefined && h.season >= 0 ? h.season : null
      const episode = h.episode !== undefined && h.episode >= 0 ? h.episode : null
      const episodeDisplay = h.meta_type === 'series' && season !== null && episode !== null ? `S${season}:E${episode}` : null
      let lastStream: any = null
      try {
        lastStream = h.last_stream ? JSON.parse(h.last_stream) : null
      } catch (_) {
        lastStream = null
      }

      const meta = resolvedHeroMeta
      if (meta) {
        continueWatchingHero = {
          id: (meta as any).id,
          type: (meta as any).type,
          name: (meta as any).name,
          poster: (meta as any).poster || h.poster,
          background: (meta as any).background || (meta as any).poster || h.poster,
          logo: (meta as any).logo,
          description: (meta as any).description,
          releaseInfo: (meta as any).releaseInfo,
          imdbRating: (meta as any).imdbRating,
          season,
          episode,
          episodeDisplay,
          lastStream
        }
      }

      if (!continueWatchingHero) {
        continueWatchingHero = {
          id: h.meta_id,
          type: h.meta_type,
          name: h.title || 'Unknown',
          poster: h.poster,
          background: h.poster,
          season,
          episode,
          episodeDisplay,
          lastStream
        }
      }
    }
    
    // Determine if the fallback was used by checking enabled addons
    const enabledAddons = profileDb.getSettingsProfileId(pId) ? addonDb.getEnabledForProfile(profileDb.getSettingsProfileId(pId)!) : [];
    const showFallbackToast = enabledAddons.length === 0 && catalogMetadata.length === 0;

    return c.json({
      catalogMetadata,
      history,
      continueWatchingHero,
      trending,
      trendingMovies,
      trendingSeries,
      showFallbackToast,
      profile
    })
  } catch (e) {
    log.error('Streaming dashboard error:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to load dashboard')
  }
})

// POST /api/streaming/filter-enrich
// Accepts client-fetched catalog items, applies server-side parental filtering
// and watch history enrichment, then returns the processed items.
streaming.post('/filter-enrich', optionalSessionMiddleware, async (c) => {
  try {
    const body = await c.req.json<{ items: any[], profileId: number }>()
    if (!body?.items || !body?.profileId) {
      return err(c, 400, 'INVALID_INPUT', 'items and profileId are required')
    }

    const { items, profileId } = body
    const parentalSettings = getParentalSettings(profileId)

    let filtered = items
    if (parentalSettings.enabled) {
      const profile = profileDb.findWithSettingsById(profileId)
      filtered = await filterContent(items, parentalSettings, profile?.user_id ?? undefined)
    }

    const enriched = await enrichContent(filtered, profileId)
    return c.json({ items: enriched })
  } catch (e) {
    log.error('filter-enrich error:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to filter content')
  }
})

// POST /api/streaming/segments/submit
// Submits an intro/recap/outro segment to IntroDB using the user's stored API key.
// The key is read server-side so it is never exposed to the client.
streaming.post('/segments/submit', sessionMiddleware, async (c) => {
  const user = c.get('user')
  if (!user) return err(c, 401, 'UNAUTHORIZED', 'Authentication required')

  const body = await c.req.json<{
    profileId: number
    imdbId: string
    season: number
    episode: number
    type: 'intro' | 'recap' | 'outro'
    startSec: number
    endSec: number
  }>().catch(() => null)

  if (!body) return err(c, 400, 'INVALID_INPUT', 'Invalid request body')
  const { profileId, imdbId, season, episode, type, startSec, endSec } = body

  if (!imdbId?.startsWith('tt')) return err(c, 400, 'INVALID_INPUT', 'imdbId must be a valid IMDB ID')
  if (!['intro', 'recap', 'outro'].includes(type)) return err(c, 400, 'INVALID_INPUT', 'type must be intro, recap, or outro')
  if (season < 1 || episode < 1) return err(c, 400, 'INVALID_INPUT', 'season and episode must be ≥ 1')
  if (startSec >= endSec) return err(c, 400, 'INVALID_INPUT', 'startSec must be less than endSec')

  // Resolve settings profile and read IntroDB API key
  const settingsProfileId = profileDb.getSettingsProfileId(profileId)
  if (!settingsProfileId) return err(c, 404, 'PROFILE_NOT_FOUND', 'Profile not found')
  const settings = streamDb.getSettings(settingsProfileId) as any
  const apiKey: string | undefined = settings?.introdb?.apiKey

  if (!apiKey?.startsWith('idb_')) {
    return err(c, 403, 'NO_API_KEY', 'No IntroDB API key configured. Add one in Streaming settings.')
  }

  try {
    const res = await fetch('https://api.introdb.app/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        imdb_id: imdbId,
        season,
        episode,
        segment_type: type,
        start_sec: startSec,
        end_sec: endSec,
      }),
      signal: AbortSignal.timeout(8000),
    })

    const data = await res.json() as any

    if (!res.ok) {
      if (res.status === 401) return err(c, 403, 'INVALID_API_KEY', 'IntroDB rejected the API key')
      if (res.status === 429) return err(c, 429, 'RATE_LIMITED', 'IntroDB rate limit reached (one submission per segment type per 5 minutes)')
      return err(c, 400, 'INTRODB_ERROR', data?.message ?? 'Submission rejected by IntroDB')
    }

    return c.json({ ok: true, submission: data.submission })
  } catch (e) {
    log.error('IntroDB submit failed', e)
    return err(c, 502, 'UPSTREAM_ERROR', 'Failed to reach IntroDB')
  }
})

// GET /api/streaming/segments?imdbId=tt0903747&season=1&episode=1
// Fetches intro/recap/outro segment timestamps from IntroDB (https://introdb.app).
// Always tries the live API first; falls back to cached DB result for offline use.
streaming.get('/segments', optionalSessionMiddleware, async (c) => {
  const imdbId = c.req.query('imdbId')
  const season = c.req.query('season') ? parseInt(c.req.query('season')!) : null
  const episode = c.req.query('episode') ? parseInt(c.req.query('episode')!) : null

  if (!imdbId || !imdbId.startsWith('tt')) {
    return err(c, 400, 'INVALID_INPUT', 'imdbId is required and must be a valid IMDB ID (tt...)')
  }

  const { db } = await import('../../services/database/connection')

  const getCached = () => {
    const stmt = db.prepare(
      'SELECT segments FROM introdb_cache WHERE imdb_id = ? AND season IS ? AND episode IS ?'
    )
    const row = stmt.get(imdbId, season, episode) as { segments: string } | undefined
    if (!row) return null
    try { return JSON.parse(row.segments) } catch { return null }
  }

  const saveCache = (segments: any[]) => {
    db.prepare(`
      INSERT INTO introdb_cache (imdb_id, season, episode, segments, fetched_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(imdb_id, season, episode)
      DO UPDATE SET segments = excluded.segments, fetched_at = excluded.fetched_at
    `).run(imdbId, season, episode, JSON.stringify(segments))
  }

  // Try live fetch first
  try {
    const params = new URLSearchParams({ imdb_id: imdbId })
    if (season !== null) params.set('season', String(season))
    if (episode !== null) params.set('episode', String(episode))

    const res = await fetch(`https://api.introdb.app/segments?${params}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const data = await res.json() as any
      // IntroDB returns { intro, recap, outro } as top-level keys (each null or a segment object)
      const segments: any[] = []
      for (const type of ['intro', 'recap', 'outro'] as const) {
        const s = data[type]
        if (!s) continue
        segments.push({
          type,
          start: s.start_sec,
          end: s.end_sec,
          confidence: s.confidence ?? 1,
          submissionCount: s.submission_count ?? 1,
        })
      }

      saveCache(segments)
      return c.json({ segments, source: 'live' })
    }
  } catch (e) {
    log.debug('IntroDB fetch failed, falling back to cache', e)
  }

  // Fall back to cache (works offline)
  const cached = getCached()
  if (cached) return c.json({ segments: cached, source: 'cache' })

  return c.json({ segments: [], source: 'none' })
})

export default streaming
