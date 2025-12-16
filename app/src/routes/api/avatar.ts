import { Hono } from 'hono'
import { generateAvatar, generateRandomAvatar, isValidAvatarStyle, DEFAULT_AVATAR_STYLE, AVATAR_STYLES, AVATAR_STYLE_NAMES, type AvatarStyle } from '../../services/avatar'

const app = new Hono()

// Get available avatar styles
app.get('/styles', (c) => {
  const styles = Object.keys(AVATAR_STYLES).map(key => ({
    id: key,
    name: AVATAR_STYLE_NAMES[key as AvatarStyle]
  }))
  return c.json({ styles, default: DEFAULT_AVATAR_STYLE })
})

// Generate random avatar
app.get('/random', async (c) => {
  try {
    const styleParam = c.req.query('style') || DEFAULT_AVATAR_STYLE
    const style = isValidAvatarStyle(styleParam) ? styleParam : DEFAULT_AVATAR_STYLE
    
    const { svg, seed } = generateRandomAvatar(style)
    
    return c.json({
      svg,
      seed,
      style,
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
    const styleParam = c.req.query('style') || DEFAULT_AVATAR_STYLE
    const style = isValidAvatarStyle(styleParam) ? styleParam : DEFAULT_AVATAR_STYLE

    const svg = generateAvatar(seed, style)
    
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
