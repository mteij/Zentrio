import { readFileSync } from 'fs'
import { join } from 'path'

let loaded = false

function parseEnv(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const lines = content.split(/\r?\n/)
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1)
    // Remove optional surrounding quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    result[key] = value
  }
  return result
}

/**
 * Idempotently load .env from the project root (parent of app/)
 * Only sets vars that are not already set in process.env
 */
export function initEnv(): void {
  if (loaded) return
  const envPath = join(process.cwd(), '../.env')
  try {
    const content = readFileSync(envPath, 'utf-8')
    const parsed = parseEnv(content)
    for (const [k, v] of Object.entries(parsed)) {
      if (process.env[k] === undefined) {
        process.env[k] = v
      }
    }
  } catch (_err) {
    // Silently ignore if no .env found
  } finally {
    loaded = true
  }
}
 
// Auto-initialize env on module import (idempotent)
initEnv()
 
/**
 * Access typed config with sensible defaults.
 * Call initEnv() early in app startup to ensure process.env is hydrated.
 */
export function getConfig() {
  // Utility to parse boolean-like envs
  const parseBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined) return defaultValue
    const s = value.trim().toLowerCase()
    return !(s === 'false' || s === '0' || s === 'no' || s === 'off' || s === '')
  }

  const PORT = Number(process.env.PORT ?? 3000)
  const DATABASE_URL = process.env.DATABASE_URL ?? './data/zentrio.db'
  const AUTH_SECRET = process.env.AUTH_SECRET ?? 'super-secret-key-change-in-production'
  // Check if running in Tauri
  const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
  const defaultUrl = isTauri ? 'https://app.zentrio.eu' : `http://localhost:${PORT}`;
  const APP_URL = process.env.APP_URL ?? defaultUrl
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'super-secret-key-change-in-production'
  // Rate limit settings (configurable via environment variables)
  const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000)
  const RATE_LIMIT_LIMIT = Number(process.env.RATE_LIMIT_LIMIT ?? 100)

  // Logging toggles
  // PROXY_LOGS controls the request logger middleware (Hono logger) that prints "-->" and "<--" lines.
  // Backwards compatibility: falls back to REQUEST_LOGS if PROXY_LOGS is not set.
  const PROXY_LOGS = parseBoolean(process.env.PROXY_LOGS ?? process.env.REQUEST_LOGS, true)
  const LOG_LEVEL = process.env.LOG_LEVEL || 'info'

  // SSO Providers
  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET
  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID
  const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET
  const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID
  const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET
  
  // OpenID Connect
  const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID
  const OIDC_CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET
  const OIDC_ISSUER = process.env.OIDC_ISSUER
  const OIDC_DISPLAY_NAME = process.env.OIDC_DISPLAY_NAME || 'OpenID'
 
  return {
    PORT,
    DATABASE_URL,
    AUTH_SECRET,
    APP_URL,
    ENCRYPTION_KEY,
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_LIMIT,
    PROXY_LOGS,
    LOG_LEVEL,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    OIDC_CLIENT_ID,
    OIDC_CLIENT_SECRET,
    OIDC_ISSUER,
    OIDC_DISPLAY_NAME,
    TMDB_API_KEY: process.env.TMDB_API_KEY
  }
}

export function requireEnv(key: string): string {
  const v = process.env[key]
  if (!v) {
    throw new Error(`Missing required env var: ${key}`)
  }
  return v
}
