import { Handlers } from "$fresh/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";
import { render } from "https://esm.sh/preact-render-to-string@6.2.1";
import {
  createUserWithGeneratedPassword,
  findUserByEmail,
} from "../../../utils/db.ts";
import { SignupEmail } from "../../../components/SignupEmail.tsx";

const resendApiKey = Deno.env.get("RESEND_API_KEY");

async function sendEmail(
  to: string,
  subject: string,
  html: string,
) {
  if (!resendApiKey) {
    console.error("RESEND_API_KEY is not set.");
    throw new Error("Server configuration error: Missing email API key.");
  }
  const resend = new Resend(resendApiKey);
  await resend.emails.send({
    from: "onboarding@resend.dev", // Must be a verified domain in Resend
    to,
    subject,
    html,
  });
}

export const handler: Handlers = {
  async POST(req) {
    try {
      const { email } = await req.json();
      if (!email || typeof email !== "string") {
        return new Response(JSON.stringify({ error: "Invalid email provided." }), { status: 400 });
      }
      const normalizedEmail = email.toLowerCase();

      const url = new URL(req.url);
      const user = await findUserByEmail(normalizedEmail);
      let redirectUrl: string;

      if (user) {
        // --- Login Flow ---
        redirectUrl = `/auth/password?email=${encodeURIComponent(normalizedEmail)}`;
      } else {
        // --- Signup Flow ---
        const { plainPassword } = await createUserWithGeneratedPassword(normalizedEmail);

        await sendEmail(
          normalizedEmail,
          "Welcome to StremioHub!",
          render(SignupEmail({ email: normalizedEmail, password: plainPassword })),
        );
        redirectUrl = `/auth/signup-success?email=${encodeURIComponent(normalizedEmail)}`;
      }

      return new Response(JSON.stringify({ redirectUrl }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error: unknown) {
      console.error("Login/Signup Error:", error);
      const message = error instanceof Error ? error.message : "An internal server error occurred.";
      return new Response(JSON.stringify({ error: message }), { status: 500 });
    }
  },
};
