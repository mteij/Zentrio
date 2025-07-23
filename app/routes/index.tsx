import { Handlers, PageProps } from "$fresh/server.ts";
import { AppState } from "./_middleware.ts";

export const handler: Handlers<null, AppState> = {
  GET(_req, ctx) {
    const { userId } = ctx.state;
    
    if (!userId) {
      // Not logged in, redirect to login
      const headers = new Headers();
      headers.set("location", "/login");
      return new Response(null, {
        status: 307,
        headers,
      });
    }

    // User is logged in, show auto-login logic page
    return ctx.render(null);
  },
};

export default function IndexPage() {
  return (
    <div class="min-h-screen bg-black flex items-center justify-center">
      <div class="text-white text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
        <p>Loading...</p>
      </div>
      <script dangerouslySetInnerHTML={{
        __html: `
          (function() {
            const autoLogin = localStorage.getItem('autoLogin') || 'none';
            const lastProfileId = localStorage.getItem('lastProfileId');
            const autoLoginProfileId = localStorage.getItem('autoLoginProfileId');
            
            if (autoLogin === 'last' && lastProfileId) {
              window.location.href = '/player/' + lastProfileId;
            } else if (autoLogin === 'profile' && autoLoginProfileId) {
              localStorage.setItem('lastProfileId', autoLoginProfileId);
              window.location.href = '/player/' + autoLoginProfileId;
            } else {
              window.location.href = '/profiles';
            }
          })();
        `
      }} />
    </div>
  );
}