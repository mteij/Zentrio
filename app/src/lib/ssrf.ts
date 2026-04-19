const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^::1$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^fc00:/i,
  /^fe80:/i,
  /^::ffff:(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.)/i,
  /^0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:ffff:7f/i,
  /^0{0,4}:0{0,4}:0{0,4}:0{0,4}:0{0,4}:ffff:0{0,4}:0?0?0?a/i,
]

const LOCAL_GATEWAY_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  'tauri.localhost'
])

export const isLocalGatewayHost = (hostHeader?: string | null): boolean => {
  const host = (hostHeader || '').trim().toLowerCase()
  if (!host) return false

  // Strip port for host checks
  const hostWithoutPort = host.startsWith('[')
    ? host.replace(/:\d+$/, '')
    : host.split(':')[0]

  return LOCAL_GATEWAY_HOSTS.has(hostWithoutPort) || hostWithoutPort.endsWith('.localhost')
}

export function isSafeExternalUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr)
    if (!['https:', 'http:'].includes(parsed.protocol)) return false
    const host = parsed.hostname
    if (!host || host === '') return false
    if (PRIVATE_IP_PATTERNS.some(p => p.test(host))) return false
    if (/^\d+$/.test(host)) return false
    return true
  } catch {
    return false
  }
}

export async function safeFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const maxRedirects = 3
  let currentUrl = url
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(currentUrl, { ...options, redirect: 'manual' })
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location')
      if (!location) return res
      try {
        const redirectUrl = new URL(location, currentUrl).href
        if (!isSafeExternalUrl(redirectUrl)) {
          throw new Error('Redirect target not allowed')
        }
        currentUrl = redirectUrl
        continue
      } catch (e) {
        if (e instanceof Error && e.message === 'Redirect target not allowed') throw e
        throw new Error('Invalid redirect URL')
      }
    }
    return res
  }
  throw new Error('Too many redirects')
}