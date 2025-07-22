import { Handlers, PageProps } from "$fresh/server.ts";
import { AppState } from "./_middleware.ts";
import { getProfilesByUser, ProfileSchema } from "../utils/db.ts";
import ProfileManager from "../islands/ProfileManager.tsx";

interface ProfilePageData {
  profiles: ProfileSchema[];
}

export const handler: Handlers<ProfilePageData, AppState> = {
  async GET(_req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("", {
        status: 307,
        headers: { Location: "/login" },
      });
    }

    const profiles = await getProfilesByUser(userId);
    return ctx.render({ profiles });
  },
};

export default function ProfilesPage({ data }: PageProps<ProfilePageData>) {
  return (
    <div class="flex-grow flex flex-col items-center justify-center p-8">
      <h1 class="text-5xl font-bold mb-8">Who's watching?</h1>
      <ProfileManager initialProfiles={data.profiles} />
      <div class="mt-8">
        <a
          href="/logout"
          class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-lg"
        >
          Logout
        </a>
      </div>
    </div>
  );
}

