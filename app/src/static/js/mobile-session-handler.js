// Mobile session handler for Capacitor apps
// Improves login persistence and handles mobile-specific issues

(function() {
    'use strict';

    // Detect if we're running in a Capacitor app
    function isCapacitorApp() {
        return window.Capacitor && window.Capacitor.isNativePlatform();
    }

    // Enhanced session storage for mobile
    class MobileSessionHandler {
        constructor() {
            this.isCapacitor = isCapacitorApp();
            this.sessionCheckInterval = null;
            this.retryCount = 0;
            this.maxRetries = 3;
            this.init();
        }

        async init() {
            if (!this.isCapacitor) {
                console.log('Not running in Capacitor, skipping mobile session handler');
                return;
            }

            console.log('Initializing mobile session handler');
            
            // Handle blank screen issue - ensure content loads
            this.handleBlankScreenIssue();
            
            // Start periodic session validation
            this.startSessionValidation();
            
            // Handle app background/foreground events
            this.setupAppStateHandlers();
            
            // Enhance cookie handling for mobile
            this.enhanceCookieHandling();
            
            // Setup network connectivity monitoring
            this.setupNetworkMonitoring();
        }

        // Handle blank screen issue after app reopen
        handleBlankScreenIssue() {
            // Force reload if page is blank for too long
            let blankCheckCount = 0;
            const maxBlankChecks = 10;
            
            const checkBlankScreen = () => {
                const body = document.body;
                const hasContent = body && (
                    body.children.length > 0 ||
                    body.innerHTML.trim().length > 0 ||
                    document.querySelector('main, .container, #app, [class*="content"]')
                );

                if (!hasContent) {
                    blankCheckCount++;
                    console.warn(`Blank screen detected (${blankCheckCount}/${maxBlankChecks})`);
                    
                    if (blankCheckCount >= maxBlankChecks) {
                        console.error('App appears to be blank, forcing reload');
                        this.forceReload();
                        return;
                    }
                } else {
                    blankCheckCount = 0; // Reset counter when content is found
                }
            };

            // Check every 500ms for the first 10 seconds
            const blankCheckInterval = setInterval(() => {
                checkBlankScreen();
                if (blankCheckCount === 0 && document.readyState === 'complete') {
                    clearInterval(blankCheckInterval);
                }
            }, 500);

            // Clear interval after 10 seconds
            setTimeout(() => {
                clearInterval(blankCheckInterval);
            }, 10000);
        }

        // Force reload with cache busting
        forceReload() {
            try {
                // Clear any cached data that might cause issues
                if (window.caches) {
                    window.caches.keys().then(cacheNames => {
                        return Promise.all(
                            cacheNames.map(cacheName => window.caches.delete(cacheName))
                        );
                    });
                }
                
                // Force reload with timestamp
                const timestamp = Date.now();
                const currentUrl = window.location.href;
                const separator = currentUrl.includes('?') ? '&' : '?';
                window.location.href = `${currentUrl}${separator}_t=${timestamp}`;
            } catch (error) {
                console.error('Failed to force reload:', error);
                // Fallback to simple reload
                window.location.reload();
            }
        }

        // Periodically validate session is still active
        startSessionValidation() {
            // Check every 5 minutes
            this.sessionCheckInterval = setInterval(async () => {
                try {
                    const response = await fetch('/api/user/profile', {
                        method: 'GET',
                        credentials: 'same-origin',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'Cache-Control': 'no-cache'
                        }
                    });

                    if (!response.ok) {
                        console.warn('Session validation failed, redirecting to login');
                        this.handleSessionExpired();
                    } else {
                        this.retryCount = 0; // Reset retry count on success
                    }
                } catch (error) {
                    console.error('Session validation error:', error);
                    this.retryCount++;
                    
                    if (this.retryCount >= this.maxRetries) {
                        console.error('Multiple session validation failures, forcing reload');
                        this.forceReload();
                    }
                }
            }, 5 * 60 * 1000);
        }

        // Handle app state changes (background/foreground)
        setupAppStateHandlers() {
            if (window.Capacitor && window.Capacitor.App) {
                window.Capacitor.App.addListener('appStateChange', (state) => {
                    if (state.isActive) {
                        // App came to foreground, validate session and check for blank screen
                        this.validateSessionOnForeground();
                        setTimeout(() => this.handleBlankScreenIssue(), 1000);
                    }
                });
            }
        }

        async validateSessionOnForeground() {
            try {
                const response = await fetch('/api/user/profile', {
                    method: 'GET',
                    credentials: 'same-origin',
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest',
                        'Cache-Control': 'no-cache'
                    }
                });

                if (!response.ok) {
                    console.log('Session expired while app was in background');
                    this.handleSessionExpired();
                }
            } catch (error) {
                console.error('Foreground session validation error:', error);
                // Don't immediately reload on foreground validation error
                // Let the periodic validation handle it
            }
        }

        // Setup network connectivity monitoring
        setupNetworkMonitoring() {
            if ('connection' in navigator) {
                const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                
                const handleConnectionChange = () => {
                    console.log('Network connection changed:', connection.effectiveType);
                    // When network is restored, validate session
                    if (connection.effectiveType !== 'slow-2g' && connection.effectiveType !== '2g') {
                        setTimeout(() => this.validateSessionOnForeground(), 1000);
                    }
                };

                connection.addEventListener('change', handleConnectionChange);
            }

            // Listen for online/offline events
            window.addEventListener('online', () => {
                console.log('App is back online');
                setTimeout(() => this.validateSessionOnForeground(), 1000);
            });

            window.addEventListener('offline', () => {
                console.log('App is offline');
            });
        }

        // Handle session expiration
        handleSessionExpired() {
            // Clear local storage
            try {
                localStorage.removeItem('selectedProfile');
                localStorage.removeItem('stremioSessionToken');
            } catch (e) {
                console.warn('Failed to clear localStorage:', e);
            }

            // Redirect to login page
            window.location.href = '/';
        }

        // Enhance cookie handling for mobile
        enhanceCookieHandling() {
            // Override fetch to ensure credentials are always included
            const originalFetch = window.fetch;
            window.fetch = function(...args) {
                const [url, options = {}] = args;
                
                // Ensure credentials are included for same-origin requests
                if (url.startsWith('/') || url.startsWith(window.location.origin)) {
                    options.credentials = options.credentials || 'same-origin';
                    options.headers = {
                        ...options.headers,
                        'X-Requested-With': 'XMLHttpRequest',
                        'Cache-Control': 'no-cache'
                    };
                }
                
                return originalFetch.apply(this, args);
            };
        }

        // Cleanup
        destroy() {
            if (this.sessionCheckInterval) {
                clearInterval(this.sessionCheckInterval);
            }
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            window.mobileSessionHandler = new MobileSessionHandler();
        });
    } else {
        window.mobileSessionHandler = new MobileSessionHandler();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (window.mobileSessionHandler) {
            window.mobileSessionHandler.destroy();
        }
    });

})();