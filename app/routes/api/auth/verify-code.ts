import { Handlers } from "$fresh/server.ts";
import { setCookie } from "$std/http/cookie.ts";
import {
  createSession,
  deleteVerificationToken,
  findOrCreateUserByEmail,
  VerificationTokens,
} from "../../../utils/db.ts";

export const handler: Handlers = {
  async POST(req) {
    const { email, code } = await req.json();

    if (!email || !code || code.length !== 6) {
      return new Response("Invalid email or code provided.", { status: 400 });
    }

    const user = await findOrCreateUserByEmail(email);
    if (!user) {
      return new Response("User not found.", { status: 400 });
    }

    const verificationToken = await VerificationTokens.findOne({
      userId: user._id,
      code: code,
      expiresAt: { $gt: new Date() },
    });

    if (!verificationToken) {
      return new Response("Invalid or expired code.", { status: 400 });
    }

    // Token is valid, create a session
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const sessionId = await createSession(
      verificationToken.userId.toString(),
      sessionExpires,
    );

    await deleteVerificationToken((verificationToken._id as { toHexString: () => string }).toHexString());

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

    headers.set("Location", "/profiles");
    return new Response(null, {
      status: 200,
      headers,
    });
  },
};
