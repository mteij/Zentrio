import { Resend } from "https://esm.sh/resend@3.2.0";
import { WelcomeEmail } from "../components/email/WelcomeEmail.tsx";
import { LoginCodeEmail } from "../components/email/LoginCodeEmail.tsx";
import { ResetPasswordEmail } from "../components/email/ResetPasswordEmail.tsx";
import { render } from "https://esm.sh/preact-render-to-string@6.2.1";

export class EmailService {
  private resend: Resend;

  constructor() {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    this.resend = new Resend(apiKey);
    this.fromDomain = Deno.env.get("EMAIL_FROM_DOMAIN") || "noreply@zentrio.eu";
  }

  private fromDomain: string;

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      console.log(`Attempting to send email to: ${to}`);
      const result = await this.resend.emails.send({
        from: `Zentrio <${this.fromDomain}>`,
        to,
        subject,
        html,
      });
      console.log(`Email sent successfully:`, result);
    } catch (error) {
      console.error("Failed to send email:", error);
      console.error("Email details:", { to, subject, fromDomain: "noreply@zentrio.deno.dev" });
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