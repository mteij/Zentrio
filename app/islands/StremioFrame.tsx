import { h as _h } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";

interface StremioFrameProps {
  profile: {
    _id: string;
    userId: string;
    name: string;
    email: string;
    password: string;
    profilePictureUrl: string;
    nsfwMode?: boolean;
    ageRating?: number;
    tmdbApiKey?: string;
    addonManagerEnabled?: boolean;
    hideCalendarButton?: boolean;
    hideAddonsButton?: boolean;
  };
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

  // Function to reload the iframe with the same session data
  const reloadIframe = () => {
    const iframe = iframeRef.current;
    if (iframe) {
      // Store the current src to preserve session data
      const currentSrc = iframe.src;
      // Reset loading state
      isLoading.value = true;
      statusMessage.value = "Reloading Stremio...";
      // Reload the iframe by setting its src to itself
      iframe.src = currentSrc;
    }
  };

  // Listen for messages from the iframe to reload it
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify the message is from the same origin
      if (event.origin !== globalThis.location.origin) return;
      
      // Check if it's our reload message
      if (event.data && event.data.type === 'reload-stremio-iframe') {
        reloadIframe();
      }
    };

    // Add event listener
    globalThis.addEventListener('message', handleMessage);

    // Cleanup
    return () => {
      globalThis.removeEventListener('message', handleMessage);
    };
  }, []);


  useEffect(() => {
    const loginAndLoad = async () => {
      try {
        // Set last profile ID on load
        localStorage.setItem("lastProfileId", profile._id);
        
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

        // If result is falsy, treat as login failure
        if (!result) {
          throw new Error("Login failed: No result returned from server.");
        }
        if (!result.authKey || !result.user?._id) {
          throw new Error("Login failed: Missing authentication data. Please check your credentials.");
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
          profilePictureUrl: profile.profilePictureUrl,
          nsfwModeEnabled: profile.nsfwMode || false,
          ageRating: profile.ageRating || 0,
          addonManagerEnabled: profile.addonManagerEnabled || false,
          hideCalendarButton: profile.hideCalendarButton || false,
          hideAddonsButton: profile.hideAddonsButton || false,
          tmdbApiKey: profile.tmdbApiKey || null,
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

            // Inject a script to handle logout and redirect
            const script = document.createElement("script");
            script.textContent = `
              const logoutObserver = new MutationObserver((mutations, obs) => {
                const backLink = document.querySelector('a[href="#"]');
                if (backLink && backLink.querySelector('img[src*="dicebear.com"]')) {
                  backLink.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    try {
                      await fetch('/stremio/api/logout', { method: 'POST' });
                    } catch (error) {
                      console.error('Failed to logout from Stremio:', error);
                    } finally {
                      window.top.location.href = '/profiles';
                    }
                  };
                  obs.disconnect();
                }
              });
              logoutObserver.observe(document.body, {
                childList: true,
                subtree: true
              });
            `;
            iframe.contentDocument?.body.appendChild(script);
          };
          const sessionData = encodeURIComponent(JSON.stringify(sessionObject));
          iframe.src = `/stremio/?sessionData=${sessionData}`;
        }
      } catch (error) {
        console.error("Auto-login failed:", error);
        statusMessage.value = (
          <div class="flex flex-col items-center justify-center">
            <span>
              Error: {error instanceof Error ? error.message : String(error)}
            </span>
            <button
              type="button"
              class="mt-6 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
              onClick={() => history.length > 1 ? history.back() : (globalThis.location.href = "/profiles")}
            >
              Go Back
            </button>
          </div>
        ) as unknown as string;
        isLoading.value = true; // keep loader visible with error
      }
    };

    loginAndLoad();
  }, [profile]);

  return (
    <div class="w-full h-full fixed inset-0 bg-black z-0 animate-fadein">
      {isLoading.value && (
        <div class="absolute inset-0 bg-black flex flex-col items-center justify-center z-10 animate-fadein">
          <div class="spinner"></div>
          <p class="mt-4 text-lg text-gray-300 transition-all duration-200 flex flex-col items-center justify-center">
            {statusMessage.value}
          </p>
        </div>
      )}
      <iframe
        ref={iframeRef}
        class={`w-full h-full border-none absolute inset-0 ${isLoading.value ? "hidden" : ""} transition-all duration-300`}
        allow="autoplay; fullscreen; picture-in-picture"
      >
      </iframe>
      <style>
        {`
          @keyframes fadein {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .animate-fadein {
            animation: fadein 0.5s cubic-bezier(.4,2,.6,1);
          }
          
          /* Prevent pull-to-refresh specifically for the Stremio frame */
          .w-full.h-full.fixed.inset-0.bg-black.z-0.animate-fadein {
            overscroll-behavior-y: none;
          }
          
          /* Prevent pull-to-refresh on iframe */
          iframe {
            overscroll-behavior-y: none;
          }
        `}
      </style>
    </div>
  );
}
