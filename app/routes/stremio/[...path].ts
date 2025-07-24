import { Handlers } from "$fresh/server.ts";

const STREMIO_WEB_URL = "https://web.stremio.com/";
const STREMIO_API_URL = "https://api.strem.io/";

const proxyRequestHandler = async (req: Request, path: string) => {
  const stremioPath = `/${path || ""}`;
  // Determine the target URL based on the path
  const isApiCall = stremioPath.startsWith("/api/");
  const baseUrl = isApiCall ? STREMIO_API_URL : STREMIO_WEB_URL;
  const targetUrl = new URL(stremioPath, baseUrl);

  // A HEAD request cannot have a body.
  const body = req.method === "HEAD" ? null : (req.method === "POST" || req.method === "PUT" ? await req.blob() : null);

  try {
    // --- Unrestrictive Header Forwarding ---
    // Clone all headers from the original request.
    const requestHeaders = new Headers(req.headers);
    // The only header we MUST change is Host to match the target.
    requestHeaders.set("Host", new URL(baseUrl).host);

    // To prevent 304 Not Modified responses, which can interfere with our login flow,
    // we remove caching headers. This forces Stremio to send a fresh response.
    requestHeaders.delete("if-modified-since");
    requestHeaders.delete("if-none-match");

    const response = await fetch(targetUrl.href, {
      method: req.method,
      headers: requestHeaders,
      body: body,
      redirect: "manual", // Handle redirects manually
    });

    // Handle redirects by rewriting the Location header
    if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
      const location = response.headers.get("location")!;
      const newLocation = location.replace(STREMIO_WEB_URL, "/stremio/");
      const headers = new Headers(response.headers);
      headers.set("location", newLocation);
      return new Response(null, { status: response.status, headers });
    }

    // --- Unrestrictive CORS Headers ---
    // Clone all headers from the original response.
    const responseHeaders = new Headers(response.headers);
    // Set the most permissive CORS headers possible.
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Credentials", "true");
    const requestHeadersHeader = req.headers.get("Access-Control-Request-Headers");
    if (requestHeadersHeader) {
      responseHeaders.set("Access-Control-Allow-Headers", requestHeadersHeader);
    }

    // Remove any restrictive security headers to allow embedding and script injection
    responseHeaders.delete("content-security-policy");
    responseHeaders.delete("Content-Security-Policy");
    responseHeaders.delete("x-frame-options");
    responseHeaders.delete("X-Frame-Options");
    
    // Set completely permissive CSP to allow everything
    responseHeaders.set("Content-Security-Policy", 
      "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
      "script-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
      "style-src * 'unsafe-inline' data: blob:; " +
      "img-src * data: blob:; " +
      "font-src * data:; " +
      "connect-src * data: blob:; " +
      "media-src * blob:; " +
      "object-src *; " +
      "child-src *; " +
      "frame-src *; " +
      "frame-ancestors *; " +
      "worker-src * blob:; " +
      "manifest-src *;"
    );

    // Set no-cache headers to prevent browser/proxy caching of CSP
    responseHeaders.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    responseHeaders.set("Pragma", "no-cache");
    responseHeaders.set("Expires", "0");

    // Rewrite Set-Cookie headers to remove the Domain attribute
    const setCookieHeader = response.headers.get("set-cookie");
    if (setCookieHeader) {
      // Deno's fetch combines set-cookie headers with ", ". We need to handle this.
      const cookies = setCookieHeader.split(/,(?=[^;]+=[^;]+;)/g);
      responseHeaders.delete("set-cookie");
      for (const cookie of cookies) {
        let rewrittenCookie = cookie.trim()
          .replace(/; domain=[^;]+(?=;|$)/gi, "")
          .replace(/; samesite=(strict|lax|none)(?=;|$)/gi, "");
        
        // If the request to our server is not secure, we must remove the Secure flag
        if (new URL(req.url).protocol !== "https:") {
          rewrittenCookie = rewrittenCookie.replace(/; secure/gi, "");
        }

        responseHeaders.append("set-cookie", rewrittenCookie);
      }
    }

    // Do not attempt to read the body for HEAD requests.
    if (req.method === "HEAD") {
      return new Response(null, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    // If the response is HTML, inject a <base> tag to fix relative paths
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      let body = await response.text();
      // Inject the base tag right after the <head> tag.
      // This ensures all relative paths on the page are resolved from /stremio/
      body = body.replace(/<head[^>]*>/i, `$&<base href="/stremio/">`);

      // Check if sessionData was passed for injection
      const url = new URL(req.url);
      const sessionData = url.searchParams.get("sessionData");
      if (sessionData) {
        // The data is a URL-encoded JSON string. We decode it and inject it.
        const decodedSessionData = decodeURIComponent(sessionData);
        
        // Properly escape the session data for safe JavaScript injection
        const escapeForJS = (str: string): string => {
          return str
            .replace(/\\/g, "\\\\")  // Escape backslashes first
            .replace(/`/g, "\\`")    // Escape backticks
            .replace(/\$/g, "\\$")   // Escape dollar signs (template literals)
            .replace(/\r?\n/g, "\\n") // Escape newlines
            .replace(/\r/g, "\\r")   // Escape carriage returns
            .replace(/\t/g, "\\t");  // Escape tabs
        };
        
        const safeSessionData = escapeForJS(decodedSessionData);
        
        const injectionScript = `
          <script>
            let session; // Declare session in a wider scope
            // This script runs before Stremio's own scripts to set up the session.
            try {
              session = JSON.parse(\`${safeSessionData}\`);
              // Iterate over the session object and set each key in localStorage.
              // Stremio expects some values to be JSON.stringified (like strings), and others not (like numbers).
              for (const key in session) {
                const value = session[key];
                if (typeof value === 'object') {
                  localStorage.setItem(key, JSON.stringify(value));
                } else if (typeof value === 'string') {
                  // Strings like installation_id must be stored as JSON strings (i.e., with quotes).
                  localStorage.setItem(key, JSON.stringify(value));
                } else {
                  // Numbers like schema_version are stored as plain strings.
                  localStorage.setItem(key, value);
                }
              }
              // Clean the URL in the browser's history.
              history.replaceState(null, '', '/stremio/');
            } catch (e) {
              console.error('StremioHub: Failed to inject session.', e);
            }

            // This observer removes the "Streaming server is not available" warning
            // and replaces the Stremio logo with the user's profile picture.
            const observer = new MutationObserver(() => {
              // Check for the warning and remove it.
              const warningLink = document.querySelector('a[href="https://www.stremio.com/download-service"]');
              if (warningLink) {
                const container = warningLink.closest('div[class*="board-warning-container"]');
                if (container) container.remove();
              }

              // Check for the logo and replace it.
              const logoImg = document.querySelector('img[src*="stremio_symbol.png"]');
              if (logoImg && session && session.stremioHubProfilePicture) {
                const logoContainer = logoImg.closest('div[class*="logo-container"]');
                if (logoContainer && !logoContainer.querySelector('a[href="/profiles"]')) {
                  const profilePicUrl = session.stremioHubProfilePicture;
                  logoContainer.innerHTML = \`
                    <a href="/profiles" title="Back to Profiles" style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%;">
                      <img src="\${profilePicUrl}" alt="Profiles" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; cursor: pointer; border: 2px solid #fff; box-shadow: 0 0 0 2px #141414;" />
                    </a>
                  \`;
                }
              }
              
              // Hide the calendar button if the setting is enabled
              if (session && session.hideCalendarButton) {
                const calendarButton = document.querySelector('[title="Calendar"]');
                if (calendarButton) {
                  calendarButton.style.display = 'none';
                }
              }
            });

            // Run the observer as soon as the body is available.
            if (document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    observer.observe(document.body, { childList: true, subtree: true });
                });
            }
          </script>
        `;
        // Inject the script at the beginning of the head.
        body = body.replace(/<head[^>]*>/i, `$&${injectionScript}`);
      }

      // Check if userscript should be injected based on localStorage setting
      const userscriptInjection = `
        <script>
          // Integrated Addon Manager Userscript
          (function() {
            // Check if the userscript is enabled
            const isEnabled = session?.addonManagerEnabled || false;
            if (!isEnabled) return;

            const buttonId = "edit-order-button";
            const modalId = "stremio-addon-manager-modal";

            function getKey() {
              return JSON.parse(localStorage.getItem("profile"))?.auth?.key;
            }

            // Create and inject the modal component
            function createAddonManagerModal() {
              if (document.getElementById(modalId)) return;

              const modalHTML = \`
                <div id="\${modalId}" class="stremio-addon-manager-modal" style="display: none;">
                  <div class="modal-backdrop"></div>
                  <div class="modal-container">
                    <div class="modal-header">
                      <h2>Addon Manager</h2>
                      <p>Drag and drop to reorder your Stremio addons</p>
                      <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-content">
                      <div class="loading-state">
                        <div class="spinner"></div>
                        <span>Loading addons...</span>
                      </div>
                      <div class="error-state" style="display: none;"></div>
                      <div class="addons-list" style="display: none;"></div>
                    </div>
                    <div class="modal-footer">
                      <div class="addon-count"></div>
                      <div class="modal-actions">
                        <button class="btn-cancel">Cancel</button>
                        <button class="btn-save">Save Changes</button>
                      </div>
                    </div>
                  </div>
                </div>
              \`;

              // Inject modal styles
              const styles = \`
                <style>
                  .stremio-addon-manager-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 16px;
                  }
                  .modal-backdrop {
                    position: absolute;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.75);
                  }
                  .modal-container {
                    position: relative;
                    background: #1f2937;
                    border-radius: 8px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
                    width: 100%;
                    max-width: 56rem;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                  }
                  .modal-header {
                    padding: 24px;
                    border-bottom: 1px solid #374151;
                    position: relative;
                  }
                  .modal-header h2 {
                    font-size: 24px;
                    font-weight: bold;
                    color: white;
                    margin: 0;
                  }
                  .modal-header p {
                    color: #9ca3af;
                    font-size: 14px;
                    margin: 4px 0 0 0;
                  }
                  .modal-close {
                    position: absolute;
                    top: 24px;
                    right: 24px;
                    background: none;
                    border: none;
                    color: #9ca3af;
                    font-size: 32px;
                    cursor: pointer;
                    padding: 0;
                    line-height: 1;
                  }
                  .modal-close:hover {
                    color: white;
                  }
                  .modal-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 24px;
                  }
                  .modal-footer {
                    padding: 24px;
                    border-top: 1px solid #374151;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                  }
                  .addon-count {
                    color: #9ca3af;
                    font-size: 14px;
                  }
                  .modal-actions {
                    display: flex;
                    gap: 12px;
                  }
                  .btn-cancel {
                    padding: 8px 16px;
                    background: none;
                    border: none;
                    color: #9ca3af;
                    cursor: pointer;
                  }
                  .btn-cancel:hover {
                    color: white;
                  }
                  .btn-save {
                    padding: 8px 24px;
                    background: #dc2626;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                  }
                  .btn-save:hover {
                    background: #b91c1c;
                  }
                  .btn-save:disabled {
                    background: #4b5563;
                    cursor: not-allowed;
                  }
                  .loading-state {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 48px;
                    color: #d1d5db;
                  }
                  .spinner {
                    width: 32px;
                    height: 32px;
                    border: 2px solid #374151;
                    border-top: 2px solid #dc2626;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-right: 12px;
                  }
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  .error-state {
                    padding: 12px;
                    background: #7f1d1d;
                    color: #fecaca;
                    border-radius: 4px;
                    margin-bottom: 16px;
                  }
                  .addon-item {
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    background: #1f2937;
                    border: 1px solid #374151;
                    border-radius: 8px;
                    margin-bottom: 8px;
                    cursor: move;
                    transition: all 0.2s;
                  }
                  .addon-item:hover {
                    border-color: #6b7280;
                  }
                  .addon-item.dragging {
                    opacity: 0.5;
                    border-color: #dc2626;
                  }
                  .addon-item.drag-over {
                    border-color: #dc2626;
                    background: #374151;
                  }
                  .drag-handle {
                    margin-right: 12px;
                    color: #6b7280;
                  }
                  .addon-logo {
                    width: 48px;
                    height: 48px;
                    background: #374151;
                    border-radius: 8px;
                    margin-right: 16px;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                  }
                  .addon-logo img {
                    width: 40px;
                    height: 40px;
                    border-radius: 4px;
                    object-fit: cover;
                  }
                  .addon-logo-fallback {
                    color: #9ca3af;
                    font-size: 12px;
                    font-weight: bold;
                  }
                  .addon-info {
                    flex: 1;
                    min-width: 0;
                  }
                  .addon-name {
                    color: white;
                    font-weight: 500;
                    margin: 0;
                    display: flex;
                    align-items: center;
                  }
                  .addon-badge {
                    margin-left: 8px;
                    padding: 2px 8px;
                    font-size: 12px;
                    border-radius: 4px;
                  }
                  .addon-badge.official {
                    background: #1d4ed8;
                    color: #dbeafe;
                  }
                  .addon-badge.protected {
                    background: #059669;
                    color: #d1fae5;
                  }
                  .addon-description {
                    color: #9ca3af;
                    font-size: 14px;
                    margin: 4px 0;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  }
                  .addon-url {
                    color: #6b7280;
                    font-size: 12px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  }
                  .remove-btn {
                    margin-left: 16px;
                    background: none;
                    border: none;
                    color: #6b7280;
                    cursor: pointer;
                    padding: 4px;
                  }
                  .remove-btn:hover {
                    color: #ef4444;
                  }
                </style>
              \`;

              document.head.insertAdjacentHTML('beforeend', styles);
              document.body.insertAdjacentHTML('beforeend', modalHTML);

              const modal = document.getElementById(modalId);
              const closeBtn = modal.querySelector('.modal-close');
              const cancelBtn = modal.querySelector('.btn-cancel');
              const saveBtn = modal.querySelector('.btn-save');
              const backdrop = modal.querySelector('.modal-backdrop');

              const closeModal = () => {
                modal.style.display = 'none';
              };

              closeBtn.addEventListener('click', closeModal);
              cancelBtn.addEventListener('click', closeModal);
              backdrop.addEventListener('click', closeModal);

              let currentAddons = [];

              // Load and display addons
              const loadAddons = async () => {
                const authKey = getKey();
                if (!authKey) {
                  showError('Unable to get auth key. Please make sure you are logged in.');
                  return;
                }

                try {
                  const response = await fetch('/stremio/api/addonCollectionGet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      type: 'AddonCollectionGet',
                      authKey,
                      update: true
                    })
                  });

                  if (!response.ok) {
                    throw new Error(\`Failed to fetch addons: \${response.statusText}\`);
                  }

                  const data = await response.json();
                  if (data.result && Array.isArray(data.result.addons)) {
                    currentAddons = data.result.addons;
                    displayAddons(currentAddons);
                  } else {
                    throw new Error('Invalid response format');
                  }
                } catch (err) {
                  showError(err.message);
                }
              };

              const showError = (message) => {
                modal.querySelector('.loading-state').style.display = 'none';
                modal.querySelector('.addons-list').style.display = 'none';
                const errorState = modal.querySelector('.error-state');
                errorState.textContent = message;
                errorState.style.display = 'block';
              };

              const displayAddons = (addons) => {
                modal.querySelector('.loading-state').style.display = 'none';
                modal.querySelector('.error-state').style.display = 'none';
                
                const addonsList = modal.querySelector('.addons-list');
                const addonCount = modal.querySelector('.addon-count');
                
                addonsList.innerHTML = addons.map((addon, index) => \`
                  <div class="addon-item" draggable="true" data-index="\${index}">
                    <div class="drag-handle">⋮⋮</div>
                    <div class="addon-logo">
                      \${addon.manifest.logo 
                        ? \`<img src="\${addon.manifest.logo}" alt="\${addon.manifest.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">\`
                        : ''
                      }
                      <div class="addon-logo-fallback" style="display: \${addon.manifest.logo ? 'none' : 'flex'}">
                        \${addon.manifest.name.slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <div class="addon-info">
                      <h3 class="addon-name">
                        \${addon.manifest.name}
                        \${addon.flags?.official ? '<span class="addon-badge official">Official</span>' : ''}
                        \${addon.flags?.protected ? '<span class="addon-badge protected">Protected</span>' : ''}
                      </h3>
                      \${addon.manifest.description ? \`<p class="addon-description">\${addon.manifest.description}</p>\` : ''}
                      <p class="addon-url">\${addon.transportUrl}</p>
                    </div>
                    \${!addon.flags?.protected ? \`<button class="remove-btn" data-index="\${index}" title="Remove addon">×</button>\` : ''}
                  </div>
                \`).join('');

                addonCount.textContent = \`\${addons.length} addons • Drag to reorder, click × to remove\`;
                addonsList.style.display = 'block';

                // Add drag and drop functionality
                setupDragAndDrop();
              };

              let draggedIndex = null;

              const setupDragAndDrop = () => {
                const items = modal.querySelectorAll('.addon-item');
                
                items.forEach(item => {
                  item.addEventListener('dragstart', (e) => {
                    draggedIndex = parseInt(e.target.dataset.index);
                    e.target.classList.add('dragging');
                  });

                  item.addEventListener('dragend', (e) => {
                    e.target.classList.remove('dragging');
                    draggedIndex = null;
                  });

                  item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.target.closest('.addon-item').classList.add('drag-over');
                  });

                  item.addEventListener('dragleave', (e) => {
                    e.target.closest('.addon-item').classList.remove('drag-over');
                  });

                  item.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const dropIndex = parseInt(e.target.closest('.addon-item').dataset.index);
                    
                    if (draggedIndex !== null && draggedIndex !== dropIndex) {
                      // Reorder addons array
                      const draggedAddon = currentAddons[draggedIndex];
                      currentAddons.splice(draggedIndex, 1);
                      currentAddons.splice(dropIndex, 0, draggedAddon);
                      
                      // Re-display
                      displayAddons(currentAddons);
                    }
                    
                    e.target.closest('.addon-item').classList.remove('drag-over');
                  });
                });

                // Remove button functionality
                modal.querySelectorAll('.remove-btn').forEach(btn => {
                  btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const index = parseInt(btn.dataset.index);
                    const addon = currentAddons[index];
                    
                    if (addon.flags?.protected) {
                      showError('Cannot remove protected addons');
                      return;
                    }

                    currentAddons.splice(index, 1);
                    displayAddons(currentAddons);
                  });
                });
              };

              // Save changes
              saveBtn.addEventListener('click', async () => {
                const authKey = getKey();
                if (!authKey) {
                  showError('Unable to get auth key');
                  return;
                }

                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';

                try {
                  const response = await fetch('/stremio/api/addonCollectionSet', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      type: 'AddonCollectionSet',
                      authKey,
                      addons: currentAddons
                    })
                  });

                  if (!response.ok) {
                    throw new Error(\`Failed to save: \${response.statusText}\`);
                  }

                  const data = await response.json();
                  if (data.result?.success === false) {
                    throw new Error(data.result.error || 'Failed to save changes');
                  }

                  // Show success and refresh the iframe to update addon order
                  saveBtn.textContent = 'Saved!';
                  setTimeout(() => {
                    closeModal();
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Save Changes';
                    
                    // Instead of reloading the page, just refresh the iframe content
                    // by sending a message to the parent window to reload the iframe
                    if (window.parent !== window) {
                      window.parent.postMessage({ type: 'reload-stremio-iframe' }, '*');
                    } else {
                      // Fallback to simple reload if no parent window
                      window.location.reload();
                    }
                  }, 1000);

                } catch (err) {
                  showError(err.message);
                  saveBtn.disabled = false;
                  saveBtn.textContent = 'Save Changes';
                }
              });

              // Open modal function
              window.openAddonManager = () => {
                modal.style.display = 'flex';
                modal.querySelector('.loading-state').style.display = 'flex';
                modal.querySelector('.error-state').style.display = 'none';
                modal.querySelector('.addons-list').style.display = 'none';
                loadAddons();
              };
            }

            function handleButtonClick() {
              const key = getKey();
              if (!key) {
                alert('Unable to get auth key. Please make sure you are logged in.');
                return;
              }

              // Create modal if it doesn't exist
              createAddonManagerModal();
              
              // Open the modal
              window.openAddonManager();
            }

            function setupButton() {
              // Remove existing button if it exists
              const existingButton = document.getElementById(buttonId);
              if (existingButton) {
                existingButton.remove();
              }

              const addonButton = document.querySelector("[class^=add-button-container]");
              if (!addonButton) return;

              const editOrderButton = document.createElement("button");
              editOrderButton.classList = addonButton.classList;  
              editOrderButton.style.cssText = "color: white; font-weight: bold; right: unset; margin-right: 10px;";
              editOrderButton.innerText = "Edit Order";
              editOrderButton.addEventListener("click", handleButtonClick);
              editOrderButton.id = buttonId;
              editOrderButton.title = "Open integrated Addon Manager";

              addonButton.insertAdjacentElement('beforebegin', editOrderButton);
            }

            const insertButtonObserver = new MutationObserver((_, observer) => {
              if (document.querySelector("[class^=add-button-container]")) {
                setupButton();
                observer.disconnect();
              }
            });

            function buttonIsOnPage() {
              return !!document.querySelector(\`#\${buttonId}\`);
            }

            function pageIsAddons() {
              return /#\\/addons.*/.test(window.location.href);
            }

            function insertButton() {
              if (pageIsAddons() && !buttonIsOnPage()) {
                insertButtonObserver.observe(document.body, {
                  attributes: false,
                  characterData: false, 
                  childList: true,
                  subtree: true,
                });
              }
            }

            // Initialize on page load
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', insertButton);
            } else {
              insertButton();
            }

            // Re-run when navigating
            window.addEventListener("popstate", insertButton);
            
            // Also listen for hash changes since Stremio is a SPA
            window.addEventListener("hashchange", insertButton);

            // No need to watch for localStorage changes since we're using session data
          })();
        </script>
      `;
      
      // NSFW Content Filtering Script
      const nsfwFilterInjection = `
        <script>
          // NSFW Content Filter
          (function() {
            // Check if current profile has NSFW filtering enabled
            const currentProfile = session?.profile?.auth?.user;
            if (!currentProfile) return;

            // This will be set by the session data if NSFW mode is enabled for the profile
            const nsfwModeEnabled = session?.nsfwModeEnabled || false;
            const tmdbApiKey = session?.tmdbApiKey;

            if (!nsfwModeEnabled || !tmdbApiKey) return;

            console.log('NSFW Content Filter: Active');

            // NSFW Filter Service (embedded)
            class NSFWFilter {
              constructor() {
                this.cache = new Map();
                this.rateLimitDelay = 100; // TMDB allows 40 requests per 10 seconds
                this.lastApiCall = 0;
                this.apiKey = tmdbApiKey;
              }

              extractTitleInfo(text) {
                let cleanTitle = text
                  .replace(/^(HD|4K|3D|CAM|TS|TC|DVDRip|BRRip|WEB-DL|WEBRip)\\s*/i, '')
                  .replace(/\\s*(HD|4K|3D|CAM|TS|TC|DVDRip|BRRip|WEB-DL|WEBRip)$/i, '')
                  .replace(/\\s*\\([^)]*\\)$/, '')
                  .trim();

                const yearMatch = text.match(/\\((\\d{4})\\)|\\b(\\d{4})\\b/);
                const year = yearMatch ? (yearMatch[1] || yearMatch[2]) : undefined;

                if (year) {
                  cleanTitle = cleanTitle.replace(new RegExp(\`\\\\b\${year}\\\\b|\\\\(\${year}\\\\)\`), '').trim();
                }

                return { title: cleanTitle, year };
              }

              async rateLimit() {
                const now = Date.now();
                const timeSinceLastCall = now - this.lastApiCall;
                if (timeSinceLastCall < this.rateLimitDelay) {
                  await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastCall));
                }
                this.lastApiCall = Date.now();
              }

              async searchTitle(title, year) {
                const cacheKey = \`\${title}\${year ? \`-\${year}\` : ''}\`;
                if (this.cache.has(cacheKey)) {
                  const cached = this.cache.get(cacheKey);
                  return cached ? { id: cached.id, type: cached.type } : null;
                }

                try {
                  await this.rateLimit();
                  
                  const searchUrl = \`https://api.themoviedb.org/3/search/multi?api_key=\${this.apiKey}&query=\${encodeURIComponent(title)}\${year ? \`&year=\${year}\` : ''}\`;
                  const response = await fetch(searchUrl);
                  
                  if (!response.ok) {
                    console.warn('TMDB API request failed:', response.statusText);
                    return null;
                  }

                  const data = await response.json();
                  
                  if (data.results && data.results.length > 0) {
                    // Find the best match, preferring exact year matches
                    let bestMatch = data.results[0];
                    
                    if (year) {
                      const yearMatch = data.results.find(result => {
                        const releaseYear = result.release_date?.substring(0, 4) || result.first_air_date?.substring(0, 4);
                        return releaseYear === year;
                      });
                      if (yearMatch) bestMatch = yearMatch;
                    }

                    const mediaType = bestMatch.media_type || (bestMatch.title ? 'movie' : 'tv');
                    const result = { id: bestMatch.id, type: mediaType };
                    this.cache.set(cacheKey, result);
                    return result;
                  }

                  this.cache.set(cacheKey, false);
                  return null;
                } catch (error) {
                  console.warn('Error searching TMDB:', error);
                  return null;
                }
              }

              async getDetails(id, type) {
                try {
                  await this.rateLimit();
                  
                  const endpoint = type === 'movie' ? 'movie' : 'tv';
                  const detailUrl = \`https://api.themoviedb.org/3/\${endpoint}/\${id}?api_key=\${this.apiKey}\`;
                  const response = await fetch(detailUrl);
                  
                  if (!response.ok) {
                    console.warn('TMDB API details request failed:', response.statusText);
                    return null;
                  }

                  const data = await response.json();
                  return data;
                } catch (error) {
                  console.warn('Error fetching TMDB details:', error);
                  return null;
                }
              }

              isNSFWContent(details) {
                // TMDB has an explicit 'adult' flag - this is the most reliable indicator
                if (details.adult) {
                  return true;
                }

                // Check genres by name (TMDB provides genre objects with names)
                if (details.genres && details.genres.length > 0) {
                  const nsfwGenreNames = [
                    'adult', 'erotica', 'erotic', 'pornographic', 'sex', 'adult entertainment'
                  ];
                  
                  const hasNSFWGenre = details.genres.some(genre => 
                    nsfwGenreNames.some(nsfwGenre => 
                      genre.name.toLowerCase().includes(nsfwGenre.toLowerCase())
                    )
                  );
                  
                  if (hasNSFWGenre) {
                    return true;
                  }
                }

                // Check overview/plot for adult keywords
                if (details.overview) {
                  const nsfwKeywords = [
                    'adult film', 'pornographic', 'explicit', 'erotic', 'sexual content',
                    'nude', 'naked', 'strip club', 'prostitute', 'brothel', 'escort',
                    'adult entertainment', 'xxx', 'sex industry', 'adult performer'
                  ];
                  
                  const overviewLower = details.overview.toLowerCase();
                  if (nsfwKeywords.some(keyword => overviewLower.includes(keyword.toLowerCase()))) {
                    return true;
                  }
                }

                // Additional check for very low-rated content that might be adult
                if (details.vote_average > 0 && details.vote_average < 3.0) {
                  // If it has adult keywords AND very low rating, it might be adult content
                  const title = details.title || details.name || '';
                  const titleLower = title.toLowerCase();
                  
                  const suspiciousKeywords = [
                    'adult', 'erotic', 'sexy', 'nude', 'naked', 'hot', 'sensual'
                  ];
                  
                  if (suspiciousKeywords.some(keyword => titleLower.includes(keyword))) {
                    return true;
                  }
                }

                return false;
              }

              async isNSFW(titleText) {
                const cacheKey = \`nsfw-\${titleText}\`;
                if (this.cache.has(cacheKey)) {
                  return this.cache.get(cacheKey) || false;
                }

                try {
                  const { title, year } = this.extractTitleInfo(titleText);
                  
                  // Search for the title
                  const searchResult = await this.searchTitle(title, year);
                  if (!searchResult) {
                    this.cache.set(cacheKey, false);
                    return false;
                  }

                  // Get detailed information
                  const details = await this.getDetails(searchResult.id, searchResult.type);
                  if (!details) {
                    this.cache.set(cacheKey, false);
                    return false;
                  }

                  // Check if it's NSFW
                  const isNSFW = this.isNSFWContent(details);
                  
                  // Cache the result
                  this.cache.set(cacheKey, isNSFW);
                  
                  return isNSFW;
                } catch (error) {
                  console.warn('Error checking NSFW status:', error);
                  this.cache.set(cacheKey, false);
                  return false;
                }
              }
            }

            const filter = new NSFWFilter();
            const processedElements = new WeakSet();

            // Function to extract title from various Stremio elements
            function extractTitle(element) {
              // Try different selectors for title text
              const titleSelectors = [
                '.title',
                '[class*="title"]',
                '.name',
                '[class*="name"]',
                'h1', 'h2', 'h3', 'h4',
                '.item-title',
                '[class*="item-title"]'
              ];

              for (const selector of titleSelectors) {
                const titleEl = element.querySelector(selector) || (element.matches(selector) ? element : null);
                if (titleEl && titleEl.textContent?.trim()) {
                  return titleEl.textContent.trim();
                }
              }

              // Fallback to element text content
              return element.textContent?.trim() || '';
            }

            // Function to hide/remove NSFW content
            function hideElement(element, reason = 'NSFW content filtered') {
              if (processedElements.has(element)) return;
              processedElements.add(element);

              // Add a subtle indicator that content was filtered
              element.style.display = 'none';
              element.setAttribute('data-nsfw-filtered', 'true');
              
              // Optional: Replace with placeholder
              const placeholder = document.createElement('div');
              placeholder.className = element.className;
              placeholder.style.cssText = \`
                background: #374151;
                border: 1px dashed #6b7280;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                color: #9ca3af;
                font-size: 14px;
                min-height: 120px;
                display: flex;
                align-items: center;
                justify-content: center;
              \`;
              placeholder.innerHTML = \`
                <div>
                  <div style="font-size: 18px; margin-bottom: 4px;">🔒</div>
                  <div>Content Filtered</div>
                  <div style="font-size: 12px; opacity: 0.8; margin-top: 4px;">NSFW content hidden</div>
                </div>
              \`;
              
              element.parentNode?.insertBefore(placeholder, element);
            }

            // Function to process content items
            async function processContentItem(element) {
              if (processedElements.has(element)) return;

              const title = extractTitle(element);
              if (!title || title.length < 2) return;

              try {
                const isNSFW = await filter.isNSFW(title);
                if (isNSFW) {
                  console.log(\`NSFW Filter: Hiding "\${title}"\`);
                  hideElement(element);
                }
              } catch (error) {
                console.warn('Error processing content item:', error);
              }
            }

            // Content scanning function
            function scanForContent() {
              // Common selectors for Stremio content items
              const contentSelectors = [
                '[class*="board-item"]',
                '[class*="item-"]',
                '[class*="poster"]',
                '[class*="movie"]',
                '[class*="series"]',
                '[class*="video"]',
                '[class*="stream"]',
                '.item',
                '[class*="content-item"]'
              ];

              const items = new Set();
              
              contentSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                  if (!processedElements.has(el) && el.textContent?.trim()) {
                    items.add(el);
                  }
                });
              });

              // Process items with rate limiting
              let delay = 0;
              items.forEach(item => {
                setTimeout(() => processContentItem(item), delay);
                delay += 100; // Stagger processing to avoid overwhelming the API
              });
            }

            // Initial scan
            setTimeout(scanForContent, 2000);

            // Set up observer for dynamic content
            const observer = new MutationObserver((mutations) => {
              let shouldScan = false;
              
              mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                  mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                      const element = node;
                      // Check if the added element contains content items
                      if (element.querySelector && (
                        element.querySelector('[class*="item"]') ||
                        element.querySelector('[class*="poster"]') ||
                        element.querySelector('[class*="board"]')
                      )) {
                        shouldScan = true;
                      }
                    }
                  });
                }
              });

              if (shouldScan) {
                setTimeout(scanForContent, 500);
              }
            });

            // Start observing
            observer.observe(document.body, {
              childList: true,
              subtree: true
            });

            // Periodic scan for missed content
            setInterval(scanForContent, 10000);

            console.log('NSFW Content Filter: Initialized and monitoring');
          })();
        </script>
      `;
      
      // Always inject the userscript - it will check the setting internally
      body = body.replace(/<\/head>/i, `${userscriptInjection}${nsfwFilterInjection}$&`);

      return new Response(body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    const errorMessage = typeof error === "object" && error !== null && "message" in error
      ? (error as { message: string }).message
      : String(error);
    return new Response(`Proxy error: ${errorMessage}`, { status: 502 });
  }
};

export const handler: Handlers = {
  async GET(req, ctx) {
    return await proxyRequestHandler(req, ctx.params.path as string);
  },
  async POST(req, ctx) {
    return await proxyRequestHandler(req, ctx.params.path as string);
  },
  async PUT(req, ctx) {
    return await proxyRequestHandler(req, ctx.params.path as string);
  },
  async DELETE(req, ctx) {
    return await proxyRequestHandler(req, ctx.params.path as string);
  },
  async HEAD(req, ctx) {
    return await proxyRequestHandler(req, ctx.params.path as string);
  },
  OPTIONS(req, _ctx) {
    const headers = new Headers({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, HEAD, OPTIONS",
      "Access-Control-Allow-Credentials": "true",
    });
    // Allow whatever headers the client is asking for.
    const requestedHeaders = req.headers.get("Access-Control-Request-Headers");
    if (requestedHeaders) {
      headers.set("Access-Control-Allow-Headers", requestedHeaders);
    }
    
    return new Response(null, {
      status: 204,
      headers: headers,
    });
  },
};
