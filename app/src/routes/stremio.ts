import { Hono } from 'hono'
import { proxyRequestHandler } from '../services/stremio/proxy'

const app = new Hono()

app.all('*', async (c) => {
    const path = c.req.path.replace('/stremio', '')
    return proxyRequestHandler(c.req.raw, path)
})

export default app
