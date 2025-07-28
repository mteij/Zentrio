(function() {
  'use strict';

  const config = window.stremioHubConfig || {};
  const { downloadsEnabled, isMobile, mobileClickToHover } = config;

  function setupDownloads() {
    if (!window.pako) {
      console.error("Pako library not loaded.");
      return;
    }

    // --- Monkey-patch fetch to intercept video URLs ---
    const originalFetch = window.fetch;
    // This function is no longer needed as we will get the URL directly.
    // The fetch override is removed.

    // --- Inject download buttons ---
    const streamsInterval = setInterval(() => {
      const streamsContainer = document.querySelector('.streams-container-bbSc4');
      if (streamsContainer) {
        const streamLinks = streamsContainer.querySelectorAll('a.stream-container-JPdah');
        streamLinks.forEach(link => {
          if (!link.parentElement.classList.contains('download-container')) {
            const container = document.createElement('div');
            container.className = 'download-container';
            container.style.cssText = 'display: flex; align-items: center; width: 100%;';

            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'download-stream-button';
            downloadBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>';
            downloadBtn.style.cssText = 'background:transparent; border:none; color:white; font-size:22px; cursor:pointer; padding:0 10px; opacity:0.8; flex-shrink: 0;';
            downloadBtn.onmouseover = () => { downloadBtn.style.opacity = '1'; };
            downloadBtn.onmouseout = () => { downloadBtn.style.opacity = '0.8'; };
            downloadBtn.onclick = (e) => {
              e.stopPropagation();
              e.preventDefault();

              // Get the main title from the meta info container, falling back to the header
              const metaInfoContainer = document.querySelector('.meta-info-container-ub8AH');
              let titleElement = metaInfoContainer ? metaInfoContainer.querySelector('img[title]') : null;
              if (!titleElement) {
                titleElement = document.querySelector('.desktop-header-title-V5d6B, .meta-details .title, h1.title');
              }
              const mainTitle = titleElement ? (titleElement.title || titleElement.textContent).trim() : 'video';

              // Find the episode title, which contains season/episode info
              const episodeTitleElement = document.querySelector('.episode-title-dln_c');
              
              let fileName;
              if (episodeTitleElement) {
                const episodeText = episodeTitleElement.textContent;
                const match = episodeText.match(/S(\d+)E(\d+)/i);
                if (match) {
                  const season = match[1].padStart(2, '0');
                  const episode = match[2].padStart(2, '0');
                  fileName = `${mainTitle} - S${season}E${episode}`;
                } else {
                  fileName = mainTitle;
                }
              } else {
                fileName = mainTitle;
              }

              const sanitizedFileName = fileName.replace(/[/\\\\?%*:|\\"<>]/g, '-') + '.mp4';

              // Now that we have the filename, open the player
              link.click();

              // Poll for the video element
              const maxRetries = 40; // 40 * 500ms = 20 seconds
              let retries = 0;
              const interval = setInterval(() => {
                const videoElement = document.querySelector('video');
                if (videoElement && videoElement.src) {
                  clearInterval(interval);
                  console.log('StremioHub: Found video element. Source:', videoElement.src);
                  window.top.postMessage({ type: 'download-stream', streamUrl: videoElement.src, fileName: sanitizedFileName }, '*');
                  history.back();
                } else {
                  retries++;
                  if (retries >= maxRetries) {
                    clearInterval(interval);
                    console.error('StremioHub: Could not find video element or its source after 20 seconds.');
                    alert('Could not find video source. Please try again.');
                  }
                }
              }, 500);
            };
            link.parentNode.insertBefore(container, link);
            container.appendChild(downloadBtn);
            container.appendChild(link);
          }
        });
      }
    }, 1000);
  }

  function setupMobileHover() {
    const setupMobileClickHandler = () => {
      const videoContainer = document.querySelector('.video-container-v9_vA');
      const playerContainer = document.querySelector('.player-container-wIELK');
      if (videoContainer && playerContainer) {
        videoContainer.addEventListener('click', (e) => {
          if (e.target.tagName === 'VIDEO') {
            e.preventDefault();
            e.stopPropagation();
            playerContainer.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
          }
        }, true);
      }
    };
    const observer = new MutationObserver((mutations, obs) => {
      if (document.querySelector('.video-container-v9_vA')) {
        setupMobileClickHandler();
        obs.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function setupLogout() {
    const logoutObserver = new MutationObserver((mutations, obs) => {
      const backLink = document.querySelector('a[href="#"]');
      if (backLink && backLink.querySelector('img[src*="dicebear.com"]')) {
        backLink.onclick = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            await fetch('/stremio/api/logout', { method: 'POST' });
          } catch (error) {
            console.error('Failed to logout from Stremio:', error);
          } finally {
            window.top.location.href = '/profiles';
          }
        };
        obs.disconnect();
      }
    });
    logoutObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (downloadsEnabled) {
    setupDownloads();
  }

  if (isMobile && mobileClickToHover) {
    setupMobileHover();
  }

  setupLogout();

})();