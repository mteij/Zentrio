import { Hono } from 'hono'
import { optionalSessionMiddleware } from '../../middleware/session'
import { addonManager } from '../../services/addons/addon-manager'
import { logger } from '../../services/logger'
import { err } from '../../utils/api'

const log = logger.scope('TmdbProxy')
const tmdbProxy = new Hono()

// GET /api/tmdb/trending?profileId=<id>
// Returns trending movies + series interleaved, in Stremio MetaPreview format
tmdbProxy.get('/trending', optionalSessionMiddleware, async (c) => {
  const profileId = parseInt(c.req.query('profileId') || '0')
  if (!profileId) return err(c, 400, 'INVALID_INPUT', 'profileId required')

  try {
    const metas = await addonManager.getTrending(profileId)
    return c.json({ metas })
  } catch (e) {
    log.error('TMDB trending error:', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to fetch trending')
  }
})

// GET /api/tmdb/trending/:type?profileId=<id>  (type = movie | series)
tmdbProxy.get('/trending/:type', optionalSessionMiddleware, async (c) => {
  const profileId = parseInt(c.req.query('profileId') || '0')
  const type = c.req.param('type') as 'movie' | 'series'
  if (!profileId) return err(c, 400, 'INVALID_INPUT', 'profileId required')
  if (type !== 'movie' && type !== 'series') return err(c, 400, 'INVALID_INPUT', 'type must be movie or series')

  try {
    const metas = await addonManager.getTrendingByType(profileId, type)
    return c.json({ metas })
  } catch (e) {
    log.error(`TMDB trending/${type} error:`, e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to fetch trending')
  }
})

// GET /api/tmdb/catalog/:type/:id?profileId=<id>
tmdbProxy.get('/catalog/:type/:id', optionalSessionMiddleware, async (c) => {
  const profileId = parseInt(c.req.query('profileId') || '0')
  const type = c.req.param('type')
  const id = c.req.param('id')
  if (!profileId) return err(c, 400, 'INVALID_INPUT', 'profileId required')

  try {
    // getSingleCatalog needs a manifestUrl — for the TMDB addon, use the virtual sentinel
    const metas = await addonManager.getSingleCatalog(profileId, 'zentrio://tmdb-addon', type, id)
    return c.json({ metas })
  } catch (e) {
    log.error(`TMDB catalog/${type}/${id} error:`, e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to fetch catalog')
  }
})

// GET /api/tmdb/meta/:type/:id?profileId=<id>
tmdbProxy.get('/meta/:type/:id', optionalSessionMiddleware, async (c) => {
  const profileId = parseInt(c.req.query('profileId') || '0')
  const type = c.req.param('type')
  const id = c.req.param('id')
  if (!profileId) return err(c, 400, 'INVALID_INPUT', 'profileId required')

  try {
    const meta = await addonManager.getMeta(type, id, profileId)
    return c.json({ meta })
  } catch (e) {
    log.error(`TMDB meta/${type}/${id} error:`, e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to fetch meta')
  }
})

export { tmdbProxy as tmdbProxyRouter }
