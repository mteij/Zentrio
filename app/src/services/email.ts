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
  private transporter: nodemailer.Transporter

  constructor(config: EmailConfig) {
    this.transporter = nodemailer.createTransport(config)
  }

  async sendMagicLink(email: string, magicLink: string): Promise<boolean> {
    try {
      const appUrl = process.env.APP_URL || 'http://localhost:3000'
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@zentrio.app',
        to: email,
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
  
      await this.transporter.sendMail(mailOptions)
      return true
    } catch (error) {
      console.error('Failed to send magic link:', error)
      return false
    }
  }

  async sendOTP(email: string, otp: string): Promise<boolean> {
    try {
      const appUrl = process.env.APP_URL || 'http://localhost:3000'
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@zentrio.app',
        to: email,
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
  
      await this.transporter.sendMail(mailOptions)
      return true
    } catch (error) {
      console.error('Failed to send OTP:', error)
      return false
    }
  }

  async sendWelcomeEmail(email: string, name: string): Promise<boolean> {
    try {
      const appUrl = process.env.APP_URL || 'http://localhost:3000'
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@zentrio.app',
        to: email,
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
  
      await this.transporter.sendMail(mailOptions)
      return true
    } catch (error) {
      console.error('Failed to send welcome email:', error)
      return false
    }
  }
}

// Create email service instance
const emailConfig: EmailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
}

export const emailService = new EmailService(emailConfig)