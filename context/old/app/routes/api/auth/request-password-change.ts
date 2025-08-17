import { Handlers } from "$fresh/server.ts";
import { createPasswordResetTokenForUser, getUserById } from "../../../utils/db.ts";
import { withErrorHandling, createJsonResponse } from "../../../shared/utils/api.ts";
import { EmailService } from "../../../shared/services/email.ts";
import { AppState } from "../../_middleware.ts";

export const handler: Handlers<null, AppState> = {
  POST: withErrorHandling(async (req, ctx) => {
    const { userId } = ctx.state;

    if (!userId) {
      return createJsonResponse({ error: "Unauthorized" }, 401);
    }

    const user = await getUserById(userId);
    const successMessage = "If a user with that email exists, a reset link has been sent.";

    if (!user) {
      // This case should be rare if userId from session is valid
      return createJsonResponse({ message: successMessage });
    }

    try {
      const token = await createPasswordResetTokenForUser(String(user._id));
      const url = new URL(req.url);
      const resetUrl = `${url.origin}/auth/reset?token=${token}`;

      const emailService = new EmailService();
      await emailService.sendPasswordReset(user.email, resetUrl);

      return createJsonResponse({ message: "A password reset link has been sent to your email." });
    } catch (error) {
      console.error("Password change request error:", error);
      throw new Error("Failed to send reset link");
    }
  }),
};