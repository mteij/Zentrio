import { Handlers } from "$fresh/server.ts";
import { createUserWithGeneratedPassword, findUserByEmail } from "../../../utils/db.ts";
import { withErrorHandling, parseJsonBody, createJsonResponse, validateEmail } from "../../../shared/utils/api.ts";
import { EmailService } from "../../../shared/services/email.ts";

/**
 * Handles login or signup flow based on whether user exists
 * - If user exists: redirects to password login
 * - If user doesn't exist: creates account with generated password and sends welcome email
 */
export const handler: Handlers = {
  POST: withErrorHandling(async (req) => {
    const { email } = await parseJsonBody<{ email: string }>(req);
    const normalizedEmail = validateEmail(email);

    const user = await findUserByEmail(normalizedEmail);
    let redirectUrl: string;

    if (user) {
      // Existing user - redirect to password login
      redirectUrl = `/auth/password?email=${encodeURIComponent(normalizedEmail)}`;
    } else {
      // New user - create account and send welcome email
      const { plainPassword } = await createUserWithGeneratedPassword(normalizedEmail);

      const emailService = new EmailService();
      await emailService.sendWelcomeEmail(normalizedEmail, plainPassword);
      
      redirectUrl = `/auth/signup-success?email=${encodeURIComponent(normalizedEmail)}`;
    }

    return createJsonResponse({ redirectUrl });
  }),
};
