// Database utilities
// Password hashing, token generation, and other shared utilities
import * as bcrypt from 'bcryptjs'
import { randomBytes, createHash } from 'crypto'

// Hash password utility
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

// Verify password utility
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

// Secure random helpers
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

// Generate session token
export function generateSessionToken(): string {
  return randomToken(32)
}
