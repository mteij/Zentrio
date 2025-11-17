'use strict';

// Zentrio bootstrap patch for vendored Stremio Web.
//
// This patch injects the session bootstrap code directly into the main entrypoint
// instead of injecting it at runtime via DOM manipulation.

module.exports.applyPatch = async function applyPatch(ctx) {
  const { vendorRoot, fs, path, console } = ctx;

  console.log('[StremioPatcher] 001-zentrio-bootstrap.js: starting');

  const targetFile = path.join(vendorRoot, 'src', 'index.js');
  if (!fs.existsSync(targetFile)) {
    console.warn('[StremioPatcher] 001-zentrio-bootstrap.js: target not found, skipping');
    return;
  }

  let source = fs.readFileSync(targetFile, 'utf8');

  // Inject Zentrio session bootstrap code at the beginning of the file
  const bootstrapCode = `
// Zentrio session bootstrap - patched in at build-time
(function() {
  try {
    // Check if we have session data from the server
    const sessionDataElement = document.getElementById('zentrio-session-data');
    if (!sessionDataElement) return;
    
    const base64 = sessionDataElement.textContent || sessionDataElement.getAttribute('data-session');
    if (!base64) return;
    
    // decode and parse
    var __ZENTRIO_DECODED__ = atob(base64);
    var session = JSON.parse(__ZENTRIO_DECODED__);
    // expose globals
    window.session = session;
    window.zentrioSession = session;

    // Patch Stremio network calls to always use the local /stremio API proxy (avoids CORS to https://api.strem.io)
    try {
      // fetch()
      if (typeof window.fetch === 'function') {
        var __zdm_origFetch = window.fetch;
        window.fetch = function(input, init) {
          try {
            var url = (typeof input === 'string')
              ? input
              : (input && typeof input.url === 'string' ? input.url : '');
            if (url && url.indexOf('https://api.strem.io/api/') === 0) {
              var u = new URL(url);
              var rewritten = '/stremio' + u.pathname + u.search + u.hash;
              return __zdm_origFetch.call(this, rewritten, init);
            }
          } catch (_e) {}
          return __zdm_origFetch.call(this, input, init);
        };
      }
      // XMLHttpRequest
      if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype && XMLHttpRequest.prototype.open) {
        var __zdm_origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
          try {
            if (typeof url === 'string' && url.indexOf('https://api.strem.io/api/') === 0) {
              var u2 = new URL(url);
              url = '/stremio' + u2.pathname + u2.search + u2.hash;
            }
          } catch (_e2) {}
          return __zdm_origOpen.call(this, method, url, async, user, password);
        };
      }
    } catch (_patchErr) {
      try { console.warn('Zentrio [Script]: failed to patch Stremio API URLs', _patchErr); } catch(_) {}
    }

    // Minimal bootstrap for Stremio Web to recognize the logged-in state.
    // Provide a strictly-shaped "profile" and a small whitelist of known keys Stremio reads.
    try {
      var authKey = (session && session.profile && session.profile.auth && session.profile.auth.key) || null;
      var authUser = (session && session.profile && session.profile.auth && session.profile.auth.user) || null;

      // Strictly shaped profile object as Stremio expects (avoid dumping arbitrary app state)
      var profileLS = {
        auth: { key: authKey, user: authUser },
        addons: (session && session.profile && Array.isArray(session.profile.addons)) ? session.profile.addons : [],
        addonsLocked: !!(session && session.profile && session.profile.addonsLocked),
        settings: (session && session.profile && session.profile.settings) || null
      };

      // Persist only if we actually have an auth key
      if (profileLS.auth && profileLS.auth.key) {
        localStorage.setItem('profile', JSON.stringify(profileLS));
      }

      // Whitelist-persist other well-known Stremio keys often read at startup.
      var safeTopLevel = {
        installation_id: (session && session.installation_id) || null,
        schema_version: (session && session.schema_version) || 18,
        library: (session && session.library) || null,
        library_recent: (session && session.library_recent) || null,
        notifications: (session && session.notifications) || null,
        search_history: (session && session.search_history) || null,
        streaming_server_urls: (session && session.streaming_server_urls) || null,
        streams: (session && session.streams) || null
      };
      for (var k in safeTopLevel) {
        if (safeTopLevel[k] !== null && typeof safeTopLevel[k] !== 'undefined') {
          try { localStorage.setItem(k, JSON.stringify(safeTopLevel[k])); } catch(_) {}
        }
      }

      // Some builds expect "settings" at top level as well.
      var settingsObj = session && session.profile && session.profile.settings;
      if (settingsObj) {
        try { localStorage.setItem('settings', JSON.stringify(settingsObj)); } catch(_) {}
      }

      // Some builds read top-level "user"
      var userObj = (session && session.profile && session.profile.auth && session.profile.auth.user) || (session && session.user) || null;
      if (userObj) {
        try { localStorage.setItem('user', JSON.stringify(userObj)); } catch(_) {}
      }
    } catch (e) {
      console.warn('Zentrio session minimal bootstrap failed', e);
    }
    // clean URL
    try {
      if (String(location.search).indexOf('sessionData=') !== -1) {
        history.replaceState(null, '', '/stremio/');
      }
    } catch (_){}
  } catch (e) {
    console.error('Zentrio [Script]: Failed to inject session.', e);
    (function(){
      var inject = function() {
        var errorContainer = document.createElement('div');
        errorContainer.innerHTML = '<div style="position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #141414; color: #fff; z-index: 99999;"><p style="margin: 0 0 20px;">An error occurred while loading the session.</p><button onclick="window.top.location.href=\\'/profiles\\\'" style="background: #007bff; color: #fff; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Back to Profiles</button></div>';
        (document.body || document.documentElement).appendChild(errorContainer);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
      else inject();
    })();
  }
})();

`;

  // Insert the bootstrap code after the copyright comment but before any other code
  const copyrightEndIndex = source.indexOf('*/');
  if (copyrightEndIndex !== -1) {
    source = source.slice(0, copyrightEndIndex + 2) + bootstrapCode + source.slice(copyrightEndIndex + 2);
  } else {
    // Fallback: insert at the very beginning
    source = bootstrapCode + source;
  }

  fs.writeFileSync(targetFile, source, 'utf8');
  console.log('[StremioPatcher] 001-zentrio-bootstrap.js: patched', targetFile);
  console.log('[StremioPatcher] 001-zentrio-bootstrap.js: finished');
};