import { Resend } from "https://esm.sh/resend@3.2.0";
import { createTransport, type Transporter } from "npm:nodemailer@6.9.13";
import { WelcomeEmail } from "../components/email/WelcomeEmail.tsx";
import { LoginCodeEmail } from "../components/email/LoginCodeEmail.tsx";
import { ResetPasswordEmail } from "../components/email/ResetPasswordEmail.tsx";
import { render } from "https://esm.sh/preact-render-to-string@6.2.1";

export class EmailService {
  private emailProvider: "resend" | "smtp";
  private resend?: Resend;
  private nodemailer?: Transporter;
  private fromDomain: string;
  private smtpFallbackEnabled: boolean;

  constructor() {
    this.emailProvider = Deno.env.get("EMAIL_PROVIDER") as "resend" | "smtp" || "resend";
    this.fromDomain = Deno.env.get("EMAIL_FROM_DOMAIN") || "noreply@yourdomain.com";
    this.smtpFallbackEnabled = Deno.env.get("SMTP_FALLBACK_ENABLED")?.toLowerCase() === "true";

    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (this.smtpFallbackEnabled && !resendApiKey) {
      throw new Error("SMTP_FALLBACK_ENABLED is true, but RESEND_API_KEY is not configured.");
    }

    if (this.emailProvider === "resend") {
      if (!resendApiKey) {
        throw new Error("EMAIL_PROVIDER is set to 'resend', but RESEND_API_KEY is not configured.");
      }
      this.resend = new Resend(resendApiKey);
    }
    
    if (this.emailProvider === "smtp") {
      const host = Deno.env.get("SMTP_HOST");
      const port = parseInt(Deno.env.get("SMTP_PORT") || "587", 10);
      const user = Deno.env.get("SMTP_USER");
      const pass = Deno.env.get("SMTP_PASS");
      const secure = Deno.env.get("SMTP_SECURE") === "true";

      if (!host || !user || !pass) {
        throw new Error("SMTP configuration is incomplete");
      }

      this.nodemailer = createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        connectionTimeout: 1000 * 10, // 10 seconds
      });
    } else if (this.emailProvider !== "resend") {
      throw new Error(`Invalid EMAIL_PROVIDER: ${this.emailProvider}`);
    }
  }

  private async sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    try {
      if (this.emailProvider === "smtp" && this.nodemailer) {
        await this.sendSmtpEmail(to, subject, html, text);
      } else if (this.emailProvider === "resend" && this.resend) {
        await this.sendResendEmail(to, subject, html, text);
      } else {
        throw new Error("No primary email provider is configured correctly.");
      }
    } catch (error) {
      console.error(`Primary email provider (${this.emailProvider}) failed:`, error);
      if (this.emailProvider === "smtp" && this.smtpFallbackEnabled && this.resend) {
        console.log("Attempting to send email via Resend as a fallback...");
        try {
          await this.sendResendEmail(to, subject, html, text);
        } catch (fallbackError) {
          console.error("Fallback email provider (Resend) also failed:", fallbackError);
          throw new Error(`Failed to send email with both primary and fallback providers: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
        }
      } else {
        throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  private async sendSmtpEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    if (!this.nodemailer) throw new Error("Nodemailer is not initialized.");
    console.log(`Attempting to send email to: ${to} via SMTP`);
    const result = await this.nodemailer.sendMail({
      from: `"Zentrio" <${this.fromDomain}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`Email sent successfully via SMTP:`, result);
  }

  private async sendResendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
    if (!this.resend) throw new Error("Resend is not initialized.");
    console.log(`Attempting to send email to: ${to} via Resend`);
    const result = await this.resend.emails.send({
      from: `Zentrio <${this.fromDomain}>`,
      to,
      subject,
      html,
      text,
    });
    console.log(`Email sent successfully via Resend:`, result);
  }

  async sendWelcomeEmail(email: string, password: string): Promise<void> {
    const loginUrl = `${Deno.env.get("APP_DOMAIN") || "http://localhost:8000"}/auth/login`;
    const html = render(WelcomeEmail({
      email,
      password,
      loginUrl,
    }));
    const text = `Welcome to Zentrio! Here are your login details:\nEmail: ${email}\nPassword: ${password}\nLogin here: ${loginUrl}`;
    await this.sendEmail(email, "Welcome to Zentrio - Your Login Details", html, text);
  }

  async sendLoginCode(email: string, code: string, verificationUrl: string): Promise<void> {
    const html = render(LoginCodeEmail({ code, verificationUrl }));
    const text = `Your Zentrio login code is: ${code}\nYou can also use this link to log in: ${verificationUrl}`;
    await this.sendEmail(email, "Your Zentrio Login Code", html, text);
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const html = render(ResetPasswordEmail({ resetUrl }));
    const text = `Please reset your password by clicking the following link: ${resetUrl}`;
    await this.sendEmail(email, "Reset Your Zentrio Password", html, text);
  }
}