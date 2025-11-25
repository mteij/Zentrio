// Zentrio Downloads Page Client Script (queue + rendering v2)
// This script now relies on the global downloads-core.js for state and logic
(function() {
  // Wait for core to be ready if needed, but it should be loaded before this script
  
  const els = {
    list: document.getElementById('downloadsList'),
    empty: document.getElementById('downloadsEmpty'),
    metricActive: document.getElementById('dlMetricActive'),
    metricCompleted: document.getElementById('dlMetricCompleted'),
    metricFailed: document.getElementById('dlMetricFailed'),
    metricSize: document.getElementById('dlMetricSize'),
    message: document.getElementById('downloadsMessage')
  };

  let queue = [];

  // --- UI Helpers ---

  function showToast(message) {
    let toast = document.getElementById('zentrio-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'zentrio-toast';
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#333',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            zIndex: '100000',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            display: 'none',
            fontSize: '14px',
            textAlign: 'center'
        });
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 5000);
  }

  function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return '0 B';
    const units = ['B','KB','MB','GB','TB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return (n >= 10 ? n.toFixed(1) : n.toFixed(2)) + ' ' + units[i];
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Modal Logic ---
  // Removed folder selection modal logic as we use OPFS

  // --- Rendering ---

  function updateItem(id, updates) {
      const items = window.__zentrioDownloadsItems || [];
      const idx = items.findIndex(i => i.id === id);
      if (idx !== -1) {
          items[idx] = { ...items[idx], ...updates };
          window.__zentrioDownloadsItems = items;
          
          // Efficient DOM update for progress
          if (updates.progress !== undefined || updates.bytesReceived !== undefined) {
              updateCardProgress(id, items[idx]);
          } else {
              render(); // Full render for status changes
          }
          updateMetrics(items);
      }
  }

  function updateCardProgress(id, item) {
      const card = document.querySelector(`.download-card[data-id="${id}"]`);
      if (!card) return;
      
      const pct = item.progress || 0;
      const sizeStr = item.size ? formatBytes(item.size) : '';
      const recStr = item.bytesReceived ? formatBytes(item.bytesReceived) : '';
      
      // Update progress bar
      let bar = card.querySelector('.download-progress-bar');
      if (!bar && item.status === 'downloading') {
          // Create if missing (e.g. transition from init to downloading)
          bar = document.createElement('div');
          bar.className = 'download-progress-bar';
          const posterContainer = card.querySelector('.download-poster-container');
          if (posterContainer) posterContainer.insertBefore(bar, posterContainer.querySelector('.download-overlay'));
      }
      if (bar) bar.style.width = `${pct.toFixed(2)}%`;
      
      // Update meta text
      const metaSpan = card.querySelector('.download-meta span:first-child');
      if (metaSpan) {
          let meta = `${recStr} / ${sizeStr}`;
          if (item.duration) meta = item.duration + ' • ' + meta;
          metaSpan.textContent = meta;
      }
      
      // Update badge
      const badge = card.querySelector('.download-status-badge');
      if (badge) {
          badge.textContent = `${Math.round(pct)}%`;
      }
  }

  function render() {
    if (!els.list || !els.empty) return;
    
    // Get items from local cache populated by events
    let items = window.__zentrioDownloadsItems || [];
    
    // Sort by date desc
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (!items.length) {
      els.empty.style.display = 'block';
      els.list.innerHTML = '';
    } else {
      els.empty.style.display = 'none';
      els.list.innerHTML = items.map(item => {
        const pct = item.progress || 0;
        const sizeStr = item.size ? formatBytes(item.size) : '';
        const recStr = item.bytesReceived ? formatBytes(item.bytesReceived) : '';
        const status = item.status || 'initiated';
        const safeTitle = escapeHtml(item.title || 'Untitled');
        const safeId = escapeHtml(item.id);
        const poster = item.poster || '';
        const duration = item.duration || '';
        
        let meta = '';
        let badgeClass = '';
        let badgeText = status;

        if (status === 'downloading') {
            meta = `${recStr} / ${sizeStr}`;
            badgeClass = 'status-downloading';
            badgeText = `${Math.round(pct)}%`;
        } else if (status === 'completed') {
            meta = sizeStr + ' - Click to Save';
            badgeClass = 'status-completed';
            badgeText = 'Ready to Save';
        } else if (status === 'failed') {
            meta = 'Failed';
            badgeClass = 'status-failed';
            badgeText = 'Failed';
        } else {
            meta = status;
        }

        if (duration) {
            meta = duration + (meta ? ' • ' + meta : '');
        }

        return `
          <div class="download-card" data-id="${safeId}">
            <div class="download-poster-container" style="position: relative; width: 100%; height: 100%;">
                ${poster ? `<img src="${poster}" class="download-poster" alt="${safeTitle}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` : ''}
                <div class="download-poster-placeholder" style="${poster ? 'display: none;' : ''}">
                    <i data-lucide="film" style="width: 48px; height: 48px; opacity: 0.5;"></i>
                </div>
                
                ${status === 'downloading' ? `<div class="download-progress-bar" style="width:${pct.toFixed(2)}%;"></div>` : ''}
                
                <div class="download-overlay">
                    <div class="download-title" title="${safeTitle}">${safeTitle}</div>
                    <div class="download-meta">
                        <span>${meta}</span>
                        <span class="download-status-badge ${badgeClass}">${badgeText}</span>
                    </div>
                </div>

                <div class="download-actions-overlay">
                    ${status === 'downloading' ? `
                        <button class="action-btn" data-action="cancel" data-id="${safeId}" title="Cancel Download">
                            <i data-lucide="x" style="width: 20px; height: 20px;"></i>
                        </button>
                    ` : ''}
                    ${status === 'failed' ? `
                        <button class="action-btn" data-action="retry" data-id="${safeId}" title="Retry Download">
                            <i data-lucide="refresh-cw" style="width: 20px; height: 20px;"></i>
                        </button>
                    ` : ''}
                    ${status === 'completed' ? `
                        <button class="action-btn" data-action="export" data-id="${safeId}" title="Save to Disk">
                            <i data-lucide="download" style="width: 20px; height: 20px;"></i>
                        </button>
                    ` : ''}
                    <button class="action-btn delete" data-action="delete" data-id="${safeId}" title="Delete">
                        <i data-lucide="trash-2" style="width: 20px; height: 20px;"></i>
                    </button>
                </div>
            </div>
          </div>
        `;
      }).join('');
      wireActions();
      initLucide();
    }
    updateMetrics(items);
  }

  function updateMetrics(items) {
    if (!els.metricActive) return;
    const active = items.filter(i => i.status === 'downloading').length;
    const completed = items.filter(i => i.status === 'completed').length;
    const failed = items.filter(i => i.status === 'failed').length;
    const totalSize = items.reduce((acc, i) => acc + (i.size || 0), 0);
    els.metricActive.textContent = String(active);
    els.metricCompleted.textContent = String(completed);
    els.metricFailed.textContent = String(failed);
    els.metricSize.textContent = formatBytes(totalSize);
  }

  function wireActions() {
    if (!els.list) return;
    els.list.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent card click if we add one later
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (!action || !id) return;
        
        if (action === 'cancel') {
            window.postMessage({ type: 'zentrio-download-cancel', id }, '*');
        } else if (action === 'retry') {
            window.postMessage({ type: 'zentrio-download-retry', id }, '*');
        } else if (action === 'delete') {
            if (confirm('Are you sure you want to delete this download?')) {
                window.postMessage({ type: 'zentrio-download-delete', id }, '*');
            }
        } else if (action === 'export') {
            window.postMessage({ type: 'zentrio-download-export', id }, '*');
        }
      });
    });
  }

  // --- Listeners ---

  window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data || typeof data !== 'object') return;

    // Listen for updates from Core
    if (data.type === 'zentrio-download-complete') {
        showToast('Download finished! Click the download button to save to your device.');
        updateItem(data.id, { status: 'completed', progress: 100, size: data.size, fileName: data.fileName });
    } else if (data.type === 'zentrio-download-progress') {
        updateItem(data.id, {
            status: 'downloading',
            progress: data.progress,
            bytesReceived: data.bytesReceived,
            size: data.size,
            eta: data.eta
        });
    } else if (data.type === 'zentrio-download-failed') {
        updateItem(data.id, { status: 'failed', error: data.error });
    } else if (data.type === 'zentrio-download-cancelled') {
        updateItem(data.id, { status: 'failed', error: 'Cancelled' });
    } else if (data.type === 'zentrio-download-started') {
        updateItem(data.id, { status: 'downloading', fileName: data.fileName, size: data.size });
    } else if (data.type === 'zentrio-download-init') {
        // New item, add to list
        if (data.payload) {
            const items = window.__zentrioDownloadsItems || [];
            const exists = items.find(i => i.id === data.payload.id);
            if (!exists) {
                items.unshift(data.payload);
                window.__zentrioDownloadsItems = items;
                render();
            }
        }
    } else if (data.type === 'zentrio-download-deleted') {
        const items = window.__zentrioDownloadsItems || [];
        window.__zentrioDownloadsItems = items.filter(i => i.id !== data.id);
        render();
    } else if (data.type === 'zentrio-download-list') {
        if (data.items && Array.isArray(data.items)) {
            window.__zentrioDownloadsItems = data.items;
            render();
        }
    }
  });

  // Initial check
  function init() {
      // Ask Core for initial list
      window.postMessage({ type: 'zentrio-download-list-request' }, '*');

      // Initial render
      render();
      
      // Poll occasionally to sync UI if messages missed
      setInterval(() => {
          window.postMessage({ type: 'zentrio-download-list-request' }, '*');
      }, 2000);
  }

  // Wire back button
  const backBtn = document.getElementById('downloadsBackBtn');
  if (backBtn) {
      backBtn.addEventListener('click', () => {
        try {
          if (document.referrer && /\/profiles$/.test(new URL(document.referrer).pathname)) {
            history.back();
          } else {
            window.location.href = '/profiles';
          }
        } catch(e) { window.location.href = '/profiles'; }
      });
  }

  // Initialize Lucide
  function initLucide() {
    if (typeof window.lucide !== 'undefined' && window.lucide.createIcons) {
      window.lucide.createIcons();
    } else {
      setTimeout(initLucide, 500);
    }
  }
  initLucide();

  init();

})();
