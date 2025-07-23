import { Handlers } from "$fresh/server.ts";
import { createVerificationToken, findUserByEmail } from "../../../utils/db.ts";
import { EmailService } from "../../../shared/services/email.ts";
import { withErrorHandling, parseJsonBody, createJsonResponse, validateEmail } from "../../../shared/utils/api.ts";
import { rateLimiter } from "../../../shared/services/rateLimiter.ts";

export const handler: Handlers = {
  POST: withErrorHandling(async (req) => {
    // Check rate limit first
    const rateLimitResponse = rateLimiter.checkRateLimit('login')(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { email } = await parseJsonBody<{ email: string }>(req);
    const normalizedEmail = validateEmail(email);

    const user = await findUserByEmail(normalizedEmail);
    if (!user) {
      return createJsonResponse({ error: "User not found." }, 404);
    }

    const url = new URL(req.url);
    const typedUser = user as { _id: { toString(): string } };
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    const { token, code } = await createVerificationToken(typedUser._id.toString(), expiresAt);
    const verificationUrl = `${url.origin}/auth/verify?token=${token}`;

    try {
      const emailService = new EmailService();
      await emailService.sendLoginCode(normalizedEmail, code, verificationUrl);
      console.log(`Login code email sent successfully to ${normalizedEmail}`);
    } catch (emailError) {
      console.error(`Failed to send login code email to ${normalizedEmail}:`, emailError);
      return createJsonResponse({ error: "Failed to send login code. Please try again." }, 500);
    }

    // Record successful operation
    rateLimiter.recordSuccess(req, 'login');

    const redirectUrl = `/auth/code?email=${encodeURIComponent(normalizedEmail)}`;
    return createJsonResponse({ redirectUrl });
  }),
};
