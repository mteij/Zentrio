// Admin RBAC (Role-Based Access Control) Service
// Provides granular permission management for admin operations

import { db } from '../database/connection'
import type { AdminRole, AdminPermission, AdminRolePermission, AdminUserRole } from '../database/types'

// Permission keys as defined in the database
export const Permissions = {
  // Monitoring
  STATS_READ: 'admin.stats.read',
  ACTIVITY_READ: 'admin.activity.read',
  AUDIT_READ: 'admin.audit.read',

  // User Management
  USERS_READ: 'admin.users.read',
  USERS_WRITE_ROLE: 'admin.users.write.role',
  USERS_WRITE_BAN: 'admin.users.write.ban',
  USERS_WRITE_EMAIL: 'admin.users.write.email',
  USERS_WRITE_PASSWORD: 'admin.users.write.password',
  USERS_WRITE_ACCOUNTS: 'admin.users.write.accounts',
  USERS_WRITE_SESSIONS: 'admin.users.write.sessions',

  // System
  SYSTEM_BOOTSTRAP: 'admin.system.bootstrap',
  SYSTEM_SETTINGS: 'admin.system.settings',
  SYSTEM_MAINTENANCE: 'admin.system.maintenance',
} as const

export type PermissionKey = (typeof Permissions)[keyof typeof Permissions]

// In-memory permission cache per user (TTL: 5 minutes)
const permissionCache = new Map<string, { permissions: Set<string>; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Get all permissions for a user (cached)
 */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const now = Date.now()
  const cached = permissionCache.get(userId)

  if (cached && cached.expiresAt > now) {
    return cached.permissions
  }

  // Query permissions from database
  // 1. Get permissions from explicit user roles
  const userRolePerms = db
    .query<{ key: string }, [string]>(
      `SELECT p.key
       FROM admin_permissions p
       JOIN admin_role_permissions rp ON rp.permission_id = p.id
       JOIN admin_user_roles ur ON ur.role_id = rp.role_id
       WHERE ur.user_id = ?`,
      [userId]
    )
    .all(userId)

  // 2. Get permissions from user's role field (legacy support during transition)
  const user = db
    .query<{ role: string }, [string]>(
      `SELECT role FROM user WHERE id = ?`,
      [userId]
    )
    .get(userId)

  const permissions = new Set<string>()

  // Add explicit role permissions
  for (const row of userRolePerms) {
    permissions.add(row.key)
  }

  // Map legacy role field to permissions (transition period)
  if (user?.role) {
    const rolePerms = getLegacyRolePermissions(user.role)
    for (const perm of rolePerms) {
      permissions.add(perm)
    }
  }

  // Cache the result
  permissionCache.set(userId, {
    permissions,
    expiresAt: now + CACHE_TTL_MS,
  })

  return permissions
}

/**
 * Map legacy role field to permissions
 */
function getLegacyRolePermissions(role: string): string[] {
  switch (role.toLowerCase()) {
    case 'superadmin':
      return Object.values(Permissions)
    case 'admin':
      return [
        Permissions.STATS_READ,
        Permissions.ACTIVITY_READ,
        Permissions.AUDIT_READ,
        Permissions.USERS_READ,
        Permissions.USERS_WRITE_BAN,
        Permissions.USERS_WRITE_SESSIONS,
      ]
    case 'moderator':
      return [
        Permissions.STATS_READ,
        Permissions.ACTIVITY_READ,
        Permissions.USERS_READ,
        Permissions.USERS_WRITE_BAN,
      ]
    default:
      return []
  }
}

/**
 * Check if user has a specific permission
 */
export async function hasPermission(userId: string, permission: PermissionKey): Promise<boolean> {
  const permissions = await getUserPermissions(userId)
  return permissions.has(permission)
}

/**
 * Check if user has any of the specified permissions
 */
export async function hasAnyPermission(userId: string, permissions: PermissionKey[]): Promise<boolean> {
  const userPerms = await getUserPermissions(userId)
  return permissions.some((p) => userPerms.has(p))
}

/**
 * Check if user has all of the specified permissions
 */
export async function hasAllPermissions(userId: string, permissions: PermissionKey[]): Promise<boolean> {
  const userPerms = await getUserPermissions(userId)
  return permissions.every((p) => userPerms.has(p))
}

/**
 * Invalidate permission cache for a user
 */
export function invalidatePermissionCache(userId: string): void {
  permissionCache.delete(userId)
}

/**
 * Get all available roles
 */
export function getAllRoles(): AdminRole[] {
  return db
    .query<AdminRole, []>(
      `SELECT * FROM admin_roles ORDER BY is_system DESC, name`
    )
    .all()
}

/**
 * Get all permissions
 */
export function getAllPermissions(): AdminPermission[] {
  return db
    .query<AdminPermission, []>(
      `SELECT * FROM admin_permissions ORDER BY category, key`
    )
    .all()
}

/**
 * Get permissions for a role
 */
export function getRolePermissions(roleId: string): AdminPermission[] {
  return db
    .query<AdminPermission, [string]>(
      `SELECT p.*
       FROM admin_permissions p
       JOIN admin_role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = ?
       ORDER BY p.category, p.key`,
      [roleId]
    )
    .all(roleId)
}

/**
 * Get roles for a user
 */
export function getUserRoles(userId: string): AdminRole[] {
  return db
    .query<AdminRole, [string]>(
      `SELECT r.*
       FROM admin_roles r
       JOIN admin_user_roles ur ON ur.role_id = r.id
       WHERE ur.user_id = ?
       ORDER BY r.name`,
      [userId]
    )
    .all(userId)
}

/**
 * Assign role to user
 */
export function assignRoleToUser(userId: string, roleId: string): boolean {
  try {
    db.query(
      `INSERT OR IGNORE INTO admin_user_roles (user_id, role_id) VALUES (?, ?)`
    ).run(userId, roleId)
    invalidatePermissionCache(userId)
    return true
  } catch (e) {
    console.error('Failed to assign role:', e)
    return false
  }
}

/**
 * Remove role from user
 */
export function removeRoleFromUser(userId: string, roleId: string): boolean {
  try {
    db.query(
      `DELETE FROM admin_user_roles WHERE user_id = ? AND role_id = ?`
    ).run(userId, roleId)
    invalidatePermissionCache(userId)
    return true
  } catch (e) {
    console.error('Failed to remove role:', e)
    return false
  }
}

/**
 * Create a custom role
 */
export function createRole(
  id: string,
  name: string,
  description?: string
): AdminRole | null {
  try {
    const result = db
      .query<AdminRole, [string, string, string | null]>(
        `INSERT INTO admin_roles (id, name, description, is_system)
         VALUES (?, ?, ?, FALSE)
         RETURNING *`
      )
      .get(id, name, description || null)
    return result || null
  } catch (e) {
    console.error('Failed to create role:', e)
    return null
  }
}

/**
 * Delete a custom role (system roles cannot be deleted)
 */
export function deleteRole(roleId: string): boolean {
  try {
    const result = db.query(
      `DELETE FROM admin_roles WHERE id = ? AND is_system = FALSE`
    ).run(roleId)

    // Invalidate all user caches since permissions may have changed
    permissionCache.clear()

    return result.changes > 0
  } catch (e) {
    console.error('Failed to delete role:', e)
    return false
  }
}

/**
 * Assign permission to role
 */
export function assignPermissionToRole(roleId: string, permissionId: string): boolean {
  try {
    db.query(
      `INSERT OR IGNORE INTO admin_role_permissions (role_id, permission_id) VALUES (?, ?)`
    ).run(roleId, permissionId)

    // Invalidate all caches since permissions may have changed
    permissionCache.clear()

    return true
  } catch (e) {
    console.error('Failed to assign permission:', e)
    return false
  }
}

/**
 * Remove permission from role
 */
export function removePermissionFromRole(roleId: string, permissionId: string): boolean {
  try {
    db.query(
      `DELETE FROM admin_role_permissions WHERE role_id = ? AND permission_id = ?`
    ).run(roleId, permissionId)

    // Invalidate all caches since permissions may have changed
    permissionCache.clear()

    return true
  } catch (e) {
    console.error('Failed to remove permission:', e)
    return false
  }
}

/**
 * Get user's effective permissions summary
 */
export async function getUserPermissionSummary(
  userId: string
): Promise<{
  roles: AdminRole[]
  permissions: string[]
}> {
  const [roles, perms] = await Promise.all([
    getUserRoles(userId),
    getUserPermissions(userId),
  ])

  return {
    roles,
    permissions: Array.from(perms).sort(),
  }
}

/**
 * Middleware helper: Check permission and return error if missing
 */
export async function requirePermission(
  userId: string,
  permission: PermissionKey
): Promise<{ granted: true } | { granted: false; missing: string }> {
  const has = await hasPermission(userId, permission)
  if (has) {
    return { granted: true }
  }
  return { granted: false, missing: permission }
}
