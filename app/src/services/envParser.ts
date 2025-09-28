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
  const APP_URL = process.env.APP_URL ?? `http://localhost:${PORT}`
  const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'super-secret-key-change-in-production'
  // Rate limit settings (configurable via environment variables)
  const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000)
  const RATE_LIMIT_LIMIT = Number(process.env.RATE_LIMIT_LIMIT ?? 100)

  // Logging toggles
  // PROXY_LOGS controls the request logger middleware (Hono logger) that prints "-->" and "<--" lines.
  // Backwards compatibility: falls back to REQUEST_LOGS if PROXY_LOGS is not set.
  // STREMIO_LOGS controls verbose logs inside the /stremio route; defaults to false.
  const PROXY_LOGS = parseBoolean(process.env.PROXY_LOGS ?? process.env.REQUEST_LOGS, true)
  const STREMIO_LOGS = parseBoolean(process.env.STREMIO_LOGS, false)
 
  return {
    PORT,
    DATABASE_URL,
    AUTH_SECRET,
    APP_URL,
    ENCRYPTION_KEY,
    RATE_LIMIT_WINDOW_MS,
    RATE_LIMIT_LIMIT,
    PROXY_LOGS,
    STREMIO_LOGS
  }
}

export function requireEnv(key: string): string {
  const v = process.env[key]
  if (!v) {
    throw new Error(`Missing required env var: ${key}`)
  }
  return v
}
