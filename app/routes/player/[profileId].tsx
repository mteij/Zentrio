import { Handlers, PageProps } from "$fresh/server.ts";
import { h as _h } from "preact";
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
      <main class="flex-grow bg-black">
        <StremioFrame profile={data.profile} />
      </main>
    </div>
  );
}
