/**
 * Client-side logger for the Zentrio browser SPA.
 *
 * Usage:
 *   import { createLogger } from '@/utils/client-logger'
 *   const log = createLogger('AuthStore')
 *   log.info('Session refreshed')
 *   log.error('Failed to fetch', error)
 *   log.time('render'); ... ; log.timeEnd('render')
 */

// ─── Log Level ────────────────────────────────────────────────────────

const levels: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

function getLevel(): number {
  // In production, default to warn-only to keep the console clean
  if (import.meta.env.PROD) {
    const override = globalThis.localStorage?.getItem('LOG_LEVEL')
    return levels[override?.toLowerCase() ?? 'warn'] ?? levels.warn
  }
  // In dev, respect localStorage override or default to debug
  const override = globalThis.localStorage?.getItem('LOG_LEVEL')
  return levels[override?.toLowerCase() ?? 'debug'] ?? levels.debug
}

// ─── Scope Color Palette ──────────────────────────────────────────────

const palette = [
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#F59E0B', // amber
  '#10B981', // emerald
  '#EC4899', // pink
  '#3B82F6', // blue
  '#EF4444', // red
  '#14B8A6', // teal
  '#F97316', // orange
  '#6366F1', // indigo
  '#A855F7', // purple
  '#22D3EE', // sky
]

const scopeColorMap = new Map<string, string>()
let colorIdx = 0

function colorFor(scope: string): string {
  let color = scopeColorMap.get(scope)
  if (!color) {
    color = palette[colorIdx % palette.length]
    colorIdx++
    scopeColorMap.set(scope, color)
  }
  return color
}

// ─── Badge / Tag Styles ───────────────────────────────────────────────

function scopeBadge(scope: string): [string, string] {
  const color = colorFor(scope)
  return [
    `%c ${scope} `,
    `background:${color};color:#fff;border-radius:3px;padding:1px 5px;font-weight:600;font-size:11px`,
  ]
}

const levelStyles: Record<string, [string, string]> = {
  debug: ['%c DEBUG ', 'background:#6B7280;color:#fff;border-radius:3px;padding:1px 4px;font-size:10px'],
  info:  ['%c INFO  ', 'background:#3B82F6;color:#fff;border-radius:3px;padding:1px 4px;font-size:10px'],
  warn:  ['%c WARN  ', 'background:#F59E0B;color:#000;border-radius:3px;padding:1px 4px;font-size:10px;font-weight:600'],
  error: ['%c ERROR ', 'background:#EF4444;color:#fff;border-radius:3px;padding:1px 4px;font-size:10px;font-weight:600'],
}

// ─── Timers ───────────────────────────────────────────────────────────

const timers = new Map<string, number>()

// ─── Logger Interface ─────────────────────────────────────────────────

export interface ClientLogger {
  debug: (message: any, ...args: any[]) => void
  info: (message: any, ...args: any[]) => void
  warn: (message: any, ...args: any[]) => void
  error: (message: any, ...args: any[]) => void
  success: (message: any, ...args: any[]) => void

  /** Start a performance timer. */
  time: (label: string) => void
  /** End a timer and log the elapsed duration. */
  timeEnd: (label: string) => void

  /** Open a collapsed group in devtools. */
  group: (title: string) => void
  /** Close the current group. */
  groupEnd: () => void

  /** Log tabular data. */
  table: (data: any) => void

  /** Create a child logger with an extended scope. */
  scope: (childName: string) => ClientLogger
}

// ─── Factory ──────────────────────────────────────────────────────────

export function createLogger(scopeName: string): ClientLogger {
  const [badgeStr, badgeStyle] = scopeBadge(scopeName)

  function emit(level: 'debug' | 'info' | 'warn' | 'error', message: string, args: any[]) {
    const currentLevel = getLevel()
    if (currentLevel > levels[level]) return

    const [lvlStr, lvlStyle] = levelStyles[level]
    const fn =
      level === 'warn' ? console.warn :
      level === 'error' ? console.error :
      console.log

    fn(`${badgeStr}${lvlStr} ${message}`, badgeStyle, lvlStyle, ...args)
  }

  const self: ClientLogger = {
    debug: (msg, ...args) => emit('debug', msg, args),
    info: (msg, ...args) => emit('info', msg, args),
    warn: (msg, ...args) => emit('warn', msg, args),
    error: (msg, ...args) => emit('error', msg, args),

    success: (msg, ...args) => {
      if (getLevel() > levels.info) return
      console.log(
        `${badgeStr}%c ✔ OK  %c ${msg}`,
        badgeStyle,
        'background:#10B981;color:#fff;border-radius:3px;padding:1px 4px;font-size:10px',
        '',
        ...args
      )
    },

    time: (label) => {
      const key = `${scopeName}:${label}`
      timers.set(key, performance.now())
    },

    timeEnd: (label) => {
      const key = `${scopeName}:${label}`
      const start = timers.get(key)
      if (start === undefined) {
        self.warn(`Timer "${label}" does not exist`)
        return
      }
      timers.delete(key)
      const elapsed = performance.now() - start
      const formatted = elapsed < 1000 ? `${elapsed.toFixed(1)}ms` : `${(elapsed / 1000).toFixed(2)}s`
      if (getLevel() <= levels.info) {
        console.log(
          `${badgeStr}%c ⏱ ${formatted} %c ${label}`,
          badgeStyle,
          'background:#6366F1;color:#fff;border-radius:3px;padding:1px 4px;font-size:10px',
          ''
        )
      }
    },

    group: (title) => {
      if (getLevel() <= levels.info) {
        console.groupCollapsed(`${badgeStr} ${title}`, badgeStyle)
      }
    },

    groupEnd: () => {
      if (getLevel() <= levels.info) {
        console.groupEnd()
      }
    },

    table: (data) => {
      if (getLevel() <= levels.info) {
        console.table(data)
      }
    },

    scope: (childName) => createLogger(`${scopeName}:${childName}`),
  }

  return self
}
