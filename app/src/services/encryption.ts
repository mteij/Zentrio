import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { getConfig } from './envParser'
import { logger } from './logger'

const _log = logger.scope('Encryption')
const { ENCRYPTION_KEY } = getConfig()

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY must be at least 32 characters long')
}

const algorithm = 'aes-256-gcm'
const CURRENT_VERSION = 1
const VERSION_PREFIX = `v${CURRENT_VERSION}:`
// KDF: scrypt with a fixed salt to stretch/normalise the ENCRYPTION_KEY to exactly 32 bytes.
// The static salt is a known trade-off — changing it invalidates all existing encrypted records.
// Real-world security depends on ENCRYPTION_KEY having high entropy (use `openssl rand -hex 32`).
const key = scryptSync(ENCRYPTION_KEY, 'salt', 32)

function encryptWithV1(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(algorithm, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

function decryptV1(encryptedText: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedText.split(':')
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid encrypted text format')
  }
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const decipher = createDecipheriv(algorithm, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

export function encrypt(text: string): string {
  const v1Result = encryptWithV1(text)
  return `${VERSION_PREFIX}${v1Result}`
}

export function decrypt(encryptedText: string): string {
  if (encryptedText.startsWith(VERSION_PREFIX)) {
    const inner = encryptedText.slice(VERSION_PREFIX.length)
    return decryptV1(inner)
  }

  if (encryptedText.includes(':') && !encryptedText.startsWith('v')) {
    return decryptV1(encryptedText)
  }

  throw new Error(`Unsupported encryption format or version: ${encryptedText.slice(0, 20)}...`)
}

export function isEncrypted(text: string): boolean {
  if (!text) return false
  return text.startsWith(VERSION_PREFIX) || (text.includes(':') && text.includes(':'))
}