import * as nodemailer from 'nodemailer'

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

class EmailService {
  private transporter?: nodemailer.Transporter
  private config?: EmailConfig

  constructor(config?: EmailConfig) {
    this.config = config
  }

  private buildConfigFromEnv(): EmailConfig {
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com'
    const port = parseInt(process.env.EMAIL_PORT || '587', 10)
    // If EMAIL_SECURE is not set, infer from port (465 => secure)
    const secure = process.env.EMAIL_SECURE !== undefined
      ? process.env.EMAIL_SECURE === 'true'
      : (port === 465)
    const user = process.env.EMAIL_USER || ''
    const pass = process.env.EMAIL_PASS || ''
    return {
      host,
      port,
      secure,
      auth: { user, pass },
    }
  }

  private ensureTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      const smtpUrl = (process.env.SMTP_URL || process.env.EMAIL_URL || '').trim()
      if (smtpUrl) {
        // Explicit SMTP URL configuration takes precedence
        this.transporter = nodemailer.createTransport(smtpUrl)
      } else {
        const cfg = this.config || this.buildConfigFromEnv()
        const hasAuth = !!(cfg?.auth?.user && cfg?.auth?.pass)
        if (hasAuth) {
          // Use configured host/port/auth when credentials are available
          this.transporter = nodemailer.createTransport(cfg)
        } else {
          // Dev fallback: avoid network and hard failures when email is not configured.
          // jsonTransport resolves sendMail() with the message serialized to JSON.
          this.transporter = nodemailer.createTransport({ jsonTransport: true })
          console.warn('[email] No SMTP configured; using jsonTransport (emails will not be sent).')
        }
      }
    }
    return this.transporter!
  }

  // Strict, conservative recipient validation to avoid quoted local-parts with embedded '@'
  // - Reject CRLF/header injection, commas (lists), and quoted local-parts entirely
  // - Accept simple addr-spec only: local@domain (RFC-lite)
  private validateRecipient(raw: string): string {
    const s = (raw || '').trim()
    if (!s || /[\r\n]/.test(s) || s.includes(',')) {
      throw new Error('Invalid recipient address')
    }
    // Extract from angle brackets if present: Name <addr> or <addr>
    const angle = s.match(/<([^>]+)>/)
    const addr = (angle ? angle[1] : s).trim()
    // Disallow quoted local-parts to prevent embedded '@' tricks
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
 
  async sendMagicLink(email: string, magicLink: string): Promise<boolean> {
    try {
      const appUrl = process.env.APP_URL || 'http://localhost:3000'
      const from = process.env.EMAIL_FROM || 'noreply@zentrio.app'
      let to: string
      try {
        to = this.validateRecipient(email)
      } catch (e: any) {
        console.error('Invalid recipient for magic link:', e?.message || e)
        return false
      }
      const mailOptions = {
        from,
        to,
        envelope: { from, to },
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
        © ${new Date().getFullYear()} Zentrio • <a href="${appUrl}" style="color:#888;text-decoration:none;">${appUrl.replace(/^https?:\/\//,'')}</a>
      </div>
    </div>
  </div>`
      }
      await this.ensureTransporter().sendMail(mailOptions)
      return true
    } catch (error: any) {
      console.error('Failed to send magic link:', error?.response || error?.message || error)
      return false
    }
  }

  async sendOTP(email: string, otp: string): Promise<boolean> {
    try {
      const appUrl = process.env.APP_URL || 'http://localhost:3000'
      const from = process.env.EMAIL_FROM || 'noreply@zentrio.app'
      let to: string
      try {
        to = this.validateRecipient(email)
      } catch (e: any) {
        console.error('Invalid recipient for OTP:', e?.message || e)
        return false
      }
      const mailOptions = {
        from,
        to,
        envelope: { from, to },
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
        © ${new Date().getFullYear()} Zentrio • <a href="${appUrl}" style="color:#888;text-decoration:none;">${appUrl.replace(/^https?:\/\//,'')}</a>
      </div>
    </div>
  </div>`
      }
      await this.ensureTransporter().sendMail(mailOptions)
      return true
    } catch (error: any) {
      console.error('Failed to send OTP:', error?.response || error?.message || error)
      return false
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    try {
      const appUrl = process.env.APP_URL || 'http://localhost:3000'
      const from = process.env.EMAIL_FROM || 'noreply@zentrio.app'
      let to: string
      try {
        to = this.validateRecipient(email)
      } catch (e: any) {
        console.error('Invalid recipient for welcome email:', e?.message || e)
        return false
      }
      const mailOptions = {
        from,
        to,
        envelope: { from, to },
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
      }
      await this.ensureTransporter().sendMail(mailOptions)
      return true
    } catch (error: any) {
      console.error('Failed to send welcome email:', error?.response || error?.message || error)
      return false
    }
  }
  async sendVerificationEmail(email: string, url: string): Promise<boolean> {
    try {
      const appUrl = process.env.APP_URL || 'http://localhost:3000'
      const from = process.env.EMAIL_FROM || 'noreply@zentrio.app'
      let to: string
      try {
        to = this.validateRecipient(email)
      } catch (e: any) {
        console.error('Invalid recipient for verification email:', e?.message || e)
        return false
      }
      const mailOptions = {
        from,
        to,
        envelope: { from, to },
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
        © ${new Date().getFullYear()} Zentrio • <a href="${appUrl}" style="color:#888;text-decoration:none;">${appUrl.replace(/^https?:\/\//,'')}</a>
      </div>
    </div>
  </div>`
      }
      await this.ensureTransporter().sendMail(mailOptions)
      return true
    } catch (error: any) {
      console.error('Failed to send verification email:', error?.response || error?.message || error)
      return false
    }
  }

  async sendResetPasswordEmail(email: string, url: string): Promise<boolean> {
    try {
      const appUrl = process.env.APP_URL || 'http://localhost:3000'
      const from = process.env.EMAIL_FROM || 'noreply@zentrio.app'
      let to: string
      try {
        to = this.validateRecipient(email)
      } catch (e: any) {
        console.error('Invalid recipient for reset password email:', e?.message || e)
        return false
      }
      const mailOptions = {
        from,
        to,
        envelope: { from, to },
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
        © ${new Date().getFullYear()} Zentrio • <a href="${appUrl}" style="color:#888;text-decoration:none;">${appUrl.replace(/^https?:\/\//,'')}</a>
      </div>
    </div>
  </div>`
      }
      await this.ensureTransporter().sendMail(mailOptions)
      return true
    } catch (error: any) {
      console.error('Failed to send reset password email:', error?.response || error?.message || error)
      return false
    }
  }
}

// Create lazy email service singleton (reads env at first use)
export const emailService = new EmailService()