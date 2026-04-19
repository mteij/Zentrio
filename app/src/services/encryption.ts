import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'
import { getConfig } from './envParser'
import { logger } from './logger'

const _log = logger.scope('Encryption')
const { ENCRYPTION_KEY } = getConfig()

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  throw new Error('ENCRYPTION_KEY must be at least 32 characters long')
}

const algorithm = 'aes-256-gcm'
const V1_PREFIX = 'v1:'
const V2_PREFIX = 'v2:'

function deriveKey(salt: Buffer): Buffer {
  return scryptSync(ENCRYPTION_KEY, salt, 32)
}

function encryptV2(text: string): string {
  const salt = randomBytes(16)
  const key = deriveKey(salt)
  const iv = randomBytes(16)
  const cipher = createCipheriv(algorithm, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${V2_PREFIX}${iv.toString('hex')}:${salt.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

function decryptV1(encryptedText: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedText.split(':')
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid v1 encrypted text format')
  }
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const staticSalt = Buffer.from('salt')
  const key = deriveKey(staticSalt)
  const decipher = createDecipheriv(algorithm, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

function decryptV2(encryptedText: string): string {
  const [ivHex, saltHex, authTagHex, encryptedHex] = encryptedText.split(':')
  if (!ivHex || !saltHex || !authTagHex || !encryptedHex) {
    throw new Error('Invalid v2 encrypted text format')
  }
  const iv = Buffer.from(ivHex, 'hex')
  const salt = Buffer.from(saltHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const encrypted = Buffer.from(encryptedHex, 'hex')
  const key = deriveKey(salt)
  const decipher = createDecipheriv(algorithm, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

export function encrypt(text: string): string {
  return encryptV2(text)
}

export function decrypt(encryptedText: string): string {
  if (encryptedText.startsWith(V2_PREFIX)) {
    const inner = encryptedText.slice(V2_PREFIX.length)
    return decryptV2(inner)
  }
  if (encryptedText.startsWith(V1_PREFIX)) {
    const inner = encryptedText.slice(V1_PREFIX.length)
    return decryptV1(inner)
  }
  if (encryptedText.includes(':') && !encryptedText.startsWith('v')) {
    return decryptV1(encryptedText)
  }
  throw new Error(`Unsupported encryption format or version: ${encryptedText.slice(0, 20)}...`)
}

export function isEncrypted(text: string): boolean {
  if (!text) return false
  return text.startsWith(V2_PREFIX) || text.startsWith(V1_PREFIX) || (text.includes(':') && text.includes(':') && !text.startsWith('v'))
}