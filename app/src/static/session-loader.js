(async () => {
    const loadingMessage = document.getElementById('loadingMessage');
    const stremioContainer = document.getElementById('stremio-container');
    const loadingContainer = document.querySelector('.loading-container');

    if (!window.sessionData) {
        loadingMessage.textContent = 'Error: Session data not found.';
        return;
    }

    const { profile, user } = window.sessionData;

    const generateInstallationId = () => {
        const randomBytes = crypto.getRandomValues(new Uint8Array(10));
        return Array.from(randomBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    };

    try {
        loadingMessage.textContent = `Logging in as ${profile.name}...`;

        const loginRes = await fetch("/stremio/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "Login",
                email: profile.stremio_email,
                password: profile.stremio_password,
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
            throw new Error("Login failed: Missing authentication data. Please check your credentials.");
        }

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
                    keyMode: 'arrows',
                },
            },
            profilePictureUrl: `/api/avatar/${encodeURIComponent(profile.avatar)}`,
            nsfwFilterEnabled: profile.nsfw_filter_enabled || false,
            ageRating: profile.nsfw_age_rating || 0,
            hideCalendarButton: !!(user && user.hideCalendarButton),
            hideAddonsButton: !!(user && user.hideAddonsButton),
            addonManagerEnabled: !!(user && user.addonManagerEnabled),
            tmdbApiKey: profile.tmdb_api_key || null,
            installation_id: result.installation_id || generateInstallationId(),
            schema_version: result.schema_version || 18,
            library: result.library || { uid: result.user._id, items: {} },
            library_recent: result.library_recent || { uid: result.user._id, items: {} },
            notifications: result.notifications || { uid: result.user._id, items: {}, lastUpdated: null, created: new Date().toISOString() },
            search_history: result.search_history || { uid: result.user._id, items: {} },
            streaming_server_urls: result.streaming_server_urls || { uid: result.user._id, items: { "http://127.0.0.1:11470/": new Date().toISOString() } },
            streams: result.streams || { uid: result.user._id, items: [] },
        };

        loadingMessage.textContent = "Loading Stremio...";

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        iframe.allow = "autoplay; fullscreen; picture-in-picture";

        iframe.onload = () => {
            loadingContainer.style.display = 'none';
            stremioContainer.style.display = 'block';
            document.title = 'Zentrio';
        };

        const sessionDataString = btoa(JSON.stringify(sessionObject));
        iframe.src = `/stremio/?sessionData=${sessionDataString}`;

        stremioContainer.appendChild(iframe);

    } catch (error) {
        console.error("Session loading failed:", error);
        document.title = 'Zentrio - Error';
        loadingMessage.innerHTML = `
            <div style="text-align: center; color: #f44336;">
                <p>Error: ${error.message}</p>
                <button
                    onclick="window.location.href='/profiles'"
                    style="margin-top: 20px; padding: 10px 20px; background: #333; color: white; border: none; border-radius: 4px; cursor: pointer;"
                >
                    Back to Profiles
                </button>
            </div>
        `;
    }
})();
