import * as nodemailer from 'nodemailer'
import { Resend } from 'resend'
import { getConfig } from './envParser'
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
    console.log(`[email] Sending mail to ${options.to} via SMTP...`)
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
      console.log(`[email] sent to ${options.to} in ${Date.now() - start}ms`)
    } catch (err: any) {
      console.error(`[email] Failed to send to ${options.to} after ${Date.now() - start}ms:`, err?.message || err)
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
    console.warn('[email] No email provider configured; using DevFallback (emails will not be sent).')
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    const result = await this.transporter.sendMail(options)
    console.log('[email] DevFallback would send:', JSON.parse(result.message).subject)
  }
}

// =============================================================================
// Email Service
// =============================================================================

class EmailService {
  private providers?: EmailProvider[]
  private providerLastFailure = new Map<string, number>()

  private getProviderBackoffMs(): number {
    return getConfig().EMAIL_PROVIDER_BACKOFF_MS
  }

  private inBackoff(providerName: string): boolean {
    const last = this.providerLastFailure.get(providerName)
    if (!last) return false
    return Date.now() - last < this.getProviderBackoffMs()
  }

  private markFailure(providerName: string) {
    this.providerLastFailure.set(providerName, Date.now())
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
    // - auto prefers Resend if configured (fast, no SMTP networking), else SMTP
    const pref = cfg.EMAIL_PROVIDER

    const smtpProvider = () => {
      if (smtpUrl) {
        console.log('[email] Using SMTP provider (URL)')
        return new SmtpProvider(smtpUrl)
      }
      const port = cfg.EMAIL_PORT
      const secure = cfg.EMAIL_SECURE
      console.log(`[email] Using SMTP provider (${host}:${port})`)
      return new SmtpProvider({ host, port, secure, auth: { user, pass } })
    }

    const resendProvider = () => {
      console.log('[email] Using Resend provider')
      return new ResendProvider(resendApiKey)
    }

    const providers: EmailProvider[] = []

    const pushSmtp = () => {
      if (smtpConfigured) providers.push(smtpProvider())
    }
    const pushResend = () => {
      if (resendConfigured) providers.push(resendProvider())
    }

    if (pref === 'resend') {
      pushResend()
      pushSmtp()
    } else if (pref === 'smtp') {
      pushSmtp()
      pushResend()
    } else {
      // auto
      if (resendConfigured) pushResend()
      else pushSmtp()
      // Add the other as failover
      if (providers.length === 0) {
        pushSmtp()
        pushResend()
      } else if (providers[0].name === 'Resend') {
        pushSmtp()
      } else {
        pushResend()
      }
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

  private async sendViaProviders(options: SendMailOptions): Promise<void> {
    let lastErr: unknown = null

    for (const provider of this.getProviders()) {
      if (this.inBackoff(provider.name)) {
        continue
      }

      try {
        await provider.sendMail(options)
        return
      } catch (e) {
        lastErr = e
        this.markFailure(provider.name)
      }
    }

    throw (lastErr instanceof Error ? lastErr : new Error('Failed to send email (all providers failed)'))
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
      console.error('Failed to send magic link:', error?.message || error)
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
      console.error('Failed to send OTP:', error?.message || error)
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
      console.error('Failed to send welcome email:', error?.message || error)
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
      console.error('Failed to send verification email:', error?.message || error)
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
      console.error('Failed to send reset password email:', error?.message || error)
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
      console.error('Failed to send list share invitation:', error?.message || error)
      return false
    }
  }
}

// Create lazy email service singleton
export const emailService = new EmailService()