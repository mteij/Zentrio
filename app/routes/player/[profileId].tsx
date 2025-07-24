import { Handlers, PageProps } from "$fresh/server.ts";
import { h as _h } from "preact";
import { AppState } from "../_middleware.ts";
import { getProfile, getDecryptedProfilePassword, getUserTmdbApiKey, getUserAddonManagerSetting, getUserHideCalendarButtonSetting, ProfileSchema } from "../../utils/db.ts";
import StremioFrame from "../../islands/StremioFrame.tsx";

interface PlayerPageData {
  profile: {
    _id: string;
    userId: string;
    name: string;
    email: string;
    password: string;
    profilePictureUrl: string;
    nsfwMode?: boolean;
    tmdbApiKey?: string;
    addonManagerEnabled?: boolean;
    hideCalendarButton?: boolean;
  };
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

    try {
      // Decrypt the password on the server side before sending to client
      const decryptedPassword = await getDecryptedProfilePassword(profile);
      
      // Get the user's TMDB API key
      const tmdbApiKey = await getUserTmdbApiKey(userId);
      
      // Get the user's addon manager setting
      const addonManagerEnabled = await getUserAddonManagerSetting(userId);
      
      // Get the user's hide calendar button setting
      const hideCalendarButton = await getUserHideCalendarButtonSetting(userId);
      
      // Create a profile object with decrypted password and TMDB key for the client
      const clientProfile = {
        _id: profile._id.toString(),
        userId: profile.userId.toString(),
        name: profile.name,
        email: profile.email,
        password: decryptedPassword,
        profilePictureUrl: profile.profilePictureUrl,
        nsfwMode: profile.nsfwMode,
        tmdbApiKey: tmdbApiKey || undefined,
        addonManagerEnabled,
        hideCalendarButton,
      };

      return ctx.render({ profile: clientProfile });
    } catch (error) {
      console.error(`Failed to decrypt password for profile ${profile._id}:`, error);
      return new Response("Failed to authenticate with profile.", {
        status: 500,
      });
    }
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
