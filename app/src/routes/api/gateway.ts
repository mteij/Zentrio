import { Hono } from 'hono'
import { getConfig } from '../../services/envParser'

const gateway = new Hono()

const REQUEST_TIMEOUT_MS = 30000

const LOCAL_GATEWAY_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  'tauri.localhost'
])

const FORWARDABLE_READ_PREFIXES = [
  '/api/streaming/dashboard',
  '/api/streaming/filters',
  '/api/streaming/details',
  '/api/streaming/catalog',
  '/api/streaming/catalog-items',
  '/api/streaming/streams-live'
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
  } catch {
    return null
  }
}

const isLocalGatewayHost = (hostHeader?: string | null): boolean => {
  const host = (hostHeader || '').trim().toLowerCase()
  if (!host) return process.env.NODE_ENV !== 'production'

  // Strip port for host checks
  const hostWithoutPort = host.startsWith('[')
    ? host.replace(/:\d+$/, '')
    : host.split(':')[0]

  return LOCAL_GATEWAY_HOSTS.has(hostWithoutPort) || hostWithoutPort.endsWith('.localhost')
}

const resolveRemoteBase = (requestOverride?: string | null) => {
  const cleanOverride = normalizeOrigin(requestOverride)
  if (cleanOverride) return cleanOverride

  const cfg = getConfig()
  const appUrl = normalizeOrigin(cfg.APP_URL)
  return appUrl || 'http://localhost:3000'
}

gateway.all('/*', async (c) => {
  // Critical production hardening: do not expose this as a public/open proxy.
  // This route is only intended for local sidecar usage.
  if (!isLocalGatewayHost(c.req.header('host'))) {
    return c.json({ error: 'Gateway is only available on local sidecar host' }, 403)
  }

  const targetPath = c.req.path
    .replace(/^\/api\/gateway/, '')
    .replace(/^\/gateway/, '') || '/'

  const allowed = FORWARDABLE_READ_PREFIXES.some((prefix) => targetPath.startsWith(prefix))
  if (!allowed) {
    return c.json({ error: 'Route not allowed via gateway' }, 403)
  }

  const remoteBase = resolveRemoteBase(c.req.query('__remote'))
  const targetUrl = new URL(`${remoteBase}${targetPath}`)

  for (const [key, value] of Object.entries(c.req.query())) {
    if (key === '__remote') continue
    if (value !== undefined) {
      targetUrl.searchParams.set(key, String(value))
    }
  }

  const reqHeaders = new Headers(c.req.raw.headers)
  reqHeaders.delete('host')
  reqHeaders.delete('origin')
  reqHeaders.set('x-zentrio-gateway', '1')

  const init: RequestInit = {
    method: c.req.method,
    headers: reqHeaders,
    redirect: 'follow'
  }

  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    init.body = await c.req.raw.arrayBuffer()
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const upstream = await fetch(targetUrl.toString(), {
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
})

export default gateway

