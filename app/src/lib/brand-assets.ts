function resolvePublicAsset(path: string) {
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  const normalizedPath = path.replace(/^\/+/, '')
  return `${normalizedBase}${normalizedPath}`
}

export const ZENTRIO_LOGO_192_URL = resolvePublicAsset('static/logo/icon-192.png')
export const ZENTRIO_LOGO_512_URL = resolvePublicAsset('static/logo/icon-512.png')
