import * as nodemailer from 'nodemailer'
import { Resend } from 'resend'
import { getConfig } from './envParser'
import { logger } from './logger'

const log = logger.scope('Email')
import { 
  getMagicLinkTemplate, 
  getOtpTemplate, 
  getWelcomeTemplate, 
  getVerificationHelperTemplate, 
  getPasswordResetTemplate, 
  getSharingInvitationTemplate 
} from './email/templates'

// =============================================================================
// Email Provider Interface
// =============================================================================

interface SendMailOptions {
  from: string
  to: string
  subject: string
  html: string
}

interface EmailProvider {
  name: string
  sendMail(options: SendMailOptions): Promise<void>
}

type EmailProviderKey = 'smtp' | 'resend'

export function resolveConfiguredProviderOrder(options: {
  preference: string
  smtpConfigured: boolean
  resendConfigured: boolean
}): EmailProviderKey[] {
  const { preference, smtpConfigured, resendConfigured } = options
  const order: EmailProviderKey[] = []

  const pushProvider = (provider: EmailProviderKey) => {
    if (provider === 'smtp' && smtpConfigured && !order.includes('smtp')) {
      order.push('smtp')
    }
    if (provider === 'resend' && resendConfigured && !order.includes('resend')) {
      order.push('resend')
    }
  }

  if (preference === 'resend') {
    pushProvider('resend')
    pushProvider('smtp')
    return order
  }

  pushProvider('smtp')
  pushProvider('resend')
  return order
}

// =============================================================================
// SMTP Provider (via Nodemailer)
// =============================================================================

class SmtpProvider implements EmailProvider {
  name = 'SMTP'
  private transporter: nodemailer.Transporter

  constructor(config: {
    host: string
    port: number
    secure: boolean
    auth: { user: string; pass: string }
  } | string) {
    // Keep SMTP timeouts short in production; slow/unreachable SMTP shouldn't block auth flows.
    const cfg = getConfig()
    const timeoutMs = cfg.EMAIL_SMTP_TIMEOUT_MS
    const defaults = {
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs
    }

    if (typeof config === 'string') {
      // SMTP URL
      this.transporter = nodemailer.createTransport(config, defaults)
    } else {
      this.transporter = nodemailer.createTransport({
        ...config,
        ...defaults
      })
    }
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    log.info(`Sending mail to ${options.to} via SMTP...`)
    const start = Date.now()
    
    try {
      // Wrap sendMail in a promise race to enforce a strict timeout
      // (in case nodemailer's internal timeouts fail to trigger)
      const cfg = getConfig()
      const hardTimeoutMs = cfg.EMAIL_SEND_TIMEOUT_MS
      await Promise.race([
        this.transporter.sendMail({
          ...options,
          envelope: { from: options.from, to: options.to }
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`SMTP sendMail timed out after ${hardTimeoutMs}ms`)),
            hardTimeoutMs
          )
        )
      ])
      log.success(`Sent to ${options.to} in ${Date.now() - start}ms`)
    } catch (err: any) {
      log.error(`Failed to send to ${options.to} after ${Date.now() - start}ms:`, err?.message || err)
      throw err
    }
  }
}

// =============================================================================
// Resend Provider
// =============================================================================

class ResendProvider implements EmailProvider {
  name = 'Resend'
  private client: Resend

  constructor(apiKey: string) {
    this.client = new Resend(apiKey)
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const { error } = await this.client.emails.send({
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.html
    })
    if (error) {
      throw new Error(`Resend error: ${error.message}`)
    }
  }
}

// =============================================================================
// Dev Fallback Provider (logs to console, doesn't send)
// =============================================================================

class DevFallbackProvider implements EmailProvider {
  name = 'DevFallback'
  private transporter: nodemailer.Transporter

  constructor() {
    this.transporter = nodemailer.createTransport({ jsonTransport: true })
    log.warn('No email provider configured; using DevFallback (emails will not be sent).')
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const result = await this.transporter.sendMail(options)
    log.info('DevFallback would send:', JSON.parse(result.message).subject)
  }
}

// =============================================================================
// Email Service
// =============================================================================

// Per-recipient rate limiter: max 5 emails per 10-minute window per address.
// Prevents inbox flooding and abuse of transactional email endpoints.
const EMAIL_RATE_LIMIT_MAX = 5
const EMAIL_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const emailRateMap = new Map<string, { count: number; resetAt: number }>()

// Periodic cleanup of expired rate-limit entries
const emailRateCleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [addr, entry] of emailRateMap) {
    if (now >= entry.resetAt) emailRateMap.delete(addr)
  }
}, 5 * 60 * 1000)
emailRateCleanupTimer.unref?.()

class EmailService {
  private providers?: EmailProvider[]
  private providerLastFailure = new Map<string, number>()

  private getProviderBackoffMs(): number {
    return getConfig().EMAIL_PROVIDER_BACKOFF_MS
  }

  private inBackoff(providerName: string): boolean {
    return this.getBackoffRemainingMs(providerName) > 0
  }

  private getBackoffRemainingMs(providerName: string): number {
    const last = this.providerLastFailure.get(providerName)
    if (!last) return 0
    const remaining = this.getProviderBackoffMs() - (Date.now() - last)
    return Math.max(0, remaining)
  }

  private markFailure(providerName: string) {
    this.providerLastFailure.set(providerName, Date.now())
  }

  private clearFailure(providerName: string) {
    this.providerLastFailure.delete(providerName)
  }

  private buildProviders(): EmailProvider[] {
    const cfg = getConfig()
    const smtpUrl = cfg.SMTP_URL

    const host = cfg.EMAIL_HOST
    const user = cfg.EMAIL_USER
    const pass = cfg.EMAIL_PASS

    const resendApiKey = cfg.RESEND_API_KEY || ''

    const smtpConfigured = !!smtpUrl || (!!host && !!user && !!pass)
    const resendConfigured = !!resendApiKey

    // Selection:
    // - EMAIL_PROVIDER=resend|smtp|auto (default auto)
    // - auto prefers SMTP when available, then falls back to Resend
    const rawPreference = cfg.EMAIL_PROVIDER
    const pref = rawPreference === 'smtp' || rawPreference === 'resend' || rawPreference === 'auto'
      ? rawPreference
      : 'auto'

    const smtpProvider = () => {
      if (smtpUrl) {
        log.info('Configured SMTP provider (URL)')
        return new SmtpProvider(smtpUrl)
      }
      const port = cfg.EMAIL_PORT
      const secure = cfg.EMAIL_SECURE
      log.info(`Configured SMTP provider (${host}:${port})`)
      return new SmtpProvider({ host, port, secure, auth: { user, pass } })
    }

    const resendProvider = () => {
      log.info('Configured Resend provider')
      return new ResendProvider(resendApiKey)
    }

    const providers: EmailProvider[] = []
    const providerFactories: Record<EmailProviderKey, () => EmailProvider> = {
      smtp: smtpProvider,
      resend: resendProvider
    }

    if (pref !== rawPreference) {
      log.warn(`Unknown EMAIL_PROVIDER "${rawPreference}", defaulting to auto (SMTP first, Resend fallback).`)
    } else if (pref === 'smtp' && !smtpConfigured && resendConfigured) {
      log.warn('EMAIL_PROVIDER=smtp was requested, but SMTP is not fully configured. Falling back to Resend.')
    } else if (pref === 'resend' && !resendConfigured && smtpConfigured) {
      log.warn('EMAIL_PROVIDER=resend was requested, but Resend is not configured. Falling back to SMTP.')
    }

    const configuredOrder = resolveConfiguredProviderOrder({
      preference: pref,
      smtpConfigured,
      resendConfigured
    })

    if (configuredOrder.length > 0) {
      log.info(`Email provider priority: ${configuredOrder.map((provider) => provider.toUpperCase()).join(' -> ')}`)
    }

    for (const provider of configuredOrder) {
      providers.push(providerFactories[provider]())
    }

    if (providers.length === 0) {
      // Fallback: Dev mode (no actual emails sent)
      providers.push(new DevFallbackProvider())
    }

    return providers
  }

  private getProviders(): EmailProvider[] {
    if (!this.providers) {
      this.providers = this.buildProviders()
    }
    return this.providers
  }

  private checkRateLimit(to: string): void {
    const now = Date.now()
    const entry = emailRateMap.get(to)
    if (!entry || now >= entry.resetAt) {
      emailRateMap.set(to, { count: 1, resetAt: now + EMAIL_RATE_LIMIT_WINDOW_MS })
      return
    }
    if (entry.count >= EMAIL_RATE_LIMIT_MAX) {
      throw new Error(`Email rate limit exceeded for ${to}. Try again later.`)
    }
    entry.count++
  }

  private async sendViaProviders(options: SendMailOptions): Promise<void> {
    this.checkRateLimit(options.to)
    let lastErr: unknown = null
    const providers = this.getProviders()
    const skippedProviders: string[] = []
    const availableProviders = providers.filter((provider) => {
      const remainingMs = this.getBackoffRemainingMs(provider.name)
      if (remainingMs <= 0) {
        return true
      }

      skippedProviders.push(`${provider.name} (${remainingMs}ms backoff remaining)`)
      return false
    })
    const providersToTry = availableProviders.length > 0 ? availableProviders : providers
    const attemptedProviders: string[] = []

    if (skippedProviders.length > 0) {
      log.warn(`Skipping email providers in backoff: ${skippedProviders.join(', ')}`)
    }

    if (providers.length > 0 && availableProviders.length === 0) {
      log.warn('All configured email providers are in backoff. Retrying them in priority order for this attempt.')
    }

    for (const provider of providersToTry) {
      attemptedProviders.push(provider.name)
      try {
        await provider.sendMail(options)
        this.clearFailure(provider.name)
        if (attemptedProviders.length > 1) {
          log.warn(`Email delivery succeeded via fallback provider ${provider.name}.`)
        }
        return
      } catch (e) {
        lastErr = e
        this.markFailure(provider.name)
        const lastErrorMessage = e instanceof Error ? e.message : String(e)
        const hasMoreProviders = attemptedProviders.length < providersToTry.length
        log.warn(`Email provider ${provider.name} failed. ${hasMoreProviders ? 'Trying next provider.' : 'No more providers available.'} Last error: ${lastErrorMessage}`)
      }
    }

    const lastErrorMessage = lastErr instanceof Error ? lastErr.message : 'Unknown email delivery failure'
    throw new Error(`Failed to send email after trying ${attemptedProviders.join(' -> ') || 'no providers'}. Last error: ${lastErrorMessage}`)
  }

  // Strict, conservative recipient validation
  private validateRecipient(raw: string): string {
    const s = (raw || '').trim()
    if (!s || /[\r\n]/.test(s) || s.includes(',')) {
      throw new Error('Invalid recipient address')
    }
    const angle = s.match(/<([^>]+)>/)
    const addr = (angle ? angle[1] : s).trim()
    if (addr.startsWith('"')) {
      throw new Error('Quoted local-parts are not allowed')
    }
    const SIMPLE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/
    if (!SIMPLE.test(addr)) {
      throw new Error('Invalid recipient address')
    }
    const [local, domain] = addr.split('@')
    return `${local}@${domain.toLowerCase()}`
  }

  private getEmailConfig() {
    const cfg = getConfig()
    const appUrl = cfg.APP_URL
    const from = cfg.EMAIL_FROM
    return { appUrl, from }
  }

  async sendMagicLink(email: string, magicLink: string): Promise<boolean> {
    try {
      const { from } = this.getEmailConfig()
      const to = this.validateRecipient(email)
      
      await this.sendViaProviders({
        from,
        to,
        subject: 'Your secure sign-in link • Zentrio',
        html: getMagicLinkTemplate(magicLink)
      })
      return true
    } catch (error: any) {
      log.error('Failed to send magic link:', error?.message || error)
      return false
    }
  }

  async sendOTP(email: string, otp: string): Promise<boolean> {
    try {
      const { from } = this.getEmailConfig()
      const to = this.validateRecipient(email)
      
      await this.sendViaProviders({
        from,
        to,
        subject: 'Your verification code • Zentrio',
        html: getOtpTemplate(otp)
      })
      return true
    } catch (error: any) {
      log.error('Failed to send OTP:', error?.message || error)
      return false
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    try {
      const { from } = this.getEmailConfig()
      const to = this.validateRecipient(email)
      
      await this.sendViaProviders({
        from,
        to,
        subject: 'Welcome to Zentrio 🎬',
        html: getWelcomeTemplate(name)
      })
      return true
    } catch (error: any) {
      log.error('Failed to send welcome email:', error?.message || error)
      return false
    }
  }

  async sendVerificationEmail(email: string, url: string): Promise<boolean> {
    try {
      const { from } = this.getEmailConfig()
      const to = this.validateRecipient(email)
      
      await this.sendViaProviders({
        from,
        to,
        subject: 'Verify your email • Zentrio',
        html: getVerificationHelperTemplate(url)
      })
      return true
    } catch (error: any) {
      log.error('Failed to send verification email:', error?.message || error)
      return false
    }
  }

  async sendResetPasswordEmail(email: string, url: string): Promise<boolean> {
    try {
      const { from } = this.getEmailConfig()
      const to = this.validateRecipient(email)
      
      await this.sendViaProviders({
        from,
        to,
        subject: 'Reset your password • Zentrio',
        html: getPasswordResetTemplate(url)
      })
      return true
    } catch (error: any) {
      log.error('Failed to send reset password email:', error?.message || error)
      return false
    }
  }

  async sendListShareInvitation(
    recipientEmail: string,
    senderName: string,
    listName: string,
    acceptUrl: string
  ): Promise<boolean> {
    try {
      const { from } = this.getEmailConfig()
      const to = this.validateRecipient(recipientEmail)
      
      await this.sendViaProviders({
        from,
        to,
        subject: `${senderName} shared a list with you • Zentrio`,
        html: getSharingInvitationTemplate(senderName, listName, acceptUrl)
      })
      return true
    } catch (error: any) {
      log.error('Failed to send list share invitation:', error?.message || error)
      return false
    }
  }
}

// Create lazy email service singleton
export const emailService = new EmailService()
