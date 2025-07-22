import { Handlers } from "$fresh/server.ts";
import { findUserByPasswordResetToken, updateUserPassword } from "../../../utils/db.ts";

export const handler: Handlers = {
  async POST(req) {
    const { token, password } = await req.json();
    if (!token || !password) {
      return new Response("Token and new password are required.", { status: 400 });
    }

    const user = await findUserByPasswordResetToken(token);
    if (!user) {
      return new Response("Invalid or expired token.", { status: 400 });
    }

    if (typeof user._id !== "string") {
      return new Response("User ID is invalid.", { status: 400 });
    }
    await updateUserPassword(user._id, password);

    return new Response(JSON.stringify({ message: "Password has been reset successfully." }), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
