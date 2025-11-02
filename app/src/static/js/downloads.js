// Zentrio Downloads Page Client Script (queue + rendering v1)
(function() {
  const LS_KEY = 'zentrioDownloadsQueue';

  function loadQueue() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch(e) { return []; }
  }

  function autoPrune(q) {
    const now = Date.now();
    // Keep last 100 entries; remove completed older than 7 days automatically
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    return q
      .filter((item, idx) => {
        if (idx >= 200) return false; // hard cap
        if (item.status === 'completed' && item.completedAt && (now - item.completedAt) > weekMs) return false;
        return true;
      });
  }

  function saveQueue(q) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(q)); } catch(e) {}
  }

  let queue = loadQueue();

  const els = {
    list: document.getElementById('downloadsList'),
    empty: document.getElementById('downloadsEmpty'),
    metricActive: document.getElementById('dlMetricActive'),
    metricCompleted: document.getElementById('dlMetricCompleted'),
    metricFailed: document.getElementById('dlMetricFailed'),
    metricSize: document.getElementById('dlMetricSize'),
    message: document.getElementById('downloadsMessage')
  };

  // Optional debug panel (add <pre id="downloadsDebug"></pre> in HTML to view)
  const debugEl = document.getElementById('downloadsDebug');
  const DEBUG = true;
  function debugLog(...args) {
    if (!DEBUG) return;
    try {
      console.log('[DownloadsUI]', ...args);
      if (debugEl) {
        const line = document.createElement('div');
        line.textContent = '[' + new Date().toISOString().slice(11,19) + '] ' + args.map(a => {
          if (typeof a === 'object') {
            try { return JSON.stringify(a); } catch(_) { return String(a); }
          }
          return String(a);
        }).join(' ');
        debugEl.appendChild(line);
        // cap lines
        while (debugEl.childNodes.length > 400) {
          debugEl.removeChild(debugEl.firstChild);
        }
      }
    } catch(_) {}
  }

  // --- Persistent Root Directory Handle Management (shared with iframe) ---
  const IDB_DB = 'zentrioDownloads';
  const IDB_STORE = 'handles';

  function openHandleDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_DB, 1);
      req.onupgradeneeded = () => {
        try {
          const db = req.result;
            if (!db.objectStoreNames.contains(IDB_STORE)) {
              db.createObjectStore(IDB_STORE);
            }
        } catch (e) { /* ignore */ }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadPersistedRootHandle() {
    try {
      const db = await openHandleDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const store = tx.objectStore(IDB_STORE);
        const g = store.get('root');
        g.onsuccess = () => resolve(g.result || null);
        g.onerror = () => reject(g.error);
      });
    } catch (_) {
      return null;
    }
  }

  async function persistRootHandle(handle) {
    try {
      const db = await openHandleDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        const store = tx.objectStore(IDB_STORE);
        const p = store.put(handle, 'root');
        p.onsuccess = () => resolve(true);
        p.onerror = () => reject(p.error);
      });
    } catch (_) {
      return false;
    }
  }

  async function ensureHandlePermission(handle) {
    if (!handle) return false;
    try {
      let perm = await handle.queryPermission({ mode: 'readwrite' });
      if (perm === 'granted') return true;
      if (perm === 'prompt') {
        perm = await handle.requestPermission({ mode: 'readwrite' });
        return perm === 'granted';
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  function setFolderStatus(text, ready) {
    const st = document.getElementById('downloadFolderStatus');
    if (!st) return;
    st.textContent = text;
    st.classList.toggle('ready', !!ready);
  }

  async function initRootHandleStatus() {
    const existing = await loadPersistedRootHandle();
    if (existing) {
      const ok = await ensureHandlePermission(existing);
      if (ok) {
        window.__zentrioSaveRootHandle = existing;
        setFolderStatus(`Folder: ${existing.name}`, true);
        // Proactively broadcast persisted handle to any open iframe (downloads manager script)
        try { window.postMessage({ type: 'zentrio-download-root-handle', handle: existing }, '*'); } catch(_) {}
        // Retry once after a short delay in case iframe not yet loaded
        setTimeout(() => {
          try { window.postMessage({ type: 'zentrio-download-root-handle', handle: existing }, '*'); } catch(_) {}
        }, 1000);
        return;
      }
    }
    setFolderStatus('No folder selected', false);
  }

  async function pickAndPersistRootFolder() {
    if (!('showDirectoryPicker' in window)) {
      setFolderStatus('Directory picker not supported', false);
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ id: 'zentrio-downloads', mode: 'readwrite', startIn: 'videos' });
      const ok = await ensureHandlePermission(handle);
      if (!ok) {
        setFolderStatus('Permission denied', false);
        return;
      }
      await persistRootHandle(handle);
      window.__zentrioSaveRootHandle = handle;
      setFolderStatus(`Folder: ${handle.name}`, true);
      // Broadcast to any open iframes (share actual handle)
      try { window.postMessage({ type: 'zentrio-download-root-handle', handle }, '*'); } catch (_) {}
    } catch (e) {
      setFolderStatus('No folder selected', false);
    }
  }

  (function wireFolderButton(){
    const btn = document.getElementById('setDownloadFolderBtn');
    if (!btn) { setTimeout(wireFolderButton, 250); return; }
    btn.addEventListener('click', () => {
      pickAndPersistRootFolder();
    });
  })();

  initRootHandleStatus();

  // Respond to iframe (session) scripts asking for the persisted root directory handle
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'zentrio-download-root-request' && window.__zentrioSaveRootHandle) {
      try {
        window.postMessage({ type: 'zentrio-download-root-handle', handle: window.__zentrioSaveRootHandle }, '*');
      } catch (_) {}
    }
  });

  function formatBytes(bytes) {
    if (!bytes || isNaN(bytes)) return '0';
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

  // Validate URLs before opening to avoid untrusted redirection
  function isSafeSameOriginUrl(u) {
    try {
      if (typeof u !== 'string') return false;
      const s = u.trim();
      const l = s.toLowerCase();
      // Block dangerous schemes outright
      if (l.startsWith('javascript:') || l.startsWith('data:') || l.startsWith('vbscript:')) return false;
      // Allow same-origin blob URLs only
      if (l.startsWith('blob:')) {
        const expectedPrefix = 'blob:' + window.location.origin;
        return s.startsWith(expectedPrefix);
      }
      // Resolve relative URLs and require same-origin
      const parsed = new URL(s, window.location.origin);
      return parsed.origin === window.location.origin;
    } catch (_) {
      return false;
    }
  }

  function openInNewTabSafe(u) {
    try {
      const w = window.open(u, '_blank', 'noopener,noreferrer');
      if (w && typeof w === 'object') {
        try { w.opener = null; } catch (_) {}
      }
    } catch (_) {}
  }

  function render() {
    if (!els.list || !els.empty) return;
    if (!queue.length) {
      els.empty.style.display = 'block';
      els.list.innerHTML = '';
    } else {
      els.empty.style.display = 'none';
      els.list.innerHTML = queue.map(item => {
        const pct = item.size && item.bytesReceived
          ? Math.min(100, (item.bytesReceived / item.size) * 100)
          : (item.progress || 0);
        const sizeStr = item.size ? formatBytes(item.size) : '';
        const recStr = item.bytesReceived ? formatBytes(item.bytesReceived) : '';
        const etaStr = (typeof item.eta === 'number' && item.eta >= 0) ? `ETA ${item.eta}s` : '';
        const status = item.status || 'initiated';
        const safeTitle = escapeHtml(item.title || 'Untitled');
        const safeFileName = escapeHtml(item.fileName || '');
        const safeId = escapeHtml(item.id);
        const safeStatus = escapeHtml(status);
        return `
          <div class="download-item" data-id="${safeId}">
            <div class="download-item-header">
              <h3 class="download-title" title="${safeTitle}">${safeTitle}</h3>
              <div class="download-status ${safeStatus}">${safeStatus}</div>
            </div>
            <div class="download-progress-wrap">
              <div class="download-progress-bar" style="width:${pct.toFixed(2)}%;"></div>
            </div>
            <div class="download-meta">
              ${sizeStr ? `<span>${sizeStr}</span>` : ''}
              ${recStr ? `<span>${recStr}</span>` : ''}
              ${etaStr ? `<span>${escapeHtml(etaStr)}</span>` : ''}
              ${safeFileName ? `<span>${safeFileName}</span>` : ''}
            </div>
            <div class="download-actions">
              ${status === 'downloading' ? `<button data-action="cancel" data-id="${safeId}">Cancel</button>` : ''}
              ${status === 'failed' ? `<button data-action="retry" data-id="${safeId}">Retry</button>` : ''}
              ${status === 'completed' && item.openable ? `<button data-action="open" data-id="${safeId}">Open</button>` : ''}
            </div>
          </div>
        `;
      }).join('');
      wireActions();
    }
    updateMetrics();
  }

  function updateMetrics() {
    if (!els.metricActive) return;
    const active = queue.filter(i => i.status === 'downloading').length;
    const completed = queue.filter(i => i.status === 'completed').length;
    const failed = queue.filter(i => i.status === 'failed').length;
    const totalSize = queue.reduce((acc, i) => acc + (i.size || 0), 0);
    els.metricActive.textContent = String(active);
    els.metricCompleted.textContent = String(completed);
    els.metricFailed.textContent = String(failed);
    els.metricSize.textContent = formatBytes(totalSize);
  }

  function showMessage(text, type) {
    if (!els.message) return;
    els.message.textContent = text;
    els.message.className = `message ${type || 'info'}`;
    els.message.style.display = 'block';
    setTimeout(() => {
      if (els.message) els.message.style.display = 'none';
    }, type === 'error' ? 6000 : 3500);
  }

  function wireActions() {
    if (!els.list) return;
    els.list.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');
        if (!action || !id) return;
        if (action === 'cancel') {
          // send cancellation signal outward (iframe or same window)
            window.postMessage({ type: 'zentrio-download-cancel', id }, '*');
        } else if (action === 'retry') {
          window.postMessage({ type: 'zentrio-download-retry', id }, '*');
        } else if (action === 'open') {
          // Opening: if we stored blobUrl (future), use it. For now just notify.
          const item = queue.find(i => i.id === id);
          if (item && item.blobUrl && isSafeSameOriginUrl(item.blobUrl)) {
            openInNewTabSafe(item.blobUrl);
          } else {
            showMessage('Open not available yet', 'info');
          }
        }
      });
    });
  }

  function upsert(item) {
    const idx = queue.findIndex(i => i.id === item.id);
    let targetIndex = idx;
    if (idx === -1) {
      queue.unshift(item);
      targetIndex = 0;
    } else {
      queue[idx] = { ...queue[idx], ...item };
      targetIndex = idx;
    }
    if (item.status === 'completed' && targetIndex >= 0 && targetIndex < queue.length) {
      queue[targetIndex].completedAt = queue[targetIndex].completedAt || Date.now();
    }
    queue = autoPrune(queue);
    saveQueue(queue);
    render();
  }

  // message events from downloadsManager script inside session iframe or same context
  window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data || typeof data !== 'object' || !data.type) return;

    // Debug / probe side-channel events (not part of queue state)
    if (data.type === 'zentrio-download-media-probe') {
      debugLog('media-probe', data.url, data.contentType, data.status);
      return;
    }
    if (data.type === 'zentrio-download-debug') {
      debugLog('debug', data);
      return;
    }

    switch (data.type) {
      case 'zentrio-download-init': {
        upsert({
          id: data.id,
          title: data.payload?.title || data.title || 'Untitled',
          href: data.payload?.href || data.href,
          status: 'initiated',
          progress: 0,
          bytesReceived: 0,
          size: 0,
          eta: null,
          fileName: data.fileName || null,
          openable: false
        });
        break;
      }
      case 'zentrio-download-progress': {
        upsert({
          id: data.id,
          status: 'downloading',
          progress: data.progress,
          bytesReceived: data.bytesReceived,
          size: data.size || 0,
          eta: data.eta
        });
        break;
      }
      case 'zentrio-download-complete': {
        upsert({
          id: data.id,
          status: 'completed',
          progress: 100,
          bytesReceived: data.size || data.bytesReceived || 0,
          size: data.size || data.bytesReceived || 0,
          fileName: data.fileName || null,
          openable: !!data.blobUrl,
          blobUrl: data.blobUrl || null
        });
        showMessage('Download completed', 'success');
        break;
      }
      case 'zentrio-download-failed': {
        upsert({
          id: data.id,
          status: 'failed'
        });
        showMessage('Download failed', 'error');
        break;
      }
      case 'zentrio-download-cancelled': {
        upsert({
          id: data.id,
          status: 'failed'
        });
        showMessage('Download cancelled', 'info');
        break;
      }
      default:
        return;
    }
  });

  // Legacy clear event no longer needed; keep listener for backward compatibility (soft refresh only)
  document.addEventListener('zentrioDownloadsRefresh', () => {
    queue = autoPrune(loadQueue());
    render();
  });

  // Wire back button dynamically (fallback if JSX onClick not bound)
  (function wireBack() {
    const btn = document.getElementById('downloadsBackBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        // Prefer history if came from profiles, else direct navigate
        try {
          if (document.referrer && /\/profiles$/.test(new URL(document.referrer).pathname)) {
            history.back();
          } else {
            window.location.href = '/profiles';
          }
        } catch(e) {
          window.location.href = '/profiles';
        }
      }, { once: true });
    } else {
      setTimeout(wireBack, 300);
    }
  })();

  // Initial render
  render();
})();
