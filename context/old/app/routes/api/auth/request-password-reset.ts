import { Handlers } from "$fresh/server.ts";
import { createPasswordResetTokenForUser, findUserByEmail } from "../../../utils/db.ts";
import { withErrorHandling, parseJsonBody, createJsonResponse, validateEmail } from "../../../shared/utils/api.ts";
import { EmailService } from "../../../shared/services/email.ts";

export const handler: Handlers = {
  POST: withErrorHandling(async (req) => {
    const { email } = await parseJsonBody<{ email: string }>(req);
    const normalizedEmail = validateEmail(email);

    const user = await findUserByEmail(normalizedEmail);
    const successMessage = "If a user with that email exists, a reset link has been sent.";

    if (!user) {
      return createJsonResponse({ message: successMessage });
    }

    try {
      const token = await createPasswordResetTokenForUser(String(user._id));
      const url = new URL(req.url);
      const resetUrl = `${url.origin}/auth/reset?token=${token}`;

      const emailService = new EmailService();
      await emailService.sendPasswordReset(normalizedEmail, resetUrl);

      return createJsonResponse({ message: successMessage });
    } catch (error) {
      console.error("Password reset request error:", error);
      throw new Error("Failed to send reset link");
    }
  }),
};
