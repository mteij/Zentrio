import { h as _h } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { ProfileSchema } from "../utils/db.ts";

interface StremioFrameProps {
  profile: ProfileSchema;
}

// Generates a 20-character hex string, matching Stremio's installation_id format.
const generateInstallationId = () => {
  const randomBytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export default function StremioFrame({ profile }: StremioFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isLoading = useSignal(true);
  const statusMessage = useSignal("Initializing...");

  useEffect(() => {
    const loginAndLoad = async () => {
      try {
        statusMessage.value = `Logging in as ${profile.name}...`;
        const loginRes = await fetch("/stremio/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "Login",
            email: profile.email,
            password: profile.password,
            facebook: false,
          }),
        });

        if (!loginRes.ok) {
          let errorMessage = `Login failed with status: ${loginRes.status}`;
          try {
            const errorData = await loginRes.json();
            if (errorData && errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (_e) {
            // Ignore if JSON parsing fails
          }
          throw new Error(errorMessage);
        }

        const loginData = await loginRes.json();
        const result = loginData?.result;

        if (!result || !result.authKey || !result.user?._id) {
          throw new Error("Login successful, but key data is missing.");
        }

        // Construct a comprehensive session object with all required keys and structures.
        const sessionObject = {
          profile: {
            auth: {
              key: result.authKey,
              user: result.user,
            },
            addons: result.addons || [],
            addonsLocked: false,
            settings: result.settings || {
              interfaceLanguage: "eng",
              hideSpoilers: false,
              streamingServerUrl: "http://127.0.0.1:11470/",
              playerType: null,
              bingeWatching: true,
              playInBackground: true,
              hardwareDecoding: true,
              frameRateMatchingStrategy: "FrameRateOnly",
              nextVideoNotificationDuration: 35000,
              audioPassthrough: false,
              audioLanguage: "eng",
              secondaryAudioLanguage: null,
              subtitlesLanguage: "eng",
              secondarySubtitlesLanguage: null,
              subtitlesSize: 100,
              subtitlesFont: "Roboto",
              subtitlesBold: false,
              subtitlesOffset: 5,
              subtitlesTextColor: "#FFFFFFFF",
              subtitlesBackgroundColor: "#00000000",
              subtitlesOutlineColor: "#000000",
              subtitlesOpacity: 100,
              escExitFullscreen: true,
              seekTimeDuration: 10000,
              seekShortTimeDuration: 3000,
              pauseOnMinimize: false,
              quitOnClose: true,
              surroundSound: false,
              streamingServerWarningDismissed: null,
              serverInForeground: false,
              sendCrashReports: true,
            },
          },
          installation_id: result.installation_id || generateInstallationId(),
          schema_version: result.schema_version || 18,
          library: result.library || { uid: result.user._id, items: {} },
          library_recent: result.library_recent || { uid: result.user._id, items: {} },
          notifications: result.notifications || { uid: result.user._id, items: {}, lastUpdated: null, created: new Date().toISOString() },
          search_history: result.search_history || { uid: result.user._id, items: {} },
          streaming_server_urls: result.streaming_server_urls || { uid: result.user._id, items: { "http://127.0.0.1:11470/": new Date().toISOString() } },
          streams: result.streams || { uid: result.user._id, items: [] },
        };

        // The cookie is set via HTTP headers from the proxy.
        // Now, load the iframe, passing the entire stringified session object
        // for the proxy to inject into localStorage.
        statusMessage.value = "Loading Stremio...";
        const iframe = iframeRef.current;
        if (iframe) {
          iframe.onload = () => {
            isLoading.value = false;
            statusMessage.value = "Loaded!";
          };
          // The proxy will intercept this URL, use the sessionData, and serve the final HTML.
          const sessionData = encodeURIComponent(JSON.stringify(sessionObject));
          iframe.src = `/stremio/?sessionData=${sessionData}`;
        }
      } catch (error) {
        console.error("Auto-login failed:", error);
        statusMessage.value = `Error: ${error instanceof Error ? error.message : String(error)}. Please check credentials.`;
      }
    };

    loginAndLoad();
  }, [profile]);

  return (
    <div class="w-full h-full relative">
      {isLoading.value && (
        <div class="absolute inset-0 bg-black flex flex-col items-center justify-center z-10">
          <div class="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-red-600">
          </div>
          <p class="mt-4 text-lg text-gray-300">{statusMessage.value}</p>
        </div>
      )}
      <iframe
        ref={iframeRef}
        class={`w-full h-full border-none ${isLoading.value ? "hidden" : ""}`}
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      >
      </iframe>
    </div>
  );
}
