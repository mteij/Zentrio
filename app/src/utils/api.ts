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
  status: 400 | 401 | 403 | 404 | 409 | 410 | 429 | 500,
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