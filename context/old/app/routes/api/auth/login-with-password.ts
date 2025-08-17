import { Handlers } from "$fresh/server.ts";
import { setCookie } from "$std/http/cookie.ts";
import { comparePassword, createSession, findUserByEmail } from "../../../utils/db.ts";

export const handler: Handlers = {
  async POST(req) {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email and password are required." }), { status: 400 });
    }

    const normalizedEmail = email.toLowerCase();
    const user = await findUserByEmail(normalizedEmail) as { _id: string; password?: string };
    if (!user || !user.password) {
      return new Response(JSON.stringify({ error: "Invalid credentials." }), { status: 401 });
    }

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) {
      return new Response(JSON.stringify({ error: "Invalid credentials." }), { status: 401 });
    }

    const sessionExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const sessionId = await createSession(user._id.toString(), sessionExpires);

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
    return new Response(JSON.stringify({ message: "Login successful" }), {
      status: 200,
      headers,
    });
  },
};
