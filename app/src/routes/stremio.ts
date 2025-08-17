import { Hono } from 'hono'
import { proxyRequestHandler } from '../services/stremio/proxy'

const app = new Hono()

app.all('*', async (c) => {
    const path = c.req.path.startsWith('/') ? c.req.path.substring(1) : c.req.path
    const query = c.req.query()
    const queryString = Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString()}` : ''
    const fullPath = `${path}${queryString}`
    return proxyRequestHandler(c.req.raw, fullPath)
})

export default app
