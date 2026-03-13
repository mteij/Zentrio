import { getConfig } from './envParser'

const config = getConfig()
const LOG_LEVEL = (config.LOG_LEVEL || 'info').toLowerCase()

// ─── Level Definitions ────────────────────────────────────────────────

const levels: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
  silent: 5
}

const currentLevel = levels[LOG_LEVEL] ?? levels.info

// ─── ANSI Colors ──────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Foreground
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Bright foreground
  gray: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  // Background
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
}

// ─── Icons ────────────────────────────────────────────────────────────

const icons = {
  debug: '⚙',
  info: 'ℹ',
  warn: '⚠',
  error: '✖',
  fatal: '💀',
  success: '✔',
  start: '▶',
  stop: '■',
  timer: '⏱',
  arrow: '→',
  dot: '·',
}

// ─── Helpers ──────────────────────────────────────────────────────────

function ts(): string {
  return new Date().toISOString()
}

function pad(label: string): string {
  return label.padEnd(5)
}

// ─── Timers ───────────────────────────────────────────────────────────

const timers = new Map<string, number>()

// ─── Core Logger Interface ────────────────────────────────────────────

interface Logger {
  debug: (message: string, ...args: any[]) => void
  info: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
  error: (message: string, ...args: any[]) => void
  fatal: (message: string, ...args: any[]) => void
  success: (message: string, ...args: any[]) => void

  /** Raw output — no formatting, no timestamp. */
  raw: (message: string, ...args: any[]) => void

  /** Start a named timer. */
  time: (label: string) => void
  /** End a named timer and log the elapsed duration. */
  timeEnd: (label: string) => void

  /** Begin a grouped/collapsed section (indented in terminal). */
  group: (title: string) => void
  /** End a grouped section. */
  groupEnd: () => void

  /** Log tabular data. */
  table: (data: Record<string, any>[] | Record<string, any>) => void

  /** Create a child logger with a fixed scope prefix. */
  scope: (name: string) => Logger

  /** Expose colors for external use (e.g. banner). */
  colors: typeof c
}

// ─── Logger Factory ───────────────────────────────────────────────────

function createScopedLogger(scopeName?: string): Logger {
  const prefix = scopeName ? `${c.bold}${c.cyan}[${scopeName}]${c.reset} ` : ''

  function emit(
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    message: string,
    args: any[]
  ) {
    const threshold = level === 'fatal' ? levels.error : levels[level]
    if (currentLevel > threshold) return

    const colorMap: Record<string, string> = {
      debug: c.magenta,
      info: c.cyan,
      warn: c.yellow,
      error: c.red,
      fatal: `${c.bgRed}${c.white}${c.bold}`,
    }
    const iconMap: Record<string, string> = {
      debug: icons.debug,
      info: icons.info,
      warn: icons.warn,
      error: icons.error,
      fatal: icons.fatal,
    }
    const labelMap: Record<string, string> = {
      debug: 'DEBUG',
      info: 'INFO',
      warn: 'WARN',
      error: 'ERROR',
      fatal: 'FATAL',
    }

    const clr = colorMap[level]
    const ico = iconMap[level]
    const lbl = labelMap[level]
    const fn = level === 'warn' ? console.warn : level === 'error' || level === 'fatal' ? console.error : console.log

    fn(
      `${c.dim}${ts()}${c.reset} ${clr}${ico} ${pad(lbl)}${c.reset} ${prefix}${message}`,
      ...args
    )
  }

  const self: Logger = {
    debug: (msg, ...args) => emit('debug', msg, args),
    info: (msg, ...args) => emit('info', msg, args),
    warn: (msg, ...args) => emit('warn', msg, args),
    error: (msg, ...args) => emit('error', msg, args),
    fatal: (msg, ...args) => {
      emit('fatal', msg, args)
      process.exit(1)
    },
    success: (msg, ...args) => {
      if (currentLevel > levels.info) return
      console.log(
        `${c.dim}${ts()}${c.reset} ${c.green}${icons.success} OK   ${c.reset} ${prefix}${msg}`,
        ...args
      )
    },

    raw: (msg, ...args) => console.log(msg, ...args),

    time: (label) => {
      const key = scopeName ? `${scopeName}:${label}` : label
      timers.set(key, performance.now())
      if (currentLevel <= levels.debug) {
        console.log(
          `${c.dim}${ts()}${c.reset} ${c.blue}${icons.start} TIMER${c.reset} ${prefix}${label} started`
        )
      }
    },

    timeEnd: (label) => {
      const key = scopeName ? `${scopeName}:${label}` : label
      const start = timers.get(key)
      if (start === undefined) {
        self.warn(`Timer "${label}" does not exist`)
        return
      }
      timers.delete(key)
      const elapsed = performance.now() - start
      const formatted = elapsed < 1000 ? `${elapsed.toFixed(1)}ms` : `${(elapsed / 1000).toFixed(2)}s`
      if (currentLevel <= levels.info) {
        console.log(
          `${c.dim}${ts()}${c.reset} ${c.blue}${icons.timer} TIMER${c.reset} ${prefix}${label} ${c.bold}${formatted}${c.reset}`
        )
      }
    },

    group: (title) => {
      if (currentLevel <= levels.info) {
        console.log(`${c.dim}${ts()}${c.reset} ${c.bold}${c.white}┌─ ${prefix}${title}${c.reset}`)
        console.group()
      }
    },

    groupEnd: () => {
      if (currentLevel <= levels.info) {
        console.groupEnd()
        console.log(`${c.dim}${ts()}${c.reset} ${c.bold}${c.white}└─${c.reset}`)
      }
    },

    table: (data) => {
      if (currentLevel > levels.info) return

      if (Array.isArray(data)) {
        console.table(data)
      } else {
        // Convert key-value object to a two-column table
        const rows = Object.entries(data).map(([key, value]) => ({ Key: key, Value: value }))
        console.table(rows)
      }
    },

    scope: (name) => {
      const child = scopeName ? `${scopeName}:${name}` : name
      return createScopedLogger(child)
    },

    colors: c
  }

  return self
}

// ─── Singleton Export ─────────────────────────────────────────────────

export const logger = createScopedLogger()