import { Hono } from 'hono'
import { watchHistoryDb, libraryDb } from '../../services/database'

const app = new Hono()

app.post('/library', async (c) => {
  const body = await c.req.json()
  const { profileId, metaId, type, title, poster, action } = body

  if (!profileId || !metaId) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  try {
    if (action === 'add') {
      libraryDb.add({
        profile_id: profileId,
        meta_id: metaId,
        type,
        title,
        poster
      })
    } else if (action === 'remove') {
      libraryDb.remove(profileId, metaId)
    }
    return c.json({ success: true })
  } catch (e) {
    console.error('Library update failed', e)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

app.post('/progress', async (c) => {
  const body = await c.req.json()
  const { profileId, metaId, metaType, title, poster, duration, position } = body

  if (!profileId || !metaId) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  try {
    watchHistoryDb.upsert({
      profile_id: profileId,
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

app.get('/streams/:type/:id', async (c) => {
  const { type, id } = c.req.param()
  const profileId = parseInt(c.req.query('profileId') || '0')
  
  if (!profileId) {
    return c.json({ error: 'Profile ID required' }, 400)
  }

  try {
    // Import dynamically to avoid circular deps if any
    const { addonManager } = await import('../../services/addons/addon-manager.js')
    console.log(`Fetching streams for ${type}/${id} profile=${profileId}`)
    const streams = await addonManager.getStreams(type, id, profileId)
    console.log(`Found ${streams.length} stream groups`)
    return c.json({ streams })
  } catch (e) {
    console.error('Failed to fetch streams', e)
    return c.json({ error: 'Internal server error', streams: [] }, 500)
  }
})

export default app