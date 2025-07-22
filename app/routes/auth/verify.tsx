import { Handlers } from "$fresh/server.ts";
import { setCookie } from "$std/http/cookie.ts";
import {
  createSession,
  deleteVerificationToken,
  getVerificationToken,
} from "../../utils/db.ts";

export const handler: Handlers = {
  async GET(req, _ctx) {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response("Missing verification token.", { status: 400 });
    }

    const verificationToken = await getVerificationToken(token);
    if (!verificationToken || verificationToken.expiresAt < new Date()) {
      return new Response("Invalid or expired token.", { status: 400 });
    }

    // Token is valid, create a session
    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const sessionId = await createSession(
      verificationToken.userId.toHexString(),
      sessionExpires,
    );

    await deleteVerificationToken(token);

    const headers = new Headers();
    setCookie(headers, {
      name: "sessionId",
      value: sessionId,
      expires: sessionExpires,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: url.protocol === "https:",
    });

    headers.set("location", "/profiles");
    return new Response(null, {
      status: 303, // See Other, for redirecting after POST/GET
      headers,
    });
  },
};
