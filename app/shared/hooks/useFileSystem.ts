import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { get, set } from "../utils/idb.ts";
import { useToast } from "./useToast.ts";

let directoryHandle: FileSystemDirectoryHandle | null = null;

export function useFileSystem() {
  const directoryName = useSignal<string | null>(null);
  const isLoading = useSignal(true);
  const { success, error: showError } = useToast();
  const canUseFileSystem = typeof window !== "undefined" && "showDirectoryPicker" in window;

  useEffect(() => {
    get<FileSystemDirectoryHandle>("download_directory_handle").then(async (handle) => {
      if (handle) {
        if (await handle.queryPermission({ mode: 'readwrite' }) === 'granted') {
          directoryHandle = handle;
          directoryName.value = handle.name;
        } else {
          await set("download_directory_handle", undefined);
          directoryHandle = null;
          directoryName.value = null;
        }
      }
      isLoading.value = false;
    }).catch(err => {
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
      const handle = await (globalThis as any).showDirectoryPicker();
      if (await handle.requestPermission({ mode: 'readwrite' }) !== 'granted') {
        showError("Permission denied for the selected directory.");
        return;
      }
      directoryHandle = handle;
      directoryName.value = handle.name;
      await set("download_directory_handle", handle);
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