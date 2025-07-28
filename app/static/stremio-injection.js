(function() {
  'use strict';

  const config = globalThis.stremioHubConfig || {};
  const { downloadsEnabled, isMobile, mobileClickToHover } = config;

  function setupDownloads() {
    if (!globalThis.pako) {
      console.error("Pako library not loaded.");
      return;
    }

    // Helper function to convert URL-safe base64 to Uint8Array
    function urlSafeBase64ToUint8Array(base64) {
        const padding = '='.repeat((4 - base64.length % 4) % 4);
        const b64 = (base64 + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = atob(b64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    // --- Inject download buttons ---
    const _streamsInterval = setInterval(() => {
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

              try {
                const href = link.getAttribute('href');
                if (!href) throw new Error('Stream link has no href attribute.');

                const b64part = href.split('/')[2];
                if (!b64part) throw new Error('Could not find stream data in href.');
                
                const b64string = decodeURIComponent(b64part);

                let streamInfo;
                try {
                  const uint8array = urlSafeBase64ToUint8Array(b64string);
                  const decompressed = pako.inflate(uint8array);
                  const jsonString = new TextDecoder().decode(decompressed);
                  streamInfo = JSON.parse(jsonString);
                } catch (pakoErr) {
                  try {
                    const bytes = urlSafeBase64ToUint8Array(b64string);
                    const jsonString = new TextDecoder().decode(bytes);
                    streamInfo = JSON.parse(jsonString);
                  } catch (jsonErr) {
                    console.error('Zentrio: Failed to parse stream data. It is not valid gzipped data or JSON.', { pakoError: pakoErr, jsonError: jsonErr });
                    throw new Error('Could not parse stream data.');
                  }
                }

                const streamUrl = streamInfo.url;
                const metaInfoContainer = document.querySelector('.meta-info-container-ub8AH');
                let titleElement = metaInfoContainer ? metaInfoContainer.querySelector('img[title]') : null;
                if (!titleElement) {
                  titleElement = document.querySelector('.desktop-header-title-V5d6B, .meta-details .title, h1.title');
                }
                const mainTitle = titleElement ? (titleElement.title || titleElement.textContent).trim() : 'video';

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

                const _sanitizedFileName = fileName.replace(/[/\\\\?%*:|\\"<>]/g, '-') + '.mp4';

                if (streamUrl) {
                  console.log('Zentrio: Starting download for', fileName);
                  globalThis.top.postMessage({ type: 'download-stream', streamUrl: streamUrl, fileName: fileName }, '*');
                } else {
                  throw new Error('No stream URL found in the decoded stream information.');
                }
              } catch (error) {
                console.error('Zentrio: Failed to initiate download.', error);
                globalThis.top.postMessage({ type: 'download-error', message: 'Could not start download: ' + error.message }, '*');
              }
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
    const observer = new MutationObserver((_mutations, obs) => {
      if (document.querySelector('.video-container-v9_vA')) {
        setupMobileClickHandler();
        obs.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function setupLogout() {
    const logoutObserver = new MutationObserver((_mutations, obs) => {
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
            globalThis.top.location.href = '/profiles';
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