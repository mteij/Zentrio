import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { get, set, STORES } from "../utils/idb.ts";
import { useToast } from "./useToast.ts";

let directoryHandle: FileSystemDirectoryHandle | null = null;

export function useFileSystem() {
  const directoryName = useSignal<string | null>(null);
  const isLoading = useSignal(true);
  const { success, error: showError } = useToast();
  const canUseFileSystem = typeof window !== "undefined" && "showDirectoryPicker" in window;

  useEffect(() => {
    get<FileSystemDirectoryHandle>(STORES.HANDLES, "download_directory_handle").then(async (handle) => {
      if (handle) {
        interface FileSystemHandleWithPermission extends FileSystemDirectoryHandle {
            requestPermission(options: { mode: "readwrite" }): Promise<"granted" | "denied">;
        }
        
        if (await (handle as FileSystemHandleWithPermission).requestPermission({ mode: "readwrite" }) === "granted") {
          directoryHandle = handle;
          directoryName.value = handle.name;
          if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: "SET_DIRECTORY_HANDLE",
              handle: handle,
            });
          }
        } else {
          await set(STORES.HANDLES, undefined, "download_directory_handle");
          directoryHandle = null;
          directoryName.value = null;
        }
      }
      isLoading.value = false;
    }).catch((err) => {
      console.error("Failed to load directory handle from IDB", err);
      isLoading.value = false;
    });
  }, []);

  const selectDirectory = async () => {
    if (!canUseFileSystem) {
      showError("File System API is not supported in this browser.");
      return;
    }

    try {
      const handle = await (globalThis as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker();
      if (await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
        showError("Permission denied for the selected directory.");
        return;
      }
      directoryHandle = handle;
      directoryName.value = handle.name;
      await set(STORES.HANDLES, handle, "download_directory_handle");
      success("Download directory saved.");

      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SET_DIRECTORY_HANDLE",
          handle: handle,
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("User aborted the directory picker.");
      } else {
        showError("Error selecting directory: " + (error as Error).message);
      }
    }
  };

  return {
    canUseFileSystem,
    directoryName,
    selectDirectory,
    isLoading,
    getDirectoryHandle: () => directoryHandle,
  };
}