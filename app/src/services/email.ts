import * as nodemailer from 'nodemailer'
import { Resend } from 'resend'

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
    const defaults = {
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000,   // 30 seconds
      socketTimeout: 30000      // 30 seconds
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
      await Promise.race([
        this.transporter.sendMail({
          ...options,
          envelope: { from: options.from, to: options.to }
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SMTP sendMail timed out after 35s')), 35000)
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
  private provider?: EmailProvider

  private getProvider(): EmailProvider {
    if (this.provider) return this.provider

    // Priority 1: SMTP URL
    const smtpUrl = (process.env.SMTP_URL || process.env.EMAIL_URL || '').trim()
    if (smtpUrl) {
      console.log('[email] Using SMTP provider (URL)')
      this.provider = new SmtpProvider(smtpUrl)
      return this.provider
    }

    // Priority 2: SMTP individual settings
    const host = process.env.EMAIL_HOST || ''
    const user = process.env.EMAIL_USER || ''
    const pass = process.env.EMAIL_PASS || ''
    if (host && user && pass) {
      const port = parseInt(process.env.EMAIL_PORT || '587', 10)
      const secure = process.env.EMAIL_SECURE !== undefined
        ? process.env.EMAIL_SECURE === 'true'
        : port === 465
      console.log(`[email] Using SMTP provider (${host}:${port})`)
      this.provider = new SmtpProvider({ host, port, secure, auth: { user, pass } })
      return this.provider
    }

    // Priority 3: Resend
    const resendApiKey = (process.env.RESEND_API_KEY || '').trim()
    if (resendApiKey) {
      console.log('[email] Using Resend provider')
      this.provider = new ResendProvider(resendApiKey)
      return this.provider
    }

    // Fallback: Dev mode (no actual emails sent)
    this.provider = new DevFallbackProvider()
    return this.provider
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
    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const from = process.env.EMAIL_FROM || 'noreply@zentrio.app'
    return { appUrl, from }
  }

  async sendMagicLink(email: string, magicLink: string): Promise<boolean> {
    try {
      const { appUrl, from } = this.getEmailConfig()
      const to = this.validateRecipient(email)
      
      await this.getProvider().sendMail({
        from,
        to,
        subject: 'Your secure sign-in link • Zentrio',
        html: `
  <div style="background:#0b0b0b;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;">
      <div style="padding:20px 24px;background:#1a1a1a;border-bottom:1px solid #222;">
        <div style="color:#e50914;font-weight:700;font-size:20px;letter-spacing:-0.3px;">Zentrio</div>
      </div>
      <div style="padding:24px 24px 8px;color:#ddd;line-height:1.6;">
        <h1 style="margin:0 0 8px;color:#fff;font-size:22px;letter-spacing:-0.2px;">Sign in with one click</h1>
        <p style="margin:0 0 16px;color:#b3b3b3;">Click the button below to securely sign in. This link expires in <strong>15 minutes</strong>.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${magicLink}" target="_blank" rel="noopener" style="display:inline-block;background:#e50914;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;">
            Sign in to Zentrio
          </a>
        </div>
        <p style="margin:16px 0;color:#8a8a8a;font-size:14px;">If the button doesn't work, copy and paste this URL into your browser:</p>
        <p style="word-break:break-all;background:#0f0f0f;border:1px solid #262626;border-radius:8px;padding:12px 14px;color:#bdbdbd;font-size:12px;">${magicLink}</p>
        <p style="margin:20px 0 10px;color:#8a8a8a;font-size:13px;">You received this email because someone tried to sign in with this address. If this wasn't you, you can safely ignore it.</p>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #222;color:#666;text-align:center;font-size:12px;">
        © ${new Date().getFullYear()} Zentrio • <a href="${appUrl}" style="color:#888;text-decoration:none;">${appUrl.replace(/^https?:\/\//, '')}</a>
      </div>
    </div>
  </div>`
      })
      return true
    } catch (error: any) {
      console.error('Failed to send magic link:', error?.message || error)
      return false
    }
  }

  async sendOTP(email: string, otp: string): Promise<boolean> {
    try {
      const { appUrl, from } = this.getEmailConfig()
      const to = this.validateRecipient(email)
      
      await this.getProvider().sendMail({
        from,
        to,
        subject: 'Your verification code • Zentrio',
        html: `
  <div style="background:#0b0b0b;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;">
      <div style="padding:20px 24px;background:#1a1a1a;border-bottom:1px solid #222;">
        <div style="color:#e50914;font-weight:700;font-size:20px;letter-spacing:-0.3px;">Zentrio</div>
      </div>
      <div style="padding:24px 24px 8px;color:#ddd;line-height:1.6;">
        <h1 style="margin:0 0 8px;color:#fff;font-size:22px;letter-spacing:-0.2px;">Your one-time verification code</h1>
        <p style="margin:0 0 16px;color:#b3b3b3;">Use the 6-digit code below to continue signing in. This code expires in <strong>10 minutes</strong>.</p>
        <div style="text-align:center;margin:24px 0;">
          <div style="display:inline-block;background:#0f0f0f;border:1px solid #262626;border-radius:10px;padding:14px 16px;">
            <span style="font-size:30px;letter-spacing:8px;font-weight:800;color:#e50914;font-family:SFMono-Regular,Consolas,'Liberation Mono',Menlo,monospace;">${otp}</span>
          </div>
        </div>
        <p style="margin:16px 0;color:#8a8a8a;font-size:13px;">Didn't request this code? You can ignore this email.</p>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #222;color:#666;text-align:center;font-size:12px;">
        © ${new Date().getFullYear()} Zentrio • <a href="${appUrl}" style="color:#888;text-decoration:none;">${appUrl.replace(/^https?:\/\//, '')}</a>
      </div>
    </div>
  </div>`
      })
      return true
    } catch (error: any) {
      console.error('Failed to send OTP:', error?.message || error)
      return false
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    try {
      const { appUrl, from } = this.getEmailConfig()
      const to = this.validateRecipient(email)
      
      await this.getProvider().sendMail({
        from,
        to,
        subject: 'Welcome to Zentrio 🎬',
        html: `
  <div style="background:#0b0b0b;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;">
      <div style="padding:20px 24px;background:#1a1a1a;border-bottom:1px solid #222;">
        <div style="color:#e50914;font-weight:700;font-size:20px;letter-spacing:-0.3px;">Zentrio</div>
      </div>
      <div style="padding:24px 24px 8px;color:#ddd;line-height:1.6;">
        <h1 style="margin:0 0 8px;color:#fff;font-size:22px;letter-spacing:-0.2px;">Welcome aboard, ${name}!</h1>
        <p style="margin:0 0 16px;color:#b3b3b3;">Your account is ready. Create profiles and start streaming your way.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${appUrl}/profiles" target="_blank" rel="noopener" style="display:inline-block;background:#e50914;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;">
            Go to Profiles
          </a>
        </div>
        <p style="margin:16px 0;color:#8a8a8a;font-size:13px;">Need help? Just reply to this email.</p>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #222;color:#666;text-align:center;font-size:12px;">
        Happy streaming — Zentrio Team
      </div>
    </div>
  </div>`
      })
      return true
    } catch (error: any) {
      console.error('Failed to send welcome email:', error?.message || error)
      return false
    }
  }

  async sendVerificationEmail(email: string, url: string): Promise<boolean> {
    try {
      const { appUrl, from } = this.getEmailConfig()
      const to = this.validateRecipient(email)
      
      await this.getProvider().sendMail({
        from,
        to,
        subject: 'Verify your email • Zentrio',
        html: `
  <div style="background:#0b0b0b;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;">
      <div style="padding:20px 24px;background:#1a1a1a;border-bottom:1px solid #222;">
        <div style="color:#e50914;font-weight:700;font-size:20px;letter-spacing:-0.3px;">Zentrio</div>
      </div>
      <div style="padding:24px 24px 8px;color:#ddd;line-height:1.6;">
        <h1 style="margin:0 0 8px;color:#fff;font-size:22px;letter-spacing:-0.2px;">Verify your email address</h1>
        <p style="margin:0 0 16px;color:#b3b3b3;">Please verify your email address to continue using Zentrio.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${url}" target="_blank" rel="noopener" style="display:inline-block;background:#e50914;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;">
            Verify Email
          </a>
        </div>
        <p style="margin:16px 0;color:#8a8a8a;font-size:14px;">If the button doesn't work, copy and paste this URL into your browser:</p>
        <p style="word-break:break-all;background:#0f0f0f;border:1px solid #262626;border-radius:8px;padding:12px 14px;color:#bdbdbd;font-size:12px;">${url}</p>
        <p style="margin:20px 0 10px;color:#8a8a8a;font-size:13px;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #222;color:#666;text-align:center;font-size:12px;">
        © ${new Date().getFullYear()} Zentrio • <a href="${appUrl}" style="color:#888;text-decoration:none;">${appUrl.replace(/^https?:\/\//, '')}</a>
      </div>
    </div>
  </div>`
      })
      return true
    } catch (error: any) {
      console.error('Failed to send verification email:', error?.message || error)
      return false
    }
  }

  async sendResetPasswordEmail(email: string, url: string): Promise<boolean> {
    try {
      const { appUrl, from } = this.getEmailConfig()
      const to = this.validateRecipient(email)
      
      await this.getProvider().sendMail({
        from,
        to,
        subject: 'Reset your password • Zentrio',
        html: `
  <div style="background:#0b0b0b;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;">
      <div style="padding:20px 24px;background:#1a1a1a;border-bottom:1px solid #222;">
        <div style="color:#e50914;font-weight:700;font-size:20px;letter-spacing:-0.3px;">Zentrio</div>
      </div>
      <div style="padding:24px 24px 8px;color:#ddd;line-height:1.6;">
        <h1 style="margin:0 0 8px;color:#fff;font-size:22px;letter-spacing:-0.2px;">Reset your password</h1>
        <p style="margin:0 0 16px;color:#b3b3b3;">We received a request to reset your password. Click the button below to choose a new one.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${url}" target="_blank" rel="noopener" style="display:inline-block;background:#e50914;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;">
            Reset Password
          </a>
        </div>
        <p style="margin:16px 0;color:#8a8a8a;font-size:14px;">If the button doesn't work, copy and paste this URL into your browser:</p>
        <p style="word-break:break-all;background:#0f0f0f;border:1px solid #262626;border-radius:8px;padding:12px 14px;color:#bdbdbd;font-size:12px;">${url}</p>
        <p style="margin:20px 0 10px;color:#8a8a8a;font-size:13px;">If you didn't ask to reset your password, you can safely ignore this email.</p>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #222;color:#666;text-align:center;font-size:12px;">
        © ${new Date().getFullYear()} Zentrio • <a href="${appUrl}" style="color:#888;text-decoration:none;">${appUrl.replace(/^https?:\/\//, '')}</a>
      </div>
    </div>
  </div>`
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
      const { appUrl, from } = this.getEmailConfig()
      const to = this.validateRecipient(recipientEmail)
      
      await this.getProvider().sendMail({
        from,
        to,
        subject: `${senderName} shared a list with you • Zentrio`,
        html: `
  <div style="background:#0b0b0b;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#111;border:1px solid #222;border-radius:12px;overflow:hidden;">
      <div style="padding:20px 24px;background:#1a1a1a;border-bottom:1px solid #222;">
        <div style="color:#e50914;font-weight:700;font-size:20px;letter-spacing:-0.3px;">Zentrio</div>
      </div>
      <div style="padding:24px 24px 8px;color:#ddd;line-height:1.6;">
        <h1 style="margin:0 0 8px;color:#fff;font-size:22px;letter-spacing:-0.2px;">You've been invited to a list! 📚</h1>
        <p style="margin:0 0 16px;color:#b3b3b3;"><strong style="color:#fff;">${senderName}</strong> has shared their list <strong style="color:#e50914;">"${listName}"</strong> with you.</p>
        <p style="margin:0 0 16px;color:#b3b3b3;">Click below to view and accept the invitation. Once accepted, you'll be able to see all the movies and shows in this list.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="${acceptUrl}" target="_blank" rel="noopener" style="display:inline-block;background:#e50914;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:700;">
            View Invitation
          </a>
        </div>
        <p style="margin:16px 0;color:#8a8a8a;font-size:14px;">If the button doesn't work, copy and paste this URL into your browser:</p>
        <p style="word-break:break-all;background:#0f0f0f;border:1px solid #262626;border-radius:8px;padding:12px 14px;color:#bdbdbd;font-size:12px;">${acceptUrl}</p>
        <p style="margin:20px 0 10px;color:#8a8a8a;font-size:13px;">This invitation expires in 30 days. If you don't have a Zentrio account yet, you'll be asked to create one.</p>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #222;color:#666;text-align:center;font-size:12px;">
        © ${new Date().getFullYear()} Zentrio • <a href="${appUrl}" style="color:#888;text-decoration:none;">${appUrl.replace(/^https?:\/\//, '')}</a>
      </div>
    </div>
  </div>`
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