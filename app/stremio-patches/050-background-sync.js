// --- Zentrio Background Sync Patch ---
// Applies the same Vanta.js background from the profile page to Stremio Web
(function() {
    const SETTING_KEY = 'zentrio_enable_vanta_bg';
    const BG_ID = 'zentrio-vanta-bg';
    
    // Check if enabled (default to true if not set)
    function isEnabled() {
        const val = localStorage.getItem(SETTING_KEY);
        return val === null || val === 'true';
    }

    function injectVantaScripts() {
        if (window.VANTA) return Promise.resolve();
        
        return new Promise((resolve) => {
            // Load Three.js first
            if (!window.THREE) {
                const threeScript = document.createElement('script');
                threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js';
                threeScript.onload = () => {
                    loadVanta(resolve);
                };
                document.head.appendChild(threeScript);
            } else {
                loadVanta(resolve);
            }
        });
    }

    function loadVanta(cb) {
        const vantaScript = document.createElement('script');
        vantaScript.src = 'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js';
        vantaScript.onload = cb;
        document.head.appendChild(vantaScript);
    }

    function applyBackground() {
        if (!isEnabled()) {
            removeBackground();
            return;
        }

        if (document.getElementById(BG_ID)) return;

        const bg = document.createElement('div');
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

        // Make Stremio background transparent to show Vanta
        const style = document.createElement('style');
        style.id = 'zentrio-bg-style';
        style.textContent = `
            body, #root, .root-container-tX_7M {
                background: transparent !important;
            }
            /* Ensure content is readable */
            .root-container-tX_7M::before {
                content: '';
                position: fixed;
                inset: 0;
                background: rgba(10,10,12,0.6);
                z-index: -1;
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);

        injectVantaScripts().then(() => {
            if (window.VANTA) {
                // Get theme colors from localStorage if available (set by Profiles page)
                let vantaColors = { highlight: '#222222', midtone: '#111111', lowlight: '#000000', base: '#000000' };
                try {
                    const themeData = localStorage.getItem('zentrioThemeData');
                    if (themeData) {
                        const theme = JSON.parse(themeData);
                        if (theme.vanta) {
                            vantaColors = theme.vanta;
                        }
                    }
                } catch(e) {}

                function hexToInt(hex) { return parseInt((hex || '#000000').replace('#', ''), 16); }

                window.VANTA.FOG({
                    el: "#" + BG_ID,
                    mouseControls: false,
                    touchControls: false,
                    minHeight: 200.00,
                    minWidth: 200.00,
                    highlightColor: hexToInt(vantaColors.highlight),
                    midtoneColor: hexToInt(vantaColors.midtone),
                    lowlightColor: hexToInt(vantaColors.lowlight),
                    baseColor: hexToInt(vantaColors.base),
                    blurFactor: 0.90,
                    speed: 0.50,
                    zoom: 0.30
                });
            }
        });
    }

    function removeBackground() {
        const bg = document.getElementById(BG_ID);
        if (bg) bg.remove();
        
        const style = document.getElementById('zentrio-bg-style');
        if (style) style.remove();
        
        // Clean up Vanta instance if possible (not easily accessible here without storing ref)
    }

    // Listen for setting changes from main window
    window.addEventListener('storage', (e) => {
        if (e.key === SETTING_KEY) {
            if (isEnabled()) applyBackground();
            else removeBackground();
        }
    });

    // Initial apply
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyBackground);
    } else {
        applyBackground();
    }

})();