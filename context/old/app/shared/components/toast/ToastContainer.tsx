import { h as _h } from "preact";
import { Toast, ToastProps } from "./Toast.tsx";

interface ToastContainerProps {
  toasts: Omit<ToastProps, "onClose">[];
  onClose: (id: number) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
  return (
    <div class="fixed top-4 right-4 z-[100] space-y-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
}