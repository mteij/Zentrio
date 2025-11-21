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

  // Generic proxy for local server (127.0.0.1) and problematic addons
  if (path.startsWith('proxy')) {
    const targetParam = url.searchParams.get('url')
    if (!targetParam) return new Response('Missing url param', { status: 400 })

    try {
      const targetUrl = new URL(targetParam)
      const requestHeaders = new Headers(c.req.header())
      requestHeaders.set('Host', targetUrl.host)
      requestHeaders.delete('origin')
      requestHeaders.delete('referer')

      const response = await fetch(targetUrl.href, {
        method: c.req.method,
        headers: requestHeaders,
        body: c.req.raw.body,
        redirect: 'follow'
      })

      const responseHeaders = new Headers(response.headers)
      responseHeaders.set('Access-Control-Allow-Origin', '*')
      responseHeaders.set('Access-Control-Allow-Credentials', 'true')
      responseHeaders.delete('content-security-policy')
      responseHeaders.delete('x-frame-options')

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      })
    } catch (err) {
      return new Response(`Proxy error: ${String(err)}`, { status: 502 })
    }
  }

  // HTML entry: serve the locally built Stremio Web index.html,
  // with session data injected for the build-time patches to use.
  if (path === '' || path === '/' || path.toLowerCase() === 'index.html') {
    return renderLocalStremioHtml(sessionData)
  }

  // Static assets from the local Stremio Web build under data/stremio-web-build
  try {
    const assetPath = path.replace(/^\/+/, '')
    const filePath = join(process.cwd(), 'stremio-web-build', assetPath)
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
      '.eot': 'application/vnd.ms-fontobject',
      '.wasm': 'application/wasm'
    }

    const ext = extname(filePath).toLowerCase()
    const contentType = typeMap[ext] || 'application/octet-stream'

    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    })

    if (contentType.includes('javascript')) {
      headers.set('Service-Worker-Allowed', '/')
    }

    return new Response(buf, { headers })
  } catch (err) {
    if (STREMIO_LOGS) {
      console.warn('[Zentrio][stremio route] static asset not found:', path, err instanceof Error ? err.message : String(err))
    }
    return new Response('Not Found', { status: 404 })
  }
})

export default app
