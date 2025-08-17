import type { Context, Next } from 'hono'

export interface ProxyLogEntry {
  profileId?: number
  sessionId?: number
  method: string
  url: string
  requestHeaders?: string
  responseStatus?: number
  responseHeaders?: string
  errorMessage?: string
  durationMs: number
  ipAddress: string
  userAgent: string
  requestSize?: number
  responseSize?: number
  timestamp: string
}

export interface ProxyLoggerOptions {
  enabled?: boolean
  logHeaders?: boolean
  logBody?: boolean
  maxBodySize?: number
  excludePaths?: string[]
  includeOnlyPaths?: string[]
  logLevel?: 'basic' | 'detailed' | 'debug'
  logErrors?: boolean
  logSuccessOnly?: boolean
  enableMetrics?: boolean
}

/**
 * Performance metrics tracking
 */
class ProxyMetrics {
  private static metrics = new Map<string, {
    totalRequests: number
    totalDuration: number
    errorCount: number
    lastRequest: number
  }>()

  static recordRequest(endpoint: string, duration: number, isError: boolean = false) {
    const key = this.normalizeEndpoint(endpoint)
    const existing = this.metrics.get(key) || {
      totalRequests: 0,
      totalDuration: 0,
      errorCount: 0,
      lastRequest: 0
    }

    existing.totalRequests++
    existing.totalDuration += duration
    existing.lastRequest = Date.now()
    
    if (isError) {
      existing.errorCount++
    }

    this.metrics.set(key, existing)
  }

  static getMetrics(endpoint?: string) {
    if (endpoint) {
      const key = this.normalizeEndpoint(endpoint)
      const metric = this.metrics.get(key)
      return metric ? {
        ...metric,
        averageDuration: metric.totalDuration / metric.totalRequests,
        errorRate: metric.errorCount / metric.totalRequests
      } : null
    }

    // Return all metrics
    const result: Record<string, any> = {}
    for (const [key, metric] of this.metrics.entries()) {
      result[key] = {
        ...metric,
        averageDuration: metric.totalDuration / metric.totalRequests,
        errorRate: metric.errorCount / metric.totalRequests
      }
    }
    return result
  }

  private static normalizeEndpoint(url: string): string {
    try {
      const urlObj = new URL(url)
      return `${urlObj.pathname.split('/').slice(0, 3).join('/')}`
    } catch {
      return url.split('/').slice(0, 3).join('/')
    }
  }

  static reset() {
    this.metrics.clear()
  }
}

/**
 * Main proxy logging middleware
 */
export const proxyLoggerMiddleware = (options: ProxyLoggerOptions = {}) => {
  const {
    enabled = true,
    logHeaders = true,
    logBody = false,
    maxBodySize = 1024 * 10, // 10KB
    excludePaths = [],
    includeOnlyPaths = [],
    logLevel = 'basic',
    logErrors = true,
    logSuccessOnly = false,
    enableMetrics = true
  } = options

  return async (c: Context, next: Next) => {
    if (!enabled) {
      await next()
      return
    }

    const startTime = Date.now()
    const method = c.req.method
    const url = c.req.url
    const path = new URL(url).pathname

    // Check if path should be excluded
    if (excludePaths.some(excludePath => path.includes(excludePath))) {
      await next()
      return
    }

    // Check if path should be included (if includeOnlyPaths is specified)
    if (includeOnlyPaths.length > 0 && !includeOnlyPaths.some(includePath => path.includes(includePath))) {
      await next()
      return
    }

    // Extract request information
    const ipAddress = c.req.header('x-forwarded-for') || 
                     c.req.header('x-real-ip') || 
                     c.req.header('cf-connecting-ip') || 
                     'unknown'
    const userAgent = c.req.header('user-agent') || 'unknown'
    
    // Get authentication context if available
    const profileId = c.get('profileId')
    const sessionId = c.get('sessionId')

    let requestHeaders: string | undefined
    let requestSize: number | undefined
    let requestBody: string | undefined

    // Capture request details based on log level
    if (logLevel === 'detailed' || logLevel === 'debug') {
      if (logHeaders) {
        const headers: Record<string, string> = {}
        c.req.header() && Object.entries(c.req.header()).forEach(([key, value]) => {
          if (value) headers[key] = value
        })
        requestHeaders = JSON.stringify(headers)
      }

      if (logBody && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        try {
          const body = await c.req.text()
          requestSize = new TextEncoder().encode(body).length
          
          if (requestSize <= maxBodySize) {
            requestBody = body
          }
          
          // Note: Cannot recreate request in Hono, body is consumed
        } catch (error) {
          console.warn('Failed to capture request body:', error)
        }
      }
    }

    let responseStatus: number | undefined
    let responseHeaders: string | undefined
    let responseSize: number | undefined
    let errorMessage: string | undefined

    try {
      await next()
      
      // Capture response details
      responseStatus = c.res.status
      
      if (logLevel === 'detailed' || logLevel === 'debug') {
        if (logHeaders && c.res.headers) {
          const headers: Record<string, string> = {}
          c.res.headers.forEach((value, key) => {
            headers[key] = value
          })
          responseHeaders = JSON.stringify(headers)
        }

        // Estimate response size from content-length header
        const contentLength = c.res.headers.get('content-length')
        if (contentLength) {
          responseSize = parseInt(contentLength, 10)
        }
      }

    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error)
      responseStatus = 500
      
      if (logErrors) {
        console.error(`Proxy request error [${method} ${path}]:`, error)
      }
      
      // Re-throw the error
      throw error
    } finally {
      const durationMs = Date.now() - startTime
      const isError = !!errorMessage || (responseStatus && responseStatus >= 400)

      // Record metrics if enabled
      if (enableMetrics) {
        ProxyMetrics.recordRequest(path, durationMs, !!isError)
      }

      // Skip logging successful requests if logSuccessOnly is false and logErrors is true
      if (logSuccessOnly && isError) {
        return
      }

      // Skip logging errors if logErrors is false
      if (!logErrors && isError) {
        return
      }

      // Create log entry
      const logEntry: ProxyLogEntry = {
        profileId,
        sessionId,
        method,
        url,
        requestHeaders,
        responseStatus,
        responseHeaders,
        errorMessage,
        durationMs,
        ipAddress,
        userAgent,
        requestSize,
        responseSize,
        timestamp: new Date().toISOString()
      }

      // Database logging removed - Stremio proxy functionality has been removed

      // Console logging based on level
      if (logLevel === 'debug') {
        console.log(`[PROXY] ${method} ${path} - ${responseStatus || 'ERROR'} (${durationMs}ms)`, {
          profileId,
          sessionId,
          requestSize,
          responseSize,
          error: errorMessage
        })
      } else if (logLevel === 'detailed') {
        console.log(`[PROXY] ${method} ${path} - ${responseStatus || 'ERROR'} (${durationMs}ms)`)
      } else if (isError) {
        console.warn(`[PROXY ERROR] ${method} ${path} - ${responseStatus} (${durationMs}ms): ${errorMessage}`)
      }
    }
  }
}


/**
 * Request timing middleware for performance monitoring
 */
export const requestTimingMiddleware = () => {
  return async (c: Context, next: Next) => {
    const startTime = performance.now()
    
    await next()
    
    const endTime = performance.now()
    const duration = endTime - startTime
    
    // Add timing header
    c.res.headers.set('X-Response-Time', `${duration.toFixed(2)}ms`)
    
    // Log slow requests (> 1 second)
    if (duration > 1000) {
      console.warn(`Slow request detected: ${c.req.method} ${c.req.url} took ${duration.toFixed(2)}ms`)
    }
  }
}

/**
 * Error tracking middleware
 */
export const errorTrackingMiddleware = () => {
  return async (c: Context, next: Next) => {
    try {
      await next()
    } catch (error) {
      const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      console.error(`[${errorId}] Unhandled error in ${c.req.method} ${c.req.url}:`, error)
      
      // Add error ID to response for debugging
      c.res.headers.set('X-Error-ID', errorId)
      
      // Re-throw to let other error handlers deal with it
      throw error
    }
  }
}

/**
 * Get proxy metrics
 */
export const getProxyMetrics = (endpoint?: string) => {
  return ProxyMetrics.getMetrics(endpoint)
}

/**
 * Reset proxy metrics
 */
export const resetProxyMetrics = () => {
  ProxyMetrics.reset()
}

/**
 * Middleware to expose metrics endpoint
 */
export const metricsEndpointMiddleware = (path: string = '/metrics') => {
  return async (c: Context, next: Next) => {
    if (c.req.path === path && c.req.method === 'GET') {
      const metrics = getProxyMetrics()
      return c.json({
        timestamp: new Date().toISOString(),
        metrics
      })
    }
    
    await next()
  }
}