import { Handlers } from "$fresh/server.ts";
import { Resend } from "https://esm.sh/resend@3.2.0";
import { render } from "https://esm.sh/preact-render-to-string@6.2.1";
import { createUserWithPassword, findUserByEmail } from "../../../utils/db.ts";
import { WelcomeEmail } from "../../../components/WelcomeEmail.tsx";

export const handler: Handlers = {
  async POST(req) {
    const { email } = await req.json();
    if (!email) {
      return new Response("Email is required.", { status: 400 });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return new Response("User already exists.", { status: 409 });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY is not set.");
      return new Response("Server configuration error.", { status: 500 });
    }

    try {
      const { plainPassword } = await createUserWithPassword(email);
      const url = new URL(req.url);
      const loginUrl = `${url.origin}/login`;

      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: "onboarding@resend.dev",
        to: email,
        subject: "Welcome to Zentrio!",
        html: render(WelcomeEmail({ email, password: plainPassword, loginUrl })),
      });

      return new Response(JSON.stringify({ message: "Signup successful. Please check your email for your password." }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Signup error:", error);
      return new Response("Failed to create user.", { status: 500 });
    }
  },
};
