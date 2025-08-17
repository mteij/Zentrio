import { Hono } from 'hono'
import { userDb } from '../../services/database'
import type { Profile } from '../../services/database'

const app = new Hono()

// User Settings API - Simplified without authentication for now
app.get('/settings', async (c) => {
  try {
    // For demo purposes, use a default user ID
    const userId = 1
    const user = userDb.findById(userId)

    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    return c.json({
      addonManagerEnabled: user.addon_manager_enabled,
    })
  } catch (error) {
    return c.json({ error: 'Failed to load settings' }, 500)
  }
})

app.put('/settings', async (c) => {
  try {
    const settings = await c.req.json()
    
    // For demo purposes, use a default user ID
    const userId = 1
    const user = userDb.findById(userId)

    if (!user) {
        return c.json({ error: 'User not found' }, 404)
    }

    const updatedUser = userDb.update(userId, {
        addon_manager_enabled: settings.addonManagerEnabled,
    })

    if (!updatedUser) {
        return c.json({ error: 'Failed to save settings' }, 500)
    }
    
    return c.json({ message: 'Settings saved successfully' })
  } catch (error) {
    return c.json({ error: 'Failed to save settings' }, 500)
  }
})

app.get('/profile', async (c) => {
  try {
    // For demo purposes, use a default user ID
    const userId = 1
    const user = userDb.findById(userId)
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    return c.json({
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name
    })
  } catch (error) {
    return c.json({ error: 'Failed to load user profile' }, 500)
  }
})

// Email update endpoint
app.put('/email', async (c) => {
  try {
    const { email } = await c.req.json()
    
    if (!email || !email.includes('@')) {
      return c.json({ error: 'Valid email address is required' }, 400)
    }
    
    // For demo purposes, use a default user ID
    const userId = 1
    const user = userDb.findById(userId)
    
    if (!user) {
      return c.json({ error: 'User not found' }, 404)
    }
    
    // Check if email is already taken by another user
    const existingUser = userDb.findByEmail(email)
    if (existingUser && existingUser.id !== user.id) {
      return c.json({ error: 'Email address is already in use' }, 409)
    }
    
    // Update email in database
    const updateSuccess = userDb.updateEmail(user.id, email)
    
    if (!updateSuccess) {
      return c.json({ error: 'Failed to update email in database' }, 500)
    }
    
    return c.json({
      message: 'Email updated successfully',
      email: email
    })
  } catch (error) {
    return c.json({ error: 'Failed to update email' }, 500)
  }
})

export default app