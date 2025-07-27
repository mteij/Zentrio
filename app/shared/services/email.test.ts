import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { EmailService } from "./email.ts";

Deno.test("EmailService - SMTP Fallback to Resend", async () => {
  // Set up environment variables for the test
  Deno.env.set("EMAIL_PROVIDER", "smtp");
  Deno.env.set("SMTP_HOST", "smtp.invalid");
  Deno.env.set("SMTP_PORT", "587");
  Deno.env.set("SMTP_USER", "test");
  Deno.env.set("SMTP_PASS", "test");
  Deno.env.set("SMTP_SECURE", "false");
  Deno.env.set("SMTP_FALLBACK_ENABLED", "true");
  Deno.env.set("RESEND_API_KEY", "re_123456789");
  Deno.env.set("EMAIL_FROM_DOMAIN", "test@example.com");

  const emailService = new EmailService();

  // Mock the sendSmtpEmail method to throw an error
  emailService["sendSmtpEmail"] = () => {
    throw new Error("SMTP failed");
  };

  // Mock the sendResendEmail method to simulate a successful call
  let resendCalled = false;
  emailService["sendResendEmail"] = () => {
    resendCalled = true;
    return Promise.resolve();
  };

  await emailService.sendWelcomeEmail("test@example.com", "password");

  assertEquals(resendCalled, true, "Resend should be called as a fallback");
});

Deno.test("EmailService - SMTP without fallback", async () => {
    // Set up environment variables for the test
    Deno.env.set("EMAIL_PROVIDER", "smtp");
    Deno.env.set("SMTP_HOST", "smtp.invalid");
    Deno.env.set("SMTP_PORT", "587");
    Deno.env.set("SMTP_USER", "test");
    Deno.env.set("SMTP_PASS", "test");
    Deno.env.set("SMTP_SECURE", "false");
    Deno.env.set("SMTP_FALLBACK_ENABLED", "false");
    Deno.env.set("RESEND_API_KEY", "re_123456789");
    Deno.env.set("EMAIL_FROM_DOMAIN", "test@example.com");
  
    const emailService = new EmailService();
  
    // Mock the sendSmtpEmail method to throw an error
    emailService["sendSmtpEmail"] = () => {
      throw new Error("SMTP failed");
    };
  
    // Mock the sendResendEmail method to simulate a successful call
    let resendCalled = false;
    emailService["sendResendEmail"] = () => {
      resendCalled = true;
      return Promise.resolve();
    };
  
    await assertRejects(
        () => emailService.sendWelcomeEmail("test@example.com", "password"),
        Error,
        "Failed to send email: SMTP failed"
    );
  
    assertEquals(resendCalled, false, "Resend should not be called as a fallback");
  });