// Shared background management for Zentrio
// Handles Vanta.js, Stremio gradient, and custom themes across all pages

(function(global) {
    const SETTING_KEY = 'zentrio_enable_vanta_bg';
    const STYLE_KEY = 'zentrioBackgroundStyle';
    const BG_ID = 'zentrio-vanta-bg';
    const THEME_KEY = 'zentrioTheme';
    const THEME_DATA_KEY = 'zentrioThemeData';
    const CUSTOM_THEME_KEY = 'zentrioCustomTheme';

    const BackgroundManager = {
        init: function() {
            // Wait for DOM if needed
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.apply());
            } else {
                this.apply();
            }

            // Listen for storage changes to sync across tabs/iframes
            window.addEventListener('storage', (e) => {
                if ([SETTING_KEY, STYLE_KEY, THEME_KEY, THEME_DATA_KEY, CUSTOM_THEME_KEY].includes(e.key)) {
                    this.apply();
                }
            });

            // Poll for changes (fallback for some iframe contexts)
            setInterval(() => {
                const currentStyle = this.getStyle();
                const currentTheme = localStorage.getItem(THEME_KEY);
                if (this._lastStyle !== currentStyle || this._lastTheme !== currentTheme) {
                    this._lastStyle = currentStyle;
                    this._lastTheme = currentTheme;
                    this.apply();
                }
            }, 2000);

            // Listen for custom events (internal updates)
            window.addEventListener('zentrio-theme-changed', () => this.apply());
        },

        isEnabled: function() {
            // Only check the sync setting if we are running inside Stremio
            if (window.location.pathname.indexOf('/stremio') !== -1) {
                const val = localStorage.getItem(SETTING_KEY);
                return val === 'true';
            }
            // Always enabled on Zentrio pages (Settings, Profiles, Loading)
            return true;
        },

        getStyle: function() {
            return localStorage.getItem(STYLE_KEY) || 'stremio';
        },

        getTheme: function() {
            try {
                // 1. Try to get full theme data first
                const themeData = localStorage.getItem(THEME_DATA_KEY);
                if (themeData) return JSON.parse(themeData);

                // 2. Fallback to ID lookup (requires themes to be loaded globally or fetched)
                // This part is tricky if themes aren't loaded. We'll rely on what we have.
                const themeId = localStorage.getItem(THEME_KEY);
                if (themeId === 'custom') {
                    const custom = localStorage.getItem(CUSTOM_THEME_KEY);
                    if (custom) return JSON.parse(custom);
                }
                
                // Default fallback
                return {
                    accent: '#e50914',
                    vanta: { highlight: '#222222', midtone: '#111111', lowlight: '#000000', base: '#000000' }
                };
            } catch (e) {
                console.warn('Failed to parse theme data', e);
                return null;
            }
        },

        injectVantaScripts: function() {
            if (window.VANTA && window.VANTA.FOG) return Promise.resolve();
            
            return new Promise((resolve) => {
                // Load Three.js first
                if (!window.THREE) {
                    const threeScript = document.createElement('script');
                    threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';
                    threeScript.onload = () => {
                        this.loadVanta(resolve);
                    };
                    document.head.appendChild(threeScript);
                } else {
                    this.loadVanta(resolve);
                }
            });
        },

        loadVanta: function(cb) {
            const vantaScript = document.createElement('script');
            vantaScript.src = 'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js';
            vantaScript.onload = cb;
            document.head.appendChild(vantaScript);
        },

        apply: function() {
            // 1. Check if we should have a background
            if (!this.isEnabled()) {
                this.remove();
                return;
            }

            // 2. Prepare container
            let bg = document.getElementById(BG_ID);
            if (!bg) {
                bg = document.createElement('div');
                bg.id = BG_ID;
                Object.assign(bg.style, {
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: -1,
                    pointerEvents: 'none'
                });
                document.body.appendChild(bg);
            }

            // 3. Determine style
            const style = this.getStyle();
            const theme = this.getTheme() || {};
            const vantaColors = theme.vanta || { highlight: '#222222', midtone: '#111111', lowlight: '#000000', base: '#000000' };

            // 4. Apply style
            if (style === 'stremio') {
                this.destroyVanta();
                bg.style.background = 'linear-gradient(41deg, rgb(12, 11, 17) 0%, rgb(26, 23, 62) 100%)';
                // this.injectTransparentStyle();
            } else if (style === 'vanta') {
                // this.injectTransparentStyle();
                this.injectVantaScripts().then(() => {
                    if (window.VANTA && window.VANTA.FOG) {
                        // Destroy existing if needed to update colors
                        if (window.__zentrioVantaInstance) {
                            // Check if colors changed to avoid unnecessary re-init? 
                            // For now, just destroy and re-create to be safe.
                            try { window.__zentrioVantaInstance.destroy(); } catch(e) {}
                        }

                        try {
                            window.__zentrioVantaInstance = window.VANTA.FOG({
                                el: "#" + BG_ID,
                                mouseControls: false,
                                touchControls: false,
                                minHeight: 200.00,
                                minWidth: 200.00,
                                highlightColor: this.hexToInt(vantaColors.highlight),
                                midtoneColor: this.hexToInt(vantaColors.midtone),
                                lowlightColor: this.hexToInt(vantaColors.lowlight),
                                baseColor: this.hexToInt(vantaColors.base),
                                blurFactor: 0.90,
                                speed: vantaColors.speed || 0.50,
                                zoom: vantaColors.zoom || 0.30
                            });
                        } catch (e) {
                            console.error('Vanta init failed', e);
                            // Fallback to gradient
                            bg.style.background = `linear-gradient(180deg, ${vantaColors.midtone} 0%, ${vantaColors.base} 100%)`;
                        }
                    }
                });
            } else if (style === 'solid') {
                // Solid Color (using base color)
                this.destroyVanta();
                bg.style.background = vantaColors.base || '#000000';
                // this.injectTransparentStyle();
            } else {
                // 'none' or fallback -> Theme Gradient (Fade)
                this.destroyVanta();
                bg.style.background = `linear-gradient(180deg, ${vantaColors.midtone} 0%, ${vantaColors.base} 100%)`;
                // this.injectTransparentStyle();
            }
        },

        remove: function() {
            const bg = document.getElementById(BG_ID);
            if (bg) bg.remove();
            this.destroyVanta();
            const style = document.getElementById('zentrio-bg-style');
            if (style) style.remove();
        },

        destroyVanta: function() {
            if (window.__zentrioVantaInstance) {
                try { window.__zentrioVantaInstance.destroy(); } catch(e) {}
                window.__zentrioVantaInstance = null;
            }
            // Also clean up any canvas left behind if Vanta didn't clean it up
            const bg = document.getElementById(BG_ID);
            if (bg) {
                const canvas = bg.querySelector('canvas');
                if (canvas) canvas.remove();
                bg.style.background = ''; // Clear inline background
            }
        },

        injectTransparentStyle: function() {
            // Ensure Stremio/App containers are transparent so background shows through
            if (document.getElementById('zentrio-bg-style')) return;
            
            const style = document.createElement('style');
            style.id = 'zentrio-bg-style';
            style.textContent = `
                body, #root, .root-container-tX_7M {
                    background: transparent !important;
                }
                /* Ensure content is readable on Stremio */
                .root-container-tX_7M::before {
                    content: '';
                    position: fixed;
                    inset: 0;
                    background: rgba(10,10,12,0.6);
                    z-index: -1;
                    pointer-events: none;
                }
                /* Fix for video player visibility */
                .player-container, .video-player, video {
                    z-index: 10 !important;
                    position: relative !important;
                    background: #000 !important;
                }
            `;
            document.head.appendChild(style);
        },

        hexToInt: function(hex) {
            return parseInt((hex || '#000000').replace('#', ''), 16);
        }
    };

    // Expose global
    global.ZentrioBackground = BackgroundManager;

    // Auto-init
    BackgroundManager.init();

})(window);