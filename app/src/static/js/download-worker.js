console.log('[Worker] Script loaded');
// Zentrio Download Worker
// Handles file downloads in a background thread using File System Access API

const activeDownloads = new Map(); // id -> AbortController

self.onmessage = async (e) => {
    const msg = e.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
        case 'start':
            await startDownload(msg.payload);
            break;
        case 'cancel':
            if (msg.id && activeDownloads.has(msg.id)) {
                activeDownloads.get(msg.id).abort();
                activeDownloads.delete(msg.id);
                self.postMessage({ type: 'cancelled', id: msg.id });
            }
            break;
    }
};

function sanitizeName(str) {
    return (str || 'download')
        .replace(/[\\/:*?"<>|]+/g, '_')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 120);
}

function extractFileExtension(url) {
    try {
        const u = new URL(url);
        const last = u.pathname.split('/').pop() || '';
        if (last.includes('.')) {
            const ext = last.split('.').pop().toLowerCase();
            if (ext.length <= 5) return ext;
        }
    } catch (_) {}
    return 'mp4';
}

function deriveFileName(title, remoteUrl) {
    const base = sanitizeName(title || 'video');
    const ext = extractFileExtension(remoteUrl);
    return base + '.' + ext;
}

async function startDownload({ item, url, rootHandle, resume }) {
    const id = item.id;
    console.log(`[Worker] Starting download ${id} from ${url}`);

    if (activeDownloads.has(id)) {
        console.warn(`[Worker] Download ${id} already active`);
        return;
    }

    const controller = new AbortController();
    activeDownloads.set(id, controller);
    const signal = controller.signal;

    try {
        // If rootHandle is not provided, try to get OPFS root directly
        let handle = rootHandle;
        if (!handle) {
            try {
                handle = await navigator.storage.getDirectory();
            } catch (e) {
                throw new Error('Failed to access OPFS');
            }
        }

        const fileName = item.fileName || deriveFileName(item.title, url);
        
        // Get file handle
        let fileHandle;
        try {
            fileHandle = await handle.getFileHandle(fileName, { create: true });
        } catch (e) {
            throw new Error(`FileSystem Error: ${e.message}`);
        }

        let writable;
        let startOffset = 0;

        if (resume) {
            try {
                const file = await fileHandle.getFile();
                startOffset = file.size;
                writable = await fileHandle.createWritable({ keepExistingData: true });
                await writable.seek(startOffset);
            } catch (e) {
                // If resume fails, try fresh
                console.warn('[Worker] Resume failed, starting fresh', e);
                startOffset = 0;
                writable = await fileHandle.createWritable();
            }
        } else {
            writable = await fileHandle.createWritable();
        }

        // Prepare headers
        const headers = {};
        if (startOffset > 0) {
            headers['Range'] = `bytes=${startOffset}-`;
        }

        // Start Fetch
        let response;
        try {
            response = await fetch(url, { headers, signal });
        } catch (e) {
            if (signal.aborted) throw new Error('Aborted');
            throw new Error(`Network Error: ${e.message}`);
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        let total = item.size || 0;
        if (!total) {
            const len = response.headers.get('Content-Length');
            if (len) total = startOffset + parseInt(len, 10);
        }

        const reader = response.body.getReader();
        let loaded = startOffset;
        let lastUpdate = 0;
        const startTime = Date.now();

        // Notify start
        self.postMessage({
            type: 'started',
            id,
            fileName,
            size: total
        });

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                loaded += value.length;
                await writable.write(value);

                const now = Date.now();
                if (now - lastUpdate > 1000) {
                    let pct = total ? (loaded / total) * 100 : 0;
                    if (pct > 100) pct = 100;

                    const elapsed = (now - startTime) / 1000;
                    const speed = (loaded - startOffset) / (elapsed || 1); // bytes per sec
                    const remaining = total ? total - loaded : 0;
                    const eta = (speed > 0 && remaining > 0) ? Math.round(remaining / speed) : 0;

                    self.postMessage({
                        type: 'progress',
                        id,
                        progress: pct,
                        bytesReceived: loaded,
                        size: total,
                        eta
                    });
                    lastUpdate = now;
                }
            }
        } catch (writeErr) {
            if (writeErr.name === 'QuotaExceededError') {
                throw new Error('Disk full or quota exceeded');
            }
            throw writeErr;
        } finally {
            // Ensure we close the writable stream
            try {
                await writable.close();
            } catch (closeErr) {
                console.warn('[Worker] Failed to close writable:', closeErr);
            }
        }

        activeDownloads.delete(id);

        self.postMessage({
            type: 'complete',
            id,
            size: loaded,
            fileName
        });

    } catch (err) {
        activeDownloads.delete(id);
        const isAbort = err.name === 'AbortError' || err.message === 'Aborted';
        
        if (isAbort) {
            self.postMessage({ type: 'cancelled', id });
        } else {
            console.error(`[Worker] Download ${id} failed:`, err);
            self.postMessage({ type: 'error', id, error: err.message });
        }
    }
}