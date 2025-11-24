import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// Zentrio Downloads Core - The Master Manager
// Handles downloads via Dedicated Worker (Web) or Capacitor Filesystem (Native)

declare global {
    interface Window {
        __zentrioDownloadsCoreInitialized: boolean;
        __zentrioDownloads: any;
    }
}

(function() {
    // Prevent multiple initializations
    if (window.__zentrioDownloadsCoreInitialized) return;
    window.__zentrioDownloadsCoreInitialized = true;

    // State
    let rootHandle: any = null;
    let worker: Worker | null = null;
    const isNative = Capacitor.isNativePlatform();
    
    // --- IndexedDB Helpers ---
    const IDB_NAME = 'zentrio_downloads_db';
    const IDB_STORE_ITEMS = 'items';

    function openDb(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(IDB_NAME, 3); // Bump version for schema change if needed, though we just ignore handles store
            req.onupgradeneeded = (e: any) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(IDB_STORE_ITEMS)) {
                    db.createObjectStore(IDB_STORE_ITEMS, { keyPath: 'id' });
                }
                // We don't need handles store anymore
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function getOpfsRoot() {
        try {
            return await navigator.storage.getDirectory();
        } catch (e) {
            console.error('[ZDM-Core] Failed to get OPFS root', e);
            return null;
        }
    }

    async function saveItem(item: any) {
        try {
            const db = await openDb();
            return new Promise<void>((resolve, reject) => {
                const tx = db.transaction(IDB_STORE_ITEMS, 'readwrite');
                tx.objectStore(IDB_STORE_ITEMS).put(item);
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        } catch (e) { console.error('[ZDM-Core] DB Save Item Error', e); }
    }

    async function getItem(id: string): Promise<any> {
        try {
            const db = await openDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(IDB_STORE_ITEMS, 'readonly');
                const req = tx.objectStore(IDB_STORE_ITEMS).get(id);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
        } catch (e) { return null; }
    }

    async function getAllItems(): Promise<any[]> {
        try {
            const db = await openDb();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(IDB_STORE_ITEMS, 'readonly');
                const req = tx.objectStore(IDB_STORE_ITEMS).getAll();
                req.onsuccess = () => resolve(req.result || []);
                req.onerror = () => reject(req.error);
            });
        } catch (e) { return []; }
    }

    // --- Messaging & Coordination ---

    function broadcast(msg: any) {
        window.postMessage(msg, '*');
        const frames = document.querySelectorAll('iframe');
        frames.forEach(f => {
            try { f.contentWindow?.postMessage(msg, '*'); } catch(_) {}
        });
    }

    // --- Native Download Logic ---

    async function startNativeDownload(item: any, url: string) {
        console.log('[ZDM-Core] Starting Native Download', item.id);
        
        try {
            // Request permission if needed (Android 10+ usually doesn't need explicit permission for public dirs if using MediaStore, but Capacitor Filesystem uses app-specific or public Documents)
            // We'll use Directory.Documents or Directory.ExternalStorage
            
            const fileName = item.fileName || (item.title.replace(/[^a-z0-9]/gi, '_') + '.mp4');
            const path = `Zentrio/${fileName}`;

            // Use Filesystem.downloadFile
            // This handles large files better than fetch+write in JS
            const result = await Filesystem.downloadFile({
                path,
                directory: Directory.Documents,
                url,
                recursive: true,
                progress: true
            });

            // Listen for progress?
            // Filesystem.downloadFile returns a promise that resolves when done.
            // To get progress, we need to add a listener BEFORE calling downloadFile?
            // Capacitor 3+ supports progress events for downloadFile if 'progress: true' is set.
            // But how to attach listener?
            // It seems we need to use `Filesystem.addListener('progress', ...)`
            
            // However, the listener is global or per-download?
            // The docs say: "Progress events are emitted to the 'progress' event listener."
            // We need to filter by something? Or maybe it's one at a time?
            // Actually, `downloadFile` returns `DownloadFileResult`.
            
            // Let's assume basic completion for now, or implement a poller if needed.
            // Wait, `Filesystem.addListener` returns a handle.
            
            // For now, let's just await completion.
            
            item.status = 'completed';
            item.progress = 100;
            item.path = result.path;
            await saveItem(item);
            
            broadcast({
                type: 'zentrio-download-complete',
                id: item.id,
                size: 0, // We might not know size
                fileName
            });

        } catch (e: any) {
            console.error('[ZDM-Core] Native download failed', e);
            item.status = 'failed';
            item.error = e.message;
            await saveItem(item);
            broadcast({
                type: 'zentrio-download-failed',
                id: item.id,
                error: e.message
            });
        }
    }

    // --- Worker Management (Web) ---

    function initWorker() {
        if (worker) return;
        try {
            worker = new Worker('/static/js/download-worker.js');
            worker.onmessage = handleWorkerMessage;
            worker.onerror = (e) => {
                console.error('[ZDM-Core] Worker error:', e.message, e.filename, e.lineno);
            };
            console.log('[ZDM-Core] Worker initialized');
        } catch (e) {
            console.error('[ZDM-Core] Failed to initialize worker', e);
        }
    }

    async function handleWorkerMessage(e: MessageEvent) {
        const msg = e.data;
        if (!msg || !msg.type) return;

        // Update local state and DB
        if (msg.id) {
            const item = await getItem(msg.id);
            if (item) {
                let changed = false;
                if (msg.type === 'progress') {
                    item.status = 'downloading';
                    item.progress = msg.progress;
                    item.bytesReceived = msg.bytesReceived;
                    item.size = msg.size;
                    item.eta = msg.eta;
                    changed = true;
                } else if (msg.type === 'complete') {
                    item.status = 'completed';
                    item.progress = 100;
                    item.size = msg.size;
                    item.fileName = msg.fileName;
                    item.completedAt = Date.now();
                    changed = true;
                } else if (msg.type === 'error') {
                    item.status = 'failed';
                    item.error = msg.error;
                    changed = true;
                } else if (msg.type === 'cancelled') {
                    item.status = 'failed';
                    item.error = 'Cancelled by user';
                    changed = true;
                } else if (msg.type === 'started') {
                    item.status = 'downloading';
                    item.fileName = msg.fileName;
                    item.size = msg.size;
                    changed = true;
                }

                if (changed) {
                    await saveItem(item);
                }
            }
        }

        // Broadcast to UI
        const typeMap: Record<string, string> = {
            'progress': 'zentrio-download-progress',
            'complete': 'zentrio-download-complete',
            'error': 'zentrio-download-failed',
            'cancelled': 'zentrio-download-cancelled',
            'started': 'zentrio-download-started'
        };

        if (typeMap[msg.type]) {
            broadcast({
                type: typeMap[msg.type],
                ...msg
            });
        }
    }

    async function handleDownloadRequest(data: any) {
        console.log('[ZDM-Core] Handling download request', data);
        
        if (!isNative) {
            if (!rootHandle) {
                rootHandle = await getOpfsRoot();
            }

            if (!rootHandle) {
                console.error('[ZDM-Core] No OPFS root handle found');
                broadcast({ type: 'zentrio-download-error', id: data.id, error: 'Storage access failed' });
                return;
            }
            // OPFS does not require permission checks
        }

        const item = {
            id: data.id,
            href: data.href,
            title: data.title,
            episodeInfo: data.episodeInfo,
            fileName: data.fileName,
            poster: data.poster,
            duration: data.duration,
            url: data.url,
            createdAt: Date.now(),
            status: 'initiated',
            progress: 0
        };

        await saveItem(item);
        broadcast({ type: 'zentrio-download-init', id: item.id, payload: item });

        if (isNative) {
            startNativeDownload(item, data.url);
        } else {
            if (!worker) initWorker();
            try {
                worker?.postMessage({
                    type: 'start',
                    payload: {
                        item,
                        url: data.url,
                        rootHandle,
                        resume: false
                    }
                });
            } catch (e) {
                console.error('[ZDM-Core] Failed to post message to worker', e);
                broadcast({ type: 'zentrio-download-error', id: data.id, error: 'Worker communication failed' });
            }
        }
    }

    // --- DOM Bridge ---
    function setupDomBridge() {
        const bridgeId = 'zentrio-comm-bridge';
        
        function attachObserver(el: HTMLElement) {
            // Prevent double observation
            if ((el as any)._zdmObserved) return;
            
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'data-message') {
                        const raw = el.getAttribute('data-message');
                        if (raw) {
                            try {
                                const data = JSON.parse(raw);
                                // Clear attribute immediately to allow next message
                                // el.removeAttribute('data-message');
                                // Actually, let the sender clear it or just overwrite it.
                                // But we should process it.
                                handleMessage(data, null);
                            } catch (e) {
                                console.error('[ZDM-Core] Bridge parse error', e);
                            }
                        }
                    }
                });
            });
            observer.observe(el, { attributes: true });
            (el as any)._zdmObserved = true;
            return observer;
        }

        function ensureBridge() {
            let bridge = document.getElementById(bridgeId);
            if (!bridge) {
                bridge = document.createElement('div');
                bridge.id = bridgeId;
                bridge.style.display = 'none';
                document.documentElement.appendChild(bridge);
            }
            attachObserver(bridge);
            return bridge;
        }

        ensureBridge();

        // Watch for removal
        const parentObserver = new MutationObserver((mutations) => {
            if (!document.getElementById(bridgeId)) {
                ensureBridge();
            }
        });
        parentObserver.observe(document.documentElement, { childList: true });
    }

    // Listen for messages from UI
    const processedMessageIds = new Set<string>();

    async function handleMessage(data: any, source: any) {
        try {
            if (!data || typeof data !== 'object') return;

            // Deduplicate by ID for requests that carry an ID
            if (data.id && (data.type === 'zentrio-download-request' || data.type === 'zentrio-download-cancel')) {
                const key = `${data.type}:${data.id}`;
                if (processedMessageIds.has(key)) {
                    // console.log('[ZDM-Core] Ignoring duplicate message', key);
                    return;
                }
                processedMessageIds.add(key);
                // Clear after 2 seconds - 5s is too long if user wants to retry quickly after failure
                setTimeout(() => processedMessageIds.delete(key), 2000);
            }

            switch (data.type) {
                case 'zentrio-download-list-request':
                    const allItems = await getAllItems();
                    // Send back to source or broadcast
                    const listMsg = { type: 'zentrio-download-list', items: allItems };
                    if (source) source.postMessage(listMsg, '*');
                    else broadcast(listMsg);
                    break;
                case 'zentrio-download-request':
                    handleDownloadRequest(data);
                    break;
                case 'zentrio-download-cancel':
                    if (isNative) {
                        // TODO: Cancel native download
                    } else {
                        if (worker) worker.postMessage({ type: 'cancel', id: data.id });
                    }
                    break;
                case 'zentrio-download-delete':
                    const delItem = await getItem(data.id);
                    if (delItem) {
                        // If file exists, try to delete it (Native only for now, or if we have handle)
                        // For now just remove from DB
                        try {
                            const db = await openDb();
                            const tx = db.transaction(IDB_STORE_ITEMS, 'readwrite');
                            tx.objectStore(IDB_STORE_ITEMS).delete(data.id);
                            broadcast({ type: 'zentrio-download-deleted', id: data.id });
                        } catch(e) { console.error('Delete failed', e); }
                    }
                    break;
                case 'zentrio-download-retry':
                    const item = await getItem(data.id);
                    if (item && item.url) {
                        handleDownloadRequest({
                            id: item.id,
                            href: item.href,
                            title: item.title,
                            episodeInfo: item.episodeInfo,
                            url: item.url
                        });
                    }
                    break;
                case 'zentrio-download-export':
                    if (!isNative && rootHandle && data.id) {
                        try {
                            const itemToExport = await getItem(data.id);
                            if (itemToExport && itemToExport.fileName) {
                                const fileHandle = await rootHandle.getFileHandle(itemToExport.fileName);
                                const file = await fileHandle.getFile();
                                
                                // Use showSaveFilePicker if available
                                if ('showSaveFilePicker' in window) {
                                    const saveHandle = await (window as any).showSaveFilePicker({
                                        suggestedName: itemToExport.fileName,
                                        types: [{
                                            description: 'Video File',
                                            accept: { 'video/*': ['.mp4', '.mkv', '.avi', '.webm'] }
                                        }]
                                    });
                                    const writable = await saveHandle.createWritable();
                                    await writable.write(file);
                                    await writable.close();
                                } else {
                                    // Fallback to blob download
                                    const url = URL.createObjectURL(file);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = itemToExport.fileName;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                }
                            }
                        } catch (e) {
                            console.error('[ZDM-Core] Export failed', e);
                        }
                    }
                    break;
            }
        } catch (err) {
            console.error('[ZDM-Core] Message listener error:', err);
        }
    }

    window.addEventListener('message', (e) => handleMessage(e.data, e.source), true);
    window.addEventListener('zentrio-message', (e: any) => handleMessage(e.detail, null));

    // --- Initialization ---
    async function init() {
        console.log('[ZDM-Core] Initializing v3 (Hybrid - OPFS)...', window.location.href);
        
        if (!isNative) {
            rootHandle = await getOpfsRoot();
            if (rootHandle) {
                console.log('[ZDM-Core] Loaded OPFS root handle');
            }
            initWorker();
        } else {
            console.log('[ZDM-Core] Running in Native mode');
        }

        window.__zentrioDownloads = {
            worker: worker,
            listFiles: async () => {
                if (!rootHandle) rootHandle = await getOpfsRoot();
                if (!rootHandle) return console.error('No root handle');
                console.log('--- OPFS Files ---');
                // @ts-ignore
                for await (const [name, handle] of rootHandle.entries()) {
                    console.log(name, handle.kind);
                }
                console.log('------------------');
            }
        };
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init();
            setupDomBridge();
        });
    } else {
        init();
        setupDomBridge();
    }

})();