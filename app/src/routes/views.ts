import { Hono } from 'hono'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getCookie } from 'hono/cookie'
import { auth } from '../services/auth'
import { LandingPage } from '../pages/LandingPage'
import { ProfilesPage } from '../pages/ProfilesPage'
import { SettingsPage } from '../pages/SettingsPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { StreamingHome } from '../pages/streaming/Home'
import { StreamingDetails } from '../pages/streaming/Details'
import { StreamingPlayer } from '../pages/streaming/Player'
import { StreamingCategory } from '../pages/streaming/Category'
import { StreamingLibrary } from '../pages/streaming/Library'
import { StreamingSearch } from '../pages/streaming/Search'
import { addonManager } from '../services/addons/addon-manager'
import { watchHistoryDb, libraryDb, profileDb } from '../services/database'
 
const app = new Hono()

async function isAuthenticated(c: any): Promise<boolean> {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })
  return !!session
}
 
async function serveHTML(filePath: string) {
  try {
    const content = await readFile(join(process.cwd(), 'src/views', filePath), 'utf-8')
    return new Response(content, {
      headers: { 'Content-Type': 'text/html' }
    })
  } catch (error) {
    return new Response('Page not found', { status: 404 })
  }
}
 
// JSX Component Routes (New)
app.get('/', async (c) => {
  if (await isAuthenticated(c)) return c.redirect('/profiles')
  return c.html(LandingPage({}))
})
 
app.get('/profiles', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.redirect('/')
  return c.html(ProfilesPage({ user: session.user }))
})
 
app.get('/settings', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  return c.html(SettingsPage({}))
})


app.get('/reset-password', async (c) => {
  return c.html(ResetPasswordPage({}))
})

// Streaming Routes
app.get('/streaming', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  return c.redirect('/profiles')
})

app.get('/streaming/:profileId', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  
  const profileId = parseInt(c.req.param('profileId'))
  if (isNaN(profileId)) return c.redirect('/profiles')

  try {
    const profile = profileDb.findById(profileId)
    const history = watchHistoryDb.getByProfileId(profileId)
    const results = await addonManager.getCatalogs(profileId)
    const catalogs = results.map(r => ({
      title: `${r.addon.name} - ${r.catalog.name || r.catalog.type}`,
      items: r.items
    }))
    return c.html(StreamingHome({ catalogs, history, profileId, profile }))
  } catch (e) {
    console.error('Streaming home error:', e)
    return c.html(StreamingHome({ catalogs: [], history: [], profileId }))
  }
})

app.get('/streaming/:profileId/series', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  const profileId = parseInt(c.req.param('profileId'))
  
  try {
    const results = await addonManager.getCatalogs(profileId)
    const catalogs = results
      .filter(r => r.catalog.type === 'series')
      .map(r => ({
        title: `${r.addon.name} - ${r.catalog.name || r.catalog.type}`,
        items: r.items
      }))
    return c.html(StreamingCategory({ catalogs, profileId, type: 'series' }))
  } catch (e) {
    return c.html(StreamingCategory({ catalogs: [], profileId, type: 'series' }))
  }
})

app.get('/streaming/:profileId/movie', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  const profileId = parseInt(c.req.param('profileId'))
  
  try {
    const results = await addonManager.getCatalogs(profileId)
    const catalogs = results
      .filter(r => r.catalog.type === 'movie')
      .map(r => ({
        title: `${r.addon.name} - ${r.catalog.name || r.catalog.type}`,
        items: r.items
      }))
    return c.html(StreamingCategory({ catalogs, profileId, type: 'movie' }))
  } catch (e) {
    return c.html(StreamingCategory({ catalogs: [], profileId, type: 'movie' }))
  }
})

app.get('/streaming/:profileId/library', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  const profileId = parseInt(c.req.param('profileId'))
  const items = libraryDb.getByProfileId(profileId)
  return c.html(StreamingLibrary({ items, profileId }))
})

app.get('/streaming/:profileId/search', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  const profileId = parseInt(c.req.param('profileId'))
  const query = c.req.query('q') || ''
  
  let results: any[] = []
  if (query) {
    results = await addonManager.search(query, profileId)
  }
  
  return c.html(StreamingSearch({ results, query, profileId }))
})

app.get('/streaming/:profileId/:type/:id', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  
  const profileId = parseInt(c.req.param('profileId'))
  const { type, id } = c.req.param()
  
  try {
    const profile = profileDb.findById(profileId)
    const meta = await addonManager.getMeta(type, id, profileId)
    if (!meta) return c.text('Content not found', 404)
    
    // Don't fetch streams server-side to avoid blocking the UI
    // Streams will be fetched client-side
    const streams: any[] = []
    const inLibrary = libraryDb.isAdded(profileId, id)
    
    return c.html(StreamingDetails({ meta, streams, profileId, inLibrary, profile }))
  } catch (e) {
    console.error('Streaming details error:', e)
    return c.text('Error loading content', 500)
  }
})

app.get('/streaming/:profileId/player', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  
  const profileId = parseInt(c.req.param('profileId'))
  const streamParam = c.req.query('stream')
  const metaParam = c.req.query('meta')
  
  if (!streamParam || !metaParam) return c.redirect(`/streaming/${profileId}`)
  
  try {
    const stream = JSON.parse(streamParam)
    const meta = JSON.parse(metaParam)
    return c.html(StreamingPlayer({ stream, meta, profileId }))
  } catch (e) {
    return c.redirect(`/streaming/${profileId}`)
  }
})
 
// Auth modal routes (keep for compatibility)
app.get('/views/auth/otp-modal.html', async (c) => {
  return serveHTML('auth/otp-modal.html')
})

app.get('/views/auth/magic-link-modal.html', async (c) => {
  return serveHTML('auth/magic-link-modal.html')
})

 
export default app
