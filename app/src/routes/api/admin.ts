import { createTaggedOpenAPIApp } from './openapi-route'
import { adminSessionMiddleware, adminStepUpMiddleware, requirePermission } from '../../middleware/admin'
import { db, userDb } from '../../services/database'
import { err, ok, getRequestMeta } from '../../utils/api'
import { getConfig } from '../../services/envParser'
import { writeAuditEvent, queryAuditLog, verifyAuditChain, getAuditStats, getAuditHistoryForTarget } from '../../services/admin/audit'
import { createChallenge, verifyChallenge, getChallengeStatus, getOtpDestinationEmail } from '../../services/admin/stepup'
import { emailService } from '../../services/email'
import { Permissions, invalidatePermissionCache } from '../../services/admin/rbac'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { logger } from '../../services/logger'

const log = logger.scope('API:Admin')

const app = createTaggedOpenAPIApp('Admin')

// Public — no auth required. Frontend uses this to show/hide the admin button and setup flow.
app.get('/status', async (c) => {
  const { ADMIN_ENABLED, ADMIN_SETUP_TOKEN } = getConfig()
  const hasOwner = !!(db.prepare("SELECT 1 FROM user WHERE role = 'superadmin' LIMIT 1").get())
  return ok(c, { enabled: ADMIN_ENABLED, hasOwner, requiresSetupToken: !!ADMIN_SETUP_TOKEN })
})

// Claim superadmin — only works when admin is enabled and no superadmin exists yet.
// Requires the user to be logged in. If ADMIN_SETUP_TOKEN is configured, the token
// must be supplied in the request body, preventing arbitrary users from claiming ownership.
app.post('/setup', async (c) => {
  const { ADMIN_ENABLED, ADMIN_SETUP_TOKEN } = getConfig()

  if (!ADMIN_ENABLED) {
    return err(c, 403, 'FORBIDDEN', 'Admin console is not enabled on this instance')
  }

  const hasOwner = !!(db.prepare("SELECT 1 FROM user WHERE role = 'superadmin' LIMIT 1").get())
  if (hasOwner) {
    return err(c, 409, 'ALREADY_CONFIGURED', 'Admin setup has already been completed')
  }

  // Verify setup token when configured
  if (ADMIN_SETUP_TOKEN) {
    const body = await c.req.json().catch(() => ({}))
    const providedToken = String(body?.setupToken || '').trim()
    if (!providedToken || providedToken !== ADMIN_SETUP_TOKEN) {
      return err(c, 403, 'INVALID_SETUP_TOKEN', 'Invalid or missing admin setup token')
    }
  }

  const session = await (await import('../../services/auth')).auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session?.user) {
    return err(c, 401, 'UNAUTHORIZED', 'You must be logged in to claim admin access')
  }

  db.prepare("UPDATE user SET role = 'superadmin', updatedAt = ? WHERE id = ?")
    .run(new Date().toISOString(), session.user.id)

  log.debug(`${session.user.email} claimed superadmin`)

  return ok(c, { message: 'Admin setup complete. You are now superadmin.' })
})

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
    const admins = (db.prepare("SELECT COUNT(*) as count FROM user WHERE lower(role) IN ('admin', 'superadmin')").get() as { count: number }).count
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
    log.error('Admin stats failed', e)
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
    log.error('Admin activity failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to fetch admin activity')
  }
})

// Pre-built query fragments for each allowed chart range.
// All SQL is hardcoded here; no user input is ever interpolated into queries.
const CHART_RANGE_QUERIES = {
  '24h': {
    usersSQL: `SELECT strftime('%Y-%m-%d %H:00', createdAt) as date, COUNT(*) as count FROM user WHERE createdAt >= datetime('now', '-24 hours') GROUP BY strftime('%Y-%m-%d %H:00', createdAt) ORDER BY date ASC`,
    watchesSQL: `SELECT strftime('%Y-%m-%d %H:00', updated_at) as date, COUNT(*) as count FROM watch_history WHERE updated_at >= datetime('now', '-24 hours') GROUP BY strftime('%Y-%m-%d %H:00', updated_at) ORDER BY date ASC`,
    dataPoints: 24,
  },
  '7d': {
    usersSQL: `SELECT date(createdAt) as date, COUNT(*) as count FROM user WHERE createdAt >= date('now', '-7 days') GROUP BY date(createdAt) ORDER BY date ASC`,
    watchesSQL: `SELECT date(updated_at) as date, COUNT(*) as count FROM watch_history WHERE updated_at >= date('now', '-7 days') GROUP BY date(updated_at) ORDER BY date ASC`,
    dataPoints: 7,
  },
  'all': {
    usersSQL: `SELECT date(createdAt) as date, COUNT(*) as count FROM user GROUP BY date(createdAt) ORDER BY date ASC`,
    watchesSQL: `SELECT date(updated_at) as date, COUNT(*) as count FROM watch_history GROUP BY date(updated_at) ORDER BY date ASC`,
    dataPoints: 0,
  },
  '30d': {
    usersSQL: `SELECT date(createdAt) as date, COUNT(*) as count FROM user WHERE createdAt >= date('now', '-30 days') GROUP BY date(createdAt) ORDER BY date ASC`,
    watchesSQL: `SELECT date(updated_at) as date, COUNT(*) as count FROM watch_history WHERE updated_at >= date('now', '-30 days') GROUP BY date(updated_at) ORDER BY date ASC`,
    dataPoints: 30,
  },
} as const

app.get('/dashboard/charts', adminSessionMiddleware, requirePermission(Permissions.STATS_READ), async (c) => {
  try {
    const rangeParam = c.req.query('range') || '30d'
    const rangeKey = (rangeParam in CHART_RANGE_QUERIES ? rangeParam : '30d') as keyof typeof CHART_RANGE_QUERIES
    const { usersSQL, watchesSQL, dataPoints } = CHART_RANGE_QUERIES[rangeKey]

    const recentUsers = db.prepare(usersSQL).all() as { date: string, count: number }[]
    const recentWatches = db.prepare(watchesSQL).all() as { date: string, count: number }[]

    const chartData: any[] = []
    
    if (rangeKey === 'all') {
      const allDates = Array.from(new Set([...recentUsers.map(u => u.date), ...recentWatches.map(w => w.date)])).filter(Boolean).sort()
      for (const d of allDates) {
        chartData.push({
          date: d,
          label: d,
          users: recentUsers.find(u => u.date === d)?.count || 0,
          watches: recentWatches.find(w => w.date === d)?.count || 0
        })
      }
    } else if (rangeKey === '24h') {
      const today = new Date()
      today.setMinutes(0, 0, 0)
      for (let i = 23; i >= 0; i--) {
        const d = new Date(today)
        d.setHours(d.getHours() - i)
        const dateStr = d.toISOString().replace('T', ' ').substring(0, 14) + ':00'
        const labelStr = `${d.getHours().toString().padStart(2, '0')}:00`
        chartData.push({
          date: dateStr,
          label: labelStr,
          users: recentUsers.find(u => u.date === dateStr)?.count || 0,
          watches: recentWatches.find(w => w.date === dateStr)?.count || 0
        })
      }
    } else {
      // 7d or 30d
      const today = new Date()
      for (let i = dataPoints - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        chartData.push({
          date: dateStr,
          label: dateStr.slice(5),
          users: recentUsers.find(u => u.date === dateStr)?.count || 0,
          watches: recentWatches.find(w => w.date === dateStr)?.count || 0
        })
      }
    }

    // Audit: admin viewed charts
    const adminUser = (c as any).get('adminUser') as any
    const { ipAddress, userAgent } = getRequestMeta(c)
    writeAuditEvent({
      actorId: adminUser.id,
      action: 'admin.dashboard.charts',
      targetType: 'system',
      ipAddress,
      userAgent,
      after: { range: rangeKey }
    })

    return ok(c, { chartData })
  } catch (e) {
    log.error('Admin charts failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to fetch admin chart data')
  }
})

app.get('/stats/platforms', adminSessionMiddleware, requirePermission(Permissions.STATS_READ), async (c) => {
  const { ANALYTICS_ENABLED } = getConfig()
  if (!ANALYTICS_ENABLED) {
    return ok(c, { total: 0, platforms: [], browsers: [], disabled: true })
  }
  try {
    // Join with client hints so Tauri Desktop sessions aren't misclassified
    // as Windows/macOS/Linux based on their WebView user-agent.
    // Include all sessions regardless of userAgent. Sessions created by the Tauri
    // HTTP plugin (reqwest) may have a null/non-browser UA; they should still be
    // counted, relying on the session_client_hints.client_type for classification.
    const sessions = db.prepare(`
      SELECT s.userAgent, sch.client_type
      FROM session s
      LEFT JOIN session_client_hints sch ON sch.session_token = s.token
    `).all() as { userAgent: string | null; client_type: string | null }[]

    const platforms: Record<string, number> = {}
    const browsers: Record<string, number> = {}

    // Map client_type hint → display name. When a Tauri hint is present the UA-based
    // OS detection would still work but would show the wrong category (e.g. a Tauri
    // Windows session looks like plain "Windows" in the UA).
    const tauriLabels: Record<string, string> = {
      'tauri-windows': 'Tauri (Windows)',
      'tauri-macos':   'Tauri (macOS)',
      'tauri-linux':   'Tauri (Linux)',
      'tauri-android': 'Tauri (Android)',
      'tauri-ios':     'Tauri (iOS)',
      'tauri-desktop': 'Tauri (Desktop)', // legacy / unknown OS fallback
    }

    for (const { userAgent: ua, client_type } of sessions) {
      // Platform — prefer the explicit hint, fall back to UA parsing for web sessions
      let platform = 'Other'
      if (client_type && tauriLabels[client_type]) {
        platform = tauriLabels[client_type]
      } else if (ua && /android/i.test(ua)) platform = 'Android'
      else if (ua && /iphone|ipad/i.test(ua)) platform = 'iOS'
      else if (ua && /windows nt/i.test(ua)) platform = 'Windows'
      else if (ua && /macintosh|mac os x/i.test(ua)) platform = 'macOS'
      else if (ua && /linux/i.test(ua)) platform = 'Linux'
      platforms[platform] = (platforms[platform] || 0) + 1

      // Skip browser breakdown for Tauri sessions — the WebView browser name
      // (e.g. "Chrome" on Android WebView) is not meaningful for a native app.
      if (client_type && tauriLabels[client_type]) continue
      let browser = 'Other'
      if (ua && /edg\//i.test(ua)) browser = 'Edge'
      else if (ua && /opr\//i.test(ua)) browser = 'Opera'
      else if (ua && /firefox\//i.test(ua)) browser = 'Firefox'
      else if (ua && /chrome\//i.test(ua)) browser = 'Chrome'
      else if (ua && /safari\//i.test(ua)) browser = 'Safari'
      browsers[browser] = (browsers[browser] || 0) + 1
    }

    return ok(c, {
      total: sessions.length,
      platforms: Object.entries(platforms)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      browsers: Object.entries(browsers)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
    })
  } catch (e) {
    log.error('Admin platform stats failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to fetch platform stats')
  }
})

app.get('/system/health', adminSessionMiddleware, requirePermission(Permissions.STATS_READ), async (c) => {
  try {
    const memory = process.memoryUsage()
    let dbSize = 0
    
    // Estimate database size
    try {
      const { DATABASE_URL } = getConfig()
      let dbPathStr = DATABASE_URL || './data/zentrio.db'
      if (!path.isAbsolute(dbPathStr)) {
        dbPathStr = path.join(process.cwd(), dbPathStr)
      }
      const stat = fs.statSync(dbPathStr)
      dbSize = stat.size
    } catch (e) {
      log.warn('Failed to stat database file:', e)
    }

    return ok(c, {
      uptime: process.uptime(),
      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external,
      },
      dbSize,
      os: {
        platform: os.platform(),
        release: os.release(),
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        loadavg: os.loadavg(),
      }
    })
  } catch (e) {
    log.error('System health failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to fetch system health')
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
        u.id,
        u.email,
        u.name,
        u.role,
        u.banned,
        u.banReason,
        u.banExpires,
        u.emailVerified,
        u.phoneNumber,
        u.phoneNumberVerified,
        u.createdAt,
        u.updatedAt,
        MAX(s.updatedAt) as lastActive
      FROM user u
      LEFT JOIN session s ON s.userId = u.id
      WHERE (? = '' OR lower(u.email) LIKE ? OR lower(u.name) LIKE ?)
      GROUP BY u.id
      ORDER BY u.createdAt DESC
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
    log.error('Admin users list failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to list users')
  }
})

app.get('/users/:id', adminSessionMiddleware, requirePermission(Permissions.USERS_READ), async (c) => {
  try {
    const targetId = c.req.param('id')
    const user = db.prepare(`
      SELECT u.id, u.email, u.name, u.role, u.banned, u.banReason, u.banExpires,
             u.emailVerified, u.phoneNumber, u.phoneNumberVerified, u.createdAt, u.updatedAt,
             MAX(s.updatedAt) as lastActive
      FROM user u
      LEFT JOIN session s ON s.userId = u.id
      WHERE u.id = ?
      GROUP BY u.id
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
    log.error('Admin user detail failed', e)
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
    log.error('Admin role update failed', e)
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
    log.error('Admin ban failed', e)
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
    log.error('Admin unban failed', e)
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
    log.error('Admin audit query failed', e)
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
    log.error('Admin audit stats failed', e)
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
    log.error('Admin audit verify failed', e)
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
      if ((process.env.NODE_ENV || '').trim().toLowerCase() !== 'production') {
        log.warn(`Email delivery failed — dev fallback OTP for ${emailDest}: ${otp}`)
      } else {
        log.error('Failed to send step-up OTP email:', emailErr)
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
    log.error('Admin step-up request failed', e)
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
    log.error('Admin step-up verify failed', e)
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
    log.error('Admin step-up status failed', e)
    return err(c, 500, 'SERVER_ERROR', 'Failed to get step-up status')
  }
})

export default app
