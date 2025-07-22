import { Handlers } from "$fresh/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";
import {
  createVerificationToken,
  findOrCreateUserByEmail,
} from "../../../utils/db.ts";
import { EmailTemplate } from "../../../components/EmailTemplate.tsx";
import { render } from "https://esm.sh/preact-render-to-string@6.2.1";

export const handler: Handlers = {
  async POST(req) {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return new Response("Invalid email provided.", { status: 400 });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not set.");
      return new Response("Server configuration error.", { status: 500 });
    }

    try {
      const user = await findOrCreateUserByEmail(email);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      if (!user._id || (typeof user._id !== "string" && typeof user._id !== "number")) {
        throw new Error("User _id is missing or of invalid type.");
      }
      const { token, code } = await createVerificationToken(
        user._id.toString(),
        expiresAt,
      );

      const url = new URL(req.url);
      const verificationUrl = `${url.origin}/auth/verify?token=${token}`;

      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: "onboarding@resend.dev", // Must be a verified domain in Resend
        to: email,
        subject: "Your StremioHub Sign-In Code",
        html: render(
          EmailTemplate({ code, verificationUrl }),
        ),
      });

      const redirectUrl = `/auth/code?email=${encodeURIComponent(email)}`;
      return new Response(JSON.stringify({ redirectUrl }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Failed to send email:", error);
      return new Response("Failed to send sign-in link.", { status: 500 });
    }
  },
};
