import { Hono } from 'hono'
import { generateAvatar, generateRandomAvatar } from '../../services/avatar'

const app = new Hono()

// Generate random avatar
app.get('/random', async (c) => {
  try {
    const { svg, seed } = await generateRandomAvatar()
    
    return c.json({
      svg,
      seed,
      dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
    })
  } catch (error) {
    return c.json({ error: 'Failed to generate random avatar' }, 500)
  }
})

// Avatar API with seed
app.get('/:seed', async (c) => {
  try {
    const seed = c.req.param('seed')
    const svg = await generateAvatar(seed)
    
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      }
    })
  } catch (error) {
    return c.json({ error: 'Failed to generate avatar' }, 500)
  }
})

export default app
