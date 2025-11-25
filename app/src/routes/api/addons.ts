import { Hono } from 'hono'
import { addonDb } from '../../services/database'
import { AddonClient } from '../../services/addons/client'

const app = new Hono()

// List all installed addons
app.get('/', (c) => {
  const addons = addonDb.list()
  return c.json(addons)
})

// Install an addon
app.post('/', async (c) => {
  const { manifestUrl } = await c.req.json()
  if (!manifestUrl) return c.json({ error: 'Manifest URL required' }, 400)

  try {
    // Validate manifest
    const client = new AddonClient(manifestUrl)
    let manifest;
    try {
        manifest = await client.init()
    } catch (e: any) {
        return c.json({ error: `Failed to fetch manifest: ${e.message}` }, 400)
    }
    
    const addon = addonDb.create({
      manifest_url: manifestUrl,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      logo: manifest.logo
    })
    
    return c.json(addon)
  } catch (e) {
    console.error('Failed to install addon', e)
    return c.json({ error: 'Internal server error during installation' }, 500)
  }
})

// Delete an addon
app.delete('/:id', (c) => {
  const id = parseInt(c.req.param('id'))
  addonDb.delete(id)
  return c.json({ success: true })
})

// Get enabled addons for a profile
app.get('/profile/:profileId', (c) => {
  const profileId = parseInt(c.req.param('profileId'))
  const addons = addonDb.getEnabledForProfile(profileId)
  return c.json(addons)
})

// Get all addons with status for a profile (for management)
app.get('/profile/:profileId/manage', (c) => {
  const profileId = parseInt(c.req.param('profileId'))
  const addons = addonDb.getAllWithStatusForProfile(profileId)
  return c.json(addons)
})

// Toggle addon for profile
app.post('/profile/:profileId/toggle', async (c) => {
  const profileId = parseInt(c.req.param('profileId'))
  const { addonId, enabled } = await c.req.json()
  
  if (enabled) {
    addonDb.enableForProfile(profileId, addonId)
  } else {
    addonDb.disableForProfile(profileId, addonId)
  }
  
  return c.json({ success: true })
})

// Reorder addons for profile
app.post('/profile/:profileId/reorder', async (c) => {
  const profileId = parseInt(c.req.param('profileId'))
  const { addonIds } = await c.req.json()
  
  if (!Array.isArray(addonIds)) {
    return c.json({ error: 'addonIds must be an array' }, 400)
  }

  addonDb.updateProfileAddonOrder(profileId, addonIds)
  return c.json({ success: true })
})

export default app