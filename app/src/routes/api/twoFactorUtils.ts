/**
 * TOTP (Time-based One-Time Password) utilities for 2FA
 * Used for SSO accounts that don't have a password
 */

import { createHmac, randomBytes } from 'crypto'

// Base32 alphabet
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/**
 * Encode bytes to base32
 */
function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''
  
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8
    
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  
  return output
}

/**
 * Decode base32 to bytes
 */
function base32Decode(input: string): Buffer {
  const cleanInput = input.replace(/=+$/, '').toUpperCase()
  const bytes: number[] = []
  let bits = 0
  let value = 0
  
  for (const char of cleanInput) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) continue
    
    value = (value << 5) | index
    bits += 5
    
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  
  return Buffer.from(bytes)
}

/**
 * Generate a random TOTP secret (20 bytes, base32 encoded)
 */
export function generateSecret(): string {
  const buffer = randomBytes(20)
  return base32Encode(buffer)
}

/**
 * Generate random backup codes
 */
export function generateBackupCodes(count: number = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const code = randomBytes(4).toString('hex').toUpperCase()
    // Format as XXXX-XXXX
    codes.push(code.slice(0, 4) + '-' + code.slice(4))
  }
  return codes
}

/**
 * Create TOTP URI for QR code
 */
export function createTwoFactorTotpURI(
  accountName: string, 
  secret: string, 
  issuer: string
): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedAccount = encodeURIComponent(accountName)
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`
}

/**
 * Generate TOTP code for a given secret and time
 */
function generateTOTPCode(secret: string, time: number): string {
  let counter = Math.floor(time / 30)
  const buffer = Buffer.alloc(8)
  
  for (let i = 7; i >= 0; i--) {
    buffer[i] = counter & 0xff
    // @ts-ignore
    counter = counter >> 8
  }
  
  const key = base32Decode(secret)
  const hmac = createHmac('sha1', key)
  hmac.update(buffer)
  const hash = hmac.digest()
  
  const offset = hash[hash.length - 1] & 0xf
  const binary = 
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff)
  
  const otp = binary % 1000000
  return otp.toString().padStart(6, '0')
}

/**
 * Verify a TOTP code (with +/- 1 period tolerance)
 */
export function verifyTOTP(secret: string, code: string): boolean {
  const now = Math.floor(Date.now() / 1000)
  
  // Check current time window and +/- 1 period (30 seconds tolerance each way)
  for (const offset of [-1, 0, 1]) {
    const time = now + (offset * 30)
    const expected = generateTOTPCode(secret, time)
    if (expected === code) {
      return true
    }
  }
  
  return false
}
