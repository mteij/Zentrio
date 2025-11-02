export const getAddonManagerScript = () => `
  // Integrated Addon Manager Userscript
  (function() {
    // Ensure a local reference to the global session
    var session = (typeof window !== 'undefined' ? (window['session'] || window['zentrioSession'] || null) : null);
    // Check if the userscript is enabled
    const isEnabled = session && session.addonManagerEnabled ? session.addonManagerEnabled : false;
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
            width: 40px;
            height: 40px;
            border: 4px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top-color: #fff;
            animation: spin 1s ease-in-out infinite;
            margin: 0 auto;
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

      // Helpers to avoid corrupting Stremio account by sending only the allowed fields
      const sanitizeAddonsForSet = (addons) => {
        const seen = new Set();
        const out = [];
        for (const a of addons || []) {
          const url = a && typeof a.transportUrl === 'string' ? a.transportUrl : '';
          if (!url || seen.has(url)) continue;
          seen.add(url);
          const flags = a && a.flags ? { official: !!a.flags.official, protected: !!a.flags.protected } : undefined;
          if (flags) out.push({ transportUrl: url, flags });
          else out.push({ transportUrl: url });
        }
        return out;
      };

      // Fallback format used by some Stremio API versions: array of transportUrl strings
      const sanitizeAddonsAsStrings = (addons) => {
        const seen = new Set();
        const out = [];
        for (const a of addons || []) {
          const url = a && typeof a.transportUrl === 'string' ? a.transportUrl : '';
          if (!url || seen.has(url)) continue;
          seen.add(url);
          out.push(url);
        }
        return out;
      };

      const tryAddonCollectionSet = async (authKey, addonsPayload) => {
        return fetch('/stremio/api/addonCollectionSet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ type: 'AddonCollectionSet', authKey, addons: addonsPayload })
        });
      };

      const safeSaveAddons = async (authKey, addons) => {
        // Prefer object form with flags
        let res = await tryAddonCollectionSet(authKey, sanitizeAddonsForSet(addons));
        let json = null;
        try { json = await res.clone().json(); } catch (_e) {}
        let failed = !res.ok || (json && json.result && json.result.success === false);

        if (failed) {
          // Retry with string array fallback
          res = await tryAddonCollectionSet(authKey, sanitizeAddonsAsStrings(addons));
          json = null; try { json = await res.clone().json(); } catch (_e) {}
          failed = !res.ok || (json && json.result && json.result.success === false);
        }

        return { res, json, failed };
      };

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
            headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
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
            const rawAddons = data.result.addons;
            currentAddons = rawAddons.map(a => {
              if (typeof a === 'string') {
                return { transportUrl: a, manifest: { name: a, description: '', logo: '' }, flags: {} };
              }
              return a;
            });
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

      // Save changes (safe: only send minimal payload to avoid account corruption)
      saveBtn.addEventListener('click', async () => {
        const authKey = getKey();
        if (!authKey) {
          showError('Unable to get auth key');
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
          const { res, json, failed } = await safeSaveAddons(authKey, currentAddons);

          if (failed) {
            const statusText = res ? (res.status + ' ' + (res.statusText || '')) : '';
            const apiMsg = json && json.result && json.result.error ? String(json.result.error) : '';
            const msg = apiMsg || (statusText || 'Failed to save changes');
            throw new Error(msg);
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
          }, 800);
        } catch (err) {
          const msg = err && err.message ? err.message : 'Failed to save changes';
          showError(msg);
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
`;
