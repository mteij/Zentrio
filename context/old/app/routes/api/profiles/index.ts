import { Handlers } from "$fresh/server.ts";
import { Types } from "mongoose";
import { AppState } from "../../_middleware.ts";
import { createEncryptedProfile, ProfileSchema } from "../../../utils/db.ts";

export const handler: Handlers<ProfileSchema | null, AppState> = {
  async POST(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { name, email, password, nsfwMode, profilePictureUrl } = await req.json();
    if (!name || !email || !password) {
      return new Response("Missing required fields", { status: 400 });
    }

    const profileData = {
      userId: new Types.ObjectId(userId),
      name,
      email,
      password, // Will be encrypted by createEncryptedProfile
      nsfwMode: nsfwMode || false,
      profilePictureUrl: profilePictureUrl || `https://api.dicebear.com/9.x/initials/svg?seed=${
        encodeURIComponent(name)
      }`,
    };

    const newProfile = await createEncryptedProfile(profileData);
    return new Response(JSON.stringify(newProfile), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  },
};
