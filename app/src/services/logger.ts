import { getConfig } from './envParser'

const config = getConfig()
const LOG_LEVEL = (config.LOG_LEVEL || 'info').toLowerCase()

const levels: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

const currentLevel = levels[LOG_LEVEL] ?? levels.info

const colors = {
  reset: '\x1b[0m',
  debug: '\x1b[35m', // Magenta
  info: '\x1b[36m',  // Cyan
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
  success: '\x1b[32m', // Green
  dim: '\x1b[2m',
  bold: '\x1b[1m'
}

const icons = {
  debug: '⚙',
  info: 'ℹ',
  warn: '⚠',
  error: '✖',
  success: '✔'
}

function formatTime() {
  return new Date().toISOString()
}

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (currentLevel <= levels.debug) {
      console.log(`${colors.dim}${formatTime()}${colors.reset} ${colors.debug}${icons.debug} [DEBUG]${colors.reset} ${message}`, ...args)
    }
  },
  info: (message: string, ...args: any[]) => {
    if (currentLevel <= levels.info) {
      console.log(`${colors.dim}${formatTime()}${colors.reset} ${colors.info}${icons.info} [INFO]${colors.reset}  ${message}`, ...args)
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (currentLevel <= levels.warn) {
      console.warn(`${colors.dim}${formatTime()}${colors.reset} ${colors.warn}${icons.warn} [WARN]${colors.reset}  ${message}`, ...args)
    }
  },
  error: (message: string, ...args: any[]) => {
    if (currentLevel <= levels.error) {
      console.error(`${colors.dim}${formatTime()}${colors.reset} ${colors.error}${icons.error} [ERROR]${colors.reset} ${message}`, ...args)
    }
  },
  success: (message: string, ...args: any[]) => {
    // Treat success as info level
    if (currentLevel <= levels.info) {
      console.log(`${colors.dim}${formatTime()}${colors.reset} ${colors.success}${icons.success} [OK]${colors.reset}    ${message}`, ...args)
    }
  },
  // Helper for the banner or raw output
  raw: (message: string, ...args: any[]) => {
    console.log(message, ...args)
  },
  // Expose colors for custom formatting if needed
  colors
}