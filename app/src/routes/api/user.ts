import { Hono } from 'hono'
import { sessionMiddleware } from '../../middleware/session'
import { userDb, otpDb, sessionDb, verifyPassword, type User } from '../../services/database'
import { emailService } from '../../services/email'
import { createHash } from 'crypto'

const app = new Hono<{
  Variables: {
    user: User
  }
}>()

// Enforce session on all routes for this router
app.use('/*', sessionMiddleware)
// CSRF-like guard mounted after session middleware
app.use('*', csrfLikeGuard)

// JSON response helpers (standard envelope for new/deprecated endpoints)
const ok = (c: any, data?: any, message?: string) =>
  c.json({ ok: true, ...(message ? { message } : {}), ...(data ? { data } : {}) })

const err = (c: any, status: number, code: string, message: string) =>
  c.json({ ok: false, error: { code, message } }, status)

// In-memory per-user rate limiting
type RL = { count: number; resetAt: number; lastAt?: number }
const rateMap = new Map<string, RL>()

function enforceRate(
  userId: number,
  key: string,
  opts: { max: number; windowMs: number; minIntervalMs?: number },
): boolean {
  const now = Date.now()
  const mapKey = `${userId}:${key}`
  let entry = rateMap.get(mapKey)
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + opts.windowMs }
  }
  if (opts.minIntervalMs && entry.lastAt && now - entry.lastAt < opts.minIntervalMs) {
    rateMap.set(mapKey, entry)
    return false
  }
  if (entry.count >= opts.max) {
    rateMap.set(mapKey, entry)
    return false
  }
  entry.count += 1
  entry.lastAt = now
  rateMap.set(mapKey, entry)
  return true
}

function normalizeEmail(e: string): string {
  return e.trim().toLowerCase()
}

// CSRF-like guard middleware
async function csrfLikeGuard(c: any, next: any) {
  const method = (c.req.method || '').toUpperCase()
  if (method === 'OPTIONS') {
    return new Response('', { status: 204 })
  }
  if (method === 'GET' || method === 'HEAD') {
    return next()
  }

  const xrw = (c.req.header('x-requested-with') || '').toLowerCase()
  if (xrw !== 'xmlhttprequest') {
    return err(c, 403, 'CSRF_CHECK_FAILED', 'CSRF checks failed')
  }

  const ct = (c.req.header('content-type') || '').toLowerCase()
  if (!ct.startsWith('application/json')) {
    return err(c, 403, 'CSRF_CHECK_FAILED', 'CSRF checks failed')
  }

  // Reconstruct expected origin honoring reverse proxy headers (TLS termination etc.)
  const rawUrl = c.req.url
  const url = new URL(rawUrl)
  const xfProto =
    (c.req.header('x-forwarded-proto') ||
      c.req.header('x-forwarded-scheme') ||
      url.protocol.replace(':', '')).toLowerCase()
  const xfHost =
    (c.req.header('x-forwarded-host') ||
      c.req.header('host') ||
      url.host).toLowerCase()
  const expectedOrigin = `${xfProto}://${xfHost}`

  const checkSameHost = (candidate: string): boolean => {
    try {
      const cand = new URL(candidate)
      const exp = new URL(expectedOrigin)
      // Accept when host matches even if scheme differs (common behind HTTPS-terminating proxy)
      return cand.host.toLowerCase() === exp.host.toLowerCase()
    } catch {
      return false
    }
  }

  const hdrOrigin = (c.req.header('origin') || '').toLowerCase()
  if (hdrOrigin) {
    if (!checkSameHost(hdrOrigin)) {
      return err(c, 403, 'CSRF_CHECK_FAILED', 'CSRF checks failed')
    }
  } else {
    const referer = c.req.header('referer') || ''
    if (referer) {
      if (!checkSameHost(referer)) {
        return err(c, 403, 'CSRF_CHECK_FAILED', 'CSRF checks failed')
      }
    }
  }

  return next()
}

// Centralized validators
function isValidEmail(email: string, currentEmail?: string): string | null {
  const normalized = normalizeEmail(String(email || ''))
  if (normalized.length < 5 || normalized.length > 254) return null
  const re = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
  if (!re.test(normalized)) return null
  if (typeof currentEmail === 'string') {
    const currentNorm = normalizeEmail(currentEmail)
    if (currentNorm === normalized) return null
  }
  return normalized
}

function isValidOtp(code: string): boolean {
  return /^[0-9]{6}$/.test(String(code || ''))
}

function isValidPassword(oldPwd: string, newPwd: string):
  | { ok: true }
  | { ok: false; reason: 'LENGTH' | 'SAME_AS_OLD' | 'MISSING_CLASSES' } {
  const oldOk = typeof oldPwd === 'string' && oldPwd.length >= 8 && oldPwd.length <= 1024
  const newOk = typeof newPwd === 'string' && newPwd.length >= 12 && newPwd.length <= 1024
  if (!oldOk || !newOk) return { ok: false, reason: 'LENGTH' }
  if (oldPwd === newPwd) return { ok: false, reason: 'SAME_AS_OLD' }
  const hasLetter = /[A-Za-z]/.test(newPwd)
  const hasDigit = /[0-9]/.test(newPwd)
  if (!hasLetter || !hasDigit) return { ok: false, reason: 'MISSING_CLASSES' }
  return { ok: true }
}

// Audit helpers
function hashEmail(emailNorm: string): string {
  return createHash('sha256').update(emailNorm).digest('hex')
}

function getClientInfo(c: any): { ip?: string; userAgent?: string } {
  const xff = c.req.header('x-forwarded-for') || ''
  const ip =
    (xff.split(',')[0] || '').trim() ||
    c.req.header('x-real-ip') ||
    undefined
  const userAgent = c.req.header('user-agent') || undefined
  return { ip, userAgent }
}

// Thin wrapper over enforceRate for per-user keys
function rateLimitUser(
  userId: number,
  key: string,
  opts: { max: number; windowMs: number; minIntervalMs?: number },
): boolean {
  return enforceRate(userId, key, opts)
}

// ========== User Settings API (session required) ==========

// [GET /settings] Return current user's app settings (keeps legacy shape for frontend)
app.get('/settings', async (c) => {
  try {
    const user = c.get('user')
    const fresh = userDb.findById(user.id)
    if (!fresh) {
      return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
    }
    return ok(c, {
      addonManagerEnabled: fresh.addon_manager_enabled,
      hideCalendarButton: fresh.hide_calendar_button ?? true,
      hideAddonsButton: fresh.hide_addons_button ?? false,
      hideCinemetaContent: fresh.hide_cinemeta_content ?? false,
      downloadsManagerEnabled: fresh.downloads_manager_enabled ?? true,
    })
  } catch (_e) {
    return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
  }
})

// [PUT /settings] Update current user's app settings (keeps legacy shape for frontend)
app.put('/settings', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}))
    const user = c.get('user')

    const updated = userDb.update(user.id, {
      addon_manager_enabled: body.addonManagerEnabled,
      hide_calendar_button: body.hideCalendarButton,
      hide_addons_button: body.hideAddonsButton,
      hide_cinemeta_content: body.hideCinemetaContent,
      downloads_manager_enabled: body.downloadsManagerEnabled,
    })
    if (!updated) {
      return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
    }
    return ok(c, undefined, 'Settings saved successfully')
  } catch (_e) {
    return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
  }
})

// [GET /profile] Return current user's profile (keeps legacy shape for frontend)
app.get('/profile', async (c) => {
  try {
    const user = c.get('user')
    const fresh = userDb.findById(user.id)
    if (!fresh) {
      return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
    }
    return ok(c, {
      id: fresh.id,
      email: fresh.email,
      username: fresh.username,
      firstName: fresh.first_name,
      lastName: fresh.last_name,
    })
  } catch (_e) {
    return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
  }
})

// ========== Email change flow ==========

// [PUT /email] Deprecated direct update
app.put('/email', async (c) => {
  // Session-protected by router-level middleware
  return err(c, 410, 'DEPRECATED', 'Use /api/user/email/initiate and /verify')
})

// [POST /email/initiate] Start email verification by sending OTP to new email
app.post('/email/initiate', async (c) => {
  const user = c.get('user')
  const { ip, userAgent } = getClientInfo(c)
  try {
    const payload = await c.req.json().catch(() => ({}))
    const maybeEmail = typeof payload?.newEmail === 'string' ? payload.newEmail : ''
    const newEmail = isValidEmail(maybeEmail, user.email)
    if (!newEmail) {
      console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'email_change_initiate', result: 'error', ip, userAgent, errorCode: 'INVALID_INPUT' }))
      return err(c, 400, 'INVALID_INPUT', 'Invalid input')
    }

    // Per-user rate limit: 5/hour, min 30s between attempts
    if (!rateLimitUser(user.id, 'email_initiate', { max: 5, windowMs: 60 * 60 * 1000, minIntervalMs: 30 * 1000 })) {
      console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'email_change_initiate', result: 'error', ip, userAgent, errorCode: 'RATE_LIMITED' }))
      return err(c, 429, 'RATE_LIMITED', 'Too many requests. Try later.')
    }

    // Check uniqueness
    const existing = userDb.findByEmail(newEmail)
    if (existing && existing.id !== user.id) {
      console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'email_change_initiate', result: 'error', ip, userAgent, targetEmailHash: hashEmail(newEmail), errorCode: 'EMAIL_IN_USE' }))
      return err(c, 409, 'EMAIL_IN_USE', 'Unable to process request')
    }

    // Issue OTP and send email
    let code: string
    try {
      code = await otpDb.issue(newEmail)
    } catch (e: any) {
      if (e instanceof Error && e.message === 'RATE_LIMITED') {
        console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'email_change_initiate', result: 'error', ip, userAgent, targetEmailHash: hashEmail(newEmail), errorCode: 'RATE_LIMITED' }))
        return err(c, 429, 'RATE_LIMITED', 'Too many requests. Try later.')
      }
      console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'email_change_initiate', result: 'error', ip, userAgent, targetEmailHash: hashEmail(newEmail), errorCode: 'SERVER_ERROR' }))
      return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
    }

    await emailService.sendOTP(newEmail, code)

    console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'email_change_initiate', result: 'success', ip, userAgent, targetEmailHash: hashEmail(newEmail) }))
    return ok(c, undefined, 'Verification code sent if eligible')
  } catch (_e) {
    console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'email_change_initiate', result: 'error', ip, userAgent, errorCode: 'SERVER_ERROR' }))
    return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
  }
})

// [POST /email/verify] Verify OTP, update email, and invalidate sessions
app.post('/email/verify', async (c) => {
  const user = c.get('user')
  const { ip, userAgent } = getClientInfo(c)
  try {
    const payload = await c.req.json().catch(() => ({}))
    const rawEmail = typeof payload?.newEmail === 'string' ? payload.newEmail : ''
    const newEmail = isValidEmail(rawEmail)
    const code = typeof payload?.code === 'string' ? payload.code : ''

    if (!newEmail || !isValidOtp(code)) {
      console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'email_change_verify', result: 'error', ip, userAgent, errorCode: 'INVALID_INPUT' }))
      return err(c, 400, 'INVALID_INPUT', 'Invalid input')
    }

    // Per-user rate limit: 10/hour
    if (!rateLimitUser(user.id, 'email_verify', { max: 10, windowMs: 60 * 60 * 1000 })) {
      console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'email_change_verify', result: 'error', ip, userAgent, targetEmailHash: hashEmail(newEmail), errorCode: 'RATE_LIMITED' }))
      return err(c, 429, 'RATE_LIMITED', 'Too many requests. Try later.')
    }

    // Verify OTP
    const valid = await otpDb.verifyAndConsume(newEmail, code)
    if (!valid) {
      console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'email_change_verify', result: 'error', ip, userAgent, targetEmailHash: hashEmail(newEmail), errorCode: 'INVALID_CODE' }))
      return err(c, 400, 'INVALID_CODE', 'Invalid verification code')
    }

    // Re-check uniqueness
    const existing = userDb.findByEmail(newEmail)
    if (existing && existing.id !== user.id) {
      console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'email_change_verify', result: 'error', ip, userAgent, targetEmailHash: hashEmail(newEmail), errorCode: 'EMAIL_IN_USE' }))
      return err(c, 409, 'EMAIL_IN_USE', 'Unable to process request')
    }

    // Update email
    const updated = userDb.updateEmail(user.id, newEmail)
    if (!updated) {
      console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'email_change_verify', result: 'error', ip, userAgent, targetEmailHash: hashEmail(newEmail), errorCode: 'SERVER_ERROR' }))
      return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
    }

    // Invalidate all sessions
    sessionDb.deleteAllForUser(user.id)

    console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'email_change_verify', result: 'success', ip, userAgent, targetEmailHash: hashEmail(newEmail) }))
    return ok(c, { email: newEmail }, 'Email updated')
  } catch (_e) {
    console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'email_change_verify', result: 'error', ip, userAgent, errorCode: 'SERVER_ERROR' }))
    return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
  }
})

// ========== Password change ==========

// [PUT /password] Verify old password, set new, invalidate sessions
app.put('/password', async (c) => {
  const user = c.get('user')
  const { ip, userAgent } = getClientInfo(c)
  try {
    const payload = await c.req.json().catch(() => ({}))
    const oldPassword = typeof payload?.oldPassword === 'string' ? payload.oldPassword : ''
    const newPassword = typeof payload?.newPassword === 'string' ? payload.newPassword : ''

    // Validation
    const v = isValidPassword(oldPassword, newPassword)
    if (!v.ok) {
      console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'password_change', result: 'error', ip, userAgent, errorCode: 'INVALID_INPUT' }))
      return err(c, 400, 'INVALID_INPUT', 'Invalid input')
    }

    // Per-user rate limit: 5 / 15 minutes
    if (!rateLimitUser(user.id, 'password_put', { max: 5, windowMs: 15 * 60 * 1000 })) {
      console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'password_change', result: 'error', ip, userAgent, errorCode: 'RATE_LIMITED' }))
      return err(c, 429, 'RATE_LIMITED', 'Too many requests. Try later.')
    }

    // Verify old password
    const fresh = userDb.findById(user.id)
    if (!fresh) {
      console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'password_change', result: 'error', ip, userAgent, errorCode: 'SERVER_ERROR' }))
      return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
    }

    const validOld = await verifyPassword(oldPassword, fresh.password_hash)
    if (!validOld) {
      // Soft delay for invalid old password
      await new Promise((r) => setTimeout(r, 500))
      console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'password_change', result: 'error', ip, userAgent, errorCode: 'AUTHENTICATION_FAILED' }))
      return err(c, 401, 'AUTHENTICATION_FAILED', 'Authentication failed')
    }

    // Update and invalidate sessions
    const updated = await userDb.updatePassword(user.id, newPassword)
    if (!updated) {
      console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'password_change', result: 'error', ip, userAgent, errorCode: 'SERVER_ERROR' }))
      return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
    }

    sessionDb.deleteAllForUser(user.id)

    console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'password_change', result: 'success', ip, userAgent }))
    return ok(c, undefined, 'Password updated; please sign in again.')
  } catch (_e) {
    console.info(JSON.stringify({ ts: new Date().toISOString(), userId: user.id, action: 'password_change', result: 'error', ip, userAgent, errorCode: 'SERVER_ERROR' }))
    return err(c, 500, 'SERVER_ERROR', 'Unexpected error')
  }
})

export default app
