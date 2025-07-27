import { ToastType } from "../components/toast/Toast.tsx";

type ToastOptions = {
  duration?: number;
};

type ShowToast = (message: string, type: ToastType, options?: ToastOptions) => void;

const showToast: ShowToast = (message, type, options) => {
  const event = new CustomEvent("show-toast", {
    detail: { message, type, ...options },
  });
  globalThis.dispatchEvent(event);
};

export const useToast = () => {
  return {
    success: (message: string, options?: ToastOptions) => showToast(message, "Success", options),
    warning: (message: string, options?: ToastOptions) => showToast(message, "Warning", options),
    message: (message: string, options?: ToastOptions) => showToast(message, "Message", options),
    error: (message: string, options?: ToastOptions) => showToast(message, "Error", options),
  };
};