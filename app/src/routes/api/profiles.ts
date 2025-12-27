import { Hono } from 'hono'
import { db, profileDb, profileProxySettingsDb, userDb, User, Profile } from '../../services/database'
import { optionalSessionMiddleware } from '../../middleware/session'
 
const app = new Hono<{
  Variables: {
    user: User | null
    guestMode: boolean
    session: any
  }
}>()
 
app.use('/*', optionalSessionMiddleware)
 
// Profile Management API
app.get('/', async (c) => {
  const user = c.get('user')
  const isGuestMode = c.get('guestMode')
  
  // In guest mode, get/create the guest user first
  const effectiveUser = isGuestMode ? userDb.getOrCreateGuestUser() : user
  if (!effectiveUser) {
    return c.json({ error: 'User not found' }, 401)
  }
  
  const profiles = profileDb.findByUserId(effectiveUser.id)
  // Remove password from profiles
  const sanitizedProfiles = profiles.map((p: Profile & { settings?: any }) => {
    return p
  })
  return c.json(sanitizedProfiles)
})

app.get('/:id', async (c) => {
  const user = c.get('user')
  const isGuestMode = c.get('guestMode')
  const profileId = parseInt(c.req.param('id'))
  
  const effectiveUser = isGuestMode ? userDb.getOrCreateGuestUser() : user
  if (!effectiveUser) {
    return c.json({ error: 'User not found' }, 401)
  }

  const profile = profileDb.findById(profileId)
  
  if (!profile) {
    return c.json({ error: 'Profile not found' }, 404)
  }
  
  if (profile.user_id !== effectiveUser.id) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  return c.json(profile)
})
 
 app.post('/', async (c) => {
   const user = c.get('user')
   const isGuestMode = c.get('guestMode')
   const { name, avatar, avatarType, avatarStyle, nsfwFilterEnabled, ageRating, hideCalendarButton, hideAddonsButton, settingsProfileId } = await c.req.json()
 
   if (!name) {
     return c.json({ error: 'Profile name is required' }, 400)
   }
   
   const effectiveUser = isGuestMode ? userDb.getOrCreateGuestUser() : user
   if (!effectiveUser) {
     return c.json({ error: 'User not found' }, 401)
   }
 
  const profile = await profileDb.create({
    user_id: effectiveUser.id,
    name,
    avatar: avatar || name,
    avatar_type: avatarType || 'initials',
    avatar_style: avatarStyle || 'bottts-neutral',
    is_default: false,
    settings_profile_id: settingsProfileId
  })

  await profileProxySettingsDb.create({
    profile_id: profile.id,
    nsfw_filter_enabled: nsfwFilterEnabled,
    nsfw_age_rating: ageRating,
    hide_calendar_button: hideCalendarButton,
    hide_addons_button: hideAddonsButton,
    hero_banner_enabled: true, // Default to true
  })

  // Ensure Zentrio addon is enabled for the new profile's settings profile
  if (profile.settings_profile_id) {
    const { addonDb, db } = require('../../services/database')
    const zentrioAddon = db.prepare("SELECT id FROM addons WHERE manifest_url = 'zentrio://tmdb-addon'").get()
    if (zentrioAddon) {
      addonDb.enableForProfile(profile.settings_profile_id, zentrioAddon.id)
    }
  }

  // Don't return password
  return c.json(profile)
})
 
 app.put('/:id', async (c) => {
   const user = c.get('user')
   const isGuestMode = c.get('guestMode')
   const profileId = parseInt(c.req.param('id'))
   const { name, avatar, avatarType, avatarStyle, nsfwFilterEnabled, ageRating, hideCalendarButton, hideAddonsButton, settingsProfileId } = await c.req.json()

   if (!name) {
     return c.json({ error: 'Profile name is required' }, 400)
   }
   
   const effectiveUser = isGuestMode ? userDb.getOrCreateGuestUser() : user
   if (!effectiveUser) {
     return c.json({ error: 'User not found' }, 401)
   }
 
   const profile = profileDb.findById(profileId)
   if (profile?.user_id !== effectiveUser.id) {
     return c.json({ error: 'Forbidden' }, 403)
   }
 
  const updates: {
      name?: string
      avatar?: string
      avatar_type?: 'initials' | 'avatar'
      avatar_style?: string
      settings_profile_id?: number
    } = {
      name,
      avatar: avatar || name,
      avatar_type: avatarType,
      avatar_style: avatarStyle,
      settings_profile_id: settingsProfileId
    }

  const updatedProfile = await profileDb.update(profileId, updates)

  if (!updatedProfile) {
    return c.json({ error: 'Profile not found' }, 404)
  }

  await profileProxySettingsDb.update(profileId, {
    nsfw_filter_enabled: nsfwFilterEnabled,
    nsfw_age_rating: ageRating,
    hide_calendar_button: hideCalendarButton,
    hide_addons_button: hideAddonsButton,
    // hero_banner_enabled is not currently sent by the profile edit modal, so we don't update it here yet
    // unless we update the frontend to send it.
  })

  // Don't return password
  return c.json(updatedProfile)
})
 
 app.delete('/:id', async (c) => {
   const user = c.get('user')
   const isGuestMode = c.get('guestMode')
   const profileId = parseInt(c.req.param('id'))
   
   const effectiveUser = isGuestMode ? userDb.getOrCreateGuestUser() : user
   if (!effectiveUser) {
     return c.json({ error: 'User not found' }, 401)
   }
 
   const profile = profileDb.findById(profileId)
   
   if (!profile) {
     return c.json({ error: 'Profile not found' }, 404)
   }
   
   if (profile.user_id !== effectiveUser.id) {
     return c.json({ error: 'Forbidden' }, 403)
   }

   // Check if profile is default
   if (profile.is_default) {
     return c.json({ error: 'Cannot delete the default profile' }, 400)
   }

   // Check if profile is currently in use (has active sessions)
   const activeSessions = db.prepare('SELECT COUNT(*) as count FROM proxy_sessions WHERE profile_id = ? AND is_active = TRUE').get(profileId) as { count: number }
   if (activeSessions && activeSessions.count > 0) {
     return c.json({ error: 'Cannot delete a profile that is currently in use' }, 400)
   }
 
   const deleted = profileDb.delete(profileId)
 
   if (!deleted) {
     return c.json({ error: 'Profile not found' }, 404)
   }
 
   return c.json({ message: 'Profile deleted successfully' })
 })

/**
 * Profile Proxy Settings endpoints
 * - GET /api/profiles/:id/settings
 * - PUT /api/profiles/:id/settings
 */
app.get('/:id/settings', async (c) => {
  const user = c.get('user')
  const isGuestMode = c.get('guestMode')
  const profileId = parseInt(c.req.param('id'))
  
  const effectiveUser = isGuestMode ? userDb.getOrCreateGuestUser() : user
  if (!effectiveUser) {
    return c.json({ error: 'User not found' }, 401)
  }
  
  const profile = profileDb.findById(profileId)
  if (profile?.user_id !== effectiveUser.id) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const settings = profileProxySettingsDb.findByProfileId(profileId)
  return c.json({
    nsfwFilterEnabled: settings?.nsfw_filter_enabled ?? false,
    ageRating: settings?.nsfw_age_rating ?? 0,
    hideCalendarButton: settings?.hide_calendar_button ?? false,
    hideAddonsButton: settings?.hide_addons_button ?? false,
    heroBannerEnabled: (settings as any)?.hero_banner_enabled ?? true,
  })
})

app.put('/:id/settings', async (c) => {
  try {
    const user = c.get('user')
    const isGuestMode = c.get('guestMode')
    const profileId = parseInt(c.req.param('id'))
    
    const effectiveUser = isGuestMode ? userDb.getOrCreateGuestUser() : user
    if (!effectiveUser) {
      return c.json({ error: 'User not found' }, 401)
    }
    
    const profile = profileDb.findById(profileId)
    if (profile?.user_id !== effectiveUser.id) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    const body = await c.req.json()
    const updated = profileProxySettingsDb.update(profileId, {
      nsfw_filter_enabled: body.nsfwFilterEnabled,
      nsfw_age_rating: body.ageRating,
      hide_calendar_button: body.hideCalendarButton,
      hide_addons_button: body.hideAddonsButton,
      hero_banner_enabled: body.heroBannerEnabled,
    })
    if (!updated) {
      return c.json({ error: 'Failed to save settings' }, 500)
    }
    return c.json({ message: 'Settings saved successfully' })
  } catch (_e) {
    return c.json({ error: 'Failed to save settings' }, 500)
  }
})

export default app
