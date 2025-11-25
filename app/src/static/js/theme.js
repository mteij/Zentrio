(function(global) {
    const THEME_DATA_KEY = 'zentrioThemeData';
    const STYLE_KEY = 'zentrioBackgroundStyle';
    const BG_ID = 'zentrio-vanta-bg';

    const ThemeManager = {
        init: function() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.apply());
            } else {
                this.apply();
            }
            window.addEventListener('storage', (e) => {
                if (e.key === THEME_DATA_KEY || e.key === STYLE_KEY) this.apply();
            });
        },

        apply: function() {
            this.applyColors();
            this.applyBackground();
        },

        applyColors: function() {
            try {
                const data = localStorage.getItem(THEME_DATA_KEY);
                if (!data) return;
                const theme = JSON.parse(data);
                const root = document.documentElement;
                
                root.style.setProperty('--accent', theme.accent || '#e50914');
                root.style.setProperty('--btn-primary-bg', theme.btnPrimary || theme.accent || '#e50914');
                root.style.setProperty('--btn-primary-bg-hover', theme.btnPrimaryHover || theme.btnPrimary || '#f40612');
                root.style.setProperty('--btn-secondary-bg', theme.btnSecondary || '#333');
                root.style.setProperty('--text', theme.text || '#ffffff');
                root.style.setProperty('--muted', theme.muted || '#b3b3b3');
                
                if (theme.vanta) {
                    root.style.setProperty('--vanta-highlight', theme.vanta.highlight);
                    root.style.setProperty('--vanta-midtone', theme.vanta.midtone);
                    root.style.setProperty('--vanta-lowlight', theme.vanta.lowlight);
                    root.style.setProperty('--vanta-base', theme.vanta.base);
                }
            } catch (e) {
                console.error('Failed to apply theme colors', e);
            }
        },

        applyBackground: function() {
            let bg = document.getElementById(BG_ID);
            if (!bg) {
                bg = document.createElement('div');
                bg.id = BG_ID;
                Object.assign(bg.style, {
                    position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
                    zIndex: -1, pointerEvents: 'none'
                });
                document.body.appendChild(bg);
            }

            const style = localStorage.getItem(STYLE_KEY) || 'vanta'; // Default to vanta if not set
            
            if (style === 'vanta') {
                this.initVanta(bg);
            } else {
                this.destroyVanta();
                if (style === 'solid') {
                    bg.style.background = getComputedStyle(document.documentElement).getPropertyValue('--vanta-base') || '#000';
                } else {
                    // Gradient fallback
                    const mid = getComputedStyle(document.documentElement).getPropertyValue('--vanta-midtone') || '#111';
                    const base = getComputedStyle(document.documentElement).getPropertyValue('--vanta-base') || '#000';
                    bg.style.background = `linear-gradient(180deg, ${mid} 0%, ${base} 100%)`;
                }
            }
        },

        initVanta: function(el) {
            if (window.__zentrioVantaInstance) return; // Already running
            
            // Check if scripts loaded
            if (!window.THREE || !window.VANTA) {
                // Scripts should be in Layout, but if not, wait or fail gracefully
                return;
            }

            try {
                const data = localStorage.getItem(THEME_DATA_KEY);
                const theme = data ? JSON.parse(data) : {};
                const v = theme.vanta || {};

                window.__zentrioVantaInstance = window.VANTA.FOG({
                    el: el,
                    mouseControls: false,
                    touchControls: false,
                    minHeight: 200.00,
                    minWidth: 200.00,
                    highlightColor: this.hexToInt(v.highlight || '#222222'),
                    midtoneColor: this.hexToInt(v.midtone || '#111111'),
                    lowlightColor: this.hexToInt(v.lowlight || '#000000'),
                    baseColor: this.hexToInt(v.base || '#000000'),
                    blurFactor: 0.90,
                    speed: v.speed || 0.50,
                    zoom: v.zoom || 0.30
                });
            } catch (e) {
                console.error('Vanta init error', e);
            }
        },

        destroyVanta: function() {
            if (window.__zentrioVantaInstance) {
                try { window.__zentrioVantaInstance.destroy(); } catch(e) {}
                window.__zentrioVantaInstance = null;
            }
            const bg = document.getElementById(BG_ID);
            if (bg) {
                const canvas = bg.querySelector('canvas');
                if (canvas) canvas.remove();
                bg.style.background = '';
            }
        },

        hexToInt: function(hex) {
            return parseInt((hex || '#000000').replace('#', ''), 16);
        }
    };

    global.ZentrioTheme = ThemeManager;
    ThemeManager.init();

})(window);