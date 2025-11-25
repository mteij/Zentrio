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

export default streaming