import { Resend } from "https://esm.sh/resend@3.2.0";
import { WelcomeEmail } from "../../components/WelcomeEmail.tsx";
import { LoginCodeEmail } from "../../components/LoginCodeEmail.tsx";
import { ResetPasswordEmail } from "../../components/ResetPasswordEmail.tsx";
import { render } from "https://esm.sh/preact-render-to-string@6.2.1";

export class EmailService {
  private resend: Resend;

  constructor() {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }
    this.resend = new Resend(apiKey);
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.resend.emails.send({
        from: "StremioHub <no-reply@yourdomain.com>",
        to,
        subject,
        html,
      });
    } catch (error) {
      console.error("Failed to send email:", error);
      throw new Error("Failed to send email");
    }
  }

  async sendWelcomeEmail(email: string, password: string): Promise<void> {
    const html = render(WelcomeEmail({ email, password }));
    await this.sendEmail(email, "Welcome to StremioHub - Your Login Details", html);
  }

  async sendLoginCode(email: string, code: string, verificationUrl: string): Promise<void> {
    const html = render(LoginCodeEmail({ code, verificationUrl }));
    await this.sendEmail(email, "Your StremioHub Login Code", html);
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const html = render(ResetPasswordEmail({ resetUrl }));
    await this.sendEmail(email, "Reset Your StremioHub Password", html);
  }
}