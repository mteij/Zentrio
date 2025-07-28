import { h } from "preact";
import { useSignal } from "@preact/signals";
import { useToast } from "../../shared/hooks/useToast.ts";

export default function CacheManager() {
  const isClearing = useSignal(false);
  const { success, error: showError } = useToast();

  const clearCache = async () => {
    isClearing.value = true;
    try {
      // Unregister service worker
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }

      // Clear all caches
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }

      // Clear IndexedDB
      if ("indexedDB" in window && indexedDB.databases) {
        const dbs = await indexedDB.databases();
        const dbNames = dbs.map(db => db.name).filter((name): name is string => !!name);
        await Promise.all(dbNames.map(name =>
          new Promise<void>((resolve, reject) => {
            const deleteRequest = indexedDB.deleteDatabase(name);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
          })
        ));
      }

      success("All caches cleared. Please reload the page.");
    } catch (err) {
      showError(`Failed to clear cache: ${(err as Error).message}`);
    } finally {
      isClearing.value = false;
    }
  };

  return (
    <div class="bg-gray-800 rounded-lg p-4 mb-4">
      <div class="mb-0">
        <h4 class="text-base font-medium text-gray-200 mb-2">Cache Management</h4>
        <p class="text-xs text-gray-400 mt-2 mb-3">
          This will unregister the service worker, delete all cached data, and clear the IndexedDB. This can resolve issues with outdated content.
        </p>
        <button
          onClick={clearCache}
          disabled={isClearing.value}
          class="px-4 py-2 rounded text-sm font-medium transition-colors duration-200 bg-red-600 hover:bg-red-700 text-white disabled:bg-gray-500"
        >
          {isClearing.value ? "Clearing..." : "Clear All Caches"}
        </button>
      </div>
    </div>
  );
}