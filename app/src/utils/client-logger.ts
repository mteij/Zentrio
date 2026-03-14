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

const levels: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
}

function getLevel(): number {
  const override = globalThis.localStorage?.getItem('LOG_LEVEL')
  if (import.meta.env.PROD) {
    return levels[override?.toLowerCase() ?? 'warn'] ?? levels.warn
  }
  return levels[override?.toLowerCase() ?? 'debug'] ?? levels.debug
}

const palette = [
  '#8B5CF6',
  '#06B6D4',
  '#F59E0B',
  '#10B981',
  '#EC4899',
  '#3B82F6',
  '#EF4444',
  '#14B8A6',
  '#F97316',
  '#6366F1',
  '#A855F7',
  '#22D3EE',
]

const scopeColorMap = new Map<string, string>()
let colorIdx = 0

function colorFor(scope: string): string {
  let color = scopeColorMap.get(scope)
  if (!color) {
    color = palette[colorIdx % palette.length]
    colorIdx += 1
    scopeColorMap.set(scope, color)
  }
  return color
}

function scopeBadge(scope: string): [string, string] {
  const color = colorFor(scope)
  return [
    scope,
    `background:${color};color:#fff;border-radius:3px;padding:1px 5px;font-weight:600;font-size:11px`,
  ]
}

const levelStyles: Record<string, [string, string]> = {
  debug: ['DEBUG', 'background:#6B7280;color:#fff;border-radius:3px;padding:1px 4px;font-size:10px'],
  info: ['INFO', 'background:#3B82F6;color:#fff;border-radius:3px;padding:1px 4px;font-size:10px'],
  warn: ['WARN', 'background:#F59E0B;color:#000;border-radius:3px;padding:1px 4px;font-size:10px;font-weight:600'],
  error: ['ERROR', 'background:#EF4444;color:#fff;border-radius:3px;padding:1px 4px;font-size:10px;font-weight:600'],
}

const timers = new Map<string, number>()

export interface ClientLogger {
  debug: (message: any, ...args: any[]) => void
  info: (message: any, ...args: any[]) => void
  warn: (message: any, ...args: any[]) => void
  error: (message: any, ...args: any[]) => void
  success: (message: any, ...args: any[]) => void
  time: (label: string) => void
  timeEnd: (label: string) => void
  group: (title: string) => void
  groupEnd: () => void
  table: (data: any) => void
  scope: (childName: string) => ClientLogger
}

function emitStyledLog(
  fn: typeof console.log,
  badgeText: string,
  badgeStyle: string,
  tagText: string,
  tagStyle: string,
  message: unknown,
  args: any[],
) {
  fn('%c%s%c %c%s%c %s', badgeStyle, badgeText, '', tagStyle, tagText, '', String(message), ...args)
}

export function createLogger(scopeName: string): ClientLogger {
  const [badgeText, badgeStyle] = scopeBadge(scopeName)

  function emit(level: 'debug' | 'info' | 'warn' | 'error', message: unknown, args: any[]) {
    const currentLevel = getLevel()
    if (currentLevel > levels[level]) return

    const [levelText, levelStyle] = levelStyles[level]
    const fn =
      level === 'warn' ? console.warn :
      level === 'error' ? console.error :
      console.log

    emitStyledLog(fn, badgeText, badgeStyle, levelText, levelStyle, message, args)
  }

  const self: ClientLogger = {
    debug: (msg, ...args) => emit('debug', msg, args),
    info: (msg, ...args) => emit('info', msg, args),
    warn: (msg, ...args) => emit('warn', msg, args),
    error: (msg, ...args) => emit('error', msg, args),

    success: (msg, ...args) => {
      if (getLevel() > levels.info) return
      emitStyledLog(
        console.log,
        badgeText,
        badgeStyle,
        'OK',
        'background:#10B981;color:#fff;border-radius:3px;padding:1px 4px;font-size:10px',
        msg,
        args,
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
        emitStyledLog(
          console.log,
          badgeText,
          badgeStyle,
          formatted,
          'background:#6366F1;color:#fff;border-radius:3px;padding:1px 4px;font-size:10px',
          label,
          [],
        )
      }
    },

    group: (title) => {
      if (getLevel() <= levels.info) {
        console.groupCollapsed('%c%s%c %s', badgeStyle, badgeText, '', String(title))
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
