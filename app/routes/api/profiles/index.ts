import { Handlers } from "$fresh/server.ts";
import { ObjectId } from "mongodb";
import { AppState } from "../../_middleware.ts";
import { createProfile, ProfileSchema } from "../../../utils/db.ts";

export const handler: Handlers<ProfileSchema | null, AppState> = {
  async POST(req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { name, email, password } = await req.json();
    if (!name || !email || !password) {
      return new Response("Missing required fields", { status: 400 });
    }

    const profileData: Omit<ProfileSchema, "_id"> = {
      userId: new ObjectId(userId),
      name,
      email,
      password, // In a real app, this should be encrypted
      profilePictureUrl: `https://api.dicebear.com/9.x/initials/svg?seed=${
        encodeURIComponent(name)
      }`,
    };

    const newProfile = await createProfile(profileData);
    return new Response(JSON.stringify(newProfile), {
      headers: { "Content-Type": "application/json" },
    });
  },
};
