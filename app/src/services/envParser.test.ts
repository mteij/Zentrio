import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { getConfig, initEnv } from './envParser'

describe('envParser', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should load default values in non-production', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.AUTH_SECRET
    delete process.env.ENCRYPTION_KEY
    
    // We need to re-import to trigger initialization logic if it runs on module load
    // But getConfig runs fresh every time it's called
    const config = getConfig()
    
    expect(config.AUTH_SECRET).toBe('super-secret-key-change-in-production')
    expect(config.ENCRYPTION_KEY).toBe('super-secret-key-change-in-production')
  })

  it('should throw error in production if secrets are missing', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.AUTH_SECRET
    delete process.env.ENCRYPTION_KEY

    expect(() => getConfig()).toThrow('MISSING REQUIRED SECRET IN PRODUCTION: AUTH_SECRET')
  })

  it('should allow secrets in production if provided', () => {
    process.env.NODE_ENV = 'production'
    process.env.AUTH_SECRET = 'valid-secret-123'
    process.env.ENCRYPTION_KEY = 'valid-key-456'

    const config = getConfig()
    
    expect(config.AUTH_SECRET).toBe('valid-secret-123')
    expect(config.ENCRYPTION_KEY).toBe('valid-key-456')
  })
  
  it('should read new standardized keys', () => {
     process.env.IMDB_UPDATE_INTERVAL_HOURS = '48'
     process.env.EMAIL_HOST = 'smtp.example.com'
     
     const config = getConfig()
     expect(config.IMDB_UPDATE_INTERVAL_HOURS).toBe(48)
     expect(config.EMAIL_HOST).toBe('smtp.example.com')
  })
})
