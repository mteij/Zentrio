export const getSessionScript = (base64: string) => `
  // Zentrio session bootstrap - runs before Stremio scripts
  try {
    // decode and parse
    var __ZENTRIO_DECODED__ = atob('${base64}');
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
        errorContainer.innerHTML = '<div style="position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #141414; color: #fff; z-index: 99999;"><p style="margin: 0 0 20px;">An error occurred while loading the session.</p><button onclick="window.top.location.href=\\\'/profiles\\\'" style="background: #007bff; color: #fff; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Back to Profiles</button></div>';
        (document.body || document.documentElement).appendChild(errorContainer);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
      else inject();
    })();
  }

  // UI observers after DOM is ready
  (function(){
    function startObserver() {
      if (!document.body) return;

      // In the native Zentrio mobile app, add safe-area padding at the top so the Stremio header
      // does not collide with the Android/iOS status bar. Detection is via the custom UA token
      // appended by the Capacitor config (" ZentrioMobile").
      try {
        var ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
        if (ua.indexOf('ZentrioMobile') !== -1) {
          if (!document.getElementById('zentrio-safe-area-style')) {
            var style = document.createElement('style');
            style.id = 'zentrio-safe-area-style';
            style.textContent =
              'body { padding-top: env(safe-area-inset-top, 0px); }' +
              ' @supports(padding: max(0px)) { body { padding-top: max(env(safe-area-inset-top, 0px), 0px); } }';
            (document.head || document.documentElement).appendChild(style);
          }
        }
      } catch (_e) {}

      var observer = new MutationObserver(function() {
        try {
          // remove warning
          var warningLink = document.querySelector('a[href="https://www.stremio.com/download-service"]');
          if (warningLink) {
            var container = warningLink.closest('div[class*="board-warning-container"]');
            if (container) {
              if (typeof container.remove === 'function') container.remove();
              else if (container.parentNode) container.parentNode.removeChild(container);
            }
          }
          // replace logo with profile
          var logoImg = document.querySelector('img[src*="stremio_symbol.png"]');
          if (logoImg && window.session && window.session.profilePictureUrl) {
            var logoContainer = logoImg.closest('div[class*="logo-container"]');
            if (logoContainer && !logoContainer.querySelector('#zentrio-profile-link')) {
              var profilePicUrl = window.session.profilePictureUrl;
              logoContainer.innerHTML = '<a id="zentrio-profile-link" href="#" title="Back to Profiles" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">' +
                '<img src="' + profilePicUrl + '" alt="Profiles" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; cursor: pointer; border: 2px solid #fff; box-shadow: 0 0 0 2px #141414;" />' +
              '</a>';
              var profileLink = logoContainer.querySelector('#zentrio-profile-link');
              if (profileLink) {
                profileLink.addEventListener('click', function(e) {
                  e.preventDefault();
                  (async function() {
                    try {
                      var authKey = window.session && window.session.profile && window.session.profile.auth && window.session.profile.auth.key;
                      if (authKey) {
                        await fetch('/stremio/api/logout', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ type: 'Logout', authKey: authKey })
                        });
                      }
                    } catch (err) {
                      console.error('Zentrio: Failed to logout.', err);
                    } finally {
                      window.top.location.href = '/profiles';
                    }
                  })();
                });
              }
            }
          }
          // hide buttons based on settings
          if (window.session && window.session.hideCalendarButton) {
            var hideCalendarButtons = function() {
              var els = document.querySelectorAll('a[href="#/calendar"]');
              for (var i=0; i<els.length; i++) { els[i].style.display = 'none'; }
            };
            hideCalendarButtons();
          }
          if (window.session && window.session.hideAddonsButton) {
            var hideAddonsButtons = function() {
              var els2 = document.querySelectorAll('a[href="#/addons"]');
              for (var j=0; j<els2.length; j++) { els2[j].style.display = 'none'; }
            };
            hideAddonsButtons();
          }
          // remove Cinemeta content rows if enabled
          if (window.session && window.session.hideCinemetaContent) {
            var removeCinemetaRows = function() {
              try {
                // Match any anchor that references the Cinemeta manifest in discover links
                var links = document.querySelectorAll(
                  'a[href*="cinemeta"], a[href*="v3-cinemeta"], a[href*="cinemeta.strem.io"], a[href*="v3-cinemeta.strem.io"]'
                );
                for (var k = 0; k < links.length; k++) {
                  var link = links[k];
                  // Do NOT touch anything inside the Addon Manager modal
                  if (link.closest('#stremio-addon-manager-modal')) continue;

                  // Climb up to the row container (class names are hashed, so match by partials)
                  var row =
                    link.closest('div[class*="board-row"], div[class*="meta-row-container"], section[class*="board-row"], div[class*="row-container"]') ||
                    link.closest('div[class*="board-row"]') ||
                    link.closest('div[class*="meta-row"]');

                  // Also skip hiding if the found row itself is inside the Addon Manager modal
                  if (row && row.closest && row.closest('#stremio-addon-manager-modal')) continue;

                  // Avoid removing DOM nodes React owns; just hide the row instead
                  if (row && row.style) {
                    row.style.display = 'none';
                  }
                }
              } catch (_e) {}
            };
            removeCinemetaRows();
          }
        } catch (e) {
          console.warn('Zentrio [Script]: observer tick failed', e);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startObserver);
    else startObserver();
  })();
`;
 
export const getSessionBootstrapOnlyScript = (base64) => {
  const full = getSessionScript(base64);
  const marker = '\n  // UI observers after DOM is ready';
  const idx = full.indexOf(marker);
  return idx === -1 ? full : full.slice(0, idx);
};
 
export const getUiTweaksScript = () => {
  const full = getSessionScript('');
  const marker = '\n  // UI observers after DOM is ready';
  const idx = full.indexOf(marker);
  if (idx === -1) return '';
  return full.slice(idx);
};
