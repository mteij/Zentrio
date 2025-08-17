import { Handlers } from "$fresh/server.ts";
import { AppState } from "../../_middleware.ts";
import { deleteProfile, updateEncryptedProfile } from "../../../utils/db.ts";

export const handler: Handlers<null, AppState> = {
  async PATCH(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { id } = ctx.params;
    const { name, email, password, profilePictureUrl, nsfwMode, ageRating } = await req.json();

    await updateEncryptedProfile(id, userId, {
      name,
      email,
      password,
      profilePictureUrl,
      nsfwMode,
      ageRating,
    });
    return new Response(null, { status: 204 });
  },

  async DELETE(_req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const { id } = ctx.params;
    await deleteProfile(id, userId);
    return new Response(null, { status: 204 });
  },
};
