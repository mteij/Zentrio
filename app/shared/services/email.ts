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

    console.log(`EmailService initialized with provider: ${this.emailProvider}, fallback enabled: ${this.smtpFallbackEnabled}`);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (this.emailProvider === "resend" || this.smtpFallbackEnabled) {
        if (!resendApiKey) {
            console.warn("Resend API key is missing. Resend provider will be unavailable.");
        } else {
            this.resend = new Resend(resendApiKey);
        }
    }

    if (this.emailProvider === "smtp" || this.smtpFallbackEnabled) {
        const host = Deno.env.get("SMTP_HOST");
        const port = parseInt(Deno.env.get("SMTP_PORT") || "587", 10);
        const user = Deno.env.get("SMTP_USER");
        const pass = Deno.env.get("SMTP_PASS");
        const secure = Deno.env.get("SMTP_SECURE") === "true";

        console.log("SMTP Config:", { host, port, user, pass: pass ? '******' : undefined, secure });

        if (!host || !user || !pass) {
            console.warn("SMTP configuration is incomplete. SMTP provider will be unavailable.");
        } else {
            this.nodemailer = createTransport({
                host,
                port,
                secure,
                auth: { user, pass },
                connectionTimeout: 1000 * 5, // 5 seconds
            });
        }
    }

    if (this.emailProvider !== "resend" && this.emailProvider !== "smtp") {
        throw new Error(`Invalid EMAIL_PROVIDER: ${this.emailProvider}`);
    }
}

  private async sendEmail(to: string, subject: string, html: string, text: string): Promise<{ success: boolean; message: string; fallbackUsed: boolean }> {
    try {
        console.log(`Attempting to send email via primary provider: ${this.emailProvider}`);
        if (this.emailProvider === "smtp" && this.nodemailer) {
            await this.sendSmtpEmail(to, subject, html, text);
        } else if (this.emailProvider === "resend" && this.resend) {
            await this.sendResendEmail(to, subject, html, text);
        } else {
            throw new Error("Primary email provider is not configured correctly.");
        }
        return { success: true, message: "Email sent successfully with primary provider.", fallbackUsed: false };
    } catch (error) {
        console.error(`Primary email provider (${this.emailProvider}) failed:`, error);

        if (this.smtpFallbackEnabled) {
            console.log("Fallback enabled, attempting to use fallback provider.");
            try {
                if (this.emailProvider === "smtp" && this.resend) {
                    console.log("Attempting to send email via Resend as a fallback...");
                    await this.sendResendEmail(to, subject, html, text);
                    return { success: true, message: "Email sent successfully using fallback provider (Resend).", fallbackUsed: true };
                } else if (this.emailProvider === "resend" && this.nodemailer) {
                    console.log("Attempting to send email via SMTP as a fallback...");
                    await this.sendSmtpEmail(to, subject, html, text);
                    return { success: true, message: "Email sent successfully using fallback provider (SMTP).", fallbackUsed: true };
                } else {
                    const errorMessage = "Fallback provider is not configured correctly.";
                    console.error(errorMessage);
                    return { success: false, message: errorMessage, fallbackUsed: false };
                }
            } catch (fallbackError) {
                const errorMessage = `Failed to send email with both primary and fallback providers: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`;
                console.error("Fallback email provider also failed:", fallbackError);
                return { success: false, message: errorMessage, fallbackUsed: false };
            }
        } else {
            const errorMessage = `Failed to send email: ${error instanceof Error ? error.message : 'Unknown error'}`;
            return { success: false, message: errorMessage, fallbackUsed: false };
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

  sendWelcomeEmail(email: string, password: string): Promise<{ success: boolean; message: string; fallbackUsed: boolean }> {
    const loginUrl = `${Deno.env.get("APP_DOMAIN") || "http://localhost:8000"}/auth/login`;
    const html = render(WelcomeEmail({
      email,
      password,
      loginUrl,
    }));
    const text = `Welcome to Zentrio! Here are your login details:\nEmail: ${email}\nPassword: ${password}\nLogin here: ${loginUrl}`;
    return this.sendEmail(email, "Welcome to Zentrio - Your Login Details", html, text);
  }

  sendLoginCode(email: string, code: string, verificationUrl: string): Promise<{ success: boolean; message: string; fallbackUsed: boolean }> {
    const html = render(LoginCodeEmail({ code, verificationUrl }));
    const text = `Your Zentrio login code is: ${code}\nYou can also use this link to log in: ${verificationUrl}`;
    return this.sendEmail(email, "Your Zentrio Login Code", html, text);
  }

  sendPasswordReset(email: string, resetUrl: string): Promise<{ success: boolean; message: string; fallbackUsed: boolean }> {
    const html = render(ResetPasswordEmail({ resetUrl }));
    const text = `Please reset your password by clicking the following link: ${resetUrl}`;
    return this.sendEmail(email, "Reset Your Zentrio Password", html, text);
  }
}