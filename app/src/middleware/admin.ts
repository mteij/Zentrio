import { createMiddleware } from 'hono/factory'
import { auth } from '../services/auth'
import { err } from '../utils/api'
import { hasValidStepUp } from '../services/admin/stepup'
import { hasPermission, type PermissionKey } from '../services/admin/rbac'

const hasAdminRole = (role: unknown): boolean => {
  if (Array.isArray(role)) {
    return role.some((r) => String(r).toLowerCase() === 'admin')
  }
  return String(role || '').toLowerCase() === 'admin'
}

/**
 * Check if user account is not banned
 */
const isNotBanned = (user: any): boolean => {
  return user?.banned !== true
}

/**
 * Admin session middleware
 * Validates admin authentication and role
 */
export const adminSessionMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })

  if (!session?.user) {
    return err(c, 401, 'UNAUTHORIZED', 'Admin authentication required')
  }

  if (!hasAdminRole((session.user as any).role)) {
    return err(c, 403, 'FORBIDDEN', 'Admin role required')
  }

  if (!isNotBanned(session.user)) {
    return err(c, 403, 'ACCOUNT_BANNED', 'Account is banned')
  }

  c.set('adminUser', session.user as any)
  c.set('adminSession', session.session as any)
  await next()
})

/**
 * Step-up verification middleware
 * Requires a recent step-up challenge verification for sensitive operations
 * 
 * This middleware checks for a valid step-up challenge that was verified
 * within the last 10 minutes (configurable via STEP_UP_MAX_AGE_MINUTES env var)
 */
export const adminStepUpMiddleware = createMiddleware(async (c, next) => {
  const adminUser = (c as any).get('adminUser') as any
  
  if (!adminUser?.id) {
    return err(c, 401, 'UNAUTHORIZED', 'Admin session required')
  }

  // Get max age from env or default to 10 minutes
  const maxAgeMinutes = Number(process.env.STEP_UP_MAX_AGE_MINUTES || 10)
  
  // Check if user has a valid step-up challenge
  const hasValidStepUpChallenge = hasValidStepUp(adminUser.id, maxAgeMinutes)
  
  if (!hasValidStepUpChallenge) {
    return err(c, 403, 'STEP_UP_REQUIRED', 'Recent step-up verification required. Please verify with OTP.')
  }

  await next()
})

/**
 * Optional: Legacy 2FA check middleware (fallback)
 * Can be used alongside step-up for additional security
 */
export const adminTwoFactorMiddleware = createMiddleware(async (c, next) => {
  const adminUser = (c as any).get('adminUser') as any
  
  if (adminUser?.twoFactorEnabled !== true) {
    return err(c, 403, 'TWO_FACTOR_REQUIRED', 'Two-factor authentication must be enabled for admin access')
  }

  await next()
})

/**
 * Combined high-security middleware
 * Requires both step-up verification and 2FA enabled
 */
export const adminHighSecurityMiddleware = createMiddleware(async (c, next) => {
  const adminUser = (c as any).get('adminUser') as any
  
  if (!adminUser?.id) {
    return err(c, 401, 'UNAUTHORIZED', 'Admin session required')
  }

  // Check 2FA is enabled
  if (adminUser?.twoFactorEnabled !== true) {
    return err(c, 403, 'TWO_FACTOR_REQUIRED', 'Two-factor authentication must be enabled')
  }

  // Check step-up
  const maxAgeMinutes = Number(process.env.STEP_UP_MAX_AGE_MINUTES || 10)
  const hasValidStepUpChallenge = hasValidStepUp(adminUser.id, maxAgeMinutes)
  
  if (!hasValidStepUpChallenge) {
    return err(c, 403, 'STEP_UP_REQUIRED', 'Recent step-up verification required')
  }

  await next()
})

/**
 * RBAC Permission middleware factory
 * Creates middleware that checks for a specific permission
 */
export function requirePermission(permission: PermissionKey) {
  return createMiddleware(async (c, next) => {
    const adminUser = (c as any).get('adminUser') as any
    
    if (!adminUser?.id) {
      return err(c, 401, 'UNAUTHORIZED', 'Admin session required')
    }

    const hasPerm = await hasPermission(adminUser.id, permission)
    
    if (!hasPerm) {
      return err(c, 403, 'PERMISSION_DENIED', `Missing required permission: ${permission}`)
    }

    await next()
  })
}
