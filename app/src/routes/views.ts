import { Hono } from 'hono'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getCookie } from 'hono/cookie'
import { auth } from '../services/auth'
import { LandingPage } from '../pages/LandingPage'
import { ProfilesPage } from '../pages/ProfilesPage'
import { SettingsPage } from '../pages/SettingsPage'
import { DownloadsPage } from '../pages/DownloadsPage'
import { ResetPasswordPage } from '../pages/ResetPasswordPage'
 
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
  if (!await isAuthenticated(c)) return c.redirect('/')
  return c.html(ProfilesPage({}))
})
 
app.get('/settings', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  return c.html(SettingsPage({}))
})


app.get('/downloads', async (c) => {
  if (!await isAuthenticated(c)) return c.redirect('/')
  return c.html(DownloadsPage({}))
})

app.get('/reset-password', async (c) => {
  return c.html(ResetPasswordPage({}))
})
 
// Auth modal routes (keep for compatibility)
app.get('/views/auth/otp-modal.html', async (c) => {
  return serveHTML('auth/otp-modal.html')
})

app.get('/views/auth/magic-link-modal.html', async (c) => {
  return serveHTML('auth/magic-link-modal.html')
})

 
export default app
