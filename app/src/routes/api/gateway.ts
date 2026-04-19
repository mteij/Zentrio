import { getConfig } from '../../services/envParser'
import { isSafeExternalUrl, safeFetch, isLocalGatewayHost } from '../../lib/ssrf'
import { createTaggedOpenAPIApp } from './openapi-route'
import { logger } from '../../services/logger'

const log = logger.scope('API:Gateway')

const gateway = createTaggedOpenAPIApp('Gateway')

const REQUEST_TIMEOUT_MS = 30000

const FORWARDABLE_READ_PREFIXES = [
  '/api/streaming/dashboard',
  '/api/streaming/filters',
  '/api/streaming/details',
  '/api/streaming/catalog',
  '/api/streaming/catalog-items',
  '/api/streaming/search-catalog-metadata',
  '/api/streaming/search-catalog-items'
]

const normalizeOrigin = (value?: string | null): string | null => {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed.origin.replace(/\/$/, '')
  } catch (_e) {
    return null
  }
}

const resolveRemoteBase = (requestOverride?: string | null) => {
  const cleanOverride = normalizeOrigin(requestOverride)
  if (cleanOverride) return cleanOverride

  const cfg = getConfig()
  const appUrl = normalizeOrigin(cfg.APP_URL)
  return appUrl || 'http://localhost:3000'
}

const gatewayProxyHandler = async (c: any) => {
  // Critical production hardening: do not expose this as a public/open proxy.
  // This route is only intended for local sidecar usage.
  if (!isLocalGatewayHost(c.req.header('host'))) {
    return c.json({ error: 'Gateway is only available on local sidecar host' }, 403)
  }

  const targetPath = c.req.path
    .replace(/^\/api\/gateway/, '')
    .replace(/^\/gateway/, '') || '/'

  const remoteBase = resolveRemoteBase(c.req.query('__remote'))
  if (remoteBase && !isSafeExternalUrl(remoteBase)) {
    return c.json({ error: 'Remote URL not allowed' }, 403)
  }
  
  let targetUrl: URL
  try {
    targetUrl = new URL(targetPath, remoteBase || 'http://localhost')
  } catch (_e) {
    return c.json({ error: 'Invalid proxy target URL' }, 400)
  }

  const normalizedPath = targetUrl.pathname
  const allowed = FORWARDABLE_READ_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))
  if (!allowed) {
    return c.json({ error: 'Route not allowed via gateway' }, 403)
  }

  for (const [key, value] of Object.entries(c.req.query())) {
    if (key === '__remote') continue
    if (value !== undefined) {
      targetUrl.searchParams.set(key, String(value))
    }
  }

  const reqHeaders = new Headers(c.req.raw.headers)
  reqHeaders.delete('host')
  reqHeaders.delete('origin')
  reqHeaders.delete('cookie')
  reqHeaders.delete('authorization')
  reqHeaders.delete('proxy-authorization')
  reqHeaders.delete('x-forwarded-for')
  reqHeaders.delete('x-forwarded-host')
  reqHeaders.delete('x-forwarded-proto')
  reqHeaders.delete('forwarded')
  reqHeaders.set('x-zentrio-gateway', '1')

  log.debug(`Forwarding ${c.req.method} ${targetUrl.toString()}`);
  log.debug(`Has Authorization:`, reqHeaders.has('authorization') || reqHeaders.has('Authorization'));
  
  const init: RequestInit = {
    method: 'GET',
    headers: reqHeaders,
    // Redirects handled manually by safeFetch to prevent SSRF bypass
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const upstream = await safeFetch(targetUrl.toString(), {
      ...init,
      signal: controller.signal
    })

    const resHeaders = new Headers(upstream.headers)
    resHeaders.set('X-Zentrio-Proxy', 'gateway')
    resHeaders.set('X-Zentrio-Gateway', 'local-sidecar')

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: resHeaders
    })
  } catch (e) {
    const isTimeout = e instanceof Error && e.name === 'AbortError'
    const message = isTimeout ? 'Gateway upstream timeout' : 'Gateway upstream request failed'
    return c.json({ error: message }, 504)
  } finally {
    clearTimeout(timeout)
  }
}

// Register explicit OpenAPI-documented routes.
// Read-only proxy: keep this GET-only to match the allowed read prefix policy.
// `:path{.+}` allows forwarding nested paths like /api/streaming/dashboard.
gateway.get('/', gatewayProxyHandler)
gateway.get('/:path{.+}', gatewayProxyHandler)

export default gateway

