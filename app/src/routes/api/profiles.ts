import { Hono } from 'hono'
import { profileDb, User } from '../../services/database'
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
   const sanitizedProfiles = profiles.map(p => {
     const { stremio_password, ...rest } = p;
     return rest;
   });
   return c.json(sanitizedProfiles)
 })
 
 app.post('/', async (c) => {
   const user = c.get('user')
   const { name, avatar, avatarType, stremioEmail, stremioPassword } = await c.req.json()
 
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
 
   // Don't return password
   const { stremio_password, ...safeProfile } = profile;

   return c.json(safeProfile)
 })
 
 app.put('/:id', async (c) => {
   const user = c.get('user')
   const profileId = parseInt(c.req.param('id'))
   const { name, avatar, avatarType, stremioEmail, stremioPassword } = await c.req.json()

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
     updates.stremio_password = stremioPassword;
   }
 
   const updatedProfile = await profileDb.update(profileId, updates)
 
   if (!updatedProfile) {
     return c.json({ error: 'Profile not found' }, 404)
   }
 
   // Don't return password
   const { stremio_password, ...safeProfile } = updatedProfile;

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

export default app