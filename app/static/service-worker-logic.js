const DB_NAME = "ZentrioDB";
const DB_VERSION = 4;

const STORES = {
  HANDLES: "fileSystemHandles",
  DOWNLOADS: "downloads",
};

let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const transaction = event.target.transaction;

      if (!db.objectStoreNames.contains(STORES.HANDLES)) {
        db.createObjectStore(STORES.HANDLES);
      }

      if (db.objectStoreNames.contains(STORES.DOWNLOADS)) {
        if (transaction) {
          const store = transaction.objectStore(STORES.DOWNLOADS);
          if (store.keyPath !== "id") {
            db.deleteObjectStore(STORES.DOWNLOADS);
            db.createObjectStore(STORES.DOWNLOADS, { keyPath: "id" });
          }
        }
      } else {
        db.createObjectStore(STORES.DOWNLOADS, { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve(db);
    };

    request.onerror = (event) => {
      reject("Error opening IndexedDB: " + event.target.error);
    };
  });
}

async function set(storeName, value, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = key ? store.put(value, key) : store.put(value);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function get(storeName, key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function remove(storeName, key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

async function updateDownload(id, updates) {
  const download = await get(STORES.DOWNLOADS, id);
  if (!download) {
    throw new Error(`Download with id ${id} not found`);
  }
  const updatedDownload = { ...download, ...updates, updatedAt: new Date() };
  await set(STORES.DOWNLOADS, updatedDownload);
  return updatedDownload;
}


let directoryHandle = null;
let isDownloading = false;

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_DIRECTORY_HANDLE') {
    directoryHandle = event.data.handle;
  }

  if (event.data && event.data.type === 'DOWNLOAD_VIDEO') {
    processDownloadQueue();
  }
});

async function processDownloadQueue() {
    if (isDownloading) return;

    const downloads = await getAll(STORES.DOWNLOADS);
    const queuedDownload = downloads.find(d => d.status === 'queued');

    if (queuedDownload) {
        isDownloading = true;
        await handleDownload(queuedDownload);
        isDownloading = false;
        processDownloadQueue(); // Process next in queue
    }
}

async function handleDownload(download) {
    if (!directoryHandle) {
        await updateDownload(download.id, { status: 'failed' });
        if (self.Notification.permission === 'granted') {
            self.registration.showNotification('Download Failed', {
                body: `No download directory selected. Please choose one in settings.`,
                icon: '/icons/icon-192.png',
            });
        }
        return;
    }

    await updateDownload(download.id, { status: 'downloading' });

    try {
        const proxyUrl = `/api/proxy?url=${encodeURIComponent(download.streamUrl)}`;
        const response = await fetch(proxyUrl);
        
        if (!response.ok || !response.body) {
          throw new Error(`Fetch failed: ${response.statusText}`);
        }

        const total = Number(response.headers.get('Content-Length')) || 0;
        await updateDownload(download.id, { total });

        const reader = response.body.getReader();
        const fileHandle = await directoryHandle.getFileHandle(download.fileName, { create: true });
        const writable = await fileHandle.createWritable();
        
        let downloaded = 0;
        let lastUpdate = Date.now();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          await writable.write(value);
          downloaded += value.length;

          if (Date.now() - lastUpdate > 1000) { // Update every second
            await updateDownload(download.id, { downloaded });
            self.clients.matchAll().then(clients => {
              clients.forEach(client => client.postMessage({ type: 'DOWNLOAD_PROGRESS', download: { ...download, downloaded } }));
            });
            lastUpdate = Date.now();
          }
        }
        await writable.close();

        await updateDownload(download.id, { status: 'completed', downloaded });
        self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({ type: 'DOWNLOAD_PROGRESS', download: { ...download, status: 'completed', downloaded } }));
        });

        if (self.Notification.permission === 'granted') {
          self.registration.showNotification('Download Complete', {
            body: `${download.fileName} downloaded.`,
            icon: '/icons/icon-192.png',
          });
        }

      } catch (_error) {
        await updateDownload(download.id, { status: 'failed' });
        self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage({ type: 'DOWNLOAD_PROGRESS', download: { ...download, status: 'failed' } }));
        });
        if (self.Notification.permission === 'granted') {
          self.registration.showNotification('Download Failed', {
            body: `Could not download ${download.fileName}.`,
            icon: '/icons/icon-192.png',
          });
        }
      }
}