// Zentrio SPA Navigation
// Turns the MPA into a pseudo-SPA to preserve background downloads

(function() {
    if (window.__zentrioSpaInitialized) return;
    window.__zentrioSpaInitialized = true;

    console.log('[SPA] Initialized');

    document.addEventListener('click', async (e) => {
        const a = e.target.closest('a');
        if (!a) return;

        // Ignore if default prevented or special keys
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        const href = a.getAttribute('href');
        if (!href) return;

        // Ignore anchors, external links, javascript:, mailto:
        if (href.startsWith('#') || 
            href.startsWith('javascript:') || 
            href.startsWith('mailto:') || 
            a.target === '_blank') return;

        // Check if same origin
        let url;
        try {
            url = new URL(href, window.location.href);
        } catch { return; }

        if (url.origin !== window.location.origin) return;

        // Ignore API routes or static files (simple heuristic)
        if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/static/')) return;

        e.preventDefault();
        
        // Push state
        history.pushState({}, '', href);
        
        await loadPage(href);
    });

    window.addEventListener('popstate', () => {
        loadPage(window.location.href);
    });

    async function loadPage(url) {
        console.log('[SPA] Loading', url);
        try {
            // Show loading bar?
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            
            const text = await res.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            
            // Update Title
            document.title = doc.title;

            // Update Head (merge/replace)
            // We want to keep persistent scripts like downloads-core.js and this spa-navigation.js
            // But we want to load new CSS/JS.
            // Simple strategy: Append new head elements that aren't already there.
            // Removing old ones might be tricky (styles might flash).
            // For now, let's just append new styles/scripts from head.
            
            const newHeadNodes = Array.from(doc.head.children);
            newHeadNodes.forEach(node => {
                if (node.tagName === 'TITLE') return;
                if (node.tagName === 'SCRIPT') {
                    // Check if already exists
                    const src = node.getAttribute('src');
                    if (src && document.head.querySelector(`script[src="${src}"]`)) return;
                }
                if (node.tagName === 'LINK') {
                    if (node.href && document.head.querySelector(`link[href="${node.getAttribute('href')}"]`)) return;
                }
                
                const clone = node.cloneNode(true);
                // Re-create script to execute
                if (node.tagName === 'SCRIPT') {
                    const s = document.createElement('script');
                    Array.from(node.attributes).forEach(attr => s.setAttribute(attr.name, attr.value));
                    s.textContent = node.textContent;
                    document.head.appendChild(s);
                } else {
                    document.head.appendChild(clone);
                }
            });

            // Replace Body
            document.body.innerHTML = doc.body.innerHTML;
            
            // Execute scripts in body
            const bodyScripts = document.body.querySelectorAll('script');
            bodyScripts.forEach(oldScript => {
                const newScript = document.createElement('script');
                Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                newScript.textContent = oldScript.textContent;
                oldScript.parentNode.replaceChild(newScript, oldScript);
            });

            // Re-trigger DOMContentLoaded-like events if needed?
            // Some scripts wait for it.
            // But we are already loaded.
            
            // Scroll to top
            window.scrollTo(0, 0);

        } catch (e) {
            console.error('[SPA] Navigation failed', e);
            window.location.reload(); // Fallback
        }
    }
})();