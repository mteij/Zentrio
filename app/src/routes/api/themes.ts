import { Hono } from 'hono'
import themeService from '../../services/themeService'

const app = new Hono()

// List available themes (reads JSON files from src/themes)
app.get('/', async (c) => {
  try {
    const themes = await themeService.listThemes()
    // Return lightweight list for the client
    const payload = themes.map(t => ({
      id: t.id,
      name: t.name,
      accent: t.accent,
      btnPrimary: t.btnPrimary || t.accent,
      text: t.text || '#ffffff',
      muted: t.muted || '#b3b3b3'
    }))
    return c.json(payload)
  } catch (e) {
    console.error('Failed to list themes', e)
    return c.json({ error: 'Failed to list themes' }, 500)
  }
})

// Save/upload a theme (writes a JSON file to src/themes)
// Expects full theme JSON in request body; id parameter used as filename
app.post('/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()
    if (!body || typeof body !== 'object') {
      return c.json({ error: 'Invalid theme body' }, 400)
    }

    // Basic validation (ensure accent color exists)
    if (!body.accent) {
      return c.json({ error: 'Theme accent color is required' }, 400)
    }

    const theme = Object.assign({ id }, body)
    await themeService.saveTheme(id, theme)
    return c.json({ message: 'Theme saved' })
  } catch (e) {
    console.error('Failed to save theme', e)
    return c.json({ error: 'Failed to save theme' }, 500)
  }
})

export default app
