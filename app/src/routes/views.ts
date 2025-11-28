import { Hono } from 'hono'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getCookie } from 'hono/cookie'
import { auth } from '../services/auth'
import { LandingPage } from '../pages/LandingPage'
import { ProfilesPage } from '../pages/ProfilesPage'
import { SettingsPage } from '../pages/SettingsPage'
import { ExploreAddonsPage } from '../pages/ExploreAddonsPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
import { TauriSetupPage } from '../pages/TauriSetupPage'
import { StreamingHome } from '../pages/streaming/Home'
import { StreamingDetails } from '../pages/streaming/Details'
import { StreamingPlayer } from '../pages/streaming/Player'
import { StreamingExplore } from '../pages/streaming/Explore'
import { StreamingLibrary } from '../pages/streaming/Library'
import { StreamingSearch } from '../pages/streaming/Search'
import { StreamingCatalog } from '../pages/streaming/Catalog'
import { addonManager } from '../services/addons/addon-manager'
import { watchHistoryDb, listDb, profileDb, addonDb } from '../services/database'
import { MetaPreview } from '../services/addons/types'
 
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
  // Check if running in Tauri and redirect to setup page
  const userAgent = c.req.header('user-agent') || ''
  const isTauri = userAgent.includes('Tauri') || c.req.query('tauri') === 'true'
  
  if (isTauri) {
    return c.redirect('/setup')
  }
  
  if (await isAuthenticated(c)) return c.redirect('/profiles')
  return c.html(LandingPage({}))
})

// Tauri setup route
app.get('/setup', async (c) => {
  return c.html(TauriSetupPage({}))
})
 
app.get('/profiles', async (c) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.redirect('/')
  return c.html(ProfilesPage({ user: session.user }))
})
 
app.get('/settings', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  // @ts-ignore
  return c.html(SettingsPage({}))
})

app.get('/settings/explore-addons', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  return c.html(ExploreAddonsPage())
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
    const profile = profileDb.findWithSettingsById(profileId)
    const history = watchHistoryDb.getByProfileId(profileId)
    const results = await addonManager.getCatalogs(profileId)
    const trending = await addonManager.getTrending(profileId)
    
    // Determine if the fallback was used by checking if the results contain only the default addon
    // and if the profile has no other addons enabled.
    const enabledAddons = profileDb.getSettingsProfileId(profileId) ? addonDb.getEnabledForProfile(profileDb.getSettingsProfileId(profileId)!) : [];
    const onlyDefaultAddon = results.every(r => r.manifestUrl === 'https://v3-cinemeta.strem.io/manifest.json');
    const showFallbackToast = enabledAddons.length === 0 && onlyDefaultAddon && results.length > 0;

    const catalogs = results.map(r => {
      const typeName = r.catalog.type === 'movie' ? 'Movies' : (r.catalog.type === 'series' ? 'Series' : 'Other')
      const manifestUrl = r.manifestUrl || (r.addon as any).manifest_url || (r.addon as any).id;
      return {
        title: `${typeName} - ${r.catalog.name || r.catalog.type}`,
        items: r.items,
        seeAllUrl: `/streaming/${profileId}/catalog/${encodeURIComponent(manifestUrl)}/${r.catalog.type}/${r.catalog.id}`
      }
    })
    return c.html(StreamingHome({ catalogs, history, profileId, profile, trending, showFallbackToast }))
  } catch (e) {
    console.error('Streaming home error:', e)
    return c.html(StreamingHome({ catalogs: [], history: [], profileId, trending: [], showFallbackToast: false }))
  }
})

app.get('/streaming/:profileId/explore', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  
  const profileId = parseInt(c.req.param('profileId'))
  if (isNaN(profileId)) return c.redirect('/profiles')

  const type = c.req.query('type')
  const genre = c.req.query('genre')

  try {
    const profile = profileDb.findWithSettingsById(profileId)
    const history = watchHistoryDb.getByProfileId(profileId)
    
    const filters = await addonManager.getAvailableFilters(profileId)
    
    let items: MetaPreview[] = []
    let catalogs: any[] = []

    if (type || genre) {
       // If type is not provided but genre is, we might need to search across all types or default to movie
       // For now, let's require type if genre is present, or default to 'movie' if only genre is present
       const searchType = type || 'movie'
       items = await addonManager.getFilteredItems(profileId, searchType, genre)
    } else {
       const results = await addonManager.getCatalogs(profileId)
       catalogs = results.map(r => {
        const typeName = r.catalog.type === 'movie' ? 'Movies' : (r.catalog.type === 'series' ? 'Series' : 'Other')
        const manifestUrl = r.manifestUrl || (r.addon as any).manifest_url || (r.addon as any).id;
        return {
          title: `${typeName} - ${r.catalog.name || r.catalog.type}`,
          items: r.items,
          seeAllUrl: `/streaming/${profileId}/catalog/${encodeURIComponent(manifestUrl)}/${r.catalog.type}/${r.catalog.id}`
        }
      })
    }

    return c.html(StreamingExplore({
      catalogs,
      items,
      filters,
      activeFilters: { type, genre },
      history,
      profileId,
      profile
    }))
  } catch (e) {
    console.error('Streaming explore error:', e)
    return c.html(StreamingExplore({
      catalogs: [],
      items: [],
      filters: { types: [], genres: [] },
      activeFilters: {},
      history: [],
      profileId
    }))
  }
})

app.get('/streaming/:profileId/library', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  const profileId = parseInt(c.req.param('profileId'))
  const profile = profileDb.findWithSettingsById(profileId)
  
  const lists = listDb.getAll(profileId)
  if (lists.length === 0) {
    // Should have been created by migration, but just in case
    listDb.create(profileId, 'My List')
    return c.redirect(c.req.url)
  }
  
  const activeList = lists[0]
  const items = listDb.getItems(activeList.id)
  
  return c.html(StreamingLibrary({ lists, activeList, items, profileId, profile }))
})

app.get('/streaming/:profileId/library/:listId', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  const profileId = parseInt(c.req.param('profileId'))
  const listId = parseInt(c.req.param('listId'))
  const profile = profileDb.findWithSettingsById(profileId)
  
  const lists = listDb.getAll(profileId)
  const activeList = lists.find(l => l.id === listId)
  
  if (!activeList) return c.redirect(`/streaming/${profileId}/library`)
  
  const items = listDb.getItems(activeList.id)
  
  return c.html(StreamingLibrary({ lists, activeList, items, profileId, profile }))
})

app.get('/streaming/:profileId/search', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  const profileId = parseInt(c.req.param('profileId'))
  const profile = profileDb.findWithSettingsById(profileId)
  const query = c.req.query('q') || ''
  
  // If there's a query, we'll load the page first then fetch results client-side
  // This makes the navigation instant as requested
  let results: any[] = []
  
  // If it's an HTMX request or we want server-side rendering (optional), we could do it here
  // But for the "instant" requirement, we'll just return the shell with the query
  
  return c.html(StreamingSearch({ results, query, profileId, profile }))
})

app.get('/streaming/:profileId/catalog/:manifestUrl/:type/:id', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  
  const profileId = parseInt(c.req.param('profileId'))
  const manifestUrl = decodeURIComponent(c.req.param('manifestUrl'))
  const type = c.req.param('type')
  const id = c.req.param('id')
  
  try {
    const profile = profileDb.findWithSettingsById(profileId)
    const result = await addonManager.getCatalogItems(profileId, manifestUrl, type, id)
    
    if (!result) return c.text('Catalog not found', 404)
    
    return c.html(StreamingCatalog({
      items: result.items,
      title: result.title,
      profileId,
      profile,
      manifestUrl,
      type,
      id
    }))
  } catch (e) {
    console.error('Streaming catalog error:', e)
    return c.text('Error loading catalog', 500)
  }
})

app.get('/streaming/:profileId/:type/:id', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  
  const profileId = parseInt(c.req.param('profileId'))
  const { type, id } = c.req.param()
  
  try {
    const profile = profileDb.findWithSettingsById(profileId)
    const meta = await addonManager.getMeta(type, id, profileId)
    if (!meta) return c.text('Content not found', 404)
    
    // Don't fetch streams server-side to avoid blocking the UI
    // Streams will be fetched client-side
    const streams: any[] = []
    const inLibrary = listDb.isInAnyList(profileId, id)
    
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
