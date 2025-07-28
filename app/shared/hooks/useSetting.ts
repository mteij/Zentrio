import { useSignal, Signal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { useToast } from "./useToast.ts";

export type StorageMethod = "localStorage" | "server";

// We can extend this with more complex server-side logic later
const serverStore: Record<string, any> = {};

export function useSetting<T>(
  key: string,
  initialValue: T,
  storageMethod: StorageMethod = "localStorage",
  onLoad?: () => void
) {
  const value = useSignal<T>(initialValue);
  const isLoaded = useSignal(false);
  const { success, error } = useToast();
  const initialValueRef = useSignal<T>(initialValue);

  useEffect(() => {
    const loadValue = async () => {
      let storedValue: T | undefined | null;
      try {
        if (storageMethod === "localStorage") {
          const item = localStorage.getItem(key);
          if (item !== null) {
            storedValue = JSON.parse(item);
          }
        } else if (storageMethod === "server") {
          const response = await fetch(`/api/settings/${key}`);
          if (response.ok) {
            storedValue = await response.json();
          } else {
            error(`Failed to load setting "${key}"`);
          }
        }
      } catch (err) {
        console.error(`Failed to load setting "${key}" from ${storageMethod}:`, err);
        error(`Failed to load setting "${key}"`);
      }

      if (storedValue !== undefined && storedValue !== null) {
        value.value = storedValue;
        initialValueRef.value = storedValue;
      }
      isLoaded.value = true;
      if (onLoad) onLoad();
    };

    loadValue();
  }, [key, storageMethod]);

  useEffect(() => {
    if (!isLoaded.value || value.value === initialValueRef.value) return;

    const handler = setTimeout(() => {
      const saveValue = async () => {
        try {
          if (storageMethod === "localStorage") {
            localStorage.setItem(key, JSON.stringify(value.value));
          } else if (storageMethod === "server") {
            const response = await fetch(`/api/settings/${key}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ value: value.value }),
            });
            if (response.ok) {
              success("Setting saved successfully.");
              initialValueRef.value = value.value;
            } else {
              error(`Failed to save setting "${key}"`);
            }
          }
        } catch (err) {
          console.error(`Failed to save setting "${key}" to ${storageMethod}:`, err);
          error(`Failed to save setting "${key}"`);
        }
      };

      saveValue();
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [value.value, key, storageMethod, isLoaded.value]);

  return value;
}