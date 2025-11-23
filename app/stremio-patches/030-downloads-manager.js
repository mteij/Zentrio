// --- Zentrio Downloads Integration (formerly 050-downloads-integration.js) ---
(function() {
    // Global cache for stream data
    window.__zentrioStreamCache = {};
    window.__zentrioMetaCache = null;

    // Helper to find React Fiber node from DOM element
    function findReactFiber(dom) {
        const key = Object.keys(dom).find(k => k.startsWith('__reactFiber$'));
        return key ? dom[key] : null;
    }

    // Function to traverse React tree and extract stream data
    function extractStreamsFromReact() {
        try {
            // 1. Extract Streams
            const containers = document.querySelectorAll('[class*="streams-container"], [class*="streams-list-container"]');
            let foundCount = 0;

            containers.forEach(container => {
                let fiber = findReactFiber(container);
                if (!fiber) return;
                
                let current = fiber;
                let depth = 0;
                while (current && depth < 20) {
                    const props = current.memoizedProps;
                    if (props && props.streams && Array.isArray(props.streams)) {
                        props.streams.forEach(group => {
                            if (group.content && group.content.content && Array.isArray(group.content.content)) {
                                group.content.content.forEach(stream => {
                                    if (stream.url) {
                                        window.__zentrioStreamCache[stream.url] = stream;
                                        foundCount++;
                                    }
                                    if (stream.deepLinks && stream.deepLinks.player) {
                                        const hash = stream.deepLinks.player.replace(/^#/, '');
                                        window.__zentrioStreamCache[hash] = stream;
                                        window.__zentrioStreamCache['#' + hash] = stream;
                                        if (hash.startsWith('player/')) {
                                            window.__zentrioStreamCache[hash.replace('player/', '')] = stream;
                                        }
                                    }
                                });
                            }
                        });
                        if (foundCount > 0) break;
                    }
                    current = current.return;
                    depth++;
                }
            });
            
            // 2. Extract Metadata (Title, Episode, etc.)
            // Look for MetaDetails or Player components
            const metaContainers = document.querySelectorAll('[class*="meta-details"], [class*="player-container"], #player');
            metaContainers.forEach(container => {
                let fiber = findReactFiber(container);
                if (!fiber) return;
                
                let current = fiber;
                let depth = 0;
                while (current && depth < 25) {
                    const props = current.memoizedProps;
                    // Check for 'meta' prop (common in Stremio components)
                    if (props && props.meta && props.meta.name) {
                        window.__zentrioMetaCache = props.meta;
                        // console.log('[Zentrio] Found metadata:', props.meta.name);
                        return;
                    }
                    // Check for 'video' prop (sometimes used in player)
                    if (props && props.video && props.video.title) {
                         // This might be the stream title, not the movie title, but useful fallback
                    }
                    // Check for 'seriesInfo'
                    if (props && props.seriesInfo) {
                        if (!window.__zentrioMetaCache) window.__zentrioMetaCache = {};
                        window.__zentrioMetaCache.seriesInfo = props.seriesInfo;
                    }
                    current = current.return;
                    depth++;
                }
            });

        } catch (e) {
            console.error('[Zentrio] Error extracting data from React:', e);
        }
    }

    // Hook into Stremio Core Analytics as a backup/active listener
    const waitForApp = setInterval(() => {
        if (window.stremio && window.stremio.services && window.stremio.services.core) {
            clearInterval(waitForApp);
            
            try {
                const originalAnalytics = window.stremio.services.core.transport.analytics;
                window.stremio.services.core.transport.analytics = function(event) {
                    try {
                        if (event && event.event === 'StreamClicked' && event.args && event.args.stream) {
                            const stream = event.args.stream;
                            if (stream.deepLinks && stream.deepLinks.player) {
                                const hash = stream.deepLinks.player.replace(/^#/, '');
                                window.__zentrioStreamCache[hash] = stream;
                                window.__zentrioStreamCache['#' + hash] = stream;
                            }
                            if (stream.url) {
                                window.__zentrioStreamCache[stream.url] = stream;
                            }
                        }
                    } catch (e) {}
                    if (originalAnalytics) return originalAnalytics.apply(this, arguments);
                };
                console.log('[Zentrio] Hooked into Core Analytics');
            } catch (e) {}
        }
    }, 500);

    // Expose helper to get stream data
    window.getZentrioStreamData = function(hrefOrUrl) {
        // Always try to refresh cache from React tree first
        extractStreamsFromReact();
        
        if (!window.__zentrioStreamCache) return null;
        
        // 1. Try exact match
        if (window.__zentrioStreamCache[hrefOrUrl]) return window.__zentrioStreamCache[hrefOrUrl];
        
        // 2. Try removing hash
        const noHash = hrefOrUrl.replace(/^#/, '');
        if (window.__zentrioStreamCache[noHash]) return window.__zentrioStreamCache[noHash];
        
        // 3. Try matching by player route suffix
        // href might be "#/player/..."
        if (hrefOrUrl.includes('/player/')) {
            // Find a key that ends with the player ID part
            // e.g. href: #/player/tt12345:1:1/aaaa
            // key: player/tt12345:1:1/aaaa
            
            const searchPart = hrefOrUrl.split('/player/')[1];
            if (searchPart) {
                const match = Object.values(window.__zentrioStreamCache).find(s => 
                    s.deepLinks && s.deepLinks.player && s.deepLinks.player.includes(searchPart)
                );
                if (match) return match;
            }
        }
        
        return null;
    };

    window.getZentrioMetaData = function() {
        extractStreamsFromReact();
        return window.__zentrioMetaCache;
    };

})();
// --- End Integration ---

// Zentrio Downloads Manager - patched in at build-time
// This version acts as a UI slave to the main window's Downloads Core
(function() {
  try {
    const session = (typeof window !== 'undefined'
      ? (window['session'] || window['zentrioSession'] || null)
      : null);

    // Feature flag (enabled by default)
    if (session && session.downloadsManagerEnabled === false) {
      return;
    }

    const STREAM_SELECTORS = [
      'a[href*="#/player/"]',
      '.stream-container a[href*="#/player/"]',
      '.stream-container',
      'a[href*="#/stream/"]',
      'a[href*="#/detail/"][href*="player"]',
      '[data-href*="#/player/"]'
    ];

    function collectStreamAnchors() {
      const out = [];
      const seen = new Set();
      STREAM_SELECTORS.forEach(sel => {
        document.querySelectorAll(sel).forEach(node => {
          let a = node;
          if (a && a.tagName !== 'A') {
            const closest = a.closest('a[href*="#/player/"]');
            if (closest) a = closest;
          }
          if (!a || a.tagName !== 'A') return;
          if (seen.has(a)) return;
          seen.add(a);
          out.push(a);
        });
      });
      return out;
    }

    const BTN_ATTR = 'data-zentrio-dl';
    const STYLE_ID = 'zentrio-downloads-style-core-v5';
    
    // Local state for UI updates only
    const items = {};
    const probing = {}; // id -> { startedAt, anchorHash }
    const ALWAYS_PROBE = true; // proactively open hidden player iframe for every download to capture media requests early

    // --- Messaging with Core ---
    function sendToCore(msg) {
        // Send to parent window where Core lives
        console.log('[ZDM] Sending to core:', msg.type, msg);
        
        // 1. Try local postMessage (for local Core)
        try { window.postMessage(msg, '*'); } catch(e) { console.error('[ZDM] Local postMessage failed', e); }
        
        // 2. Try parent postMessage (for parent Core)
        // Only if parent is different from window to avoid double sending
        if (window.parent && window.parent !== window) {
            try { window.parent.postMessage(msg, '*'); } catch(e) { console.error('[ZDM] Parent postMessage failed', e); }
        }
        
        // Fallback 1: CustomEvent
        try {
            if (window.parent && window.parent.dispatchEvent) {
                 window.parent.dispatchEvent(new CustomEvent('zentrio-message', { detail: msg }));
            }
        } catch(e) { console.error('[ZDM] Dispatch failed', e); }

        // Fallback 2: DOM Bridge (bypass event blockers)
        // Skip bridge if message contains non-serializable data (like FileSystemHandle)
        if (msg.handle) {
             console.warn('[ZDM] Skipping bridge for message with handle (not serializable)');
             return;
        }

        try {
            // Try to find bridge in current, parent or top window
            let bridge = null;
            
            // 1. Try current window (if Core is running locally)
            try { bridge = document.getElementById('zentrio-comm-bridge'); } catch(_) {}
            
            // 2. Try parent window
            if (!bridge) {
                try { bridge = window.parent.document.getElementById('zentrio-comm-bridge'); } catch(_) {}
            }
            
            // 3. Try top window
            if (!bridge) {
                try { bridge = window.top.document.getElementById('zentrio-comm-bridge'); } catch(_) {}
            }
            
            if (bridge) {
                console.log('[ZDM] Writing to bridge...');
                bridge.setAttribute('data-message', JSON.stringify(msg));
                // Clear it after a tick to allow re-sending same message if needed
                setTimeout(() => bridge.removeAttribute('data-message'), 50);
            } else {
                console.warn('[ZDM] Bridge not found');
                // Retry once after a short delay if not found (maybe initialization race)
                setTimeout(() => {
                    try {
                        let retryBridge = null;
                        try { retryBridge = document.getElementById('zentrio-comm-bridge'); } catch(_) {}
                        if (!retryBridge) {
                            try { retryBridge = window.parent.document.getElementById('zentrio-comm-bridge'); } catch(_) {}
                        }
                        if (!retryBridge) {
                            try { retryBridge = window.top.document.getElementById('zentrio-comm-bridge'); } catch(_) {}
                        }
                        
                        if (retryBridge) {
                            console.log('[ZDM] Bridge found on retry, writing...');
                            retryBridge.setAttribute('data-message', JSON.stringify(msg));
                            setTimeout(() => retryBridge.removeAttribute('data-message'), 50);
                        } else {
                            console.error('[ZDM] Bridge definitely not found');
                        }
                    } catch(e) {}
                }, 500);
            }
        } catch(e) { console.error('[ZDM] Bridge failed', e); }
    }

    window.addEventListener('message', (e) => {
        const data = e.data;
        if (!data || typeof data !== 'object') return;

        // Handle updates from Core
        if (data.type === 'zentrio-download-progress') {
            updateButtonState(data.id, 'downloading', data.progress);
            items[data.id] = { ...items[data.id], status: 'downloading', progress: data.progress };
            renderPopupList();
        } else if (data.type === 'zentrio-download-complete') {
            updateButtonState(data.id, 'complete');
            items[data.id] = { ...items[data.id], status: 'completed', progress: 100 };
            renderPopupList();
        } else if (data.type === 'zentrio-download-failed' || data.type === 'zentrio-download-cancelled') {
            updateButtonState(data.id, 'default');
            items[data.id] = { ...items[data.id], status: 'failed' };
            renderPopupList();
        } else if (data.type === 'zentrio-download-init') {
            const item = data.payload;
            items[item.id] = item;
            renderPopupList();
            // Find button and set state
            const anchors = document.querySelectorAll(`a[href="${item.href}"]`);
            anchors.forEach(a => {
                const btn = a.querySelector('.zentrio-dl-btn');
                if (btn) setButtonState(btn, 'downloading');
            });
        } else if (data.type === 'zentrio-download-root-handle') {
            // Core has a handle, we can update UI if needed (e.g. hide modal warning)
            const modal = document.getElementById('zentrioFolderModal');
            if (modal) modal.style.display = 'none';
        } else if (data.type === 'zentrio-download-error') {
             if (data.error === 'No download folder selected' || data.error === 'Permission required') {
                 // Store the pending item so we can retry
                 if (data.id && items[data.id]) {
                     window.__zentrioPendingDownloadItem = items[data.id];
                 }
                 const modal = document.getElementById('zentrioFolderModal');
                 if (modal) modal.style.display = 'block';
             }
        }
    });

    // --- Probe mode for cases where initial JSON doesn't expose final media URL (player loads it later) ---
    function openHiddenPlayer(hash) {
      try {
        if (!hash || !hash.startsWith('#/player/')) return;
        const iframeId = 'zdm-probe-frame-' + btoa(hash).replace(/[^a-z0-9]/ig,'').slice(0,12);
        if (document.getElementById(iframeId)) {
          return;
        }
        const ifr = document.createElement('iframe');
        ifr.id = iframeId;
        const basePath = window.location.pathname.split('#')[0];
        // Ensure we pass sessionData to the probe iframe so it can actually load the stream
        const currentSearch = window.location.search;
        ifr.src = basePath + currentSearch + hash;
        Object.assign(ifr.style, {
          position: 'absolute',
          width: '0px',
          height: '0px',
          border: '0',
          opacity: '0',
          pointerEvents: 'none'
        });
        ifr.addEventListener('load', () => {
          try {
            if (ifr.contentWindow) {
              // Patch fetch and XHR in the iframe
              const w = ifr.contentWindow;
              if (w.__zdmPatched) return;
              w.__zdmPatched = true;
              
              // Ensure we target the top-most window that is listening (Zentrio main window)
              // Since this script runs in the Stremio iframe, and the probe iframe is a child of that,
              // we need to post to the Stremio iframe (parent of probe), which then relays to Core (parent of Stremio).
              // But wait, this script runs in the Stremio iframe context.
              // So 'w' is the probe iframe window. 'w.parent' is the Stremio iframe window (where this script runs).
              // So posting to w.parent is correct.
              const postTarget = w.parent;
              
              // Force console logging to parent window for visibility
              try {
                  w.console = w.parent.console;
              } catch(_) {}

              const origFetch = w.fetch;
              if (typeof origFetch === 'function') {
                w.fetch = async function(...args) {
                  let url = '';
                  try { url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || ''); } catch(_) {}
                  const res = await origFetch.apply(this, args);
                  try {
                    const ct = res.headers.get('content-type') || '';
                    if ((/\bmpegurl|application\/dash|video|audio|octet-stream/i.test(ct) ||
                        /\.(m3u8|mpd|mp4|mkv|avi|mov|webm|flv|wmv)(\?|$)/i.test(url)) &&
                        !/\.(json|srt|vtt|js|css|html|svg|png|jpg|jpeg|gif|ico)($|\?)/i.test(url) &&
                        !/manifest\.json/i.test(url)) {
                      // Log for debugging
                      // console.log('[ZDM-Probe] fetch success', url, ct);
                      postTarget.postMessage({ type: 'zentrio-download-media-probe', url, contentType: ct, status: res.status, ctx: 'iframe' }, '*');
                    }
                  } catch(e) { console.error('[ZDM-Probe] fetch intercept error', e); }
                  return res;
                };
              }

              // Patch XHR
              try {
                const origOpen = w.XMLHttpRequest.prototype.open;
                w.XMLHttpRequest.prototype.open = function(method, url) {
                    this._zdmUrl = url;
                    return origOpen.apply(this, arguments);
                };
                
                const origSend = w.XMLHttpRequest.prototype.send;
                w.XMLHttpRequest.prototype.send = function() {
                    this.addEventListener('load', () => {
                        try {
                            const url = this._zdmUrl || this.responseURL;
                            const ct = this.getResponseHeader('content-type') || '';
                            if ((/\bmpegurl|application\/dash|video|audio|octet-stream/i.test(ct) ||
                                /\.(m3u8|mpd|mp4|mkv|avi|mov|webm|flv|wmv)(\?|$)/i.test(url)) &&
                                !/\.(json|srt|vtt|js|css|html|svg|png|jpg|jpeg|gif|ico)($|\?)/i.test(url) &&
                                !/manifest\.json/i.test(url)) {
                                postTarget.postMessage({ type: 'zentrio-download-media-probe', url, contentType: ct, status: this.status, ctx: 'iframe' }, '*');
                            }
                        } catch(e) { console.error('[ZDM-Probe] XHR intercept error', e); }
                    });
                    return origSend.apply(this, arguments);
                };
              } catch(e) { console.error('[ZDM-Probe] XHR patch error', e); }
              
              // Also patch window.open to catch direct media opens
              try {
                  const origWindowOpen = w.open;
                  w.open = function(url, target, features) {
                      if (url && typeof url === 'string') {
                          if (/\.(mp4|mkv|avi|mov|webm|m3u8|mpd)($|\?)/i.test(url)) {
                              postTarget.postMessage({ type: 'zentrio-download-media-probe', url, contentType: 'video/unknown', status: 200, ctx: 'iframe-window-open' }, '*');
                              return null; // Block actual open
                          }
                      }
                      return origWindowOpen.apply(this, arguments);
                  };
              } catch(e) { console.error('[ZDM-Probe] window.open patch error', e); }
            }
          } catch(e2) { console.error('[ZDM-Probe] iframe load error', e2); }
        });
        document.body.appendChild(ifr);
        
        // Force video playback in the iframe to trigger network requests
        // We need to wait for the iframe to load and then try to find the video element
        ifr.onload = () => {
            setTimeout(() => {
                try {
                    const doc = ifr.contentDocument || ifr.contentWindow.document;
                    
                    // Watch for video src changes
                    try {
                        const checkVideo = (v) => {
                            if (v && v.src && !v.src.startsWith('blob:')) {
                                const postTarget = ifr.contentWindow.parent;
                                postTarget.postMessage({ type: 'zentrio-download-media-probe', url: v.src, contentType: 'video/unknown', status: 200, ctx: 'video-src' }, '*');
                            }
                        };

                        const observer = new MutationObserver((mutations) => {
                            mutations.forEach(m => {
                                if (m.type === 'attributes' && m.attributeName === 'src') {
                                    checkVideo(m.target);
                                }
                                if (m.type === 'childList') {
                                    m.addedNodes.forEach(n => {
                                        if (n.nodeName === 'VIDEO') checkVideo(n);
                                        if (n.querySelectorAll) n.querySelectorAll('video').forEach(checkVideo);
                                    });
                                }
                            });
                        });
                        observer.observe(doc, { attributes: true, childList: true, subtree: true, attributeFilter: ['src'] });
                        
                        // Check existing
                        doc.querySelectorAll('video').forEach(checkVideo);
                    } catch(e) { console.error('[ZDM-Probe] Observer error', e); }

                    // Try to find video element and play it
                    const tryPlay = () => {
                        const video = doc.querySelector('video');
                        if (video) {
                            video.muted = true;
                            video.volume = 0;
                            video.play().catch(() => {});
                        } else {
                            setTimeout(tryPlay, 500);
                        }
                    };
                    tryPlay();
                } catch(e) {}
            }, 2000);
        };

        setTimeout(() => { try { ifr.remove(); } catch(_){} }, 90000);
      } catch(e) { }
    }

    function markProbing(id, anchorHash) {
      probing[id] = { startedAt: Date.now(), anchorHash };
      openHiddenPlayer(anchorHash);
    }

    function clearProbing(id) {
      if (probing[id]) delete probing[id];
    }

    // Listen for probe results
    window.addEventListener('message', (e) => {
        const data = e.data;
        if (!data || typeof data !== 'object') return;
        
        if (data.type === 'zentrio-download-media-probe' && data.url) {
            if (data.url.startsWith('blob:')) return;

            // Associate with earliest probing download
            const probingIds = Object.keys(probing).sort((a,b)=> probing[a].startedAt - probing[b].startedAt);
            if (probingIds.length) {
              const targetId = probingIds[0];
              if ((/\.(m3u8|mpd|mp4|mkv|avi|mov|webm|flv|wmv|ts|m4s)(\?|$)/i.test(data.url) ||
                  /mpegurl|video|audio|mp4|dash|octet-stream/i.test(data.contentType || '')) &&
                  !/json|html|text/i.test(data.contentType || '')) {
                
                const probeData = probing[targetId];
                clearProbing(targetId);
                
                // We have the URL now, send request to Core
                // We need to reconstruct the info since we didn't store it fully in probing map
                // But we can just store the pending request info in 'items' temporarily or pass it through
                // Actually, we should have stored the pending item info when we started probing.
                
                if (items[targetId]) {
                    const item = items[targetId];
                    sendToCore({
                        type: 'zentrio-download-request',
                        id: targetId,
                        href: item.href,
                        title: item.title,
                        episodeInfo: item.episodeInfo,
                        url: data.url
                    });
                }
              }
            }
        }
    });

    // --- UI Logic ---

    function injectStyles() {
      if (document.getElementById(STYLE_ID)) return;
      
      // Inject Lucide script if not already present
      if (!document.querySelector('script[src*="lucide"]')) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.js';
        script.onload = () => initializeLucideIcons();
        document.head.appendChild(script);
      }
      
      const css = '.zentrio-actions-column {' +
        'position: absolute;' +
        'top: 50%;' +
        'right: 8px;' +
        'transform: translateY(-50%);' +
        'display: flex;' +
        'flex-direction: column;' +
        'gap: 6px;' +
        'z-index: 10050;' +
        '}' +
        '.zentrio-dl-btn, .zentrio-play-btn {' +
        'background: rgba(0,0,0,0.55);' +
        'border: 1px solid rgba(255,255,255,0.25);' +
        'color: #fff;' +
        'width: 42px;' +
        'height: 42px;' +
        'border-radius: 8px;' +
        'cursor: pointer;' +
        'font-size: 16px;' +
        'line-height: 1;' +
        'display: flex;' +
        'align-items: center;' +
        'justify-content: center;' +
        'backdrop-filter: blur(4px);' +
        '-webkit-backdrop-filter: blur(4px);' +
        'padding: 0;' +
        'margin: 0;' +
        'opacity: 0.85;' +
        'transition: background .15s, border-color .15s, opacity .15s, transform .15s;' +
        '}' +
        '.zentrio-play-btn {' +
        'display: none;' + // Hide play button as it's redundant and causes visual clutter
        '}' +
        '.zentrio-dl-btn:focus, .zentrio-play-btn:focus {' +
        'outline: 2px solid #dc2626;' +
        'outline-offset: 2px;' +
        '}' +
        '.zentrio-dl-btn:hover, .zentrio-play-btn:hover {' +
        'background: #dc2626;' +
        'border-color: #dc2626;' +
        'opacity: 1;' +
        '}' +
        '.zentrio-dl-btn:active, .zentrio-play-btn:active {' +
        'transform: scale(0.92);' +
        '}' +
        '.zentrio-dl-btn.is-downloading {' +
        'background: #1e3a8a;' +
        'border-color: #1e3a8a;' +
        'cursor: default;' +
        '}' +
        '.zentrio-dl-btn.is-complete {' +
        'background: #059669;' +
        'border-color: #059669;' +
        '}' +
        '.zentrio-dl-btn .spinner {' +
        'width: 22px;' +
        'height: 22px;' +
        'border: 2px solid rgba(255,255,255,0.4);' +
        'border-top-color: #fff;' +
        'border-radius: 50%;' +
        'animation: zentrio-spin 0.8s linear infinite;' +
        '}' +
        '.zentrio-dl-btn i[data-lucide], .zentrio-play-btn i[data-lucide] {' +
        'display: inline-block;' +
        'vertical-align: middle;' +
        '}' +
        '@keyframes zentrio-spin {' +
        'from { transform: rotate(0deg); }' +
        'to { transform: rotate(360deg); }' +
        '}' +
        '.zentrio-has-actions {' +
        'position: relative;' +
        'user-select: none;' +
        '-webkit-user-select: none;' +
        '-webkit-touch-callout: none;' +
        'padding-right: 70px !important;' +
        'box-sizing: border-box !important;' +
        '}' +
        '.zentrio-has-actions > div:not(.zentrio-actions-column) {' +
        'max-width: 100% !important;' +
        '}' +
        'svg.icon-rAZvO {' +
        'display: none !important;' +
        'visibility: hidden !important;' +
        'width: 0 !important;' +
        'height: 0 !important;' +
        '}' +
        '.zentrio-modal {' +
        'display: none;' +
        'position: fixed;' +
        'z-index: 100000;' +
        'left: 0;' +
        'top: 0;' +
        'width: 100%;' +
        'height: 100%;' +
        'background-color: rgba(0,0,0,0.8);' +
        '}' +
        '.zentrio-modal-content {' +
        'background-color: #222;' +
        'margin: 10% auto;' +
        'padding: 40px;' +
        'border-radius: 8px;' +
        'width: 90%;' +
        'max-width: 500px;' +
        'position: relative;' +
        'color: #fff;' +
        'font-family: sans-serif;' +
        '}' +
        '.zentrio-close {' +
        'color: #aaa;' +
        'float: right;' +
        'font-size: 28px;' +
        'font-weight: bold;' +
        'cursor: pointer;' +
        'position: absolute;' +
        'top: 15px;' +
        'right: 20px;' +
        '}' +
        '.zentrio-close:hover {' +
        'color: white;' +
        '}' +
        '.zentrio-btn {' +
        'background: #e50914;' +
        'color: white;' +
        'padding: 10px 20px;' +
        'border: none;' +
        'border-radius: 4px;' +
        'font-size: 14px;' +
        'cursor: pointer;' +
        'font-weight: bold;' +
        '}' +
        '.zentrio-btn:hover {' +
        'background: #f40612;' +
        '}' +
        '.zentrio-btn-secondary {' +
        'background: #333;' +
        'margin-right: 10px;' +
        '}' +
        '.zentrio-btn-secondary:hover {' +
        'background: #555;' +
        '}' +
        '.zentrio-downloads-popup {' +
        'display: none;' +
        'position: fixed;' +
        'top: 60px;' +
        'right: 20px;' +
        'width: 320px;' +
        'background: #1a1a1a;' +
        'border: 1px solid #333;' +
        'border-radius: 8px;' +
        'box-shadow: 0 4px 12px rgba(0,0,0,0.5);' +
        'z-index: 100001;' +
        'max-height: 400px;' +
        'overflow-y: auto;' +
        'color: #fff;' +
        'font-family: sans-serif;' +
        '}' +
        '.zentrio-popup-header {' +
        'padding: 12px 16px;' +
        'border-bottom: 1px solid #333;' +
        'display: flex;' +
        'justify-content: space-between;' +
        'align-items: center;' +
        'background: #222;' +
        'position: sticky;' +
        'top: 0;' +
        'z-index: 1;' +
        '}' +
        '.zentrio-popup-title {' +
        'font-weight: 600;' +
        'font-size: 14px;' +
        'margin: 0;' +
        '}' +
        '.zentrio-popup-link {' +
        'color: #aaa;' +
        'text-decoration: none;' +
        'font-size: 12px;' +
        '}' +
        '.zentrio-popup-link:hover {' +
        'color: #fff;' +
        '}' +
        '.zentrio-popup-list {' +
        'padding: 0;' +
        'margin: 0;' +
        'list-style: none;' +
        '}' +
        '.zentrio-popup-item {' +
        'padding: 12px 16px;' +
        'border-bottom: 1px solid #2a2a2a;' +
        'display: flex;' +
        'flex-direction: column;' +
        'gap: 4px;' +
        '}' +
        '.zentrio-popup-item:last-child {' +
        'border-bottom: none;' +
        '}' +
        '.zentrio-item-title {' +
        'font-size: 13px;' +
        'font-weight: 500;' +
        'white-space: nowrap;' +
        'overflow: hidden;' +
        'text-overflow: ellipsis;' +
        '}' +
        '.zentrio-item-meta {' +
        'font-size: 11px;' +
        'color: #888;' +
        'display: flex;' +
        'justify-content: space-between;' +
        '}' +
        '.zentrio-item-progress {' +
        'height: 4px;' +
        'background: #333;' +
        'border-radius: 2px;' +
        'margin-top: 6px;' +
        'overflow: hidden;' +
        '}' +
        '.zentrio-item-bar {' +
        'height: 100%;' +
        'background: #e50914;' +
        'transition: width 0.2s;' +
        '}' +
        '.zentrio-popup-empty {' +
        'padding: 30px 20px;' +
        'text-align: center;' +
        'color: #666;' +
        'font-size: 13px;' +
        '}' +
        // Hide the native Stremio context menu (hold menu) for stream items
        '.menu-container-B6cqK {' +
        'display: none !important;' +
        '}';
      const el = document.createElement('style');
      el.id = STYLE_ID;
      el.textContent = css;
      document.head.appendChild(el);
      
      // Inject Downloads Popup HTML
      if (!document.getElementById('zentrioDownloadsPopup')) {
        const popup = document.createElement('div');
        popup.id = 'zentrioDownloadsPopup';
        popup.className = 'zentrio-downloads-popup';
        popup.innerHTML = `
          <div class="zentrio-popup-header">
            <h3 class="zentrio-popup-title">Downloads</h3>
            <a href="#" id="zentrioViewAllDownloads" class="zentrio-popup-link">View All</a>
          </div>
          <div id="zentrioPopupList" class="zentrio-popup-list">
             <div class="zentrio-popup-empty">No active downloads</div>
          </div>
        `;
        document.body.appendChild(popup);
        
        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            const popup = document.getElementById('zentrioDownloadsPopup');
            const trigger = document.getElementById('zentrio-header-action');
            if (popup && popup.style.display === 'block') {
                if (!popup.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
                    popup.style.display = 'none';
                }
            }
        });
        
        // Listen for toggle event from header integration
        window.addEventListener('zentrioToggleDownloadsPopup', () => {
            const popup = document.getElementById('zentrioDownloadsPopup');
            if (popup) {
                popup.style.display = popup.style.display === 'block' ? 'none' : 'block';
                renderPopupList();
            }
        });

        // Handle View All link
        const viewAllBtn = document.getElementById('zentrioViewAllDownloads');
        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.top.location.href = '/downloads';
            });
        }
      }

      // Inject Modal HTML
      if (!document.getElementById('zentrioFolderModal')) {
        const modal = document.createElement('div');
        modal.id = 'zentrioFolderModal';
        modal.className = 'zentrio-modal';
        modal.innerHTML = `
          <div class="zentrio-modal-content">
            <span class="zentrio-close" id="zentrioCloseFolderModal">&times;</span>
            <h2 style="margin-bottom: 20px; color: #fff; margin-top: 0;">Select Download Folder</h2>
            <p style="color: #b3b3b3; margin-bottom: 24px; line-height: 1.5;">
              Please select a folder where your downloads will be saved. This is required to store files on your device.
            </p>
            <div style="display: flex; justify-content: flex-end;">
              <button id="zentrioModalBackBtn" class="zentrio-btn zentrio-btn-secondary">Cancel</button>
              <button id="zentrioModalSelectBtn" class="zentrio-btn">Select Folder</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        
        // Wire up modal events
        const closeBtn = document.getElementById('zentrioCloseFolderModal');
        const backBtn = document.getElementById('zentrioModalBackBtn');
        const selectBtn = document.getElementById('zentrioModalSelectBtn');
        
        const hideModal = () => { modal.style.display = 'none'; };
        
        if (closeBtn) closeBtn.onclick = hideModal;
        if (backBtn) backBtn.onclick = hideModal;
        if (selectBtn) selectBtn.onclick = async () => {
          if (!('showDirectoryPicker' in window)) {
            alert('Directory picker not supported');
            return;
          }
          try {
            const handle = await window.showDirectoryPicker({ id: 'zentrio-downloads', mode: 'readwrite', startIn: 'videos' });
            // Send handle to Core
            sendToCore({ type: 'zentrio-download-root-set', handle });
            hideModal();
            
            // Retry pending download if any
            if (window.__zentrioPendingDownloadItem) {
               const item = window.__zentrioPendingDownloadItem;
               window.__zentrioPendingDownloadItem = null;
               // Re-trigger download
               const btn = document.querySelector(`a[href="${item.href}"] .zentrio-dl-btn`);
               if (btn) {
                   // Reset button state to allow re-download
                   setButtonState(btn, 'default');
                   startDownload(btn.closest('a'), btn);
               }
            }
            
          } catch (e) {
            console.error('Folder selection failed', e);
          }
        };
        
        window.onclick = (event) => {
          if (event.target == modal) hideModal();
        };
      }
    }

    function ensureRelative(el) {
      const cs = window.getComputedStyle(el);
      if (cs.position === 'static' || !cs.position) {
        el.style.position = 'relative';
      }
    }

    function createButton(anchor) {
      if (anchor.querySelector('.zentrio-actions-column')) return;
      ensureRelative(anchor);
      
      const col = document.createElement('div');
      col.className = 'zentrio-actions-column';
      
      // Custom Play Button (Visual only, click bubbles to anchor)
      const playBtn = document.createElement('div');
      playBtn.className = 'zentrio-play-btn';
      playBtn.title = 'Play';
      playBtn.innerHTML = '<i data-lucide="play" style="width: 24px; height: 24px;"></i>';
      col.appendChild(playBtn);

      // Download Button
      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'zentrio-dl-btn';
      dlBtn.title = 'Download';
      dlBtn.innerHTML = '<i data-lucide="download" style="width: 24px; height: 24px;"></i>';
      col.appendChild(dlBtn);

      anchor.appendChild(col);
      anchor.classList.add('zentrio-has-actions');

      dlBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startDownload(anchor, dlBtn);
      }, { passive: false });

      anchor.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        return false;
      });

      setTimeout(() => initializeLucideIcons(), 50);
    }

    function markProcessed(anchor) {
        anchor.setAttribute(BTN_ATTR, '1');
        anchor.setAttribute('data-zentrio-href', anchor.getAttribute('href'));
    }
    function isProcessed(anchor) { return anchor.hasAttribute(BTN_ATTR); }
    function needsUpdate(anchor) {
        return anchor.getAttribute('data-zentrio-href') !== anchor.getAttribute('href');
    }

    function extractStreamInfo(anchor) {
      const titleEl = anchor.querySelector('.addon-name-tC8PX, .name, [class*="addon-name"], .info-container-TihQo');
      const descEl = anchor.querySelector('.description-container-vW_De, [class*="description"]');
      
      // This is usually the addon name (e.g. "Torrentio")
      let addonName = titleEl ? (titleEl.textContent || '').trim() : (anchor.getAttribute('title') || '').trim();
      let description = descEl ? (descEl.getAttribute('title') || descEl.textContent || '').trim() : '';
      
      // Try to get the real content title from React metadata (most reliable)
      let contentTitle = '';
      let episodeInfo = '';
      
      if (window.getZentrioMetaData) {
          const meta = window.getZentrioMetaData();
          if (meta) {
              console.log('[ZDM] Found React metadata:', meta);
              if (meta.name) contentTitle = meta.name;
          } else {
              console.log('[ZDM] No React metadata found');
          }
      }

      // Fallback to DOM scraping
      if (!contentTitle) {
          try {
              // 1. Try document title (usually "Movie Name - Stremio")
              const docTitle = document.title.split(' - ')[0].trim();
              console.log('[ZDM] Document title:', document.title, 'Parsed:', docTitle);
              if (docTitle && docTitle !== 'Stremio') {
                  contentTitle = docTitle;
              }
              
              // 2. Try meta tags
              if (!contentTitle) {
                  const ogTitle = document.querySelector('meta[property="og:title"]');
                  if (ogTitle) contentTitle = ogTitle.getAttribute('content');
              }
              
              // 3. Try common UI elements
              if (!contentTitle) {
                  const uiTitle = document.querySelector('.meta-info .title, .title-container .title, [class*="MetaInfo"] h1');
                  if (uiTitle) contentTitle = uiTitle.textContent.trim();
              }
          } catch(e) {}
      }
      
      // Fallback to addon name if we really can't find anything
      if (!contentTitle) contentTitle = addonName;

      const epRegex = /(S\d+\s*:?\s*E\d+|Season\s*\d+\s*Episode\s*\d+|\d+x\d+)/i;
      
      // Check page title for episode info first (e.g. "Show Name S01E01")
      const titleMatch = contentTitle.match(epRegex);
      if (titleMatch) {
          episodeInfo = titleMatch[0];
      } else {
          // Check description
          const descMatch = description.match(epRegex);
          if (descMatch) {
            episodeInfo = descMatch[0];
          }
      }

      return {
        href: anchor.getAttribute('href') || '',
        title: contentTitle,
        description: description,
        episodeInfo: episodeInfo,
        addedAt: Date.now()
      };
    }

    function setButtonState(btn, state) {
      if (!btn) return;
      btn.classList.remove('is-downloading', 'is-complete');
      if (state === 'downloading') {
        btn.classList.add('is-downloading');
        btn.innerHTML = '<div class="spinner"></div>';
      } else if (state === 'complete') {
        btn.classList.add('is-complete');
        btn.innerHTML = '<i data-lucide="check-circle" style="width: 24px; height: 24px;"></i>';
      } else {
        btn.innerHTML = '<i data-lucide="download" style="width: 24px; height: 24px;"></i>';
      }
      initializeLucideIcons();
    }

    function updateButtonState(id, state, progress) {
        const item = items[id];
        if (!item) return;
        const anchors = document.querySelectorAll(`a[href="${item.href}"]`);
        anchors.forEach(a => {
            const btn = a.querySelector('.zentrio-dl-btn');
            if (btn) setButtonState(btn, state);
        });
    }

    function generateId() {
      return 'dl_' + Math.random().toString(36).slice(2);
    }

    function deriveRemoteUrlFromHref(href) {
      try {
        if (!href) return null;
        const idx = href.indexOf('#/player/');
        if (idx === -1) return null;
        
        const raw = href.substring(idx + 9);
        let decoded = raw;
        try {
            decoded = decodeURIComponent(raw);
            // Try double decode just in case
            if (decoded.includes('%')) {
                try { decoded = decodeURIComponent(decoded); } catch(e) {}
            }
        } catch(e) {}
        
        // Try to parse JSON from the decoded string to find 'url' or 'stream' property
        try {
            // Look for JSON-like structure
            const firstBrace = decoded.indexOf('{');
            const lastBrace = decoded.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace > firstBrace) {
                const jsonStr = decoded.substring(firstBrace, lastBrace + 1);
                const obj = JSON.parse(jsonStr);
                if (obj) {
                    if (obj.url && typeof obj.url === 'string' && obj.url.startsWith('http')) return obj.url;
                    if (obj.stream && obj.stream.url && typeof obj.stream.url === 'string' && obj.stream.url.startsWith('http')) return obj.stream.url;
                    if (obj.streams && Array.isArray(obj.streams) && obj.streams.length > 0 && obj.streams[0].url) return obj.streams[0].url;
                }
            }
        } catch(e) {}

        const extractUrls = (str) => {
            const urls = [];
            const regex = /(https?:\/\/[^\s"'<>]+)/gi;
            let match;
            while ((match = regex.exec(str)) !== null) {
                urls.push(match[1]);
            }
            return urls;
        };
        
        const candidates = [...extractUrls(raw), ...extractUrls(decoded)];
        
        // 1. Video extensions
        for (const url of candidates) {
            if (url.startsWith('blob:')) continue;
            let clean = url;
            if (clean.includes('%3A') || clean.includes('%2F')) {
                try { clean = decodeURIComponent(clean); } catch(e) {}
            }
            if (/\.(mp4|mkv|avi|mov|webm|m3u8|mpd)($|\?)/i.test(clean)) {
                return clean;
            }
        }
        
        // 2. Fallback: any http link that is not a known non-video type
        // Sort by length descending, as stream URLs are usually long/complex
        candidates.sort((a, b) => b.length - a.length);
        
        for (const url of candidates) {
             let clean = url;
             if (clean.includes('%3A') || clean.includes('%2F')) {
                try { clean = decodeURIComponent(clean); } catch(e) {}
            }
            if (!/\.(json|srt|vtt|jpg|jpeg|png|gif|webp|js|css|html|svg|ico|woff|woff2|map)($|\?)/i.test(clean) &&
                !/manifest\.json/i.test(clean) &&
                !/stremio_core_web/i.test(clean) &&
                !/stremio-assets/i.test(clean)) {
                return clean;
            }
        }
        
        return null;
      } catch(_) { return null; }
    }

    function startDownload(anchor, btn) {
      if (!anchor || !btn) return;
      if (btn.classList.contains('is-downloading')) return;
      
      let info = extractStreamInfo(anchor);
      const id = generateId();
      
      // Try to get enhanced data from integration cache
      if (window.getZentrioStreamData) {
          const cached = window.getZentrioStreamData(info.href);
          if (cached) {
              console.log('[ZDM] Found cached stream data', cached);
              if (cached.url && (cached.url.startsWith('http') || cached.url.startsWith('https'))) {
                  // We found the direct URL from the core object!
                  info.directUrl = cached.url;
              } else if (cached.externalUrl && (cached.externalUrl.startsWith('http') || cached.externalUrl.startsWith('https'))) {
                  info.directUrl = cached.externalUrl;
              }
              
              // Update metadata
              if (cached.title) info.title = cached.title;
              if (cached.name) info.episodeInfo = cached.name;
              if (cached.addon && cached.addon.manifest && cached.addon.manifest.name) {
                  info.description = cached.addon.manifest.name;
              }
          }
      }

      const directUrl = info.directUrl || deriveRemoteUrlFromHref(info.href);
      
      console.log('[ZDM] startDownload', id, info.title, 'directUrl:', directUrl);

      // Store item info locally for probing context
      items[id] = { ...info, id };

      if (ALWAYS_PROBE) {
        const hash = info.href && info.href.startsWith('#') ? info.href : '#' + (info.href || '');
        markProbing(id, hash);
        
        // If we have a likely URL, wait less time for probe (4s) to see if we can get a better one (e.g. resolved redirect)
        // If we don't have directUrl, wait longer (15s)
        // If we have a directUrl from the integration cache (which is authoritative), we can skip probing entirely or wait very briefly
        const isAuthoritative = !!(window.getZentrioStreamData && window.getZentrioStreamData(info.href));
        const timeoutMs = isAuthoritative ? 500 : (directUrl ? 4000 : 15000);
        
        // Fallback timeout
        setTimeout(() => {
          if (probing[id]) {
            clearProbing(id);
            if (directUrl) {
               console.log('[ZDM] Probe timed out (or skipped), using directUrl', directUrl);
               sendToCore({
                  type: 'zentrio-download-request',
                  id,
                  href: info.href,
                  title: info.title,
                  episodeInfo: info.episodeInfo,
                  url: directUrl
               });
            } else {
               // Try one last check for direct URL in case it was populated late
               const lateDirectUrl = deriveRemoteUrlFromHref(info.href);
               if (lateDirectUrl) {
                   console.log('[ZDM] Probe timed out, found lateDirectUrl', lateDirectUrl);
                   sendToCore({
                      type: 'zentrio-download-request',
                      id,
                      href: info.href,
                      title: info.title,
                      episodeInfo: info.episodeInfo,
                      url: lateDirectUrl
                   });
               } else {
                   console.warn('[ZDM] Could not extract media URL');
                   alert('Could not extract media URL. Please try playing the video first.');
                   setButtonState(btn, 'default');
               }
            }
          }
        }, timeoutMs);
      } else if (directUrl) {
        sendToCore({
            type: 'zentrio-download-request',
            id,
            href: info.href,
            title: info.title,
            episodeInfo: info.episodeInfo,
            url: directUrl
        });
      } else {
        const hash = info.href && info.href.startsWith('#') ? info.href : '#' + (info.href || '');
        markProbing(id, hash);
      }
      
      // Optimistically set button state
      setButtonState(btn, 'downloading');
    }

    function scan(force) {
      const anchors = collectStreamAnchors();
      anchors.forEach(a => {
        if (!isProcessed(a)) {
          const href = a.getAttribute('href');
          if (!href || href.indexOf('#/player/') === -1) return;
          markProcessed(a);
          createButton(a);
        } else {
          if (needsUpdate(a)) {
             markProcessed(a);
             const btn = a.querySelector('.zentrio-dl-btn');
             if (btn) setButtonState(btn, 'default');
          }
        }
      });
    }

    function debounce(fn, wait) {
      let t;
      return function() {
        clearTimeout(t);
        const args = arguments, ctx = this;
        t = setTimeout(() => fn.apply(ctx, args), wait);
      };
    }

    function initializeLucideIcons() {
      if (typeof window.lucide !== 'undefined' && window.lucide.createIcons) {
        try { window.lucide.createIcons(); } catch (e) {}
      } else {
        setTimeout(() => initializeLucideIcons(), 500);
      }
    }

    function renderPopupList() {
        const list = document.getElementById('zentrioPopupList');
        if (!list) return;
        
        const recentItems = Object.values(items)
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 5);
            
        if (recentItems.length === 0) {
            list.innerHTML = '<div class="zentrio-popup-empty">No active downloads</div>';
            return;
        }
        
        list.innerHTML = recentItems.map(item => {
            const pct = item.progress || 0;
            const status = item.status || 'pending';
            const title = item.title || 'Unknown';
            const ep = item.episodeInfo ? `<span style="color: #aaa; margin-left: 6px;">${item.episodeInfo}</span>` : '';
            
            let metaText = status;
            if (status === 'downloading') {
                metaText = `${Math.round(pct)}%`;
            } else if (status === 'completed') {
                metaText = 'Completed';
            } else if (status === 'failed') {
                metaText = 'Failed';
            }
            
            return `
                <div class="zentrio-popup-item">
                    <div class="zentrio-item-title" title="${title}">${title}${ep}</div>
                    <div class="zentrio-item-meta">
                        <span>${metaText}</span>
                    </div>
                    ${status === 'downloading' ? `
                    <div class="zentrio-item-progress">
                        <div class="zentrio-item-bar" style="width: ${pct}%"></div>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    function init() {
      injectStyles();
      
      // Ask Core for root handle status to update modal if needed
      sendToCore({ type: 'zentrio-download-root-request' });

      scan();
      const observer = new MutationObserver(debounce(() => scan(), 250));
      observer.observe(document.body, { childList: true, subtree: true });
      
      setTimeout(() => scan(true), 800);
      setTimeout(() => scan(true), 1600);
      setInterval(() => scan(), 4000);
      
      window.addEventListener('hashchange', () => setTimeout(() => scan(true), 120));
      
      document.addEventListener('click', (e) => {
        const target = e.target;
        if (!target) return;
        const el = target instanceof Element ? target : null;
        const a = el && el.closest ? el.closest('a[href*="#/player/"]') : null;
        if (a && !isProcessed(a)) {
          markProcessed(a);
          createButton(a);
        }
      }, true);

      document.addEventListener('contextmenu', (e) => {
        const target = e.target;
        if (!target) return;
        const el = target instanceof Element ? target : null;
        if (el && el.closest('.zentrio-has-actions')) {
          e.preventDefault();
        }
      }, true);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }

  } catch(err) {
    console.error('Zentrio Downloads Manager init failed', err);
  }
})();