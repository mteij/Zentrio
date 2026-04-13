import { describe, expect, it, vi } from 'vitest'

const TEST_ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests-32ch'

vi.mock('./envParser', () => ({
  getConfig: () => ({
    ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
  }),
}))

const { encrypt, decrypt } = await import('./encryption')

describe('Encryption Service', () => {
  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'Hello, World!'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should produce different ciphertexts for same plaintext (due to random IV)', () => {
      const plaintext = 'Same text'
      const encrypted1 = encrypt(plaintext)
      const encrypted2 = encrypt(plaintext)

      expect(encrypted1).not.toBe(encrypted2)
      expect(decrypt(encrypted1)).toBe(plaintext)
      expect(decrypt(encrypted2)).toBe(plaintext)
    })

    it('should handle empty string', () => {
      const plaintext = ''
      const encrypted = encrypt(plaintext)
      expect(encrypted).toBeTruthy()
      expect(encrypted.startsWith('v1:')).toBe(true)
    })

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should handle unicode characters', () => {
      const plaintext = 'Hello 世界! 🎉'
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000)
      const encrypted = encrypt(plaintext)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(plaintext)
    })
  })

  describe('ciphertext format', () => {
    it('should produce iv:tag:ciphertext format with version prefix', () => {
      const encrypted = encrypt('test')
      const withoutVersion = encrypted.slice(3)
      const parts = withoutVersion.split(':')

      expect(parts).toHaveLength(3)
      expect(parts[0]).toHaveLength(32) // 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32) // 16 bytes = 32 hex chars (auth tag)
      expect(parts[2].length).toBeGreaterThan(0) // ciphertext
    })

    it('should reject malformed ciphertext', () => {
      expect(() => decrypt('invalid')).toThrow()
      expect(() => decrypt('only:two')).toThrow()
      expect(() => decrypt('')).toThrow()
    })

    it('should reject ciphertext with invalid hex', () => {
      const encrypted = encrypt('test')
      const withoutVersion = encrypted.slice(3)
      const [iv, tag, ciphertext] = withoutVersion.split(':')
      const tampered = `${encrypted.slice(0, 3)}${iv.slice(0, -2)}gg:${tag}:${ciphertext}`

      expect(() => decrypt(tampered)).toThrow()
    })
  })

  describe('versioned envelope', () => {
    it('should have version prefix', () => {
      const encrypted = encrypt('test')
      expect(encrypted.startsWith('v1:')).toBe(true)
    })

    it('should be decryptable with version prefix', () => {
      const plaintext = 'versioned-test'
      const encrypted = encrypt(plaintext)
      expect(decrypt(encrypted)).toBe(plaintext)
    })
  })
})
