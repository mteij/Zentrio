// Zentrio UI tweaks - patched in at build-time
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

        // Handle Stremio's native profile section (top right usually)
        // We want to replace it with downloads button if enabled
        if (window.session && window.session.downloadsManagerEnabled) {
            // Strategy: Find the profile icon SVG by its path globally
            // Path provided by user for the profile icon
            var profileIconPathStart = "M328.209";
            
            // Find all paths in the document
            var paths = document.querySelectorAll('path');
            var targetPath = null;
            for (var i = 0; i < paths.length; i++) {
                var d = paths[i].getAttribute('d');
                if (d && d.startsWith(profileIconPathStart)) {
                    targetPath = paths[i];
                    break;
                }
            }
            
            if (targetPath) {
                var svg = targetPath.closest('svg');
                // The button container is the parent of the SVG
                var profileBtn = svg ? svg.parentNode : null;
                
                if (profileBtn) {
                    // Check if we already injected our button
                    var existingBtn = document.getElementById('zentrio-downloads-action');
                    
                    // If our button exists but is not in the DOM (detached) or not in the right place
                    if (existingBtn && !document.body.contains(existingBtn)) {
                            existingBtn = null; // Re-create
                    }
                    
                    if (!existingBtn) {
                        // Create download button
                        var dlBtn = document.createElement('div');
                        dlBtn.id = 'zentrio-downloads-action';
                        // Copy classes from original button to maintain layout/style
                        dlBtn.className = profileBtn.className;
                        dlBtn.style.cssText = 'display: flex; align-items: center; justify-content: center; cursor: pointer; color: #fff; position: relative;';
                        
                        // Add styles for animation
                        if (!document.getElementById('zentrio-downloads-anim-style')) {
                            var style = document.createElement('style');
                            style.id = 'zentrio-downloads-anim-style';
                            style.textContent =
                                '@keyframes zentrio-download-pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(0.92); opacity: 0.8; } 100% { transform: scale(1); opacity: 1; } } ' +
                                '.zentrio-download-active svg { animation: zentrio-download-pulse 2s infinite ease-in-out; color: #4ade80 !important; }' +
                                '.zentrio-download-badge { position: absolute; top: -2px; right: -2px; width: 8px; height: 8px; background: #e50914; border-radius: 50%; display: none; }' +
                                '.zentrio-download-active .zentrio-download-badge { display: block; }';
                            document.head.appendChild(style);
                        }

                        dlBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>' +
                            '<div class="zentrio-download-badge"></div>';
                        
                        dlBtn.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            window.dispatchEvent(new CustomEvent('zentrioToggleDownloadsPopup'));
                        });

                        // Listen for download activity to animate
                        window.addEventListener('message', function(e) {
                            if (!e.data) return;
                            if (e.data.type === 'zentrio-download-progress' || e.data.type === 'zentrio-download-init') {
                                dlBtn.classList.add('zentrio-download-active');
                            } else if (e.data.type === 'zentrio-download-complete' || e.data.type === 'zentrio-download-failed') {
                                var activeDownloads = window.__zentrioActiveDownloads ? Object.keys(window.__zentrioActiveDownloads.active || {}).length : 0;
                                if (activeDownloads === 0) {
                                    dlBtn.classList.remove('zentrio-download-active');
                                }
                            }
                        });

                        // Insert before the profile button
                        profileBtn.parentNode.insertBefore(dlBtn, profileBtn);
                    }
                    
                    // Always ensure profile button is hidden
                    if (profileBtn.style.display !== 'none') {
                        profileBtn.style.display = 'none';
                    }
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