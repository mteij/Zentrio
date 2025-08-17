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
   return c.json(profiles)
 })
 
 app.post('/', async (c) => {
   const user = c.get('user')
   const { name, avatar, avatarType } = await c.req.json()
 
   if (!name) {
     return c.json({ error: 'Profile name is required' }, 400)
   }
 
   const profile = await profileDb.create({
     user_id: user.id,
     name,
     avatar: avatar || name,
     avatar_type: avatarType || 'initials',
     is_default: false,
   })
 
   return c.json(profile)
 })
 
 app.put('/:id', async (c) => {
   const user = c.get('user')
   const profileId = parseInt(c.req.param('id'))
   const { name, avatar, avatarType } = await c.req.json()
 
   const profile = profileDb.findById(profileId)
   if (profile?.user_id !== user.id) {
     return c.json({ error: 'Forbidden' }, 403)
   }
 
   const updates: {
     name?: string
     avatar?: string
     avatar_type?: 'initials' | 'avatar'
   } = {
     name,
     avatar: avatar || name,
     avatar_type: avatarType,
   }
 
   const updatedProfile = await profileDb.update(profileId, updates)
 
   if (!updatedProfile) {
     return c.json({ error: 'Profile not found' }, 404)
   }
 
   return c.json(updatedProfile)
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