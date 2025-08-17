import { Handlers } from "$fresh/server.ts";
import { findUserByPasswordResetToken, updateUserPassword } from "../../../utils/db.ts";
import { withErrorHandling, parseJsonBody, createJsonResponse } from "../../../shared/utils/api.ts";

export const handler: Handlers = {
  POST: withErrorHandling(async (req) => {
    const { token, password } = await parseJsonBody<{ token: string; password: string }>(req);
    
    if (!token || !password) {
      return createJsonResponse({ error: "Token and new password are required." }, 400);
    }

    if (password.length < 8) {
      return createJsonResponse({ error: "Password must be at least 8 characters long." }, 400);
    }

    const user = await findUserByPasswordResetToken(token);
    if (!user) {
      return createJsonResponse({ error: "Invalid or expired token." }, 400);
    }

    try {
      const typedUser = user as { _id: { toString(): string } };
      await updateUserPassword(typedUser._id.toString(), password);
      console.log(`Password reset successfully for user: ${user.email}`);
    } catch (error) {
      console.error("Error resetting password:", error);
      return createJsonResponse({ error: "Failed to reset password." }, 500);
    }

    return createJsonResponse({ message: "Password has been reset successfully." });
  }),
};
