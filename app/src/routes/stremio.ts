import { Hono } from 'hono'
import { proxyRequestHandler } from '../services/stremio/proxy'
import { getConfig } from '../services/envParser'
const app = new Hono()

app.all('*', async (c) => {
    const url = new URL(c.req.url);
    // Expect this router to be mounted under "/stremio"
    // Strip leading "/" and the "stremio/" prefix if present
    let path = url.pathname.replace(/^\/+/, '');
    if (path.toLowerCase().startsWith('stremio/')) {
        path = path.substring('stremio/'.length);
    }
    const sessionData = url.searchParams.get('sessionData');
    url.searchParams.delete('sessionData');
    // Rebuild query string without sessionData
    const queryString = url.searchParams.toString();
    const fullPath = queryString ? `${path}?${queryString}` : path;

    // Debug trace
    const { STREMIO_LOGS } = getConfig()
    if (STREMIO_LOGS) {
        console.log('[Zentrio][stremio route] incoming:', url.pathname, '-> forwarding:', fullPath);
    }

    return proxyRequestHandler(c.req.raw, fullPath, sessionData);
})

export default app
