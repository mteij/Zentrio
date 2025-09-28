import { Hono } from 'hono'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getCookie } from 'hono/cookie'
import { sessionDb } from '../services/database'
import { LandingPage } from '../pages/LandingPage'
import { ProfilesPage } from '../pages/ProfilesPage'
import { SettingsPage } from '../pages/SettingsPage'
import { DownloadsPage } from '../pages/DownloadsPage'
 
const app = new Hono()

function isAuthenticated(c: any): boolean {
  const cookies = getCookie(c)
  
  // Check for Better Auth session token
  const betterAuthToken = Object.keys(cookies).find((k) => k === 'session_token' || k.endsWith('.session_token'))
  if (betterAuthToken) {
    return true // Trust Better Auth's session management
  }
  
  // Check for our local session
  const sessionId = cookies['sessionId']
  if (sessionId) {
    // Validate session in database
    const session = sessionDb.findByToken(sessionId)
    return !!session
  }
  
  return false
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
  if (isAuthenticated(c)) return c.redirect('/profiles')
  return c.html(LandingPage({}))
})
 
app.get('/profiles', async (c) => {
  if (!isAuthenticated(c)) return c.redirect('/')
  return c.html(ProfilesPage({}))
})
 
app.get('/settings', async (c) => {
  if (!isAuthenticated(c)) return c.redirect('/')
  return c.html(SettingsPage({}))
})


app.get('/downloads', async (c) => {
  if (!isAuthenticated(c)) return c.redirect('/')
  return c.html(DownloadsPage({}))
})

 
// Auth modal routes (keep for compatibility)
app.get('/views/auth/otp-modal.html', async (c) => {
  return serveHTML('auth/otp-modal.html')
})

app.get('/views/auth/magic-link-modal.html', async (c) => {
  return serveHTML('auth/magic-link-modal.html')
})

 
export default app
