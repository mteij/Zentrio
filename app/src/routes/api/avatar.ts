import { generateAvatar, generateRandomAvatar, isValidAvatarStyle, DEFAULT_AVATAR_STYLE, AVATAR_STYLES, AVATAR_STYLE_NAMES, type AvatarStyle } from '../../services/avatar'
import { createTaggedOpenAPIApp } from './openapi-route'

const app = createTaggedOpenAPIApp('Avatar')

// Get available avatar styles
app.get('/styles', (c) => {
  const styles = Object.keys(AVATAR_STYLES).map(key => ({
    id: key,
    name: AVATAR_STYLE_NAMES[key as AvatarStyle]
  }))
  return c.json({ styles, default: DEFAULT_AVATAR_STYLE })
})

// Root handler (redirect/alias to random or just generate)
// Fixes 404 on /api/avatar/?style=...
app.get('/', async (c) => {
    try {
        const styleParam = c.req.query('style') || DEFAULT_AVATAR_STYLE
        const style = isValidAvatarStyle(styleParam) ? styleParam : DEFAULT_AVATAR_STYLE
        
        // If they want the SVG directly (acting as image src)
        // We generate a random one
        const seed = Math.random().toString(36).substring(7)
        const svg = generateAvatar(seed, style)
        
        return new Response(svg, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'no-store' // Random should not be cached tightly
          }
        })
    } catch (error) {
        return c.json({ error: 'Failed to generate avatar' }, 500)
    }
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
