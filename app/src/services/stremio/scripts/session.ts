export const getSessionScript = (base64: string) => `
  // Zentrio session bootstrap - runs before Stremio scripts
  try {
    // decode and parse
    var __ZENTRIO_DECODED__ = atob('${base64}');
    var session = JSON.parse(__ZENTRIO_DECODED__);
    // expose globals
    window.session = session;
    window.zentrioSession = session;
    // persist to localStorage
    for (var k in session) {
      try { localStorage.setItem(k, JSON.stringify(session[k])); } catch (e) { console.warn('Zentrio store fail', k, e); }
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
        errorContainer.innerHTML = '<div style="position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background-color: #141414; color: #fff; z-index: 99999;"><p style="margin: 0 0 20px;">An error occurred while loading the session.</p><button onclick="window.top.location.href=\\'/profiles\\'" style="background: #007bff; color: #fff; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Back to Profiles</button></div>';
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
