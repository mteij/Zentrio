// Global type declarations for Zentrio

// Augment React to accept Firefox's non-standard orient attribute for range inputs
declare namespace React {
  interface InputHTMLAttributes<T> {
    orient?: 'horizontal' | 'vertical'
  }
}

declare global {
  interface Window {
    addToast?: (type: 'message' | 'warning' | 'error' | 'success' | 'info', title: string, message?: string) => void;
    __TAURI__?: any;
    __ZENTRIO_PERF__?: Array<{
      name: string;
      at: string;
      data?: Record<string, unknown>;
    }>;
  }
  
  /** App version from package.json, injected at build time */
  const __APP_VERSION__: string;
}

// mp4box.js module declaration
declare module 'mp4box' {
  const MP4Box: any
  export default MP4Box
}

export {};
