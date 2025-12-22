// Global type declarations for Zentrio

declare global {
  interface Window {
    addToast?: (type: 'message' | 'warning' | 'error' | 'success' | 'info', title: string, message?: string) => void;
    __TAURI__?: any;
  }
}

// mp4box.js module declaration
declare module 'mp4box' {
  const MP4Box: any
  export default MP4Box
}

export {};
