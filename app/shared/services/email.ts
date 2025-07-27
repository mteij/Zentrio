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

  constructor() {
    this.emailProvider = Deno.env.get("EMAIL_PROVIDER") as "resend" | "smtp" || "resend";
    this.fromDomain = Deno.env.get("EMAIL_FROM_DOMAIN") || "noreply@yourdomain.com";

    if (this.emailProvider === "resend") {
      const apiKey = Deno.env.get("RESEND_API_KEY");
      if (!apiKey) throw new Error("RESEND_API_KEY is not configured for Resend provider");
      this.resend = new Resend(apiKey);
    } else if (this.emailProvider === "smtp") {
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
    } else {
      throw new Error(`Invalid EMAIL_PROVIDER: ${this.emailProvider}`);
    }
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      console.log(`Attempting to send email to: ${to} via ${this.emailProvider}`);
      
      if (this.emailProvider === "resend" && this.resend) {
        const result = await this.resend.emails.send({
          from: `Zentrio <${this.fromDomain}>`,
          to,
          subject,
          html,
        });
        console.log(`Email sent successfully via Resend:`, result);
      } else if (this.emailProvider === "smtp" && this.nodemailer) {
        const result = await this.nodemailer.sendMail({
          from: `"Zentrio" <${this.fromDomain}>`,
          to,
          subject,
          html,
        });
        console.log(`Email sent successfully via SMTP:`, result);
      } else {
        throw new Error("Email provider not initialized correctly.");
      }

    } catch (error) {
      console.error("Failed to send email:", error);
      throw new Error(`Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async sendWelcomeEmail(email: string, password: string): Promise<void> {
    const html = render(WelcomeEmail({ 
      email, 
      password, 
      loginUrl: `${Deno.env.get("APP_DOMAIN") || "http://localhost:8000"}/auth/login`
    }));
    await this.sendEmail(email, "Welcome to Zentrio - Your Login Details", html);
  }

  async sendLoginCode(email: string, code: string, verificationUrl: string): Promise<void> {
    const html = render(LoginCodeEmail({ code, verificationUrl }));
    await this.sendEmail(email, "Your Zentrio Login Code", html);
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const html = render(ResetPasswordEmail({ resetUrl }));
    await this.sendEmail(email, "Reset Your Zentrio Password", html);
  }
}