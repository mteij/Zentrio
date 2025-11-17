import { Hono } from 'hono'
import { proxyRequestHandler, renderLocalStremioHtml } from '../services/stremio/proxy'
import { getConfig } from '../services/envParser'
import { join, extname } from 'path'
import { promises as fs } from 'fs'

const app = new Hono()

app.all('*', async (c) => {
  const url = new URL(c.req.url)
  // Expect this router to be mounted under "/stremio"
  // Strip leading "/" and the "stremio/" prefix if present
  let path = url.pathname.replace(/^\/+/, '')
  if (path.toLowerCase().startsWith('stremio/')) {
    path = path.substring('stremio/'.length)
  }

  const sessionData = url.searchParams.get('sessionData')
  url.searchParams.delete('sessionData')
  // Rebuild query string without sessionData
  const queryString = url.searchParams.toString()
  const fullPath = queryString ? `${path}?${queryString}` : path

  const { STREMIO_LOGS } = getConfig()
  if (STREMIO_LOGS) {
    console.log('[Zentrio][stremio route] incoming:', url.pathname, '-> resolved path:', fullPath)
  }

  const isApiCall = path.toLowerCase().startsWith('api/')

  // API calls are always proxied to the remote Stremio API via our proxy handler
  if (isApiCall) {
    return proxyRequestHandler(c.req.raw, fullPath, sessionData)
  }

  // HTML entry: serve the locally built Stremio Web index.html,
  // with Zentrio session/addon/NSFW/download scripts injected.
  if (path === '' || path === '/' || path.toLowerCase() === 'index.html') {
    return renderLocalStremioHtml(sessionData)
  }

  // Static assets from the local Stremio Web build under data/stremio-web-build
  try {
    const assetPath = path.replace(/^\/+/, '')
    const filePath = join(process.cwd(), 'data', 'stremio-web-build', assetPath)
    const buf = await fs.readFile(filePath)

    const typeMap: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.mjs': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.ico': 'image/x-icon',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.eot': 'application/vnd.ms-fontobject'
    }

    const ext = extname(filePath).toLowerCase()
    const contentType = typeMap[ext] || 'application/octet-stream'

    return new Response(buf, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      }
    })
  } catch (err) {
    if (STREMIO_LOGS) {
      console.warn('[Zentrio][stremio route] static asset not found:', path, err instanceof Error ? err.message : String(err))
    }
    return new Response('Not Found', { status: 404 })
  }
})

export default app
