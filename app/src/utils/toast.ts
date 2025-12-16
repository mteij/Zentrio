// Toast utility using Sonner
// Re-exports Sonner's toast for consistent API across the app

import { toast as sonnerToast } from 'sonner'

export interface ToastOptions {
  type: 'message' | 'warning' | 'error' | 'success' | 'info'
  title?: string
  message: string
  duration?: number
}

/**
 * Toast utility wrapper around Sonner
 */
export const toast = {
  success: (message: string, title?: string) => {
    sonnerToast.success(title || 'Success', { description: message })
  },
  
  error: (message: string, title?: string) => {
    sonnerToast.error(title || 'Error', { description: message })
  },
  
  warning: (message: string, title?: string) => {
    sonnerToast.warning(title || 'Warning', { description: message })
  },
  
  info: (message: string, title?: string) => {
    sonnerToast.info(title || 'Info', { description: message })
  },
  
  message: (message: string, title?: string) => {
    sonnerToast.message(title || 'Notice', { description: message })
  },

  // Generic show method for backwards compatibility
  show: (options: ToastOptions) => {
    const { type, title, message } = options
    switch (type) {
      case 'success':
      case 'message':
        toast.success(message, title)
        break
      case 'error':
        toast.error(message, title)
        break
      case 'warning':
        toast.warning(message, title)
        break
      case 'info':
        toast.info(message, title)
        break
    }
  },
  
  // Promise helper for async operations
  promise: sonnerToast.promise,
  
  // Dismiss helpers
  dismiss: sonnerToast.dismiss,
}

// Export convenience functions
export const showSuccess = (message: string, title?: string) => toast.success(message, title)
export const showError = (message: string, title?: string) => toast.error(message, title)
export const showWarning = (message: string, title?: string) => toast.warning(message, title)
export const showInfo = (message: string, title?: string) => toast.info(message, title)

// Legacy compatibility - window.addToast bridge
// This allows gradual migration without breaking existing code
if (typeof window !== 'undefined') {
  (window as any).addToast = (type: string, title: string, message?: string) => {
    const description = message || ''
    switch (type) {
      case 'error':
        sonnerToast.error(title, { description })
        break
      case 'warning':
        sonnerToast.warning(title, { description })
        break
      case 'success':
      case 'message':
      default:
        sonnerToast.success(title, { description })
        break
    }
  }
}

// Re-export sonner's toast for direct use
export { sonnerToast }