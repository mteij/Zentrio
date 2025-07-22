import { Handlers } from "$fresh/server.ts";
import { setCookie } from "$std/http/cookie.ts";
import {
  createSession,
  deleteVerificationToken,
  findUserByEmail,
  VerificationTokens,
} from "../../../utils/db.ts";

export const handler: Handlers = {
  async POST(req) {
    const { email, code } = await req.json();

    if (!email || !code || code.length !== 6) {
      return new Response(JSON.stringify({ error: "Invalid email or code provided." }), { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();
    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found for this email." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const verificationToken = await VerificationTokens.findOne({
      userId: user._id,
      code: code,
      expiresAt: { $gt: new Date() },
    }) as { _id: { toHexString: () => string }, userId: string, code: string, expiresAt: Date } | null;

    if (!verificationToken) {
      return new Response(JSON.stringify({ error: "Invalid or expired code." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Token is valid, create a session
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const sessionId = await createSession(
      verificationToken.userId.toString(),
      sessionExpires,
    );

    await deleteVerificationToken(verificationToken._id.toHexString());

    const headers = new Headers();
    setCookie(headers, {
      name: "sessionId",
      value: sessionId,
      expires: sessionExpires,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: new URL(req.url).protocol === "https:",
    });

    headers.set("Content-Type", "application/json");
    return new Response(
      JSON.stringify({ message: "Verification successful" }),
      {
        status: 200,
        headers,
      },
    );
  },
};
