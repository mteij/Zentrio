import { Hono } from 'hono'
import { auth } from '../services/auth'
 
const app = new Hono()

async function isAuthenticated(c: any): Promise<boolean> {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers
  })
  return !!session
}
 
// JSX Component Routes (New)
// We now serve the SPA for the root route as well, letting the client handle routing
// This avoids SSR issues with client-side hooks (useNavigate, useEffect, etc.)
app.get('/', async (c) => {
  // We can still do a quick auth check to redirect if needed,
  // but for a true SPA experience, we might want to let the client handle this too.
  // For now, let's keep the redirect as a convenience.
  if (await isAuthenticated(c)) return c.redirect('/profiles')
  
  // Fall through to the SPA handler in index.ts
  return c.notFound()
})

// Redirect legacy Tauri routes to root
app.get('/tauri', (c) => c.redirect('/'))
app.get('/setup', (c) => c.redirect('/'))
app.get('/tauri-login', (c) => c.redirect('/'))
 
export default app
