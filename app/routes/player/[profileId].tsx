import { Handlers, PageProps } from "$fresh/server.ts";
import { h } from "preact";
import { AppState } from "../_middleware.ts";
import { getProfile, ProfileSchema } from "../../utils/db.ts";
import StremioFrame from "../../islands/StremioFrame.tsx";

interface PlayerPageData {
  profile: ProfileSchema;
}

export const handler: Handlers<PlayerPageData, AppState> = {
  async GET(_req, ctx) {
    const { userId } = ctx.state;
    if (!userId) {
      return new Response("", {
        status: 307,
        headers: { Location: "/login" },
      });
    }

    const profile = await getProfile(ctx.params.profileId);
    if (
      !profile ||
      String(profile.userId) !== userId
    ) {
      return new Response("Profile not found or access denied.", {
        status: 404,
      });
    }

    return ctx.render({ profile });
  },
};

export default function PlayerPage({ data }: PageProps<PlayerPageData>) {
  return (
    <div class="flex-grow flex flex-col h-full">
      <header class="bg-gray-800 p-3 flex items-center justify-between shadow-lg z-10">
        <a href="/profiles" class="flex items-center text-gray-300 hover:text-white">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Profiles
        </a>
        <div class="flex items-center space-x-4">
          <img src={data.profile.profilePictureUrl} alt="Profile Picture" class="rounded-full w-8 h-8 object-cover" />
          <span class="font-bold text-white">{data.profile.name}</span>
        </div>
      </header>
      <main class="flex-grow bg-black">
        <StremioFrame profile={data.profile} />
      </main>
    </div>
  );
}
