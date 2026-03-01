// Admin Audit Service with hash-chained tamper-evident logging
import { createHash } from 'crypto'
import { db } from '../database/connection'
import type { AdminAuditLog } from '../database/types'

export interface AuditEventInput {
  actorId: string
  action: string
  targetType?: string
  targetId?: string
  reason?: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  ipAddress?: string
  userAgent?: string
}

/**
 * Compute SHA-256 hash of audit entry data
 */
function computeHash(data: string): string {
  return createHash('sha256').update(data).digest('hex')
}

/**
 * Build canonical string for hash computation
 * This ensures consistent hashing regardless of key order
 */
function buildCanonicalString(entry: Omit<AdminAuditLog, 'id' | 'hash_curr'>): string {
  const parts = [
    entry.actor_id,
    entry.action,
    entry.target_type || '',
    entry.target_id || '',
    entry.reason || '',
    entry.before_json || '',
    entry.after_json || '',
    entry.ip_address || '',
    entry.user_agent || '',
    entry.hash_prev,
    entry.created_at,
  ]
  return parts.join('|')
}

/**
 * Get the hash of the most recent audit entry
 * Returns a genesis hash if no entries exist
 */
function getPreviousHash(): string {
  const row = db
    .query<{ hash_curr: string }, []>(
      'SELECT hash_curr FROM admin_audit_log ORDER BY id DESC LIMIT 1'
    )
    .get()

  if (row) {
    return row.hash_curr
  }

  // Genesis hash for first entry
  return createHash('sha256').update('ZENTRIO_ADMIN_AUDIT_GENESIS').digest('hex')
}

/**
 * Write an audit event with tamper-evident hash chaining
 */
export function writeAuditEvent(input: AuditEventInput): AdminAuditLog {
  const now = new Date().toISOString()
  const hashPrev = getPreviousHash()

  const entry: Omit<AdminAuditLog, 'id' | 'hash_curr'> = {
    actor_id: input.actorId,
    action: input.action,
    target_type: input.targetType || null,
    target_id: input.targetId || null,
    reason: input.reason || null,
    before_json: input.before ? JSON.stringify(input.before) : null,
    after_json: input.after ? JSON.stringify(input.after) : null,
    ip_address: input.ipAddress || null,
    user_agent: input.userAgent || null,
    hash_prev: hashPrev,
    created_at: now,
  }

  const canonical = buildCanonicalString(entry)
  const hashCurr = computeHash(canonical)

  const result = db
    .query<
      AdminAuditLog,
      [
        string,
        string,
        string | null,
        string | null,
        string | null,
        string | null,
        string | null,
        string | null,
        string | null,
        string,
        string,
      ]
    >(
      `INSERT INTO admin_audit_log 
       (actor_id, action, target_type, target_id, reason, before_json, after_json, 
        ip_address, user_agent, hash_prev, hash_curr, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`
    )
    .get(
      entry.actor_id,
      entry.action,
      entry.target_type,
      entry.target_id,
      entry.reason,
      entry.before_json,
      entry.after_json,
      entry.ip_address,
      entry.user_agent,
      entry.hash_prev,
      hashCurr,
      entry.created_at
    )

  if (!result) {
    throw new Error('Failed to write audit event')
  }

  return result
}

/**
 * Query audit log with pagination and filtering
 */
export interface AuditQueryFilters {
  actorId?: string
  action?: string
  targetType?: string
  targetId?: string
  startDate?: string
  endDate?: string
}

export interface AuditQueryResult {
  logs: AdminAuditLog[]
  total: number
  hasMore: boolean
}

export function queryAuditLog(
  filters: AuditQueryFilters = {},
  limit: number = 50,
  offset: number = 0
): AuditQueryResult {
  const conditions: string[] = []
  const params: (string | number)[] = []

  if (filters.actorId) {
    conditions.push('actor_id = ?')
    params.push(filters.actorId)
  }
  if (filters.action) {
    conditions.push('action = ?')
    params.push(filters.action)
  }
  if (filters.targetType) {
    conditions.push('target_type = ?')
    params.push(filters.targetType)
  }
  if (filters.targetId) {
    conditions.push('target_id = ?')
    params.push(filters.targetId)
  }
  if (filters.startDate) {
    conditions.push('created_at >= ?')
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    conditions.push('created_at <= ?')
    params.push(filters.endDate)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Get total count
  const countRow = db
    .query<{ count: number }, (string | number)[]>(
      `SELECT COUNT(*) as count FROM admin_audit_log ${whereClause}`
    )
    .get(...params)
  const total = countRow?.count || 0

  // Get paginated results
  const logs = db
    .query<AdminAuditLog, (string | number)[]>(
      `SELECT * FROM admin_audit_log 
       ${whereClause}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset)

  return {
    logs,
    total,
    hasMore: offset + logs.length < total,
  }
}

/**
 * Verify the integrity of the audit chain
 * Returns the first ID where chain integrity fails, or null if valid
 */
export function verifyAuditChain(): { valid: boolean; firstInvalidId: number | null; error?: string } {
  const logs = db
    .query<AdminAuditLog, []>(
      'SELECT * FROM admin_audit_log ORDER BY id ASC'
    )
    .all()

  if (logs.length === 0) {
    return { valid: true, firstInvalidId: null }
  }

  // Check genesis entry
  const genesisHash = createHash('sha256').update('ZENTRIO_ADMIN_AUDIT_GENESIS').digest('hex')
  if (logs[0].hash_prev !== genesisHash) {
    return {
      valid: false,
      firstInvalidId: logs[0].id,
      error: 'Genesis hash mismatch',
    }
  }

  // Verify chain
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i]

    // Recompute hash for this entry
    const entry: Omit<AdminAuditLog, 'id' | 'hash_curr'> = {
      actor_id: log.actor_id,
      action: log.action,
      target_type: log.target_type,
      target_id: log.target_id,
      reason: log.reason,
      before_json: log.before_json,
      after_json: log.after_json,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      hash_prev: log.hash_prev,
      created_at: log.created_at,
    }

    const canonical = buildCanonicalString(entry)
    const computedHash = computeHash(canonical)

    if (computedHash !== log.hash_curr) {
      return {
        valid: false,
        firstInvalidId: log.id,
        error: `Hash mismatch at entry ${log.id}`,
      }
    }

    // Verify chain link (except for last entry)
    if (i < logs.length - 1) {
      if (logs[i + 1].hash_prev !== log.hash_curr) {
        return {
          valid: false,
          firstInvalidId: logs[i + 1].id,
          error: `Chain broken between entries ${log.id} and ${logs[i + 1].id}`,
        }
      }
    }
  }

  return { valid: true, firstInvalidId: null }
}

/**
 * Get recent audit events for a specific target
 */
export function getAuditHistoryForTarget(
  targetType: string,
  targetId: string,
  limit: number = 20
): AdminAuditLog[] {
  return db
    .query<AdminAuditLog, [string, string, number]>(
      `SELECT * FROM admin_audit_log 
       WHERE target_type = ? AND target_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`
    )
    .all(targetType, targetId, limit)
}

/**
 * Get audit statistics
 */
export function getAuditStats(): {
  totalEvents: number
  uniqueActors: number
  actionsBreakdown: Record<string, number>
} {
  const totalRow = db
    .query<{ count: number }, []>('SELECT COUNT(*) as count FROM admin_audit_log')
    .get()
  const totalEvents = totalRow?.count || 0

  const actorsRow = db
    .query<{ count: number }, []>(
      'SELECT COUNT(DISTINCT actor_id) as count FROM admin_audit_log'
    )
    .get()
  const uniqueActors = actorsRow?.count || 0

  const actions = db
    .query<{ action: string; count: number }, []>(
      'SELECT action, COUNT(*) as count FROM admin_audit_log GROUP BY action'
    )
    .all()

  const actionsBreakdown: Record<string, number> = {}
  for (const row of actions) {
    actionsBreakdown[row.action] = row.count
  }

  return {
    totalEvents,
    uniqueActors,
    actionsBreakdown,
  }
}
