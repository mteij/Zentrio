import { addonDb, db, profileDb, userDb, type User } from '../../services/database'
import { AddonClient } from '../../services/addons/client'
import { sessionMiddleware, optionalSessionMiddleware } from '../../middleware/session'
import { createTaggedOpenAPIApp } from './openapi-route'
import { logger } from '../../services/logger'

const log = logger.scope('API:Addons')

const app = createTaggedOpenAPIApp<{
  Variables: { user: User; guestMode: boolean; session: any }
}>('Addons')

// Returns the user_id that owns a given settings profile, or null if not found.
function getSettingsProfileOwner(settingsProfileId: number): string | null {
  const row = db.prepare('SELECT user_id FROM profiles WHERE settings_profile_id = ?').get(settingsProfileId) as { user_id: string } | null
  return row?.user_id ?? null
}

// List all installed addons
app.get('/', (c) => {
  const addons = addonDb.list()
  return c.json(addons)
})

// Install an addon
app.post('/', sessionMiddleware, async (c) => {
  const { manifestUrl, settingsProfileId } = await c.req.json()
  if (!manifestUrl) return c.json({ error: 'Manifest URL required' }, 400)

  try {
    // Validate manifest
    const client = new AddonClient(manifestUrl)
    let manifest;
    try {
        manifest = await client.init()
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        return c.json({ error: `Failed to fetch manifest: ${message}` }, 400)
    }
    
    let logoUrl = manifest.logo
    if (logoUrl && !logoUrl.startsWith('http')) {
      const baseUrl = new URL(manifestUrl)
      logoUrl = new URL(logoUrl, baseUrl).href
    }

    const addon = addonDb.create({
      manifest_url: manifestUrl,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      logo: manifest.logo,
      logo_url: logoUrl,
      behavior_hints: manifest.behaviorHints
    })

    // If settingsProfileId is provided, enable it for that profile
    if (settingsProfileId) {
        addonDb.enableForProfile(parseInt(settingsProfileId), addon.id);
    }
    
    return c.json(addon)
  } catch (e) {
    log.error('Failed to install addon', e)
    return c.json({ error: 'Internal server error during installation' }, 500)
  }
})

// Delete an addon
app.delete('/:id', sessionMiddleware, (c) => {
  const id = parseInt(c.req.param('id'))
  addonDb.delete(id)
  return c.json({ success: true })
})

// Get enabled addons for a profile (legacy support + resolution)
app.get('/profile/:profileId', optionalSessionMiddleware, async (c) => {
  const rawProfileId = c.req.param('profileId')
  let profileId: number

  if (rawProfileId === 'guest') {
    const guestDefaultProfile = await userDb.ensureGuestDefaultProfile()
    profileId = guestDefaultProfile.id
  } else {
    profileId = parseInt(rawProfileId)
  }

  // Resolve settings profile
  const settingsProfileId = profileDb.getSettingsProfileId(profileId)
  if (!settingsProfileId) return c.json([])
  
  const addons = addonDb.getEnabledForProfile(settingsProfileId)
  return c.json(addons)
})

// Get enabled addons for a settings profile
app.get('/settings-profile/:settingsProfileId', (c) => {
  const settingsProfileId = parseInt(c.req.param('settingsProfileId'))
  const addons = addonDb.getEnabledForProfile(settingsProfileId)
  return c.json(addons)
})

// Get all addons with status for a settings profile (for management)
app.get('/settings-profile/:settingsProfileId/manage', (c) => {
  const settingsProfileId = parseInt(c.req.param('settingsProfileId'))
  const addons = addonDb.getAllWithStatusForProfile(settingsProfileId)
  return c.json(addons)
})

// Toggle addon for settings profile
app.post('/settings-profile/:settingsProfileId/toggle', optionalSessionMiddleware, async (c) => {
  const settingsProfileId = parseInt(c.req.param('settingsProfileId'))
  const isGuestMode = c.get('guestMode') as boolean
  const sessionUser = c.get('user')

  if (!isGuestMode && sessionUser) {
    const ownerId = getSettingsProfileOwner(settingsProfileId)
    if (ownerId !== sessionUser.id) {
      return c.json({ error: 'Forbidden' }, 403)
    }
  }

  const { addonId, enabled } = await c.req.json()

  if (enabled) {
    addonDb.enableForProfile(settingsProfileId, addonId)
  } else {
    addonDb.disableForProfile(settingsProfileId, addonId)
  }

  return c.json({ success: true })
})

// Reorder addons for settings profile
app.post('/settings-profile/:settingsProfileId/reorder', optionalSessionMiddleware, async (c) => {
  const settingsProfileId = parseInt(c.req.param('settingsProfileId'))
  const isGuestMode = c.get('guestMode') as boolean
  const sessionUser = c.get('user')

  if (!isGuestMode && sessionUser) {
    const ownerId = getSettingsProfileOwner(settingsProfileId)
    if (ownerId !== sessionUser.id) {
      return c.json({ error: 'Forbidden' }, 403)
    }
  }

  const { addonIds } = await c.req.json()

  if (!Array.isArray(addonIds)) {
    return c.json({ error: 'addonIds must be an array' }, 400)
  }

  addonDb.updateProfileAddonOrder(settingsProfileId, addonIds)
  return c.json({ success: true })
})

// Remove addon from settings profile
app.delete('/settings-profile/:settingsProfileId/:addonId', optionalSessionMiddleware, (c) => {
  const settingsProfileId = parseInt(c.req.param('settingsProfileId'))
  const addonId = parseInt(c.req.param('addonId'))

  log.debug(`DELETE /settings-profile/${settingsProfileId}/${addonId}`)

  if (isNaN(settingsProfileId) || isNaN(addonId)) {
    log.error('Invalid parameters for remove addon')
    return c.json({ error: 'Invalid parameters' }, 400)
  }

  const isGuestMode = c.get('guestMode') as boolean
  const sessionUser = c.get('user')

  if (!isGuestMode && sessionUser) {
    const ownerId = getSettingsProfileOwner(settingsProfileId)
    if (ownerId !== sessionUser.id) {
      return c.json({ error: 'Forbidden' }, 403)
    }
  }

  addonDb.removeFromProfile(settingsProfileId, addonId)
  return c.json({ success: true })
})

export default app
