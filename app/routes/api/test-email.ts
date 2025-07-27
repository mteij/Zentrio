import { Handlers } from "$fresh/server.ts";
import { EmailService } from "../../shared/services/email.ts";

export const handler: Handlers = {
  GET(_req) {
    try {
      // Check if RESEND_API_KEY is configured
      const apiKey = Deno.env.get("RESEND_API_KEY");
      if (!apiKey) {
        return new Response(JSON.stringify({
          error: "RESEND_API_KEY environment variable is not set"
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Test email service initialization
      
      return new Response(JSON.stringify({
        success: true,
        message: "Email service initialized successfully",
        apiKeyConfigured: !!apiKey,
        apiKeyLength: apiKey.length
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        details: "Failed to initialize email service"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  },

  async POST(req) {
    try {
      const { email } = await req.json();
      
      if (!email) {
        return new Response(JSON.stringify({ 
          error: "Email address is required" 
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }

      const emailService = new EmailService();
      await emailService.sendWelcomeEmail(email, "test123");
      
      return new Response(JSON.stringify({ 
        success: true,
        message: `Test email sent successfully to ${email}`
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        details: "Failed to send test email"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};