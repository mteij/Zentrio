import { h as _h } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { ProfileSchema } from "../utils/db.ts";

interface StremioFrameProps {
  profile: ProfileSchema;
}

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
        const authKey = loginData?.result?.authKey;

        if (!authKey) {
          throw new Error("Login successful, but no authKey was returned.");
        }

        // Set the cookie that Stremio's web app expects.
        // The path MUST be `/stremio/` as you discovered.
        document.cookie = `authKey=${authKey}; path=/stremio/`;

        // The cookie is now set. We can load the iframe.
        statusMessage.value = "Loading Stremio...";
        const iframe = iframeRef.current;
        if (iframe) {
          iframe.onload = () => {
            isLoading.value = false;
            statusMessage.value = "Loaded!";
          };
          iframe.src = "/stremio/";
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
