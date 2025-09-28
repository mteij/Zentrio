import { Hono } from 'hono'
import { db, profileDb, profileProxySettingsDb, User, Profile } from '../../services/database'
import { sessionMiddleware } from '../../middleware/session'
 
 const app = new Hono<{
   Variables: {
     user: User
   }
 }>()
 
 app.use('/*', sessionMiddleware)
 
 // Profile Management API
 app.get('/', async (c) => {
   const user = c.get('user')
   const profiles = profileDb.findByUserId(user.id)
   // Remove password from profiles
   const sanitizedProfiles = profiles.map((p: Profile & { settings?: any }) => {
     const { stremio_password, ...rest } = p
     return rest
   })
   return c.json(sanitizedProfiles)
 })
 
 app.post('/', async (c) => {
   const user = c.get('user')
   const { name, avatar, avatarType, stremioEmail, stremioPassword, nsfwFilterEnabled, ageRating, hideCalendarButton, hideAddonsButton } = await c.req.json()
 
   if (!name || !stremioEmail || !stremioPassword) {
     return c.json({ error: 'Profile name, Stremio email, and password are required' }, 400)
   }
 
  const profile = await profileDb.create({
    user_id: user.id,
    name,
    avatar: avatar || name,
    avatar_type: avatarType || 'initials',
    is_default: false,
    stremio_email: stremioEmail,
    stremio_password: stremioPassword,
  })

  await profileProxySettingsDb.create({
    profile_id: profile.id,
    nsfw_filter_enabled: nsfwFilterEnabled,
    nsfw_age_rating: ageRating,
    hide_calendar_button: hideCalendarButton,
    hide_addons_button: hideAddonsButton,
  })

  // Don't return password
  const { stremio_password, ...safeProfile } = profile

  return c.json(safeProfile)
})
 
 app.put('/:id', async (c) => {
   const user = c.get('user')
   const profileId = parseInt(c.req.param('id'))
   const { name, avatar, avatarType, stremioEmail, stremioPassword, nsfwFilterEnabled, ageRating, hideCalendarButton, hideAddonsButton } = await c.req.json()

   if (!name || !stremioEmail) {
     return c.json({ error: 'Profile name and Stremio email are required' }, 400)
   }
 
   const profile = profileDb.findById(profileId)
   if (profile?.user_id !== user.id) {
     return c.json({ error: 'Forbidden' }, 403)
   }
 
  const updates: {
      name?: string
      avatar?: string
      avatar_type?: 'initials' | 'avatar'
      stremio_email?: string
      stremio_password?: string
    } = {
      name,
      avatar: avatar || name,
      avatar_type: avatarType,
      stremio_email: stremioEmail,
    }

  if (stremioPassword) {
    updates.stremio_password = stremioPassword
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
  })

  // Don't return password
  const { stremio_password, ...safeProfile } = updatedProfile

  return c.json(safeProfile)
})
 
 app.delete('/:id', async (c) => {
   const user = c.get('user')
   const profileId = parseInt(c.req.param('id'))
 
   const profile = profileDb.findById(profileId)
   if (profile?.user_id !== user.id) {
     return c.json({ error: 'Forbidden' }, 403)
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
  const profileId = parseInt(c.req.param('id'))
  const profile = profileDb.findById(profileId)
  if (profile?.user_id !== user.id) {
    return c.json({ error: 'Forbidden' }, 403)
  }
  const settings = profileProxySettingsDb.findByProfileId(profileId)
  return c.json({
    nsfwFilterEnabled: settings?.nsfw_filter_enabled ?? false,
    ageRating: settings?.nsfw_age_rating ?? 0,
    hideCalendarButton: settings?.hide_calendar_button ?? false,
    hideAddonsButton: settings?.hide_addons_button ?? false,
  })
})

app.put('/:id/settings', async (c) => {
  try {
    const user = c.get('user')
    const profileId = parseInt(c.req.param('id'))
    const profile = profileDb.findById(profileId)
    if (profile?.user_id !== user.id) {
      return c.json({ error: 'Forbidden' }, 403)
    }
    const body = await c.req.json()
    const updated = profileProxySettingsDb.update(profileId, {
      nsfw_filter_enabled: body.nsfwFilterEnabled,
      nsfw_age_rating: body.ageRating,
      hide_calendar_button: body.hideCalendarButton,
      hide_addons_button: body.hideAddonsButton,
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
