'use strict';

// Zentrio Downloads Manager patch for vendored Stremio Web.
//
// This patch injects the downloads manager functionality directly into the main entrypoint
// instead of injecting it at runtime via DOM manipulation.

module.exports.applyPatch = async function applyPatch(ctx) {
  const { vendorRoot, fs, path, console } = ctx;

  console.log('[StremioPatcher] 030-downloads-manager.js: starting');

  const targetFile = path.join(vendorRoot, 'src', 'index.js');
  if (!fs.existsSync(targetFile)) {
    console.warn('[StremioPatcher] 030-downloads-manager.js: target not found, skipping');
    return;
  }

  let source = fs.readFileSync(targetFile, 'utf8');

  // Inject Zentrio Downloads Manager code after the addon manager
  const downloadsManagerCode = `
// Zentrio Downloads Manager - patched in at build-time
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
              // Patch fetch and XHR in the iframe
              const w = ifr.contentWindow;
              if (w.__zdmPatched) return;
              w.__zdmPatched = true;
              
              const postTarget = (w.parent && w.parent !== w) ? w.parent : w;
              
              const origFetch = w.fetch;
              if (typeof origFetch === 'function') {
                w.fetch = async function(...args) {
                  let url = '';
                  try { url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || ''); } catch(_) {}
                  try { zdmLog('[net]', 'iframe', 'fetch()', url, args[1]?.method || 'GET'); } catch(_) {}
                  const res = await origFetch.apply(this, args);
                  try {
                    const ct = res.headers.get('content-type') || '';
                    if (/\\bmpegurl|application\\/dash|video|octet-stream/i.test(ct) ||
                        /\\.m3u8(\\?|$)/i.test(url) || /\\.mpd(\\?|$)/i.test(url) || /\\.mp4(\\?|$)/i.test(url)) {
                      zdmLog('[probe] media response', url, ct, res.status, 'iframe');
                      postTarget.postMessage({ type: 'zentrio-download-media-probe', url, contentType: ct, status: res.status, ctx: 'iframe' }, '*');
                    }
                  } catch(_) {}
                  return res;
                };
              }
              
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

    function injectStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const css = '.zentrio-dl-btn {' +
        'position: absolute;' +
        'top: 6px;' +
        'right: 6px;' +
        'background: rgba(0,0,0,0.55);' +
        'border: 1px solid rgba(255,255,255,0.25);' +
        'color: #fff;' +
        'width: 28px;' +
        'height: 28px;' +
        'border-radius: 6px;' +
        'cursor: pointer;' +
        'font-size: 15px;' +
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
        'z-index: 10050;' +
        '}' +
        '.zentrio-dl-btn:focus {' +
        'outline: 2px solid #dc2626;' +
        'outline-offset: 2px;' +
        '}' +
        '.zentrio-dl-btn:hover {' +
        'background: #dc2626;' +
        'border-color: #dc2626;' +
        'opacity: 1;' +
        '}' +
        '.zentrio-dl-btn:active {' +
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
        'width: 14px;' +
        'height: 14px;' +
        'border: 2px solid rgba(255,255,255,0.4);' +
        'border-top-color: #fff;' +
        'border-radius: 50%;' +
        'animation: zentrio-spin 0.8s linear infinite;' +
        '}' +
        '@keyframes zentrio-spin {' +
        'from { transform: rotate(0deg); }' +
        'to { transform: rotate(360deg); }' +
        '}' +
        '.zentrio-has-actions {' +
        'position: relative;' +
        'padding-right: 78px !important;' +
        '}' +
        '.zentrio-stream-actions {' +
        'position: absolute;' +
        'top: 6px;' +
        'right: 6px;' +
        'display: flex;' +
        'gap: 6px;' +
        'align-items: center;' +
        'z-index: 3;' +
        '}' +
        '.zentrio-stream-actions .zentrio-dl-btn {' +
        'position: static;' +
        'margin: 0;' +
        '}' +
        'svg.icon-rAZvO {' +
        'opacity: 1 !important;' +
        'visibility: visible !important;' +
        '}';
      const el = document.createElement('style');
      el.id = STYLE_ID;
      el.textContent = css;
      document.head.appendChild(el);
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
        .replace(/[\\\\/:*?"<>|]+/g,'_')
        .replace(/\\\\s+/g,' ')
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
      
      // Store item for potential retry
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
            zdmLog('Starting simulation after probe delay', item.id);
            simulate(item);
            clearProbing(item.id);
          }
        }, 800);
      } else {
        simulate(item);
      }

      // Button feedback (purely cosmetic)
      setTimeout(() => {
        setButtonState(btn, 'complete');
        setTimeout(() => setButtonState(btn, 'default'), 2500);
      }, 1500);
    }

    // Listen for cancel / retry events from outer context
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
          const newItem = { ...items[id], id: generateId() }; // new id for new attempt
          items[newItem.id] = newItem;
          window.postMessage({
            type: 'zentrio-download-init',
            id: newItem.id,
            payload: { href: newItem.href, title: newItem.title }
          }, '*');
          simulate(newItem);
        }
      } else if (data.type === 'zentrio-download-media-probe' && data.url) {
        zdmLog('Media probe event', data.url, data.contentType, data.status);
        // Associate with earliest probing download
        const probingIds = Object.keys(probing).sort((a,b)=> probing[a].startedAt - probing[b].startedAt);
        if (probingIds.length) {
          const targetId = probingIds[0];
          if (/\\.(m3u8|mp4|mkv|webm|ts|m4s|mpd)(\\?|$)/i.test(data.url) ||
              /mpegurl|video|mp4|dash/i.test(data.contentType || '')) {
            // For now, we'll just log the probe and continue with simulation
            zdmLog('Media probe detected for', targetId, data.url);
            clearProbing(targetId);
          }
        }
      }
    });

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
      injectStyles();
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

  // Insert the downloads manager code after the addon manager code
  const addonManagerEndIndex = source.indexOf('})();', source.indexOf('Addon Manager - patched in at build-time'));
  if (addonManagerEndIndex !== -1) {
    source = source.slice(0, addonManagerEndIndex + 4) + downloadsManagerCode + source.slice(addonManagerEndIndex + 4);
  } else {
    // Fallback: insert before the first require statement
    const requireIndex = source.indexOf('const Bowser = require');
    if (requireIndex !== -1) {
      source = source.slice(0, requireIndex) + downloadsManagerCode + source.slice(requireIndex);
    } else {
      // Last resort: insert at the beginning
      source = downloadsManagerCode + source;
    }
  }

  fs.writeFileSync(targetFile, source, 'utf8');
  console.log('[StremioPatcher] 030-downloads-manager.js: patched', targetFile);
  console.log('[StremioPatcher] 030-downloads-manager.js: finished');
};