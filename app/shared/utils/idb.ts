const DB_NAME = "ZentrioDB";
const DB_VERSION = 4; // Incremented version to force upgrade

export const STORES = {
  HANDLES: "fileSystemHandles",
  DOWNLOADS: "downloads",
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const transaction = (event.target as IDBOpenDBRequest).transaction;

      // Create handles store if it doesn't exist
      if (!db.objectStoreNames.contains(STORES.HANDLES)) {
        db.createObjectStore(STORES.HANDLES);
      }

      // Check and fix downloads store
      if (db.objectStoreNames.contains(STORES.DOWNLOADS)) {
        if (transaction) {
          const store = transaction.objectStore(STORES.DOWNLOADS);
          if (store.keyPath !== "id") {
            console.log("Recreating 'downloads' store due to incorrect keyPath.");
            db.deleteObjectStore(STORES.DOWNLOADS);
            db.createObjectStore(STORES.DOWNLOADS, { keyPath: "id" });
          }
        }
      } else {
        console.log("Creating 'downloads' store for the first time.");
        db.createObjectStore(STORES.DOWNLOADS, { keyPath: "id" });
      }
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onerror = (event) => {
      const error = (event.target as IDBOpenDBRequest).error;
      console.error(`IndexedDB error: ${error?.message}`);
      reject(`Error opening IndexedDB: ${error?.name}`);
      dbPromise = null; // Reset promise on error
    };

    request.onblocked = () => {
      console.warn("IndexedDB open request is blocked. Please close other tabs with this application open.");
    };
  });

  return dbPromise;
}

async function performTransaction<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    // Use a try-catch block to handle potential transaction creation errors
    try {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = action(store);

      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => {
        console.error("Transaction error:", request.error);
        reject(request.error);
      };
    } catch (error) {
      console.error("Failed to create transaction:", error);
      reject(error);
    }
  });
}

export function set(storeName: string, value: unknown, key?: IDBValidKey): Promise<void> {
  return performTransaction<void>(storeName, "readwrite", (store) => {
    return key ? store.put(value, key) : store.put(value);
  });
}

export function get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return performTransaction<T | undefined>(storeName, "readonly", (store) => store.get(key));
}

export function getAll<T>(storeName:string): Promise<T[]> {
  return performTransaction<T[]>(storeName, "readonly", (store) => store.getAll());
}

export function remove(storeName: string, key: IDBValidKey): Promise<void> {
  return performTransaction<void>(storeName, "readwrite", (store) => store.delete(key));
}