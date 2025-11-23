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

  function setFolderStatus(text, ready) {
    const st = document.getElementById('downloadFolderStatus');
    if (!st) return;
    st.textContent = text;
    st.classList.toggle('ready', !!ready);
  }

  // --- Modal Logic ---
  const modal = document.getElementById('folderModal');
  const modalSelectBtn = document.getElementById('modalSelectBtn');
  const modalBackBtn = document.getElementById('modalBackBtn');
  const closeFolderModal = document.getElementById('closeFolderModal');

  function showModal() { if (modal) modal.style.display = 'block'; }
  function hideModal() { if (modal) modal.style.display = 'none'; }

  if (closeFolderModal) closeFolderModal.onclick = hideModal;
  if (modalBackBtn) modalBackBtn.onclick = () => {
    hideModal();
    try {
      if (document.referrer && /\/profiles$/.test(new URL(document.referrer).pathname)) {
        history.back();
      } else {
        window.location.href = '/profiles';
      }
    } catch(e) { window.location.href = '/profiles'; }
  };
  
  if (modalSelectBtn) modalSelectBtn.onclick = async () => {
    if (!('showDirectoryPicker' in window)) {
      setFolderStatus('Directory picker not supported', false);
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ id: 'zentrio-downloads', mode: 'readwrite', startIn: 'videos' });
      // Send to Core
      window.postMessage({ type: 'zentrio-download-root-set', handle }, '*');
      hideModal();
    } catch (e) {
      setFolderStatus('No folder selected', false);
    }
  };

  window.onclick = function(event) {
    if (event.target == modal) hideModal();
  }

  // --- Rendering ---

  function render() {
    if (!els.list || !els.empty) return;
    
    // Get items from Core global if available, or local queue
    let items = [];
    if (window.__zentrioDownloads && window.__zentrioDownloads.items) {
        items = Object.values(window.__zentrioDownloads.items);
    } else {
        // Fallback to trying to get from IDB if core not ready?
        // Core should be ready.
        items = queue;
    }
    
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
        const etaStr = (typeof item.eta === 'number' && item.eta > 0) ? `ETA ${item.eta}s` : '';
        const status = item.status || 'initiated';
        const safeTitle = escapeHtml(item.title || 'Untitled');
        const safeFileName = escapeHtml(item.fileName || '');
        const safeId = escapeHtml(item.id);
        const safeStatus = escapeHtml(status);
        
        // Calculate speed if possible (not stored in item, but we can infer or just show size)
        // Actually Core doesn't store speed.
        
        let meta = '';
        if (status === 'downloading') {
            meta = `${recStr} / ${sizeStr} • ${etaStr}`;
        } else if (status === 'completed') {
            meta = `${sizeStr} • Completed`;
        } else {
            meta = status;
        }

        return `
          <div class="download-item" data-id="${safeId}">
            <div class="download-icon">
                <i data-lucide="${status === 'completed' ? 'check-circle' : (status === 'failed' ? 'alert-circle' : 'video')}" style="width: 24px; height: 24px; color: ${status === 'completed' ? '#10b981' : (status === 'failed' ? '#ef4444' : '#60a5fa')}"></i>
            </div>
            <div class="download-info">
                <div class="download-header">
                    <h3 class="download-title" title="${safeTitle}">${safeTitle}</h3>
                    <div class="download-actions">
                        ${status === 'downloading' ? `<button class="icon-btn" data-action="cancel" data-id="${safeId}" title="Cancel"><i data-lucide="x"></i></button>` : ''}
                        ${status === 'failed' ? `<button class="icon-btn" data-action="retry" data-id="${safeId}" title="Retry"><i data-lucide="refresh-cw"></i></button>` : ''}
                        ${status === 'completed' ? `<button class="icon-btn" data-action="open" data-id="${safeId}" title="Open Folder"><i data-lucide="folder-open"></i></button>` : ''}
                    </div>
                </div>
                <div class="download-progress-container">
                    <div class="download-progress-bar" style="width:${pct.toFixed(2)}%;"></div>
                </div>
                <div class="download-meta-row">
                    <span class="download-meta-text">${meta}</span>
                    <span class="download-percent">${Math.round(pct)}%</span>
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
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (!action || !id) return;
        
        if (action === 'cancel') {
            window.postMessage({ type: 'zentrio-download-cancel', id }, '*');
        } else if (action === 'retry') {
            window.postMessage({ type: 'zentrio-download-retry', id }, '*');
        } else if (action === 'open') {
            // Not supported yet
        }
      });
    });
  }

  // --- Listeners ---

  window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data || typeof data !== 'object') return;

    // Listen for updates from Core
    if (data.type === 'zentrio-download-progress' || 
        data.type === 'zentrio-download-complete' || 
        data.type === 'zentrio-download-failed' ||
        data.type === 'zentrio-download-cancelled' ||
        data.type === 'zentrio-download-init' ||
        data.type === 'zentrio-download-started') {
        
        // If we have direct access to core items, use them for consistency
        // Otherwise we rely on events but that's harder to sync full list
        render();
    } else if (data.type === 'zentrio-download-root-handle') {
        if (data.handle) {
            setFolderStatus(`Folder: ${data.handle.name}`, true);
        } else {
            setFolderStatus('No folder selected', false);
            showModal();
        }
    }
  });

  // Initial check
  function init() {
      // Ask Core for root handle status
      window.postMessage({ type: 'zentrio-download-root-request' }, '*');
      
      // Initial render
      render();
      
      // Poll occasionally to sync UI if messages missed
      setInterval(render, 1000);
  }

  // Wire folder button
  const folderBtn = document.getElementById('setDownloadFolderBtn');
  if (folderBtn) {
      folderBtn.addEventListener('click', async () => {
        if (!('showDirectoryPicker' in window)) {
            setFolderStatus('Directory picker not supported', false);
            return;
        }
        try {
            const handle = await window.showDirectoryPicker({ id: 'zentrio-downloads', mode: 'readwrite', startIn: 'videos' });
            window.postMessage({ type: 'zentrio-download-root-set', handle }, '*');
        } catch (e) {
            // cancelled
        }
      });
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
