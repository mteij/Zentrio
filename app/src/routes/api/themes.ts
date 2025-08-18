import { Hono } from 'hono'
import themeService from '../../services/themeService'

const app = new Hono()

// List available themes (reads JSON files from src/themes)
app.get('/', async (c) => {
  try {
    const themes = await themeService.listThemes()
    // Return lightweight list for the client (id, name, accent, muted preview colors)
    const payload = themes.map(t => ({
      id: t.id,
      name: t.name,
      accent: t.accent,
      btnPrimary: t.btnPrimary,
      text: t.text || '#ffffff',
      vanta: t.vanta
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

    // Basic validation (ensure vanta keys exist)
    if (!body.vanta || !body.vanta.highlight || !body.vanta.midtone || !body.vanta.lowlight || !body.vanta.base) {
      return c.json({ error: 'Theme vanta colors are required' }, 400)
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