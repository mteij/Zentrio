/**
 * Toast Notification System for Zentrio
 * Provides non-blocking notifications to replace native alert() calls
 */

(function() {
    'use strict';

    // Configuration
    const TOAST_DURATION = 5000; // 5 seconds
    const TOAST_ANIMATION_DURATION = 300; // ms
    const MAX_TOASTS = 5;

    // Create container for toasts
    let toastContainer = null;

    function initContainer() {
        if (toastContainer) return;
        
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-container';
        toastContainer.setAttribute('aria-live', 'polite');
        toastContainer.setAttribute('aria-atomic', 'true');
        document.body.appendChild(toastContainer);
    }

    /**
     * Add a toast notification
     * @param {string} type - Type of toast: 'message', 'warning', or 'error'
     * @param {string} title - Toast title
     * @param {string} message - Toast message (optional)
     */
    function addToast(type, title, message) {
        initContainer();

        // Normalize type
        const normalizedType = type === 'success' ? 'message' : (type === 'info' ? 'message' : type);
        
        // Limit number of toasts
        const existingToasts = toastContainer.querySelectorAll('.toast');
        if (existingToasts.length >= MAX_TOASTS) {
            removeToast(existingToasts[0]);
        }

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${normalizedType}`;
        toast.setAttribute('role', 'alert');
        
        // Icon based on type
        let icon = '';
        switch (normalizedType) {
            case 'error':
                icon = '<span class="iconify toast-icon" data-icon="mdi:alert-circle" data-width="20" data-height="20"></span>';
                break;
            case 'warning':
                icon = '<span class="iconify toast-icon" data-icon="mdi:alert" data-width="20" data-height="20"></span>';
                break;
            case 'message':
            default:
                icon = '<span class="iconify toast-icon" data-icon="mdi:check-circle" data-width="20" data-height="20"></span>';
                break;
        }

        // Build toast content
        toast.innerHTML = `
            ${icon}
            <div class="toast-content">
                <div class="toast-title">${escapeHtml(title)}</div>
                ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
            </div>
            <button class="toast-close" aria-label="Close notification">
                <span class="iconify" data-icon="mdi:close" data-width="16" data-height="16"></span>
            </button>
        `;

        // Add to container
        toastContainer.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('toast-show'), 10);

        // Auto-dismiss
        const timeoutId = setTimeout(() => removeToast(toast), TOAST_DURATION);

        // Close button handler
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            clearTimeout(timeoutId);
            removeToast(toast);
        });

        // Pause auto-dismiss on hover
        toast.addEventListener('mouseenter', () => clearTimeout(timeoutId));
        toast.addEventListener('mouseleave', () => {
            const newTimeoutId = setTimeout(() => removeToast(toast), TOAST_DURATION);
            toast.dataset.timeoutId = newTimeoutId;
        });
    }

    function removeToast(toast) {
        if (!toast || !toast.parentNode) return;
        
        toast.classList.remove('toast-show');
        toast.classList.add('toast-hide');
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, TOAST_ANIMATION_DURATION);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Expose globally
    window.addToast = addToast;

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initContainer);
    } else {
        initContainer();
    }
})();
