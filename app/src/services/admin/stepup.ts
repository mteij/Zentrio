// Admin Step-up Challenge Service
// Provides email OTP verification for sensitive admin operations

import { randomBytes, createHash } from 'crypto'
import { db } from '../database/connection'
import type { AdminStepUpChallenge } from '../database/types'
import { getConfig } from '../envParser'

// Challenge TTL: 10 minutes
const CHALLENGE_TTL_MS = 10 * 60 * 1000
// Max active (unused, unexpired) challenges per user at one time
const MAX_ACTIVE_CHALLENGES = 3
// Max new challenges per 10-minute window (prevents email spam)
const MAX_CHALLENGES_PER_WINDOW = 5
// Max failed verification attempts per individual challenge before it is locked
const MAX_FAILED_ATTEMPTS = 5
// Max cumulative failed attempts across all active challenges (cross-challenge brute-force guard)
const MAX_TOTAL_ACTIVE_FAILED = 10

export interface StepUpChallengeResult {
  challengeId: string
  expiresAt: Date
}

export interface VerifyResult {
  valid: boolean
  error?: string
}

/**
 * Generate a cryptographically secure 6-digit OTP
 */
function generateOTP(): string {
  // Use randomBytes for cryptographically secure randomness
  const bytes = randomBytes(4)
  const num = bytes.readUInt32BE(0)
  // Generate 6-digit number (000000-999999)
  return String(num % 1000000).padStart(6, '0')
}

/**
 * Generate a unique challenge ID
 */
function generateChallengeId(): string {
  return `stepup_${randomBytes(16).toString('hex')}_${Date.now()}`
}

/**
 * Hash OTP for storage (prevents reading OTPs from DB)
 */
function hashOtp(otp: string): string {
  return createHash('sha256').update(otp).digest('hex')
}

/**
 * Clean up expired or used challenges for a user
 */
function cleanupOldChallenges(userId: string): void {
  db.query(
    `DELETE FROM admin_stepup_challenges
     WHERE admin_identity_id = ?
     AND (datetime(expires_at) < datetime('now') OR used_at IS NOT NULL)`
  ).run(userId)
}

/**
 * Count challenges created in the last 10 minutes (rate-limit window)
 */
function countRecentChallenges(userId: string): number {
  const row = db
    .query<{ count: number }, [string]>(
      `SELECT COUNT(*) as count FROM admin_stepup_challenges
       WHERE admin_identity_id = ?
       AND created_at > datetime('now', '-10 minutes')`
    )
    .get(userId)
  return row?.count || 0
}

/**
 * Sum of failed_attempts across all currently active challenges for a user.
 * Guards against cross-challenge brute-force (request new challenge after 5 fails, repeat).
 */
function getTotalActiveFailedAttempts(userId: string): number {
  const row = db
    .query<{ total: number }, [string]>(
      `SELECT COALESCE(SUM(failed_attempts), 0) as total FROM admin_stepup_challenges
       WHERE admin_identity_id = ?
       AND used_at IS NULL
       AND datetime(expires_at) > datetime('now')`
    )
    .get(userId)
  return row?.total || 0
}

/**
 * Count active challenges for a user
 */
function countActiveChallenges(userId: string): number {
  const row = db
    .query<{ count: number }, [string]>(
      `SELECT COUNT(*) as count FROM admin_stepup_challenges
       WHERE admin_identity_id = ?
       AND datetime(expires_at) > datetime('now')
       AND used_at IS NULL`
    )
    .get(userId)
  return row?.count || 0
}

/**
 * Create a new step-up challenge (email OTP)
 * Returns the challenge ID and the plain OTP (to send via email)
 */
export function createChallenge(userId: string): { challengeId: string; otp: string; expiresAt: Date } {
  // Cleanup old challenges first
  cleanupOldChallenges(userId)

  // Check concurrent active limit
  const activeCount = countActiveChallenges(userId)
  if (activeCount >= MAX_ACTIVE_CHALLENGES) {
    throw new Error('Too many active challenges. Please wait before requesting another.')
  }

  // Check time-window rate limit (prevents email spam / brute-force via fresh challenges)
  const recentCount = countRecentChallenges(userId)
  if (recentCount >= MAX_CHALLENGES_PER_WINDOW) {
    throw new Error('Too many verification requests in a short period. Please wait before requesting another.')
  }

  const challengeId = generateChallengeId()
  const otp = generateOTP()
  const otpHash = hashOtp(otp)
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS)

  db.query(
    `INSERT INTO admin_stepup_challenges
     (id, admin_identity_id, challenge_type, otp_code, expires_at, created_at)
     VALUES (?, ?, 'email_otp', ?, ?, datetime('now'))`
  ).run(challengeId, userId, otpHash, expiresAt.toISOString())

  return {
    challengeId,
    otp,
    expiresAt,
  }
}

/**
 * Verify a step-up challenge
 * Mark it as used if valid
 */
export function verifyChallenge(userId: string, challengeId: string, otp: string): VerifyResult {
  // Get the challenge
  const challenge = db
    .query<AdminStepUpChallenge, [string, string]>(
      `SELECT * FROM admin_stepup_challenges
       WHERE id = ? AND admin_identity_id = ?`
    )
    .get(challengeId, userId)

  if (!challenge) {
    return { valid: false, error: 'Challenge not found' }
  }

  // Check if already used
  if (challenge.used_at) {
    return { valid: false, error: 'Challenge already used' }
  }

  // Check expiration
  const now = new Date()
  const expiresAt = new Date(challenge.expires_at)
  if (now > expiresAt) {
    return { valid: false, error: 'Challenge expired' }
  }

  // Check per-challenge attempt limit
  if (challenge.failed_attempts >= MAX_FAILED_ATTEMPTS) {
    return { valid: false, error: 'Too many failed attempts. Request a new verification code.' }
  }

  // Cross-challenge brute-force guard: check cumulative failures across all active challenges
  const totalFailed = getTotalActiveFailedAttempts(userId)
  if (totalFailed >= MAX_TOTAL_ACTIVE_FAILED) {
    return { valid: false, error: 'Too many failed attempts across verification codes. Wait for them to expire before trying again.' }
  }

  // Verify OTP hash
  const otpHash = hashOtp(otp)
  if (otpHash !== challenge.otp_code) {
    // Increment failed attempt counter
    db.query(
      `UPDATE admin_stepup_challenges SET failed_attempts = failed_attempts + 1 WHERE id = ?`
    ).run(challengeId)
    const remaining = MAX_FAILED_ATTEMPTS - (challenge.failed_attempts + 1)
    return { valid: false, error: remaining > 0 ? `Invalid code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Invalid code. No attempts remaining. Request a new verification code.' }
  }

  // Mark as used
  db.query(
    `UPDATE admin_stepup_challenges
     SET used_at = datetime('now')
     WHERE id = ?`
  ).run(challengeId)

  return { valid: true }
}

/**
 * Check if user has a valid (verified) step-up challenge
 * Used by middleware to verify recent step-up
 */
export function hasValidStepUp(userId: string, maxAgeMinutes: number = 10): boolean {
  const intervalStr = `-${maxAgeMinutes} minutes`

  const row = db
    .query<{ count: number }, [string, string]>(
      `SELECT COUNT(*) as count FROM admin_stepup_challenges
       WHERE admin_identity_id = ?
       AND used_at IS NOT NULL
       AND used_at > datetime('now', ?)
       AND datetime(expires_at) > datetime('now')`
    )
    .get(userId, intervalStr)

  return (row?.count || 0) > 0
}

/**
 * Get challenge status (for debugging/admin)
 */
export interface ChallengeStatus {
  total: number
  active: number
  used: number
  expired: number
}

export function getChallengeStatus(userId: string): ChallengeStatus {
  const totalRow = db
    .query<{ count: number }, [string]>(
      `SELECT COUNT(*) as count FROM admin_stepup_challenges WHERE admin_identity_id = ?`
    )
    .get(userId)

  const activeRow = db
    .query<{ count: number }, [string]>(
      `SELECT COUNT(*) as count FROM admin_stepup_challenges
       WHERE admin_identity_id = ? AND used_at IS NULL AND datetime(expires_at) > datetime('now')`
    )
    .get(userId)

  const usedRow = db
    .query<{ count: number }, [string]>(
      `SELECT COUNT(*) as count FROM admin_stepup_challenges
       WHERE admin_identity_id = ? AND used_at IS NOT NULL`
    )
    .get(userId)

  const expiredRow = db
    .query<{ count: number }, [string]>(
      `SELECT COUNT(*) as count FROM admin_stepup_challenges
       WHERE admin_identity_id = ? AND used_at IS NULL AND datetime(expires_at) <= datetime('now')`
    )
    .get(userId)

  return {
    total: totalRow?.count || 0,
    active: activeRow?.count || 0,
    used: usedRow?.count || 0,
    expired: expiredRow?.count || 0,
  }
}

/**
 * Resolve OTP delivery email — in non-production, routes to a configured
 * redirect inbox if ADMIN_OTP_DEV_REDIRECT_EMAIL is set.
 */
export function getOtpDestinationEmail(userEmail: string): string {
  const cfg = getConfig()
  if (cfg.ADMIN_PHONE_OTP_DEV_FALLBACK_EMAIL && process.env.NODE_ENV !== 'production') {
    return cfg.ADMIN_PHONE_OTP_DEV_FALLBACK_EMAIL
  }
  return userEmail
}
