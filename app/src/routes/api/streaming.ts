import { Hono } from 'hono'
import { addonManager } from '../../services/addons/addon-manager'
import { streamDb, watchHistoryDb, profileDb, addonDb, listDb, type User } from '../../services/database'
import { sessionMiddleware } from '../../middleware/session'
import { ok, err } from '../../utils/api'

const streaming = new Hono<{
  Variables: {
    user: User
  }
}>()

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

streaming.get('/search', async (c) => {
  const { q, profileId } = c.req.query()
  if (!q || !profileId) return c.json({ results: [] })
  
  try {
    const results = await addonManager.search(q, parseInt(profileId))
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
    } else if (type) {
      items = await addonManager.getFilteredItems(pId, type, genre, skipNum)
      return c.json({ items })
    }
    return c.json({ items })
  } catch (e) {
    console.error('Failed to fetch catalog items', e)
    return c.json({ items: [] })
  }
})


streaming.post('/progress', async (c) => {
  try {
    const body = await c.req.json()
    const { profileId, metaId, metaType, title, poster, duration, position } = body
    
    if (!profileId || !metaId || !metaType) {
      return c.json({ error: 'Missing required fields' }, 400)
    }

    watchHistoryDb.upsert({
      profile_id: parseInt(profileId),
      meta_id: metaId,
      meta_type: metaType,
      title,
      poster,
      duration,
      position
    })

    return c.json({ success: true })
  } catch (e) {
    console.error('Failed to save progress', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
streaming.get('/details/:type/:id', sessionMiddleware, async (c) => {
  const { type, id } = c.req.param()
  const { profileId } = c.req.query()
  const pId = parseInt(profileId)
  
  try {
    const meta = await addonManager.getMeta(type, id, pId)
    if (!meta) return err(c, 404, 'NOT_FOUND', 'Content not found')
    
    const inLibrary = listDb.isInAnyList(pId, id)
    
    return c.json({ meta, inLibrary })
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
streaming.get('/dashboard', sessionMiddleware, async (c) => {
  try {
    const { profileId } = c.req.query()
    const user = c.get('user')
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

    const history = watchHistoryDb.getByProfileId(pId)
    const results = await addonManager.getCatalogs(pId)
    const trending = await addonManager.getTrending(pId)
    
    // Determine if the fallback was used by checking if the results contain only the default addon
    // and if the profile has no other addons enabled.
    const enabledAddons = profileDb.getSettingsProfileId(pId) ? addonDb.getEnabledForProfile(profileDb.getSettingsProfileId(pId)!) : [];
    const onlyDefaultAddon = results.every(r => r.manifestUrl === 'https://v3-cinemeta.strem.io/manifest.json');
    const showFallbackToast = enabledAddons.length === 0 && onlyDefaultAddon && results.length > 0;

    const catalogs = results.map(r => {
      const typeName = r.catalog.type === 'movie' ? 'Movies' : (r.catalog.type === 'series' ? 'Series' : 'Other')
      const manifestUrl = r.manifestUrl || (r.addon as any).manifest_url || (r.addon as any).id;
      return {
        title: `${typeName} - ${r.catalog.name || r.catalog.type}`,
        items: r.items,
        seeAllUrl: `/streaming/${pId}/catalog/${encodeURIComponent(manifestUrl)}/${r.catalog.type}/${r.catalog.id}`
      }
    })

    return c.json({
      catalogs,
      history,
      trending,
      showFallbackToast,
      profile
    })
  } catch (e) {
    console.error('Streaming dashboard error:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to load dashboard')
  }
})

export default streaming