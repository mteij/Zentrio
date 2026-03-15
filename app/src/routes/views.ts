import { Hono } from 'hono'
 
const app = new Hono()
 
// JSX Component Routes (New)
// We now serve the SPA for the root route as well, letting the client handle routing
// This avoids SSR issues with client-side hooks (useNavigate, useEffect, etc.)
// app.get('/') handler removed to allow fallthrough to SPA handler in index.ts

// Redirect legacy Tauri routes to root
app.get('/tauri', (c) => c.redirect('/'))
app.get('/setup', (c) => c.redirect('/'))
app.get('/tauri-login', (c) => c.redirect('/'))
 
export default app
