import { Handlers } from "$fresh/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";
import { render } from "https://esm.sh/preact-render-to-string@6.2.1";
import { createPasswordResetTokenForUser, findUserByEmail } from "../../../utils/db.ts";
import { ResetPasswordEmail } from "../../../components/ResetPasswordEmail.tsx";

export const handler: Handlers = {
  async POST(req) {
    const { email } = await req.json();
    if (!email) {
      return new Response("Email is required.", { status: 400 });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      // Don't reveal if user exists, just send success response
      return new Response(JSON.stringify({ message: "If a user with that email exists, a reset link has been sent." }));
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response("Server configuration error.", { status: 500 });
    }

    try {
      const token = await createPasswordResetTokenForUser(String(user._id));
      const url = new URL(req.url);
      const resetUrl = `${url.origin}/auth/reset?token=${token}`;

      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: email,
        subject: "Reset Your Zentrio Password",
        html: render(ResetPasswordEmail({ resetUrl })),
      });

      return new Response(JSON.stringify({ message: "If a user with that email exists, a reset link has been sent." }));
    } catch (error) {
      console.error("Password reset request error:", error);
      return new Response("Failed to send reset link.", { status: 500 });
    }
  },
};
