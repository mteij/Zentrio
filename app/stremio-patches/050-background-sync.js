// --- Zentrio Background Sync Patch ---
// Applies the same Vanta.js background from the profile page to Stremio Web
// Now uses the shared background-manager.js logic
(function() {
    // Load the shared background manager script
    const script = document.createElement('script');
    script.src = '/static/js/background-manager.js';
    script.onload = () => {
        console.log('[Zentrio] Background manager loaded');
        // Force apply after load to ensure it runs
        if (window.ZentrioBackground) {
            window.ZentrioBackground.init();
        }
    };
    document.head.appendChild(script);
})();