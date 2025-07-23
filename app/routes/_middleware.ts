import { FreshContext } from "$fresh/server.ts";
import { getCookies } from "$std/http/cookie.ts";
import { getSession } from "../utils/db.ts";

export interface AppState {
  userId: string | null;
}

export async function handler(
  req: Request,
  ctx: FreshContext<AppState>,
) {
  const { sessionId } = getCookies(req.headers);
  ctx.state.userId = null;

  if (sessionId) {
    const session = await getSession(sessionId);
    if (session && new Date() < session.expiresAt) {
      ctx.state.userId = session.userId.toString();
    }
  }

  const response = await ctx.next();
  return response;
}