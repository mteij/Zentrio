import { Handlers, PageProps } from "$fresh/server.ts";
import { AppState } from "./_middleware.ts";
import { getProfilesByUser, ProfileSchema, ObjectId as _ObjectId } from "../utils/db.ts";
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
    <div class="flex-grow flex flex-col items-center justify-center p-4 sm:p-8 min-h-screen bg-black">
      <div class="w-full max-w-2xl min-w-[320px] bg-black bg-opacity-75 p-6 sm:p-8 rounded-lg animate-profilecard-in">
        <h1 class="text-2xl sm:text-5xl font-bold mb-8 text-center">Who's watching?</h1>
        <ProfileManager initialProfiles={data.profiles} />
        <div class="mt-8 flex justify-center">
          <a
            href="/logout"
            class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-lg transition-all duration-200"
          >
            Logout
          </a>
        </div>
      </div>
      <style>
        {`
          @keyframes profilecard-in {
            0% { opacity: 0; transform: scale(0.97);}
            100% { opacity: 1; transform: scale(1);}
          }
          .animate-profilecard-in {
            animation: profilecard-in 0.5s cubic-bezier(.4,2,.6,1);
          }
        `}
      </style>
    </div>
  );
}
