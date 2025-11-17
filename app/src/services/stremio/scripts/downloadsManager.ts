export const getDownloadsManagerScript = () => `
  // Zentrio Downloads Manager (Refactor Phase - emits events only, UI handled externally)
  (function() {
    try {
      const session = (typeof window !== 'undefined'
        ? (window['session'] || window['zentrioSession'] || null)
        : null);

      // Debug bootstrap info for downloads manager
      try {
        console.log('[ZDM] bootstrap', {
          hasSession: !!session,
          downloadsManagerEnabled: session ? session.downloadsManagerEnabled : undefined,
          userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) || null,
          locationHref: (typeof location !== 'undefined' && location.href) || null,
        });
      } catch (_) {}

      // Feature flag (enabled by default)
      if (session && session.downloadsManagerEnabled === false) {
        try { console.log('[ZDM] disabled via session flag, aborting init'); } catch (_) {}
        return;
      }

      // Broaden selector: some streams may not retain 'stream-container' class consistently
      // Original single selector replaced by a broadened set to adapt to DOM variations
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
      const ACTIVE_KEY = '__zentrioActiveDownloads';
const STYLE_ID = 'zentrio-downloads-style-core';

// Debug / logging utilities
const DEBUG = true;
function zdmLog(...a) { try { if (DEBUG) console.log('[ZDM]', ...a); } catch(_) {} }
// Global error & unhandled rejection debugging to surface precise location of syntax/runtime issues
if (!window.__zdmErrorsHooked) {
  window.__zdmErrorsHooked = true;
  window.addEventListener('error', (e) => {
    try {
      window.postMessage({
        type: 'zentrio-download-debug',
        phase: 'script-error',
        message: e.message,
        filename: e.filename,
        lineno: e.lineno,
        colno: e.colno,
        stack: e.error && e.error.stack || null
      }, '*');
    } catch(_) {}
  });
  window.addEventListener('unhandledrejection', (e) => {
    try {
      window.postMessage({
        type: 'zentrio-download-debug',
        phase: 'unhandled-rejection',
        reason: (e.reason && (e.reason.message || e.reason.toString())) || String(e.reason),
        stack: e.reason && e.reason.stack || null
      }, '*');
    } catch(_) {}
  });
}

// Network instrumentation (fetch + XHR) to observe media related requests
function patchFetchAndXHR(ctx) {
  const w = ctx || window;
  if (w.__zdmPatched) return;
  w.__zdmPatched = true;

  const postTarget = (w.parent && w.parent !== w) ? w.parent : w;

  const origFetch = w.fetch;
  if (typeof origFetch === 'function') {
    w.fetch = async function(...args) {
      let url = '';
      try { url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || ''); } catch(_) {}
      try { zdmLog('[net]', w === window ? 'win' : 'iframe', 'fetch()', url, args[1]?.method || 'GET'); } catch(_) {}
      const res = await origFetch.apply(this, args);
      try {
        const ct = res.headers.get('content-type') || '';
        if (/\bmpegurl|application\/dash|video|octet-stream/i.test(ct) ||
            /\.m3u8(\?|$)/i.test(url) || /\.mpd(\?|$)/i.test(url) || /\.mp4(\?|$)/i.test(url)) {
          zdmLog('[probe] media response', url, ct, res.status, w === window ? 'main' : 'iframe');
          postTarget.postMessage({ type: 'zentrio-download-media-probe', url, contentType: ct, status: res.status, ctx: (w === window ? 'main' : 'iframe') }, '*');
        }
      } catch(_) {}
      return res;
    };
  }

  const OrigXHR = w.XMLHttpRequest;
  if (OrigXHR) {
    function WrappedXHR() {
      const xhr = new OrigXHR();
      let openUrl = '';
      const origOpen = xhr.open;
      xhr.open = function(method, url, ...rest) {
        openUrl = url;
        try { zdmLog('[net]', w === window ? 'win' : 'iframe', 'xhr.open()', method, url); } catch(_) {}
        return origOpen.call(xhr, method, url, ...rest);
      };
      xhr.addEventListener('load', function() {
        try {
          const ct = xhr.getResponseHeader('content-type') || '';
          if (/\bmpegurl|application\/dash|video|octet-stream/i.test(ct) ||
              /\.m3u8(\?|$)/i.test(openUrl) || /\.mpd(\?|$)/i.test(openUrl) || /\.mp4(\?|$)/i.test(openUrl)) {
            zdmLog('[probe] xhr media response', openUrl, ct, xhr.status, w === window ? 'main' : 'iframe');
            postTarget.postMessage({ type: 'zentrio-download-media-probe', url: openUrl, contentType: ct, status: xhr.status, ctx: (w === window ? 'main' : 'iframe') }, '*');
          }
        } catch(_) {}
      });
      return xhr;
    }
    w.XMLHttpRequest = WrappedXHR;
  }
}

      // In-memory structures
      const active = {};
      const items = {}; // store minimal metadata by id for retry

      // --- Probe mode for cases where initial JSON doesn't expose final media URL (player loads it later) ---
      const probing = {}; // id -> { startedAt, anchorHash }
      const ALWAYS_PROBE = true; // proactively open hidden player iframe for every download to capture media requests early

function openHiddenPlayer(hash) {
        try {
          if (!hash || !hash.startsWith('#/player/')) return;
          const iframeId = 'zdm-probe-frame-' + btoa(hash).replace(/[^a-z0-9]/ig,'').slice(0,12);
          if (document.getElementById(iframeId)) {
            zdmLog('Probe iframe already exists', iframeId);
            return;
          }
          zdmLog('Creating hidden probe iframe', hash);
          const ifr = document.createElement('iframe');
          ifr.id = iframeId;
          const basePath = window.location.pathname.split('#')[0];
          ifr.src = basePath + hash;
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
              zdmLog('Probe iframe loaded', hash);
              window.postMessage({ type: 'zentrio-download-debug', phase: 'probe-iframe-load', hash }, '*');
              if (ifr.contentWindow) {
                patchFetchAndXHR(ifr.contentWindow);
                window.postMessage({ type: 'zentrio-download-debug', phase: 'probe-iframe-patched', hash }, '*');
              } else {
                window.postMessage({ type: 'zentrio-download-debug', phase: 'probe-iframe-no-contentWindow', hash }, '*');
              }
            } catch(e2) {
              zdmLog('Probe iframe patch error', e2);
              window.postMessage({ type: 'zentrio-download-debug', phase: 'probe-iframe-patch-error', error: ''+e2, hash }, '*');
            }
          });
          document.body.appendChild(ifr);
          setTimeout(() => { try { ifr.remove(); } catch(_){} }, 90000);
        } catch(e) {
          zdmLog('openHiddenPlayer error', e);
          window.postMessage({ type: 'zentrio-download-debug', phase: 'probe-iframe-create-error', error: ''+e, hash }, '*');
        }
      }

function markProbing(id, anchorHash) {
        probing[id] = { startedAt: Date.now(), anchorHash };
        zdmLog('Entering probe mode', id, anchorHash);
        openHiddenPlayer(anchorHash);
        window.postMessage({ type: 'zentrio-download-debug', id, phase: 'probing', anchorHash, ts: Date.now() }, '*');
        // After 4s if still probing, emit waiting debug
        setTimeout(() => {
          if (probing[id]) {
            window.postMessage({ type: 'zentrio-download-debug', id, phase: 'probing-waiting', waitedMs: 4000 }, '*');
          }
        }, 4000);
      }

      function clearProbing(id) {
        if (probing[id]) delete probing[id];
      }

      async function startProbeDownload(id, mediaUrl) {
        if (!probing[id]) return;
        clearProbing(id);
        zdmLog('Starting probe-derived download', id, mediaUrl);
        try {
          window.postMessage({ type: 'zentrio-download-debug', id, phase: 'probe-media-discovered', mediaUrl }, '*');
        } catch(_) {}

        const fakeItem = items[id];
        if (!fakeItem) {
          zdmLog('Probe item missing', id);
          return;
        }

        if (active[id]) { try { active[id].abort(); } catch(_) {} }
        const controller = new AbortController();
        active[id] = controller;
        window.postMessage({
          type: 'zentrio-download-progress',
          id,
          progress: 0,
          bytesReceived: 0,
          size: 0,
          eta: null
        }, '*');

        const title = fakeItem.title;

        try {
          if (/\.m3u8(\?|$)/i.test(mediaUrl)) {
            // HLS path
            const fileName = deriveFileName(title, mediaUrl).replace(/\.m3u8(\?|$)/i, '.ts');
            let writable = null;
            let rootDir = await ensureRootDirectory();
            if (rootDir) {
              const { writable: dirWritable } = await openFileWritable(rootDir, fileName);
              writable = dirWritable;
            }
            if (!writable) {
              let fh = await requestSaveHandle(fileName);
              if (fh) { try { writable = await fh.createWritable(); } catch(_) {} }
            }

            const hlsResult = await downloadHls(mediaUrl, controller, (p) => {
              window.postMessage({
                type: 'zentrio-download-progress',
                id,
                progress: 0,
                bytesReceived: p.received,
                size: 0,
                eta: null,
                segmentsDone: p.idx,
                segmentsTotal: p.total
              }, '*');
              if (p.idx === 1 || p.idx % 25 === 0 || p.idx === p.total) {
                try {
                  window.postMessage({
                    type: 'zentrio-download-debug',
                    id,
                    phase: 'hls-progress',
                    segIndex: p.idx,
                    segTotal: p.total,
                    received: p.received,
                    probe: true
                  }, '*');
                } catch(_) {}
              }
            });

            const totalBufferLen = hlsResult.chunks.reduce((a,u8)=>a+u8.byteLength,0);
            const merged = new Uint8Array(totalBufferLen);
            let off = 0;
            for (const u8 of hlsResult.chunks) {
              merged.set(u8, off);
              off += u8.byteLength;
              if (writable) { try { await writable.write(u8); } catch(_) {} }
            }
            if (writable) { try { await writable.close(); } catch(_) {} }
            const blob = new Blob([merged], { type: hlsResult.contentType });
            const blobUrl = URL.createObjectURL(blob);
            window.postMessage({ type: 'zentrio-download-complete', id, size: totalBufferLen, fileName, blobUrl }, '*');
            try {
              window.postMessage({ type: 'zentrio-download-debug', id, phase: 'hls-complete', segments: hlsResult.chunks.length, size: totalBufferLen, fileName, probe: true }, '*');
            } catch(_) {}
            delete active[id];
            return;
          }

          // Direct file
          const resp = await fetch(mediaUrl, { signal: controller.signal });
            if (!resp.ok || !resp.body) throw new Error('Probe fetch failed ' + resp.status);
          const ct = resp.headers.get('content-type') || 'video/mp4';
          const fileName = deriveFileName(title, mediaUrl);

          let writable = null;
          let rootDir = await ensureRootDirectory();
          if (rootDir) {
            const { writable: dirWritable } = await openFileWritable(rootDir, fileName);
            writable = dirWritable;
          }
          if (!writable) {
            let fh = await requestSaveHandle(fileName);
            if (fh) { try { writable = await fh.createWritable(); } catch(_) {} }
          }

          const reader = resp.body.getReader();
          const chunks = [];
          let received = 0;
          const len = Number(resp.headers.get('Content-Length')) || 0;
          const start = Date.now();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              received += value.length;
              if (writable) { try { await writable.write(value); } catch(_) {} }
              let progress = 0;
              let eta = null;
              if (len) {
                progress = (received / len) * 100;
                const elapsed = (Date.now() - start)/1000;
                if (elapsed > 1) {
                  const speed = received / elapsed;
                  const rem = len - received;
                  eta = Math.round(rem / speed);
                }
              } else {
                progress = Math.min(99, (received / (1024*1024)) % 100);
              }
              window.postMessage({ type: 'zentrio-download-progress', id, progress, bytesReceived: received, size: len, eta }, '*');
            }
          }
          if (writable) { try { await writable.close(); } catch(_) {} }
          const blob = new Blob(chunks, { type: ct });
          const blobUrl = URL.createObjectURL(blob);
          window.postMessage({ type: 'zentrio-download-complete', id, size: len || received, fileName, blobUrl }, '*');
          try {
            window.postMessage({ type: 'zentrio-download-debug', id, phase: 'direct-complete', size: len || received, fileName, contentType: ct, probe: true }, '*');
          } catch(_) {}
        } catch (e) {
          if (controller.signal.aborted) {
            window.postMessage({ type: 'zentrio-download-cancelled', id }, '*');
          } else {
            zdmLog('Probe download failed', e);
            window.postMessage({ type: 'zentrio-download-failed', id }, '*');
          }
        } finally {
          delete active[id];
        }
      }

      function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const css = \`
          .zentrio-dl-btn {
            position: absolute;
            top: 6px;
            right: 6px;
            background: rgba(0,0,0,0.55);
            border: 1px solid rgba(255,255,255,0.25);
            color: #fff;
            width: 28px;
            height: 28px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 15px;
            line-height: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            padding: 0;
            margin: 0;
            opacity: 0.85;
            transition: background .15s, border-color .15s, opacity .15s, transform .15s;
            z-index: 10050; /* ensure visibility over stream overlays */
          }
          .zentrio-dl-btn:focus {
            outline: 2px solid #dc2626;
            outline-offset: 2px;
          }
          .zentrio-dl-btn:hover {
            background: #dc2626;
            border-color: #dc2626;
            opacity: 1;
          }
          .zentrio-dl-btn:active {
            transform: scale(0.92);
          }
          .zentrio-dl-btn.is-downloading {
            background: #1e3a8a;
            border-color: #1e3a8a;
            cursor: default;
          }
          .zentrio-dl-btn.is-complete {
            background: #059669;
            border-color: #059669;
          }
          .zentrio-dl-btn .spinner {
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255,255,255,0.4);
            border-top-color: #fff;
            border-radius: 50%;
            animation: zentrio-spin 0.8s linear infinite;
          }
          @keyframes zentrio-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          /* Stream actions layout (reuse previous approach) */
          .zentrio-has-actions {
            position: relative;
            padding-right: 78px !important;
          }
          .zentrio-stream-actions {
            position: absolute;
            top: 6px;
            right: 6px;
            display: flex;
            gap: 6px;
            align-items: center;
            z-index: 3;
          }
          .zentrio-stream-actions .zentrio-dl-btn {
            position: static;
            margin: 0;
          }
          svg.icon-rAZvO {
            opacity: 1 !important;
            visibility: visible !important;
          }
        \`;
        const el = document.createElement('style');
        el.id = STYLE_ID;
        el.textContent = css;
        document.head.appendChild(el);
      }

      function injectBannerStyles() {
        if (document.getElementById('zdm-setup-banner-style')) return;
        const css = \`
          #zdm-setup-banner {
            position: fixed;
            left: 50%;
            transform: translateX(-50%);
            top: 10px;
            z-index: 10060;
            background: rgba(15,23,42,0.98);
            color: #e5e7eb;
            padding: 8px 14px;
            border-radius: 9999px;
            box-shadow: 0 10px 20px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            gap: 10px;
            font-size: 13px;
          }
          #zdm-setup-banner button {
            border: none;
            border-radius: 9999px;
            padding: 5px 10px;
            font-size: 12px;
            cursor: pointer;
          }
          #zdm-setup-banner button.zdm-primary {
            background: #dc2626;
            color: #fff;
          }
          #zdm-setup-banner button.zdm-secondary {
            background: transparent;
            color: #9ca3af;
          }
          #zdm-setup-banner button.zdm-secondary:hover {
            background: rgba(148,163,184,0.12);
          }
        \`;
        const el = document.createElement('style');
        el.id = 'zdm-setup-banner-style';
        el.textContent = css;
        document.head.appendChild(el);
      }

      const BANNER_DISMISS_LS_KEY = 'zentrioDownloadsDirBannerDismissed';

      function shouldShowSetupBanner() {
        if (!('showDirectoryPicker' in window)) return false;
        try {
          const raw = localStorage.getItem(BANNER_DISMISS_LS_KEY);
          if (raw === '1') return false;
        } catch (_) {}
        return true;
      }

      async function maybeShowSetupBanner() {
        if (!shouldShowSetupBanner()) return;
        try {
          const persisted = await loadPersistedHandle();
          if (persisted) {
            window.__zentrioSaveRootHandle = persisted;
            return;
          }
        } catch (_) {}
        createSetupBanner();
      }

      function createSetupBanner() {
        if (document.getElementById('zdm-setup-banner')) return;
        const banner = document.createElement('div');
        banner.id = 'zdm-setup-banner';

        const text = document.createElement('span');
        text.textContent = 'Choose a default folder for Zentrio downloads?';
        banner.appendChild(text);

        const primary = document.createElement('button');
        primary.className = 'zdm-primary';
        primary.textContent = 'Choose folder';

        const secondary = document.createElement('button');
        secondary.className = 'zdm-secondary';
        secondary.textContent = 'Not now';

        banner.appendChild(primary);
        banner.appendChild(secondary);
        document.body.appendChild(banner);

        const close = () => { try { banner.remove(); } catch (_) {} };

        primary.addEventListener('click', async () => {
          try {
            if (!('showDirectoryPicker' in window)) {
              close();
              return;
            }
            const handle = await window.showDirectoryPicker({ id: 'zentrio-downloads', mode: 'readwrite', startIn: 'videos' });
            if (handle) {
              window.__zentrioSaveRootHandle = handle;
              persistHandle(handle);
              try { localStorage.setItem(BANNER_DISMISS_LS_KEY, '1'); } catch (_) {}
              try { window.postMessage({ type: 'zentrio-download-root-handle', handle }, '*'); } catch (_) {}
            }
          } catch (_) {
            // user cancelled; leave banner so they can try again or dismiss
            return;
          }
          close();
        });

        secondary.addEventListener('click', () => {
          try { localStorage.setItem(BANNER_DISMISS_LS_KEY, '1'); } catch (_) {}
          close();
        });
      }

      function ensureRelative(el) {
        const cs = window.getComputedStyle(el);
        if (cs.position === 'static' || !cs.position) {
          el.style.position = 'relative';
        }
      }

      function createButton(anchor) {
        if (anchor.querySelector('.zentrio-dl-btn')) return;
        ensureRelative(anchor);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'zentrio-dl-btn';
        btn.title = 'Download';
        btn.textContent = '⬇';

        const playIcon = anchor.querySelector('svg.icon-rAZvO');
        if (playIcon) {
          let actions = anchor.querySelector('.zentrio-stream-actions');
          if (!actions) {
            actions = document.createElement('span');
            actions.className = 'zentrio-stream-actions';
            anchor.classList.add('zentrio-has-actions');
            anchor.appendChild(actions);
            if (playIcon.parentElement !== actions) {
              actions.appendChild(playIcon);
            }
          } else {
            anchor.classList.add('zentrio-has-actions');
          }
          actions.appendChild(btn);
        } else {
          anchor.appendChild(btn);
        }

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          startDownload(anchor, btn);
        }, { passive: false });
      }

      function repositionIfPlayIconAppears(anchor) {
        const playIcon = anchor.querySelector('svg.icon-rAZvO');
        if (!playIcon) return;
        let actions = anchor.querySelector('.zentrio-stream-actions');
        if (!actions) {
          actions = document.createElement('span');
          actions.className = 'zentrio-stream-actions';
          anchor.classList.add('zentrio-has-actions');
          anchor.appendChild(actions);
          if (playIcon.parentElement !== actions) {
            actions.appendChild(playIcon);
          }
        }
        const btn = anchor.querySelector('.zentrio-dl-btn');
        if (btn && btn.parentElement !== actions) {
          actions.appendChild(btn);
        }
      }

      function markProcessed(anchor) { anchor.setAttribute(BTN_ATTR, '1'); }
      function isProcessed(anchor) { return anchor.hasAttribute(BTN_ATTR); }

      function extractStreamInfo(anchor) {
        const titleEl = anchor.querySelector('.addon-name-tC8PX, .name, [class*="addon-name"], .info-container-TihQo');
        const descEl = anchor.querySelector('.description-container-vW_De, [class*="description"]');
        return {
          href: anchor.getAttribute('href') || '',
          title: titleEl ? (titleEl.textContent || '').trim() : (anchor.getAttribute('title') || '').trim(),
          description: descEl ? (descEl.getAttribute('title') || descEl.textContent || '').trim() : '',
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
          btn.textContent = '✅';
        } else {
          btn.textContent = '⬇';
        }
      }

      function generateId() {
        return 'dl_' + Math.random().toString(36).slice(2);
      }

      function deriveRemoteUrlFromHref(href) {
        try {
          if (!href) return null;
          const idx = href.indexOf('#/player/');
          if (idx === -1) return null;
          const part = href.substring(idx + 9);
          const segments = part.split('/');
          for (let i = segments.length -1; i >=0; i--) {
            if (segments[i].startsWith('https%3A%2F%2F') || segments[i].startsWith('http%3A%2F%2F')) {
              return decodeURIComponent(segments[i]);
            }
          }
          return null;
        } catch(_) { return null; }
      }

      function sanitizeName(str) {
        return (str || 'download')
          .replace(/[\\/:*?"<>|]+/g,'_')
          .replace(/\\s+/g,' ')
          .trim()
          .substring(0,120);
      }

      function extractFileExtension(url) {
        try {
          const u = new URL(url);
          const last = u.pathname.split('/').pop() || '';
          if (last.includes('.')) {
            const ext = last.split('.').pop().toLowerCase();
            if (ext.length <= 5) return ext;
          }
        } catch(_) {}
        return 'mp4';
      }

      function deriveFileName(title, remoteUrl) {
        const base = sanitizeName(title || 'video');
        const ext = extractFileExtension(remoteUrl);
        return base + '.' + ext;
      }

      // Persistent directory handle (prompt once + persisted via IndexedDB so iframe reloads reuse without asking)
      const IDB_DB = 'zentrioDownloads';
      const IDB_STORE = 'handles';

      function openHandleDb() {
        return new Promise((resolve, reject) => {
          const req = indexedDB.open(IDB_DB, 1);
            req.onupgradeneeded = () => {
              try {
                const db = req.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                  db.createObjectStore(IDB_STORE);
                }
              } catch (e) { /* ignore */ }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
      }

      async function loadPersistedHandle() {
        try {
          const db = await openHandleDb();
          return await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const getReq = store.get('root');
            getReq.onsuccess = () => resolve(getReq.result || null);
            getReq.onerror = () => reject(getReq.error);
          });
        } catch (_) {
          return null;
        }
      }

      async function persistHandle(handle) {
        try {
          const db = await openHandleDb();
          await new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            const putReq = store.put(handle, 'root');
            putReq.onsuccess = () => resolve();
            putReq.onerror = () => reject(putReq.error);
          });
        } catch (_) { /* ignore */ }
      }

      async function ensureRootDirectory() {
        if (window.__zentrioSaveRootHandle) return window.__zentrioSaveRootHandle;

        // Attempt to load persisted handle (no prompt)
        try {
          const persisted = await loadPersistedHandle();
          if (persisted) {
            window.__zentrioSaveRootHandle = persisted;
            return persisted;
          }
        } catch (_) { /* ignore */ }

        if (window.__zentrioSaveRootDenied) return null;

        // Prompt user only if none cached/persisted
        try {
          const handle = await window.showDirectoryPicker({ id: 'zentrio-downloads', mode: 'readwrite', startIn: 'videos' });
          window.__zentrioSaveRootHandle = handle;
          // Persist for future iframe loads
          persistHandle(handle);
          window.postMessage({ type: 'zentrio-download-root-handle', handle }, '*');
          return handle;
        } catch (e) {
          window.__zentrioSaveRootDenied = true;
          return null;
        }
      }

      async function openFileWritable(rootHandle, fileName) {
        if (!rootHandle) return { writable: null, fileHandle: null };
        try {
          const safeFolder = await rootHandle.getDirectoryHandle('Zentrio', { create: true });
          const fh = await safeFolder.getFileHandle(fileName, { create: true });
          const writable = await fh.createWritable();
          return { writable, fileHandle: fh };
        } catch (e) {
          return { writable: null, fileHandle: null };
        }
      }

      function findMediaUrlInJson(obj) {
        const urls = [];
        const recurse = (val) => {
          if (!val) return;
            if (typeof val === 'string') {
if (/https?:\\/\\//.test(val) && /\\.(mp4|mkv|webm|mpg|mpeg|avi|m3u8|mpd|ts|m4s)(\\?|$)/i.test(val)) {
                urls.push(val);
              }
            } else if (Array.isArray(val)) {
              val.forEach(recurse);
            } else if (typeof val === 'object') {
              Object.values(val).forEach(recurse);
            }
        };
        recurse(obj);
        return urls;
      }

      async function requestSaveHandle(name) {
        if (!('showSaveFilePicker' in window)) return null;
        try {
          return await window.showSaveFilePicker({
            suggestedName: name,
            types: [{ description: 'Video', accept: { 'video/*': ['.mp4', '.mkv', '.webm'] } }]
          });
        } catch(_) { return null; }
      }

/**
 * Basic HLS support:
 *  - Detect master vs media playlist
 *  - Select highest BANDWIDTH variant
 *  - Fetch segments sequentially and aggregate
 * NOTE: Produces a .ts transport stream blob.
 */
async function fetchText(url, signal) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error('Failed ' + url + ' ' + r.status);
  return await r.text();
}
function parseMasterPlaylist(txt, baseUrl) {
  const variants = [];
  const lines = txt.split(/\\r?\\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const bwMatch = line.match(/BANDWIDTH=(\\d+)/);
      const bandwidth = bwMatch ? parseInt(bwMatch[1], 10) : 0;
      const next = lines[i + 1] || '';
      if (next && !next.startsWith('#')) {
        const resolved = new URL(next, baseUrl).href;
        variants.push({ bandwidth, url: resolved });
      }
    }
  }
  return variants;
}
function parseMediaPlaylistSegments(txt, baseUrl) {
  const segs = [];
  const lines = txt.split(/\\r?\\n/);
  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;
    const resolved = new URL(line, baseUrl).href;
    segs.push(resolved);
  }
  return segs;
}
async function downloadHls(remoteUrl, controller, progressCb) {
  zdmLog('HLS download start', remoteUrl);
  const masterText = await fetchText(remoteUrl, controller.signal);
  let targetPlaylistUrl = remoteUrl;
  if (/EXT-X-STREAM-INF/.test(masterText)) {
    const variants = parseMasterPlaylist(masterText, remoteUrl);
    variants.sort((a, b) => b.bandwidth - a.bandwidth);
    if (variants[0]) targetPlaylistUrl = variants[0].url;
    zdmLog('Selected HLS variant', targetPlaylistUrl);
  }
  const mediaText = targetPlaylistUrl === remoteUrl && /EXTINF:/.test(masterText)
    ? masterText
    : await fetchText(targetPlaylistUrl, controller.signal);
  const segments = parseMediaPlaylistSegments(mediaText, targetPlaylistUrl);
  zdmLog('Segment count', segments.length);
  const chunks = [];
  let received = 0;
  let idx = 0;
  for (const segUrl of segments) {
    if (controller.signal.aborted) throw new Error('aborted');
    try {
      const r = await fetch(segUrl, { signal: controller.signal });
      if (!r.ok) throw new Error('seg status ' + r.status);
      const b = await r.arrayBuffer();
      received += b.byteLength;
      chunks.push(new Uint8Array(b));
      idx++;
      progressCb && progressCb({ received, idx, total: segments.length });
    } catch (e) {
      zdmLog('Segment fetch failed', segUrl, e);
      break;
    }
  }
return { chunks, contentType: 'video/mp2t' };
}

// --- Minimal DASH (MPD) support (best-effort; not full spec) ---
async function fetchTextMaybe(url, signal) {
  const r = await fetch(url, { signal });
  if (!r.ok) throw new Error('Failed ' + url + ' ' + r.status);
  return await r.text();
}

function extractAbsolute(url, base) {
  try { return new URL(url, base).href; } catch(_) { return url; }
}

function parseMpdForSegments(xmlText, baseUrl) {
  // Very simplified: gather initialization + any SegmentURL media attributes or direct BaseURL media files
  const segments = [];
  let initUrl = null;
  try {
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'application/xml');

      // Pick highest bandwidth video Representation
      let chosen = null;
      const reps = Array.from(doc.querySelectorAll('Representation'));
      reps.forEach(r => {
        const mime = r.getAttribute('mimeType') || '';
        if (!/video/i.test(mime)) return;
        const bw = parseInt(r.getAttribute('bandwidth') || '0', 10);
        if (!chosen || bw > chosen.bw) {
          chosen = { node: r, bw };
        }
      });

      if (chosen) {
        // Initialization
        const initEl = chosen.node.querySelector('Initialization');
        if (initEl && initEl.getAttribute('sourceURL')) {
          initUrl = extractAbsolute(initEl.getAttribute('sourceURL'), baseUrl);
          segments.push(initUrl);
        }
        // SegmentList -> SegmentURL
        const segList = chosen.node.querySelector('SegmentList');
        if (segList) {
          const segUrls = Array.from(segList.querySelectorAll('SegmentURL'))
            .map(el => el.getAttribute('media'))
            .filter(Boolean)
            .map(u => extractAbsolute(u, baseUrl));
          segments.push(...segUrls);
        } else {
          // SegmentTemplate naive expansion (limited)
          const segTemplate = chosen.node.querySelector('SegmentTemplate');
          if (segTemplate) {
            const media = segTemplate.getAttribute('media'); // e.g. chunk-$Number$.m4s
            const startNumber = parseInt(segTemplate.getAttribute('startNumber') || '1', 10);
            // Limit segments to avoid runaway (arbitrary cap 300)
            if (media && /\$Number\$/i.test(media)) {
              for (let n = startNumber; n < startNumber + 120; n++) {
                const u = media.replace(/\$Number\$/ig, String(n));
                segments.push(extractAbsolute(u, baseUrl));
              }
            }
          }
        }
      }

      // Fallback: any BaseURL that ends with media extensions
      if (!segments.length) {
        const baseEls = Array.from(doc.querySelectorAll('BaseURL'));
        baseEls.forEach(el => {
          const t = (el.textContent || '').trim();
            if (/\.(mp4|m4s)(\?|$)/i.test(t)) {
              segments.push(extractAbsolute(t, baseUrl));
            }
        });
      }
    } else {
      // Regex fallback (very naive)
      const baseMatches = xmlText.match(/<BaseURL>([^<]+)<\/BaseURL>/gi) || [];
      baseMatches.forEach(m => {
        const inner = m.replace(/<\/?BaseURL>/gi, '');
        if (/\.(mp4|m4s)(\?|$)/i.test(inner)) {
          segments.push(extractAbsolute(inner.trim(), baseUrl));
        }
      });
      const segUrls = xmlText.match(/SegmentURL[^>]+media="([^"]+)"/gi) || [];
      segUrls.forEach(m => {
        const mm = m.match(/media="([^"]+)"/i);
        if (mm && mm[1]) segments.push(extractAbsolute(mm[1], baseUrl));
      });
    }
  } catch (e) {
    zdmLog('MPD parse error', e);
  }
  // Deduplicate
  const seen = new Set();
  const unique = [];
  for (const s of segments) {
    if (!seen.has(s)) { seen.add(s); unique.push(s); }
  }
  return { segments: unique, initUrl };
}

async function downloadDash(remoteUrl, controller, progressCb) {
  zdmLog('DASH download start', remoteUrl);
  let mpdText;
  try {
    mpdText = await fetchTextMaybe(remoteUrl, controller.signal);
  } catch (e) {
    throw new Error('MPD fetch failed');
  }
  const parsed = parseMpdForSegments(mpdText, remoteUrl);
  zdmLog('MPD segments parsed', parsed.segments.length);
  if (!parsed.segments.length) {
    throw new Error('No segments extracted from MPD');
  }
  const chunks = [];
  let received = 0;
  let idx = 0;
  for (const seg of parsed.segments) {
    if (controller.signal.aborted) throw new Error('aborted');
    try {
      const r = await fetch(seg, { signal: controller.signal });
      if (!r.ok) throw new Error('seg ' + r.status);
      const b = await r.arrayBuffer();
      received += b.byteLength;
      chunks.push(new Uint8Array(b));
      idx++;
      progressCb && progressCb({ received, idx, total: parsed.segments.length });
      // Heuristic stop: if large file ( > ~1.2GB ) or > 400 segments
      if (received > 1.2 * 1024 * 1024 * 1024 || idx > 400) {
        zdmLog('DASH heuristic stop', { received, idx });
        break;
      }
    } catch (e) {
      zdmLog('DASH segment fetch error', seg, e);
      break;
    }
  }
  return { chunks, contentType: 'video/mp4' };
}

async function startRealDownload(item) {
        const { id, href, title } = item;
        const initialUrl = deriveRemoteUrlFromHref(href);
        if (!initialUrl) {
          simulate(item);
          return;
        }

        const controller = new AbortController();
        active[id] = controller;

        window.postMessage({
          type: 'zentrio-download-progress',
          id,
          progress: 0,
          bytesReceived: 0,
          size: 0,
          eta: null
        }, '*');

        let remoteUrl = initialUrl;
        let response;

        try {
          response = await fetch(remoteUrl, { signal: controller.signal });
        } catch (e) {
          if (controller.signal.aborted) {
            window.postMessage({ type: 'zentrio-download-cancelled', id }, '*');
          } else {
            window.postMessage({ type: 'zentrio-download-failed', id }, '*');
          }
          return;
        }

        // If we got JSON (likely manifest / metadata), attempt to derive a direct media URL
        let contentType = response.headers.get('Content-Type') || response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          try {
            const json = await response.clone().json();
            const mediaCandidates = findMediaUrlInJson(json);
            zdmLog('JSON media candidates', mediaCandidates);
            // Priority: direct files > HLS > DASH > anything
            let chosen = mediaCandidates.find(u => /\\.(mp4|mkv|webm)(\\?|$)/i.test(u)) ||
                         mediaCandidates.find(u => /\\.m3u8(\\?|$)/i.test(u)) ||
                         mediaCandidates.find(u => /\\.mpd(\\?|$)/i.test(u)) ||
                         mediaCandidates[0];
            if (chosen) {
              remoteUrl = chosen;
              zdmLog('Chosen media from JSON', remoteUrl);
              try {
                response = await fetch(remoteUrl, { signal: controller.signal });
                contentType = response.headers.get('content-type') || '';
              } catch (e2) {
                zdmLog('Secondary fetch failed', e2, '-> entering probe mode');
                markProbing(id, item.href && item.href.startsWith('#') ? item.href : '#' + (item.href || ''));
                setTimeout(() => {
                  if (probing[id]) {
                    zdmLog('Probe timeout fallback (secondary fetch failed)', id);
                    simulate(item);
                    clearProbing(id);
                  }
                }, 15000);
                return;
              }
            } else {
              zdmLog('No usable media URL in JSON -> probe mode');
              markProbing(id, item.href && item.href.startsWith('#') ? item.href : '#' + (item.href || ''));
              setTimeout(() => {
                if (probing[id]) {
                  zdmLog('Probe timeout fallback (no media candidates)', id);
                  simulate(item);
                  clearProbing(id);
                }
              }, 15000);
              return;
            }
          } catch (_) {
            // ignore json parse errors
          }
        }

        // DASH handling branch (MPD) and HLS handling branch (playlist)
        if (/\\.mpd(\\?|$)/i.test(remoteUrl) || /application\\/dash\\+xml|application\\/mpd|application\\/dash/i.test(contentType)) {
          zdmLog('Processing as DASH', remoteUrl);
          const fileName = deriveFileName(title, remoteUrl).replace(/\\.mpd(\\?|$)/i, '.mp4');
          const controllerObj = controller;

          // Acquire directory handle or fallback
          let writable = null;
          let rootDir = await ensureRootDirectory();
          if (rootDir) {
            const { writable: dirWritable } = await openFileWritable(rootDir, fileName);
            writable = dirWritable;
          }
          if (!writable) {
            let fh = await requestSaveHandle(fileName);
            if (fh) {
              try { writable = await fh.createWritable(); } catch(_) {}
            }
          }

          try {
            const dashResult = await downloadDash(remoteUrl, controllerObj, (p) => {
              window.postMessage({
                type: 'zentrio-download-progress',
                id,
                progress: 0,
                bytesReceived: p.received,
                size: 0,
                eta: null,
                segmentsDone: p.idx,
                segmentsTotal: p.total,
                streamType: 'dash'
              }, '*');
            });
            const totalBufferLen = dashResult.chunks.reduce((acc,u8)=>acc+u8.byteLength,0);
            const merged = new Uint8Array(totalBufferLen);
            let off = 0;
            for (const u8 of dashResult.chunks) {
              merged.set(u8, off);
              off += u8.byteLength;
              if (writable) { try { await writable.write(u8); } catch(_) {} }
            }
            if (writable) { try { await writable.close(); } catch(_) {} }
            const blob = new Blob([merged], { type: dashResult.contentType });
            const blobUrl = URL.createObjectURL(blob);
            window.postMessage({
              type: 'zentrio-download-complete',
              id,
              size: totalBufferLen,
              fileName,
              blobUrl
            }, '*');
          } catch(eDash) {
            if (controllerObj.signal.aborted) {
              window.postMessage({ type: 'zentrio-download-cancelled', id }, '*');
            } else {
              zdmLog('DASH download failed', eDash);
              window.postMessage({ type: 'zentrio-download-failed', id }, '*');
            }
          } finally {
            delete active[id];
          }
          return;
        }

        // HLS handling branch (playlist)
        if (/\\.m3u8(\\?|$)/i.test(remoteUrl) || /application\\/vnd\\.apple\\.mpegurl|application\\/x-mpegURL/i.test(contentType)) {
          zdmLog('Processing as HLS', remoteUrl);
          const fileName = deriveFileName(title, remoteUrl).replace(/\\.m3u8(\\?|$)/i, '.ts');
          const controllerObj = controller;

            // Acquire directory handle or fallback
          let writable = null;
          let rootDir = await ensureRootDirectory();
          if (rootDir) {
            const { writable: dirWritable } = await openFileWritable(rootDir, fileName);
            writable = dirWritable;
          }
          if (!writable) {
            let fh = await requestSaveHandle(fileName);
            if (fh) {
              try { writable = await fh.createWritable(); } catch(_) {}
            }
          }

          try {
            const hlsResult = await downloadHls(remoteUrl, controllerObj, (p) => {
              window.postMessage({
                type: 'zentrio-download-progress',
                id,
                progress: 0,
                bytesReceived: p.received,
                size: 0,
                eta: null,
                segmentsDone: p.idx,
                segmentsTotal: p.total
              }, '*');
            });
            // Concatenate
            const totalBufferLen = hlsResult.chunks.reduce((acc, u8) => acc + u8.byteLength, 0);
            const merged = new Uint8Array(totalBufferLen);
            let offset = 0;
            for (const u8 of hlsResult.chunks) {
              merged.set(u8, offset);
              offset += u8.byteLength;
              if (writable) {
                try { await writable.write(u8); } catch(_) {}
              }
            }
            if (writable) {
              try { await writable.close(); } catch(_) {}
            }
            const blob = new Blob([merged], { type: hlsResult.contentType });
            const blobUrl = URL.createObjectURL(blob);
            window.postMessage({
              type: 'zentrio-download-complete',
              id,
              size: totalBufferLen,
              fileName,
              blobUrl
            }, '*');
          } catch (e) {
            if (controllerObj.signal.aborted) {
              window.postMessage({ type: 'zentrio-download-cancelled', id }, '*');
            } else {
              zdmLog('HLS download failed', e);
              window.postMessage({ type: 'zentrio-download-failed', id }, '*');
            }
          } finally {
            delete active[id];
          }
          return;
        }

        // If still JSON at this point, avoid saving JSON file; switch to probe mode instead of writing .json
        if ((contentType && /application\/json/i.test(contentType)) && (/\.json(\?|$)/i.test(remoteUrl))) {
          zdmLog('JSON response would be saved, switching to probe instead', remoteUrl, contentType);
          window.postMessage({ type: 'zentrio-download-debug', id, phase: 'json-nonmedia', remoteUrl, contentType }, '*');
          markProbing(id, item.href && item.href.startsWith('#') ? item.href : '#' + (item.href || ''));
          setTimeout(() => {
            if (probing[id]) {
              zdmLog('Probe timeout after json-nonmedia', id);
              window.postMessage({ type: 'zentrio-download-debug', id, phase: 'json-nonmedia-timeout' }, '*');
              simulate(item);
              clearProbing(id);
            }
          }, 15000);
          return;
        }

        if (!response.ok || !response.body) {
          window.postMessage({ type: 'zentrio-download-failed', id }, '*');
          return;
        }

        const contentLength = Number(response.headers.get('Content-Length')) || 0;
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        const started = Date.now();

        const fileName = deriveFileName(title, remoteUrl);

        // Acquire or reuse directory handle (prompt once). Fallback: save file picker if directory denied.
        let writable = null;
        let rootDir = await ensureRootDirectory();
        if (rootDir) {
          const { writable: dirWritable } = await openFileWritable(rootDir, fileName);
          writable = dirWritable;
        }
        if (!writable) {
          // fallback single-file picker only once per download
          let fh = await requestSaveHandle(fileName);
          if (fh) {
            try { writable = await fh.createWritable(); } catch(_) {}
          }
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              received += value.length;
              if (writable) {
                try { await writable.write(value); } catch(_) {}
              }
              let progress = 0;
              let eta = null;
              if (contentLength) {
                progress = (received / contentLength) * 100;
                const elapsed = (Date.now() - started)/1000;
                if (elapsed > 1) {
                  const speed = received / elapsed;
                  const remaining = contentLength - received;
                  eta = Math.round(remaining / speed);
                }
              } else {
                progress = Math.min(99, (received / (1024*1024)) % 100);
              }
              window.postMessage({
                type: 'zentrio-download-progress',
                id,
                progress,
                bytesReceived: received,
                size: contentLength,
                eta
              }, '*');
            }
          }
          if (writable) {
            try { await writable.close(); } catch(_) {}
          }
          const blob = new Blob(chunks, { type: contentType || 'video/mp4' });
          const blobUrl = URL.createObjectURL(blob);
          window.postMessage({
            type: 'zentrio-download-complete',
            id,
            size: contentLength || received,
            fileName,
            blobUrl
          }, '*');
        } catch (e) {
          if (controller.signal.aborted) {
            window.postMessage({ type: 'zentrio-download-cancelled', id }, '*');
          } else {
            window.postMessage({ type: 'zentrio-download-failed', id }, '*');
          }
        } finally {
          delete active[id];
        }
      }

      function simulate(item) {
        const { id } = item;
        let pct = 0;
        const size = 2 * 1024 * 1024;
        const start = Date.now();
        const timer = setInterval(() => {
          pct += Math.random() * 15;
            if (pct >= 100) {
              pct = 100;
              clearInterval(timer);
              const blob = new Blob(['Simulation'], { type: 'text/plain' });
              const blobUrl = URL.createObjectURL(blob);
              window.postMessage({
                type: 'zentrio-download-complete',
                id,
                size,
                fileName: 'simulation.txt',
                blobUrl
              }, '*');
              return;
            }
          const received = Math.round(size * (pct/100));
          const elapsed = (Date.now() - start)/1000;
          const speed = received / (elapsed || 1);
          const remaining = size - received;
          const eta = Math.round(remaining / (speed || 1));
          window.postMessage({
            type: 'zentrio-download-progress',
            id,
            progress: pct,
            bytesReceived: received,
            size,
            eta
          }, '*');
        }, 450);
      }

      function begin(item) {
        items[item.id] = item;
        window.postMessage({
          type: 'zentrio-download-init',
          id: item.id,
          payload: { href: item.href, title: item.title }
        }, '*');
        if (ALWAYS_PROBE) {
          const hash = item.href && item.href.startsWith('#') ? item.href : '#' + (item.href || '');
          zdmLog('Proactive probe (ALWAYS_PROBE)', item.id, hash);
          markProbing(item.id, hash);
          // Allow some time for player scripts to request manifests/segments before direct fetch attempt
          setTimeout(() => {
            if (!active[item.id]) {
              zdmLog('Starting direct fetch after probe delay', item.id);
              startRealDownload(item);
            }
          }, 800);
        } else {
          startRealDownload(item);
        }
      }

      function startDownload(anchor, btn) {
        if (!anchor || !btn) return;
        if (btn.classList.contains('is-downloading')) return;

        const info = extractStreamInfo(anchor);
        const id = generateId();
        const item = {
          id,
          href: info.href,
          title: info.title,
          description: info.description,
          createdAt: Date.now()
        };
        setButtonState(btn, 'downloading');
        begin(item);

        // Button feedback (purely cosmetic)
        setTimeout(() => {
          setButtonState(btn, 'complete');
          setTimeout(() => setButtonState(btn, 'default'), 2500);
        }, 1500);
      }

      // Listen for cancel / retry / injected root handle from outer context
      window.addEventListener('message', (e) => {
        const data = e.data;
        if (!data || typeof data !== 'object') return;
        if (data.type === 'zentrio-download-cancel') {
          const id = data.id;
          if (active[id]) {
            try { active[id].abort(); } catch(_) {}
          }
        } else if (data.type === 'zentrio-download-retry') {
          const id = data.id;
          if (items[id] && !active[id]) {
            begin({ ...items[id], id: generateId() }); // new id for new attempt
          }
        } else if (data.type === 'zentrio-download-root-handle' && data.handle) {
          try {
            window.__zentrioSaveRootHandle = data.handle;
            persistHandle(data.handle);
          } catch(_) {}
        } else if (data.type === 'zentrio-download-media-probe' && data.url) {
          zdmLog('Media probe event', data.url, data.contentType, data.status);
          // Associate with earliest probing download
            const probingIds = Object.keys(probing).sort((a,b)=> probing[a].startedAt - probing[b].startedAt);
            if (probingIds.length) {
              const targetId = probingIds[0];
              if (/\\.(m3u8|mp4|mkv|webm|ts|m4s|mpd)(\\?|$)/i.test(data.url) ||
                  /mpegurl|video|mp4|dash/i.test(data.contentType || '')) {
                startProbeDownload(targetId, data.url);
              }
            }
        }
      });

      // Proactively request an existing persisted root handle (downloads page will respond)
      function requestExternalRootHandleRetries() {
        if (window.__zentrioSaveRootHandle) return;
        let attempts = 0;
        const max = 3;
        const intervalMs = 1200;
        const attempt = () => {
          if (window.__zentrioSaveRootHandle || attempts >= max) return;
            attempts++;
            try { window.postMessage({ type: 'zentrio-download-root-request' }, '*'); } catch(_) {}
            if (!window.__zentrioSaveRootHandle && attempts < max) {
              setTimeout(attempt, intervalMs);
            }
        };
        // Initial slight delay to allow outer contexts to attach their listeners
        setTimeout(attempt, 400);
      }

      function scan(force) {
        const anchors = collectStreamAnchors();
        zdmLog('scan()', 'candidate anchors:', anchors.length, 'force:', !!force);
        if (!anchors.length) {
          window.postMessage({ type: 'zentrio-download-debug', phase: 'scan-empty', force: !!force }, '*');
          // schedule another quick retry if empty and not forced
          if (!force) {
            setTimeout(() => scan(true), 550);
          }
        }
        let attached = 0;
        anchors.forEach(a => {
          if (!isProcessed(a)) {
            const href = a.getAttribute('href');
            if (!href || href.indexOf('#/player/') === -1) {
              zdmLog('Skipping non-player href candidate', href);
              return;
            }
            zdmLog('Attaching download button to anchor', href);
            markProcessed(a);
            createButton(a);
            attached++;
          } else {
            repositionIfPlayIconAppears(a);
          }
        });
        window.postMessage({ type: 'zentrio-download-debug', phase: 'scan-result', anchors: anchors.length, attached }, '*');
      }

      function debounce(fn, wait) {
        let t;
        return function() {
          clearTimeout(t);
          const args = arguments, ctx = this;
          t = setTimeout(() => fn.apply(ctx, args), wait);
        };
      }

      function init() {
        zdmLog('Downloads Manager init start');
patchFetchAndXHR(window);
        injectStyles();
        injectBannerStyles();
        maybeShowSetupBanner();
        requestExternalRootHandleRetries();
        // expose manual trigger
        window.zdmForceScan = () => { zdmLog('Manual force scan'); scan(true); };
        scan();
        const observer = new MutationObserver(debounce(() => scan(), 250));
        observer.observe(document.body, { childList: true, subtree: true });
        // Additional early aggressive scans to catch late-loaded lists
        setTimeout(() => scan(true), 800);
        setTimeout(() => scan(true), 1600);
        setInterval(() => scan(), 4000);
        window.addEventListener('hashchange', () => {
          zdmLog('hashchange -> rescan');
          setTimeout(() => scan(true), 120);
        });
        document.addEventListener('keydown', (e) => {
          if (e.ctrlKey && e.shiftKey && e.code === 'KeyD') {
            zdmLog('Ctrl+Shift+D -> force scan');
            scan(true);
          }
        });
        // Global click fallback: if user clicks a potential stream element without button yet
        document.addEventListener('click', (e) => {
          const target = e.target;
          if (!target) return;
          const el = target instanceof Element ? target : null;
          const a = el && el.closest ? el.closest('a[href*="#/player/"]') : null;
          if (a && !isProcessed(a)) {
            zdmLog('Late attachment via click fallback', a.getAttribute('href'));
            markProcessed(a);
            createButton(a);
          }
        }, true);
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }

      // Expose minimal debug (optional)
      window[ACTIVE_KEY] = { active, items };
    } catch(err) {
      console.error('Zentrio Downloads Manager (refactored) init failed', err);
    }
  })();
`;
