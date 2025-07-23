import { Handlers } from "$fresh/server.ts";
import { withErrorHandling, parseJsonBody, createJsonResponse } from "../../../shared/utils/api.ts";
import { findUserByEmail, updateUserPassword, comparePassword } from "../../../utils/db.ts";
import { rateLimiter } from "../../../shared/services/rateLimiter.ts";
import { getCookies } from "$std/http/cookie.ts";

export const handler: Handlers = {
  POST: withErrorHandling(async (req) => {
    // Check rate limit
    const rateLimitResponse = rateLimiter.checkRateLimit('password-change')(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Get user from session cookie
    const cookies = getCookies(req.headers);
    const sessionCookie = cookies.session;
    if (!sessionCookie) {
      return createJsonResponse({ error: "Not authenticated" }, 401);
    }

    // Parse session data to get user email
    let userEmail: string;
    try {
      const sessionData = JSON.parse(atob(sessionCookie));
      userEmail = sessionData.email;
      if (!userEmail) {
        throw new Error("No email in session");
      }
    } catch {
      return createJsonResponse({ error: "Invalid session" }, 401);
    }

    const { currentPassword, newPassword } = await parseJsonBody<{
      currentPassword: string;
      newPassword: string;
    }>(req);

    // Validate inputs
    if (!currentPassword || !newPassword) {
      return createJsonResponse({ error: "Current password and new password are required" }, 400);
    }

    if (newPassword.length < 8) {
      return createJsonResponse({ error: "New password must be at least 8 characters long" }, 400);
    }

    // Find user and verify current password
    const user = await findUserByEmail(userEmail);
    if (!user) {
      return createJsonResponse({ error: "User not found" }, 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await comparePassword(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return createJsonResponse({ error: "Current password is incorrect" }, 400);
    }

    // Update password
    try {
      const typedUser = user as { _id: { toString(): string } };
      await updateUserPassword(typedUser._id.toString(), newPassword);
      console.log(`Password updated successfully for user: ${userEmail}`);
    } catch (error) {
      console.error("Error updating password:", error);
      return createJsonResponse({ error: "Failed to update password" }, 500);
    }

    // Record successful operation
    rateLimiter.recordSuccess(req, 'password-change');

    return createJsonResponse({ success: true, message: "Password updated successfully" });
  }),
};