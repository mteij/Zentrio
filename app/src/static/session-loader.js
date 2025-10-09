(async () => {
    const loadingMessage = document.getElementById('loadingMessage');
    const stremioContainer = document.getElementById('stremio-container');
    const loadingContainer = document.querySelector('.loading-container');

    if (!window.sessionData) {
        loadingMessage.textContent = 'Error: Session data not found.';
        return;
    }

    const { profile, user, decryptionError } = window.sessionData;

    // Early validation: ensure we have credentials to log into Stremio
    if (!profile || !profile.stremio_email || !profile.stremio_password) {
        const reason = !profile ? 'Missing profile data' : (!profile.stremio_email ? 'Missing Stremio email' : 'Missing Stremio password');
        let hint = 'Open the profile and re-enter your Stremio email and password.';
        if (decryptionError) {
            hint = 'Your saved Stremio password could not be decrypted. The server encryption key may have changed. Please open the profile and re-enter your Stremio password.';
        }
        throw new Error(`${reason}. ${hint}`);
    }

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
            downloadsManagerEnabled: (user && typeof user.downloadsManagerEnabled !== 'undefined') ? !!user.downloadsManagerEnabled : true,
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

                // Debug bridge + queue recorder: mirror downloads debug messages, allow forcing scans, and persist queue
                try {
                    const LS_KEY = 'zentrioDownloadsQueue';
                    function loadQueue() {
                        try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : []; } catch(_) { return []; }
                    }
                    function saveQueue(q) {
                        try { localStorage.setItem(LS_KEY, JSON.stringify(q)); } catch(_) {}
                    }
                    function autoPrune(q) {
                        const now = Date.now();
                        const weekMs = 7 * 24 * 60 * 60 * 1000;
                        return q.filter((item, idx) => {
                            if (idx >= 200) return false;
                            if (item.status === 'completed' && item.completedAt && (now - item.completedAt) > weekMs) return false;
                            return true;
                        });
                    }
                    function upsertQueue(item) {
                        let q = loadQueue();
                        const i = q.findIndex(x => x.id === item.id);
                        if (i === -1) q.unshift(item); else q[i] = { ...q[i], ...item };
                        if ((item.status === 'completed' || item.status === 'failed') && i !== -1) {
                            q[i].completedAt = q[i].completedAt || Date.now();
                        }
                        q = autoPrune(q);
                        saveQueue(q);
                    }
                    window.addEventListener('message', (e) => {
                        const d = e.data;
                        if (!d || typeof d !== 'object') return;
                        if (d.type && String(d.type).startsWith('zentrio-download-')) {
                            console.debug('[ZDM-Top]', d);
                            // Persist to localStorage for Downloads page
                            switch (d.type) {
                                case 'zentrio-download-init':
                                    upsertQueue({
                                        id: d.id,
                                        title: d.payload?.title || d.title || 'Untitled',
                                        href: d.payload?.href || d.href || null,
                                        status: 'initiated', progress: 0, bytesReceived: 0, size: 0, eta: null,
                                        fileName: null, openable: false
                                    });
                                    break;
                                case 'zentrio-download-progress':
                                    upsertQueue({ id: d.id, status: 'downloading', progress: d.progress, bytesReceived: d.bytesReceived, size: d.size || 0, eta: d.eta });
                                    break;
                                case 'zentrio-download-complete':
                                    upsertQueue({ id: d.id, status: 'completed', progress: 100, bytesReceived: d.size || d.bytesReceived || 0, size: d.size || d.bytesReceived || 0, fileName: d.fileName || null, openable: !!d.blobUrl, blobUrl: d.blobUrl || null });
                                    break;
                                case 'zentrio-download-failed':
                                case 'zentrio-download-cancelled':
                                    upsertQueue({ id: d.id, status: 'failed' });
                                    break;
                            }
                        }
                    });
                    // Expose helpers in devtools: zdmScan() and zdmDebug(true/false)
                    window.zdmScan = function() {
                        try { iframe.contentWindow && iframe.contentWindow.postMessage({ type: 'zdm-force-scan' }, '*'); } catch(_) {}
                    };
                    window.zdmDebug = function(enabled) {
                        try { iframe.contentWindow && iframe.contentWindow.postMessage({ type: 'zdm-debug-toggle', enabled: !!enabled }, '*'); } catch(_) {}
                    };
                } catch(_) {}

    } catch (error) {
        console.error("Session loading failed:", error);
        document.title = 'Zentrio - Error';
        loadingMessage.innerHTML = `
            <div class="message error" style="display: block; margin: 0 auto; max-width: 400px;">
                <p style="margin-bottom: 15px;"><strong>Error</strong></p>
                <p>${error.message}</p>
                ${decryptionError ? '<p style="margin-top:10px; color:#bbb;">Tip: Ensure the server ENCRYPTION_KEY stays the same across restarts; otherwise saved passwords can\'t be decrypted.</p>' : ''}
                <button
                    onclick="window.history.back()"
                    class="btn btn-secondary"
                    style="margin-top: 20px;"
                >
                    Go Back
                </button>
            </div>
        `;
    }
})();
