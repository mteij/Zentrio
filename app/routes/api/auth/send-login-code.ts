import { Handlers } from "$fresh/server.ts";
import { render } from "https://esm.sh/preact-render-to-string@6.2.1";
import { Resend } from "https://esm.sh/resend@3.2.0";
import { createVerificationToken, findUserByEmail } from "../../../utils/db.ts";
import { LoginCodeEmail } from "../../../components/LoginCodeEmail.tsx";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

async function sendEmail(to: string, subject: string, html: string) {
  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not set.");
    throw new Error("Server configuration error: Missing email API key.");
  }
  const resend = new Resend(resendApiKey);
  await resend.emails.send({
    from: "onboarding@resend.dev",
    to,
    subject,
    html,
  });
}

export const handler: Handlers = {
  async POST(req) {
    try {
      const { email } = await req.json();
      if (!email) {
        return new Response(JSON.stringify({ error: "Email is required." }), { status: 400 });
      }
      const normalizedEmail = email.toLowerCase();

      const user = await findUserByEmail(normalizedEmail);
      if (!user) {
        return new Response(JSON.stringify({ error: "User not found." }), { status: 404 });
      }

      const url = new URL(req.url);
      const typedUser = user as { _id: { toString(): string } };
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      const { token, code } = await createVerificationToken(typedUser._id.toString(), expiresAt);
      const verificationUrl = `${url.origin}/auth/verify?token=${token}`;

      await sendEmail(
        normalizedEmail,
        "Your StremioHub Sign-In Code",
        render(LoginCodeEmail({ code, verificationUrl })),
      );

      const redirectUrl = `/auth/code?email=${encodeURIComponent(normalizedEmail)}`;
      return new Response(JSON.stringify({ redirectUrl }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Send login code error:", error);
      return new Response(JSON.stringify({ error: "Failed to send login code." }), { status: 500 });
    }
  },
};
