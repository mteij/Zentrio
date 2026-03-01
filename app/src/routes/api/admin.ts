import { createTaggedOpenAPIApp } from './openapi-route'
import { adminSessionMiddleware, adminStepUpMiddleware, requirePermission } from '../../middleware/admin'
import { db, userDb } from '../../services/database'
import { err, ok } from '../../utils/api'
import { writeAuditEvent, queryAuditLog, verifyAuditChain, getAuditStats, getAuditHistoryForTarget } from '../../services/admin/audit'
import { createChallenge, verifyChallenge, getChallengeStatus, getOtpDestinationEmail } from '../../services/admin/stepup'
import { emailService } from '../../services/email'
import { Permissions, invalidatePermissionCache } from '../../services/admin/rbac'

const app = createTaggedOpenAPIApp('Admin')

// Helper to extract IP and user agent from request
function getRequestMeta(c: any) {
  const headers = c.req.raw.headers
  return {
    ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown',
    userAgent: headers.get('user-agent') || 'unknown',
  }
}

app.get('/me', adminSessionMiddleware, async (c) => {
  const adminUser = (c as any).get('adminUser') as any
  return ok(c, {
    id: adminUser?.id,
    email: adminUser?.email,
    name: adminUser?.name,
    role: adminUser?.role,
  })
})

app.get('/stats', adminSessionMiddleware, requirePermission(Permissions.STATS_READ), async (c) => {
  try {
    const users = (db.prepare('SELECT COUNT(*) as count FROM user').get() as { count: number }).count
    const admins = (db.prepare("SELECT COUNT(*) as count FROM user WHERE lower(role) = 'admin'").get() as { count: number }).count
    const profiles = (db.prepare('SELECT COUNT(*) as count FROM profiles').get() as { count: number }).count
    const activeSessions = (db.prepare('SELECT COUNT(*) as count FROM proxy_sessions WHERE is_active = 1').get() as { count: number }).count
    const watchedItems = (db.prepare('SELECT COUNT(*) as count FROM watch_history WHERE is_watched = 1').get() as { count: number }).count
    const bannedUsers = (db.prepare('SELECT COUNT(*) as count FROM user WHERE banned = 1').get() as { count: number }).count

    // Audit: admin viewed stats
    const adminUser = (c as any).get('adminUser') as any
    const { ipAddress, userAgent } = getRequestMeta(c)
    writeAuditEvent({
      actorId: adminUser.id,
      action: 'admin.stats.view',
      targetType: 'system',
      ipAddress,
      userAgent,
    })

    return ok(c, {
      users,
      admins,
      profiles,
      activeSessions,
      watchedItems,
      bannedUsers,
      ts: new Date().toISOString(),
    })
  } catch (e) {
    console.error('Admin stats failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to fetch admin stats')
  }
})

app.get('/activity/live', adminSessionMiddleware, requirePermission(Permissions.ACTIVITY_READ), async (c) => {
  try {
    const activeProxySessions = db.prepare(`
      SELECT id, user_id, profile_id, ip_address, user_agent, last_activity, expires_at
      FROM proxy_sessions
      WHERE is_active = 1
      ORDER BY last_activity DESC
      LIMIT 100
    `).all()

    const recentWatchEvents = db.prepare(`
      SELECT id, profile_id, meta_id, meta_type, season, episode, title, position, duration, updated_at
      FROM watch_history
      ORDER BY updated_at DESC
      LIMIT 100
    `).all()

    // Audit: admin viewed activity
    const adminUser = (c as any).get('adminUser') as any
    const { ipAddress, userAgent } = getRequestMeta(c)
    writeAuditEvent({
      actorId: adminUser.id,
      action: 'admin.activity.view',
      targetType: 'system',
      ipAddress,
      userAgent,
    })

    return ok(c, {
      activeProxySessions,
      recentWatchEvents,
      ts: new Date().toISOString(),
    })
  } catch (e) {
    console.error('Admin activity failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to fetch admin activity')
  }
})

app.get('/users', adminSessionMiddleware, requirePermission(Permissions.USERS_READ), async (c) => {
  try {
    const q = (c.req.query('q') || '').trim().toLowerCase()
    const limit = Math.max(1, Math.min(200, Number(c.req.query('limit') || 50)))
    const offset = Math.max(0, Number(c.req.query('offset') || 0))

    const like = `%${q}%`

    const users = db.prepare(`
      SELECT
        id,
        email,
        name,
        role,
        banned,
        banReason,
        banExpires,
        emailVerified,
        phoneNumber,
        phoneNumberVerified,
        createdAt,
        updatedAt
      FROM user
      WHERE (? = '' OR lower(email) LIKE ? OR lower(name) LIKE ?)
      ORDER BY createdAt DESC
      LIMIT ? OFFSET ?
    `).all(q, like, like, limit, offset)

    const total = (db.prepare(`
      SELECT COUNT(*) as count
      FROM user
      WHERE (? = '' OR lower(email) LIKE ? OR lower(name) LIKE ?)
    `).get(q, like, like) as { count: number }).count

    // Audit: admin listed users
    const adminUser = (c as any).get('adminUser') as any
    const { ipAddress, userAgent } = getRequestMeta(c)
    writeAuditEvent({
      actorId: adminUser.id,
      action: 'admin.users.list',
      targetType: 'user',
      ipAddress,
      userAgent,
      after: { query: q, limit, offset, total },
    })

    return ok(c, {
      users,
      pagination: {
        total,
        limit,
        offset,
      },
    })
  } catch (e) {
    console.error('Admin users list failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to list users')
  }
})

app.get('/users/:id', adminSessionMiddleware, requirePermission(Permissions.USERS_READ), async (c) => {
  try {
    const targetId = c.req.param('id')
    const user = db.prepare(`
      SELECT id, email, name, role, banned, banReason, banExpires,
             emailVerified, phoneNumber, phoneNumberVerified, createdAt, updatedAt
      FROM user WHERE id = ?
    `).get(targetId) as any

    if (!user) return err(c, 404, 'NOT_FOUND', 'User not found')

    const roles = db.prepare(`
      SELECT r.id, r.name, r.description FROM admin_roles r
      JOIN admin_user_roles ur ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `).all(targetId)

    const recentActivity = getAuditHistoryForTarget('user', targetId, 10)

    return ok(c, { user, roles, recentActivity })
  } catch (e) {
    console.error('Admin user detail failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to fetch user')
  }
})


app.post('/users/:id/role', adminSessionMiddleware, requirePermission(Permissions.USERS_WRITE_ROLE), adminStepUpMiddleware, async (c) => {
  try {
    const targetId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const role = String(body?.role || '').trim().toLowerCase()
    const reason = body?.reason ? String(body.reason).slice(0, 500) : null

    if (!targetId) {
      return err(c, 400, 'INVALID_INPUT', 'User ID is required')
    }
    if (role !== 'user' && role !== 'admin') {
      return err(c, 400, 'INVALID_INPUT', 'Role must be user or admin')
    }
    if (!reason) {
      return err(c, 400, 'REASON_REQUIRED', 'Reason is required for role changes')
    }

    // Get current user state for audit
    const targetUser = db.prepare('SELECT id, email, role FROM user WHERE id = ?').get(targetId) as { id: string; email: string; role: string } | undefined
    if (!targetUser) {
      return err(c, 404, 'NOT_FOUND', 'User not found')
    }

    const before = { role: targetUser.role }
    const updated = await userDb.update(targetId, { role })
    if (!updated) {
      return err(c, 404, 'NOT_FOUND', 'User not found')
    }
    // Invalidate RBAC cache immediately so new role takes effect on next request
    invalidatePermissionCache(targetId)

    // Audit: role change
    const adminUser = (c as any).get('adminUser') as any
    const { ipAddress, userAgent } = getRequestMeta(c)
    writeAuditEvent({
      actorId: adminUser.id,
      action: 'admin.user.role.change',
      targetType: 'user',
      targetId: targetId,
      reason,
      ipAddress,
      userAgent,
      before,
      after: { role: updated.role },
    })

    return ok(c, {
      id: updated.id,
      email: updated.email,
      role: updated.role,
    }, 'User role updated')
  } catch (e) {
    console.error('Admin role update failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to update user role')
  }
})

app.post('/users/:id/ban', adminSessionMiddleware, requirePermission(Permissions.USERS_WRITE_BAN), adminStepUpMiddleware, async (c) => {
  try {
    const targetId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const banReason = body?.banReason ? String(body.banReason).slice(0, 500) : null
    const expiresIn = Number(body?.banExpiresIn || 0)
    const banExpires = expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null

    if (!banReason) {
      return err(c, 400, 'REASON_REQUIRED', 'Ban reason is required')
    }

    // Get current state for audit
    const targetUser = db.prepare('SELECT id, email, banned, banReason FROM user WHERE id = ?').get(targetId) as { id: string; email: string; banned: boolean; banReason: string | null } | undefined
    if (!targetUser) {
      return err(c, 404, 'NOT_FOUND', 'User not found')
    }

    const before = { banned: targetUser.banned, banReason: targetUser.banReason }
    const updated = await userDb.update(targetId, {
      banned: true,
      banReason,
      banExpires,
    })

    if (!updated) {
      return err(c, 404, 'NOT_FOUND', 'User not found')
    }
    invalidatePermissionCache(targetId)

    // Audit: user ban
    const adminUser = (c as any).get('adminUser') as any
    const { ipAddress, userAgent } = getRequestMeta(c)
    writeAuditEvent({
      actorId: adminUser.id,
      action: 'admin.user.ban',
      targetType: 'user',
      targetId: targetId,
      reason: banReason,
      ipAddress,
      userAgent,
      before,
      after: { banned: updated.banned, banReason: updated.banReason, banExpires: updated.banExpires },
    })

    return ok(c, {
      id: updated.id,
      banned: updated.banned,
      banReason: updated.banReason,
      banExpires: updated.banExpires,
    }, 'User banned')
  } catch (e) {
    console.error('Admin ban failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to ban user')
  }
})

app.post('/users/:id/unban', adminSessionMiddleware, requirePermission(Permissions.USERS_WRITE_BAN), adminStepUpMiddleware, async (c) => {
  try {
    const targetId = c.req.param('id')
    const body = await c.req.json().catch(() => ({}))
    const reason = body?.reason ? String(body.reason).slice(0, 500) : null

    if (!reason) {
      return err(c, 400, 'REASON_REQUIRED', 'Reason is required for unban')
    }

    // Get current state for audit
    const targetUser = db.prepare('SELECT id, email, banned, banReason, banExpires FROM user WHERE id = ?').get(targetId) as { id: string; email: string; banned: boolean; banReason: string | null; banExpires: string | null } | undefined
    if (!targetUser) {
      return err(c, 404, 'NOT_FOUND', 'User not found')
    }

    const before = { banned: targetUser.banned, banReason: targetUser.banReason, banExpires: targetUser.banExpires }
    const updated = await userDb.update(targetId, {
      banned: false,
      banReason: null,
      banExpires: null,
    })

    if (!updated) {
      return err(c, 404, 'NOT_FOUND', 'User not found')
    }
    invalidatePermissionCache(targetId)

    // Audit: user unban
    const adminUser = (c as any).get('adminUser') as any
    const { ipAddress, userAgent } = getRequestMeta(c)
    writeAuditEvent({
      actorId: adminUser.id,
      action: 'admin.user.unban',
      targetType: 'user',
      targetId: targetId,
      reason,
      ipAddress,
      userAgent,
      before,
      after: { banned: updated.banned, banReason: updated.banReason, banExpires: updated.banExpires },
    })

    return ok(c, {
      id: updated.id,
      banned: updated.banned,
    }, 'User unbanned')
  } catch (e) {
    console.error('Admin unban failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to unban user')
  }
})

// Audit log query endpoints
app.get('/audit', adminSessionMiddleware, requirePermission(Permissions.AUDIT_READ), async (c) => {
  try {
    const limit = Math.max(1, Math.min(100, Number(c.req.query('limit') || 50)))
    const offset = Math.max(0, Number(c.req.query('offset') || 0))
    const actorId = c.req.query('actorId') || undefined
    const action = c.req.query('action') || undefined
    const targetType = c.req.query('targetType') || undefined
    const targetId = c.req.query('targetId') || undefined
    const startDate = c.req.query('startDate') || undefined
    const endDate = c.req.query('endDate') || undefined

    const result = queryAuditLog(
      { actorId, action, targetType, targetId, startDate, endDate },
      limit,
      offset
    )

    // Audit: admin viewed audit log
    const adminUser = (c as any).get('adminUser') as any
    const { ipAddress, userAgent } = getRequestMeta(c)
    writeAuditEvent({
      actorId: adminUser.id,
      action: 'admin.audit.view',
      targetType: 'system',
      ipAddress,
      userAgent,
      after: { filters: { actorId, action, targetType, targetId, startDate, endDate }, limit, offset },
    })

    return ok(c, {
      logs: result.logs,
      total: result.total,
      hasMore: result.hasMore,
      pagination: { limit, offset },
    })
  } catch (e) {
    console.error('Admin audit query failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to query audit log')
  }
})

app.get('/audit/stats', adminSessionMiddleware, requirePermission(Permissions.AUDIT_READ), async (c) => {
  try {
    const stats = getAuditStats()

    // Audit: admin viewed audit stats
    const adminUser = (c as any).get('adminUser') as any
    const { ipAddress, userAgent } = getRequestMeta(c)
    writeAuditEvent({
      actorId: adminUser.id,
      action: 'admin.audit.stats',
      targetType: 'system',
      ipAddress,
      userAgent,
    })

    return ok(c, stats)
  } catch (e) {
    console.error('Admin audit stats failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to get audit stats')
  }
})

app.post('/audit/verify', adminSessionMiddleware, requirePermission(Permissions.AUDIT_READ), adminStepUpMiddleware, async (c) => {
  try {
    const result = verifyAuditChain()

    // Audit: admin verified audit chain
    const adminUser = (c as any).get('adminUser') as any
    const { ipAddress, userAgent } = getRequestMeta(c)
    writeAuditEvent({
      actorId: adminUser.id,
      action: 'admin.audit.verify',
      targetType: 'system',
      ipAddress,
      userAgent,
      after: { valid: result.valid, firstInvalidId: result.firstInvalidId },
    })

    if (!result.valid) {
      return err(c, 400, 'AUDIT_CHAIN_INVALID', `Audit chain integrity check failed: ${result.error} (entry ${result.firstInvalidId})`)
    }

    return ok(c, { valid: true, message: 'Audit chain integrity verified' })
  } catch (e) {
    console.error('Admin audit verify failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to verify audit chain')
  }
})

// Step-up challenge endpoints
app.post('/stepup/request', adminSessionMiddleware, async (c) => {
  try {
    const adminUser = (c as any).get('adminUser') as any
    const { ipAddress, userAgent } = getRequestMeta(c)

    // Create challenge
    const { challengeId, otp, expiresAt } = createChallenge(adminUser.id)

    // Send OTP via email
    const emailDest = getOtpDestinationEmail(adminUser.email)

    try {
      const sent = await emailService.sendOTP(emailDest, otp)
      if (!sent) {
        throw new Error('Email service returned false')
      }
    } catch (emailErr) {
      // In non-production: log OTP to console as a dev fallback so step-up can be tested
      // without valid email credentials (mirrors phone OTP dev fallback in auth.ts)
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[StepUp] Email delivery failed — dev fallback OTP for ${emailDest}: ${otp}`)
      } else {
        console.error('Failed to send step-up OTP email:', emailErr)
        return err(c, 500, 'EMAIL_FAILED', 'Failed to send verification code. Please try again.')
      }
    }

    // Audit: step-up requested
    writeAuditEvent({
      actorId: adminUser.id,
      action: 'admin.stepup.request',
      targetType: 'user',
      targetId: adminUser.id,
      ipAddress,
      userAgent,
      after: { challengeId, emailDest: emailDest !== adminUser.email ? 'fallback' : 'primary' },
    })

    return ok(c, {
      challengeId,
      expiresAt: expiresAt.toISOString(),
      message: 'Verification code sent to your email',
    })
  } catch (e: any) {
    console.error('Admin step-up request failed', e)
    if (e.message?.includes('Too many active challenges')) {
      return err(c, 429, 'RATE_LIMITED', e.message)
    }
    return err(c, 500, 'SERVER_ERROR', 'Failed to create step-up challenge')
  }
})

app.post('/stepup/verify', adminSessionMiddleware, async (c) => {
  try {
    const adminUser = (c as any).get('adminUser') as any
    const body = await c.req.json().catch(() => ({}))
    const challengeId = String(body?.challengeId || '').trim()
    const otp = String(body?.otp || '').trim()

    if (!challengeId || !otp) {
      return err(c, 400, 'INVALID_INPUT', 'Challenge ID and OTP are required')
    }

    const { ipAddress, userAgent } = getRequestMeta(c)

    // Verify challenge
    const result = verifyChallenge(adminUser.id, challengeId, otp)

    if (!result.valid) {
      // Audit: failed verification
      writeAuditEvent({
        actorId: adminUser.id,
        action: 'admin.stepup.verify.failed',
        targetType: 'user',
        targetId: adminUser.id,
        ipAddress,
        userAgent,
        after: { challengeId, reason: result.error },
      })
      return err(c, 403, 'VERIFICATION_FAILED', result.error || 'Invalid verification code')
    }

    // Audit: successful verification
    writeAuditEvent({
      actorId: adminUser.id,
      action: 'admin.stepup.verify.success',
      targetType: 'user',
      targetId: adminUser.id,
      ipAddress,
      userAgent,
      after: { challengeId },
    })

    return ok(c, {
      valid: true,
      message: 'Step-up verification successful',
    })
  } catch (e) {
    console.error('Admin step-up verify failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to verify step-up challenge')
  }
})

app.get('/stepup/status', adminSessionMiddleware, async (c) => {
  try {
    const adminUser = (c as any).get('adminUser') as any
    const status = getChallengeStatus(adminUser.id)

    return ok(c, {
      ...status,
      hasValidStepUp: status.used > 0,
    })
  } catch (e) {
    console.error('Admin step-up status failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to get step-up status')
  }
})

export default app
