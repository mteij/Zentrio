import { Hono } from 'hono'
import { addonManager } from '../../services/addons/addon-manager'
import { streamDb, watchHistoryDb } from '../../services/database'

const streaming = new Hono()

streaming.get('/streams/:type/:id', async (c) => {
  const { type, id } = c.req.param()
  const { profileId, season, episode } = c.req.query()
  const streams = await addonManager.getStreams(type, id, parseInt(profileId), season ? parseInt(season) : undefined, episode ? parseInt(episode) : undefined)
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
    } else if (type) {
      items = await addonManager.getFilteredItems(pId, type, genre, skipNum)
    }
    return c.json({ items })
  } catch (e) {
    console.error('Failed to fetch catalog items', e)
    return c.json({ items: [] })
  }
})

streaming.get('/settings', async (c) => {
  const { profileId } = c.req.query()
  const settings = streamDb.getSettings(parseInt(profileId))
  return c.json({ data: settings })
})

streaming.put('/settings', async (c) => {
  const { profileId } = c.req.query()
  const settings = await c.req.json()
  streamDb.saveSettings(parseInt(profileId), settings)
  return c.json({ success: true })
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
export default streaming