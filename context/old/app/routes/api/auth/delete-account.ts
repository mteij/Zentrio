import { Handlers } from "$fresh/server.ts";
import {
  getUserById,
  comparePassword,
  deleteUser,
  invalidateAllUserSessions,
} from "../../../utils/db.ts";
import {
  withErrorHandling,
  parseJsonBody,
  createJsonResponse,
  ApiError,
} from "../../../shared/utils/api.ts";
import { AppState } from "../../_middleware.ts";

export const handler: Handlers<null, AppState> = {
  POST: withErrorHandling(async (req, ctx) => {
    const { userId } = ctx.state;
    if (!userId) {
      throw new ApiError("Unauthorized", 401);
    }

    const { password } = await parseJsonBody<{ password?: string }>(req);
    if (!password) {
      throw new ApiError("Password confirmation is required", 400);
    }

    const user = await getUserById(userId);
    if (!user || !user.password) {
      throw new ApiError("User not found or password not set", 404);
    }

    const isPasswordCorrect = await comparePassword(password, user.password);
    if (!isPasswordCorrect) {
      throw new ApiError("Incorrect password", 401);
    }

    // Invalidate all sessions before deleting the user
    await invalidateAllUserSessions(userId);

    // Delete the user and all associated data (profiles, etc.)
    await deleteUser(userId);

    return createJsonResponse({ message: "Account deleted successfully." });
  }),
};