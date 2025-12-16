// Global type declarations for Zentrio

declare global {
  interface Window {
    addToast?: (type: 'message' | 'warning' | 'error' | 'success' | 'info', title: string, message?: string) => void;
    __TAURI__?: any;
  }
}

export {};
