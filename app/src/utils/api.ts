import type { Context } from 'hono'
import { z } from 'zod'

// Standard API Response format
export interface ApiResponse<T = any> {
  ok: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  message?: string
}

// Success response helper
export const ok = <T>(c: Context, data?: T, message?: string) => {
  return c.json(
    {
      ok: true,
      ...(data !== undefined ? { data } : {}),
      ...(message ? { message } : {}),
    } as ApiResponse<T>,
    200
  )
}

// Error response helper
export const err = (
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 410 | 429 | 500 | 502,
  code: string,
  message: string,
  details?: unknown
) => {
  return c.json(
    {
      ok: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    } as ApiResponse,
    status
  )
}

export function getRequestMeta(c: Context) {
  const headers = c.req.raw.headers
  // Use the LAST entry in X-Forwarded-For — this is appended by the nearest
  // trusted proxy and is much harder to spoof than the first (client-supplied) entry.
  const xff = headers.get('x-forwarded-for')
  const forwardedFor = xff ? xff.split(',') : null
  const ip = (forwardedFor ? forwardedFor[forwardedFor.length - 1]?.trim() : null) ||
             headers.get('x-real-ip') ||
             //@ts-ignore: runtime typing gap
             c.env?.incoming?.socket?.remoteAddress ||
             '127.0.0.1'

  return {
    ipAddress: ip,
    userAgent: headers.get('user-agent') || 'unknown',
  }
}

// Validation helper
export const validate = async <T>(schema: z.Schema<T>, data: any): Promise<{ success: true; data: T } | { success: false; error: any }> => {
  const result = await schema.safeParseAsync(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error.format() }
}

// Common schemas
export const schemas = {
  email: z.string().email().min(5).max(254).transform(e => e.trim().toLowerCase()),
  password: z.string().min(6).max(1024),
  username: z.string().min(2).max(50).trim(),
  id: z.coerce.number().int().positive(),
}
