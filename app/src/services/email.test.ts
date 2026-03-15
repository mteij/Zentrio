import { describe, expect, it } from 'vitest'
import { resolveConfiguredProviderOrder } from './email'

describe('resolveConfiguredProviderOrder', () => {
  it('prefers SMTP in auto mode when both providers are configured', () => {
    expect(resolveConfiguredProviderOrder({
      preference: 'auto',
      smtpConfigured: true,
      resendConfigured: true
    })).toEqual(['smtp', 'resend'])
  })

  it('falls back to Resend in auto mode when SMTP is unavailable', () => {
    expect(resolveConfiguredProviderOrder({
      preference: 'auto',
      smtpConfigured: false,
      resendConfigured: true
    })).toEqual(['resend'])
  })

  it('keeps SMTP as fallback when Resend is explicitly preferred', () => {
    expect(resolveConfiguredProviderOrder({
      preference: 'resend',
      smtpConfigured: true,
      resendConfigured: true
    })).toEqual(['resend', 'smtp'])
  })

  it('treats unknown preferences like SMTP-first auto mode', () => {
    expect(resolveConfiguredProviderOrder({
      preference: 'unexpected',
      smtpConfigured: true,
      resendConfigured: true
    })).toEqual(['smtp', 'resend'])
  })
})
