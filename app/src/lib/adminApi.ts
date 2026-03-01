import { apiFetch } from './apiFetch'

// Error class that preserves the backend error code
export class AdminApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init)
  const body = await res.json().catch(() => ({})) as any
  if (!res.ok || body?.ok === false) {
    throw new AdminApiError(
      body?.error?.code ?? 'SERVER_ERROR',
      body?.error?.message ?? `Request failed: ${res.status}`,
      res.status
    )
  }
  return body.data as T
}

function json(init: Omit<RequestInit, 'body'> & { body: Record<string, unknown> }): RequestInit {
  return {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    body: JSON.stringify(init.body),
  }
}

// ── Response types ────────────────────────────────────────────────────────────

export interface AdminMe {
  id: string
  email: string
  name: string
  role: string
}

export interface AdminStats {
  users: number
  admins: number
  profiles: number
  activeSessions: number
  watchedItems: number
  bannedUsers: number
  ts: string
}

export interface AdminProxySession {
  id: number
  user_id: string
  profile_id?: number
  ip_address?: string
  user_agent?: string
  last_activity: string
  expires_at: string
}

export interface AdminWatchEvent {
  id: number
  profile_id: number
  meta_id: string
  meta_type: string
  season?: number
  episode?: number
  title?: string
  position?: number
  duration?: number
  updated_at: string
}

export interface AdminActivityData {
  activeProxySessions: AdminProxySession[]
  recentWatchEvents: AdminWatchEvent[]
  ts: string
}

export interface AdminUser {
  id: string
  email: string
  name: string
  role?: string
  banned?: boolean
  banReason?: string | null
  banExpires?: string | null
  emailVerified: boolean
  phoneNumber?: string | null
  phoneNumberVerified?: boolean
  createdAt: string
  updatedAt: string
}

export interface AdminUserRole {
  id: string
  name: string
  description?: string | null
}

export interface AdminAuditEntry {
  id: number
  actor_id: string
  action: string
  target_type?: string | null
  target_id?: string | null
  reason?: string | null
  before_json?: string | null
  after_json?: string | null
  ip_address?: string | null
  user_agent?: string | null
  hash_prev: string
  hash_curr: string
  created_at: string
}

export interface AuditQueryResult {
  logs: AdminAuditEntry[]
  total: number
  hasMore: boolean
  pagination: { limit: number; offset: number }
}

export interface AuditStats {
  total: number
  byAction: { action: string; count: number }[]
  uniqueActors: number
}

export interface StepUpStatus {
  total: number
  active: number
  used: number
  expired: number
  hasValidStepUp: boolean
}

export interface StepUpRequestResult {
  challengeId: string
  expiresAt: string
  message: string
}

// ── API functions ─────────────────────────────────────────────────────────────

export const adminApi = {
  getMe: () =>
    adminFetch<AdminMe>('/api/admin/me'),

  getStats: () =>
    adminFetch<AdminStats>('/api/admin/stats'),

  getLiveActivity: () =>
    adminFetch<AdminActivityData>('/api/admin/activity/live'),

  listUsers: (params?: { q?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set('q', params.q)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    if (params?.offset != null) qs.set('offset', String(params.offset))
    const query = qs.toString()
    return adminFetch<{ users: AdminUser[]; pagination: { total: number; limit: number; offset: number } }>(
      `/api/admin/users${query ? `?${query}` : ''}`
    )
  },

  getUser: (id: string) =>
    adminFetch<{ user: AdminUser; roles: AdminUserRole[]; recentActivity: AdminAuditEntry[] }>(
      `/api/admin/users/${id}`
    ),

  setUserRole: (id: string, role: string, reason: string) =>
    adminFetch<AdminUser>(`/api/admin/users/${id}/role`, json({ method: 'POST', body: { role, reason } })),

  banUser: (id: string, banReason: string, banExpiresIn?: number) =>
    adminFetch<Pick<AdminUser, 'id' | 'banned' | 'banReason' | 'banExpires'>>(
      `/api/admin/users/${id}/ban`,
      json({ method: 'POST', body: { banReason, ...(banExpiresIn ? { banExpiresIn } : {}) } })
    ),

  unbanUser: (id: string, reason: string) =>
    adminFetch<Pick<AdminUser, 'id' | 'banned'>>(`/api/admin/users/${id}/unban`, json({ method: 'POST', body: { reason } })),

  getAuditLog: (filters?: {
    actorId?: string
    action?: string
    targetType?: string
    targetId?: string
    startDate?: string
    endDate?: string
  }, limit = 50, offset = 0) => {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) })
    if (filters?.actorId) qs.set('actorId', filters.actorId)
    if (filters?.action) qs.set('action', filters.action)
    if (filters?.targetType) qs.set('targetType', filters.targetType)
    if (filters?.targetId) qs.set('targetId', filters.targetId)
    if (filters?.startDate) qs.set('startDate', filters.startDate)
    if (filters?.endDate) qs.set('endDate', filters.endDate)
    return adminFetch<AuditQueryResult>(`/api/admin/audit?${qs}`)
  },

  getAuditStats: () =>
    adminFetch<AuditStats>('/api/admin/audit/stats'),

  verifyAuditChain: () =>
    adminFetch<{ valid: boolean; message: string }>('/api/admin/audit/verify', { method: 'POST' }),

  requestStepUp: () =>
    adminFetch<StepUpRequestResult>('/api/admin/stepup/request', { method: 'POST' }),

  verifyStepUp: (challengeId: string, otp: string) =>
    adminFetch<{ valid: boolean; message: string }>(
      '/api/admin/stepup/verify',
      json({ method: 'POST', body: { challengeId, otp } })
    ),

  getStepUpStatus: () =>
    adminFetch<StepUpStatus>('/api/admin/stepup/status'),

}
