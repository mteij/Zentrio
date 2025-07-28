import { h as _h } from "preact";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";
import { ToastContainer } from "../shared/components/toast/ToastContainer.tsx";
import { ToastProps } from "../shared/components/toast/Toast.tsx";

export default function ToastHandler() {
  const toasts = useSignal<Omit<ToastProps, "onClose">[]>([]);

  useEffect(() => {
    const handleShowToast = (e: CustomEvent) => {
      const { message, type, duration } = e.detail;
      toasts.value = [
        ...toasts.value,
        { id: Date.now() + Math.random(), message, type, duration },
      ];
    };

    globalThis.addEventListener("show-toast", handleShowToast as EventListener);
    return () => globalThis.removeEventListener("show-toast", handleShowToast as EventListener);
  }, []);

  const handleCloseToast = (id: number) => {
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  };

  return <ToastContainer toasts={toasts.value} onClose={handleCloseToast} />;
}