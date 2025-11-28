document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('streaming-settings-container');
    if (!container) return;

    const defaultSettings = {
        resolutions: ['4k', '2160p', '1440p', '1080p', '720p', '576p', '480p', '360p', '240p', 'Unknown'],
        qualities: ['BluRay/UHD', 'WEB/HD', 'DVD/TV/SAT', 'CAM/Screener', 'Unknown'],
        maxFileSize: 0, // 0 = Unlimited
        sorting: [
            { id: 'language', name: 'Language', desc: 'Sort by preferred languages first', enabled: true, direction: 'desc', directionLabels: { desc: 'Preferred First', asc: 'Preferred Last' } },
            { id: 'cached', name: 'Cached', desc: 'Show cached results first', enabled: true, direction: 'desc', directionLabels: { desc: 'Cached First', asc: 'Uncached First' } },
            { id: 'resolution', name: 'Resolution', desc: 'Highest resolution first', enabled: true, direction: 'desc', directionLabels: { desc: 'Highest First', asc: 'Lowest First' } },
            { id: 'quality', name: 'Quality', desc: 'Best quality first', enabled: true, direction: 'desc', directionLabels: { desc: 'Best First', asc: 'Worst First' } },
            { id: 'size', name: 'Size', desc: 'Largest size first', enabled: true, direction: 'desc', directionLabels: { desc: 'Largest First', asc: 'Smallest First' } },
            { id: 'seeders', name: 'Seeders', desc: 'Most seeders first', enabled: true, direction: 'desc', directionLabels: { desc: 'Most First', asc: 'Least First' } },
            { id: 'created', name: 'Created At', desc: 'Newest first', enabled: true, direction: 'desc', directionLabels: { desc: 'Newest First', asc: 'Oldest First' } }
        ],
        languages: ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian', 'Japanese', 'Korean', 'Chinese', 'Hindi', 'Arabic', 'Turkish', 'Dutch', 'Polish', 'Swedish', 'Indonesian', 'Thai', 'Vietnamese'],
        selectedLanguages: [],
        parental: {
            enabled: false,
            ratingLimit: 'R'
        },
        sortingEnabled: true
    };

    // Initial state
    let settings = JSON.parse(JSON.stringify(defaultSettings));
    let currentProfileId = '';

    // --- UI Rendering Functions ---

    function renderResolutions() {
        const container = document.getElementById('resolution-options');
        if (!container) return;
        container.innerHTML = '';
        
        // Use settings.resolutions if it exists and has items, otherwise default
        // But we need to make sure we have all resolutions available, just ordered differently
        // If settings.resolutions is just a list of selected ones (old behavior), we need to change strategy.
        // New strategy: settings.resolutions is the ORDERED list of ALL resolutions.
        // But we also need to know which are ENABLED.
        // Let's assume for now settings.resolutions contains objects { id: '4k', enabled: true } or just strings.
        // If strings, we assume all in the list are enabled? No, the previous UI had selection.
        
        // Let's migrate: settings.resolutions should be an array of objects { id: string, enabled: boolean }
        // If it's an array of strings, we convert it.
        
        let displayResolutions = [];
        
        if (Array.isArray(settings.resolutions) && settings.resolutions.length > 0) {
            if (typeof settings.resolutions[0] === 'string') {
                // Migration: Strings are "enabled" ones. We need to add the rest as disabled.
                const enabledSet = new Set(settings.resolutions);
                // Start with default order for those not in the list? Or put enabled first?
                // Let's put enabled first in their relative order, then disabled.
                settings.resolutions.forEach(r => {
                    displayResolutions.push({ id: r, enabled: true });
                });
                defaultSettings.resolutions.forEach(r => {
                    if (!enabledSet.has(r)) {
                        displayResolutions.push({ id: r, enabled: false });
                    }
                });
                settings.resolutions = displayResolutions; // Save migration
            } else {
                displayResolutions = settings.resolutions;
            }
        } else {
            // Default
            displayResolutions = defaultSettings.resolutions.map(r => ({ id: r, enabled: true }));
            settings.resolutions = displayResolutions;
        }

        displayResolutions.forEach(res => {
            const card = document.createElement('div');
            card.className = `option-card ${res.enabled ? 'selected' : ''}`;
            card.dataset.id = res.id;
            card.innerHTML = `
                <span class="sort-handle" style="cursor: grab; margin-right: 10px; opacity: 0.5;">⋮⋮</span>
                <span class="option-label" style="flex: 1;">${res.id}</span>
                <span class="option-check">✓</span>
            `;
            
            // Click to toggle
            card.onclick = (e) => {
                // Don't toggle if clicking handle
                if (e.target.classList.contains('sort-handle')) return;
                
                res.enabled = !res.enabled;
                saveSettings();
                renderResolutions(); // Re-render to update style
            };

            container.appendChild(card);
        });

        // Initialize Sortable
        if (window.Sortable) {
            new Sortable(container, {
                handle: '.sort-handle',
                animation: 150,
                onEnd: () => {
                    const newOrder = [];
                    const items = container.querySelectorAll('.option-card');
                    items.forEach(item => {
                        const id = item.dataset.id;
                        const obj = settings.resolutions.find(r => r.id === id);
                        if (obj) newOrder.push(obj);
                    });
                    settings.resolutions = newOrder;
                    saveSettings();
                }
            });
        }
    }

    function renderQualities() {
        const container = document.getElementById('quality-options');
        if (!container) return;
        container.innerHTML = '';

        const allQualities = defaultSettings.qualities;
        // Ensure settings.qualities is an array
        const currentQualities = Array.isArray(settings.qualities) ? settings.qualities : [];

        allQualities.forEach(qual => {
            const isSelected = currentQualities.includes(qual);
            const card = createOptionCard(qual, isSelected, () => toggleQuality(qual));
            container.appendChild(card);
        });
    }

    function renderFileSize() {
        const slider = document.getElementById('file-size-slider');
        const valueDisplay = document.getElementById('file-size-value');
        if (!slider || !valueDisplay) return;

        const val = typeof settings.maxFileSize === 'number' ? settings.maxFileSize : 0;
        slider.value = val;
        valueDisplay.textContent = val === 0 ? 'Unlimited' : `${val} GB`;

        slider.oninput = (e) => {
            const val = parseInt(e.target.value);
            settings.maxFileSize = val;
            valueDisplay.textContent = val === 0 ? 'Unlimited' : `${val} GB`;
        };
        slider.onchange = () => saveSettings();
    }

    function renderSorting() {
        const container = document.getElementById('sorting-priority-list');
        if (!container) return;
        container.innerHTML = '';

        // Ensure settings.sorting is an array
        const currentSorting = Array.isArray(settings.sorting) ? settings.sorting : defaultSettings.sorting;

        currentSorting.forEach(item => {
            if (!item || !item.id) return; // Skip invalid items
            
            const el = document.createElement('div');
            el.className = 'sortable-item';
            el.dataset.id = item.id;
            
            const directionLabel = item.directionLabels ? (item.direction === 'asc' ? item.directionLabels.asc : item.directionLabels.desc) : (item.direction === 'asc' ? 'Ascending' : 'Descending');
            const directionIcon = item.direction === 'asc' ? '↑' : '↓';

            el.innerHTML = `
                <div class="sort-handle">☰</div>
                <div class="sort-content">
                    <div class="sort-left">
                        <div class="sort-label">
                            ${item.name || item.id}
                            <input type="checkbox" ${item.enabled ? 'checked' : ''} class="sort-enable-check" data-id="${item.id}">
                        </div>
                    </div>
                    <div class="sort-right">
                        <button class="sort-direction-btn" data-id="${item.id}">
                            <i>${directionIcon}</i> ${directionLabel}
                        </button>
                    </div>
                </div>
            `;
            
            // Checkbox listener
            const checkbox = el.querySelector('.sort-enable-check');
            checkbox.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                const sortItem = settings.sorting.find(s => s.id === id);
                if (sortItem) {
                    sortItem.enabled = e.target.checked;
                    saveSettings();
                }
            });

            // Direction toggle listener
            const dirBtn = el.querySelector('.sort-direction-btn');
            dirBtn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const sortItem = settings.sorting.find(s => s.id === id);
                if (sortItem) {
                    sortItem.direction = sortItem.direction === 'asc' ? 'desc' : 'asc';
                    renderSorting(); // Re-render to update label/icon
                    saveSettings();
                }
            });

            container.appendChild(el);
        });

        // Initialize Sortable
        if (window.Sortable) {
            new Sortable(container, {
                handle: '.sort-handle',
                animation: 150,
                onEnd: (evt) => {
                    // Update array order
                    const newOrder = [];
                    const items = container.querySelectorAll('.sortable-item');
                    items.forEach(item => {
                        const id = item.dataset.id;
                        const sortObj = settings.sorting.find(s => s.id === id);
                        if (sortObj) newOrder.push(sortObj);
                    });
                    settings.sorting = newOrder;
                    saveSettings();
                }
            });
        }
    }

    function renderLanguages() {
        const select = document.getElementById('language-select-input');
        const addBtn = document.getElementById('add-language-btn');
        if (!select || !addBtn) return;

        // Populate dropdown with unselected languages
        const currentSelected = Array.isArray(settings.selectedLanguages) ? settings.selectedLanguages : [];
        const availableLanguages = defaultSettings.languages.filter(lang => !currentSelected.includes(lang));
        
        // Save current selection if it's still valid
        const currentVal = select.value;
        
        select.innerHTML = '<option value="">Select a language to add...</option>';
        availableLanguages.sort().forEach(lang => {
            const opt = document.createElement('option');
            opt.value = lang;
            opt.textContent = lang;
            select.appendChild(opt);
        });

        if (availableLanguages.includes(currentVal)) {
            select.value = currentVal;
        }

        // Add button handler (remove old one first to prevent duplicates if re-rendering)
        const newBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newBtn, addBtn);
        
        newBtn.addEventListener('click', () => {
            const langToAdd = select.value;
            if (langToAdd && !settings.selectedLanguages.includes(langToAdd)) {
                settings.selectedLanguages.push(langToAdd);
                renderLanguages();
                renderLanguagePriority();
                saveSettings();
            }
        });
    }

    function renderLanguagePriority() {
        const container = document.getElementById('language-priority-list');
        if (!container) return;
        container.innerHTML = '';

        const currentSelected = Array.isArray(settings.selectedLanguages) ? settings.selectedLanguages : [];

        if (currentSelected.length === 0) {
            container.innerHTML = '<div style="color: #666; font-style: italic;">No languages selected. Select languages above to arrange priority.</div>';
            return;
        }

        currentSelected.forEach(lang => {
            const el = document.createElement('div');
            el.className = 'language-item';
            el.dataset.lang = lang;
            el.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="sort-handle" style="cursor: grab; opacity: 0.5;">⋮⋮</span>
                    <span>${lang}</span>
                </div>
                <button class="remove-lang-btn" style="background: none; border: none; color: #ff4444; cursor: pointer; padding: 5px;">✕</button>
            `;
            
            el.querySelector('.remove-lang-btn').addEventListener('click', () => {
                settings.selectedLanguages = settings.selectedLanguages.filter(l => l !== lang);
                renderLanguages();
                renderLanguagePriority();
                saveSettings();
            });

            container.appendChild(el);
        });

        if (window.Sortable) {
            new Sortable(container, {
                handle: '.sort-handle',
                animation: 150,
                onEnd: () => {
                    const newOrder = [];
                    const items = container.querySelectorAll('.language-item');
                    items.forEach(item => newOrder.push(item.dataset.lang));
                    settings.selectedLanguages = newOrder;
                    saveSettings();
                }
            });
        }
    }

    function renderParental() {
        const toggle = document.getElementById('parental-enabled');
        const options = document.getElementById('parental-options');
        const select = document.getElementById('parental-rating-limit');

        // Ensure settings.parental exists
        if (!settings.parental) settings.parental = { enabled: false, ratingLimit: 'R' };

        if (toggle) {
            if (settings.parental.enabled) toggle.classList.add('active');
            else toggle.classList.remove('active');
            
            toggle.onclick = () => {
                settings.parental.enabled = !settings.parental.enabled;
                renderParental();
                saveSettings();
            };
        }

        if (options) {
            options.style.display = settings.parental.enabled ? 'flex' : 'none';
        }

        if (select) {
            select.value = settings.parental.ratingLimit || 'R';
            select.onchange = (e) => {
                settings.parental.ratingLimit = e.target.value;
                saveSettings();
            };
        }
    }

    // --- Helper Functions ---

    function createOptionCard(label, isSelected, onClick) {
        const card = document.createElement('div');
        card.className = `option-card ${isSelected ? 'selected' : ''}`;
        card.innerHTML = `
            <span class="option-label">${label}</span>
            <span class="option-check">✓</span>
        `;
        card.onclick = onClick;
        return card;
    }

    function toggleResolution(res) {
        if (settings.resolutions.includes(res)) {
            settings.resolutions = settings.resolutions.filter(r => r !== res);
        } else {
            settings.resolutions.push(res);
        }
        renderResolutions();
        saveSettings();
    }

    function toggleQuality(qual) {
        if (settings.qualities.includes(qual)) {
            settings.qualities = settings.qualities.filter(q => q !== qual);
        } else {
            settings.qualities.push(qual);
        }
        renderQualities();
        saveSettings();
    }

    function toggleLanguage(lang) {
        if (settings.selectedLanguages.includes(lang)) {
            settings.selectedLanguages = settings.selectedLanguages.filter(l => l !== lang);
        } else {
            settings.selectedLanguages.push(lang);
        }
        renderLanguages();
        renderLanguagePriority();
        saveSettings();
    }

    // --- Data Loading & Saving ---

    async function loadProfiles() {
        try {
            const res = await fetch('/api/user/settings-profiles');
            if (res.ok) {
                const data = await res.json();
                const profiles = data.data || data;
                const select = document.getElementById('streaming-profile-select');
                if (select && Array.isArray(profiles)) {
                    select.innerHTML = '';
                    profiles.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p.id;
                        opt.textContent = p.name;
                        if (!currentProfileId) currentProfileId = p.id;
                        select.appendChild(opt);
                    });
                    if (currentProfileId) select.value = currentProfileId;
                    
                    select.addEventListener('change', (e) => {
                        currentProfileId = e.target.value;
                        loadSettings();
                        updateProfileActions();
                    });
                    updateProfileActions();
                }
            }
        } catch (e) {
            console.error('Failed to load settings profiles', e);
        }
    }

    function updateProfileActions() {
        const select = document.getElementById('streaming-profile-select');
        const deleteBtn = document.getElementById('delete-settings-profile-btn');
        const renameBtn = document.getElementById('rename-settings-profile-btn');
        
        if (!select || !deleteBtn || !renameBtn) return;
        
        const selectedOption = select.options[select.selectedIndex];
        const isDefault = selectedOption.textContent === 'Default';
        
        deleteBtn.style.display = isDefault ? 'none' : 'inline-block';
        renameBtn.style.display = isDefault ? 'none' : 'inline-block';
    }

    async function loadSettings() {
        try {
            const url = currentProfileId ? `/api/streaming/settings?settingsProfileId=${currentProfileId}` : '/api/streaming/settings';
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.data) {
                    // Merge loaded settings with defaults to ensure structure
                    const loaded = data.data;
                    
                    // Handle legacy settings migration or structure updates if needed
                    // For now, we just overwrite if keys exist
                    if (loaded.resolutions) settings.resolutions = loaded.resolutions;
                    if (loaded.qualities) settings.qualities = loaded.qualities;
                    if (loaded.maxFileSize !== undefined) settings.maxFileSize = loaded.maxFileSize;
                    
                    // Merge sorting carefully to preserve structure if backend has old format
                    if (loaded.sorting) {
                        if (Array.isArray(loaded.sorting) && typeof loaded.sorting[0] === 'string') {
                            // Old format was array of strings, map to new object structure
                            // We'll use defaultSettings.sorting as base and reorder
                            const newSorting = [];
                            loaded.sorting.forEach(id => {
                                const def = defaultSettings.sorting.find(s => s.id === id);
                                if (def) newSorting.push({ ...def, enabled: true });
                            });
                            // Add any missing ones from default
                            defaultSettings.sorting.forEach(def => {
                                if (!newSorting.find(s => s.id === def.id)) {
                                    newSorting.push({ ...def, enabled: false });
                                }
                            });
                            settings.sorting = newSorting;
                        } else {
                            // Merge with defaults to ensure new properties (direction, labels) exist
                            settings.sorting = loaded.sorting.map(item => {
                                const def = defaultSettings.sorting.find(s => s.id === item.id);
                                return { ...def, ...item }; // Keep saved values, fill missing from default
                            });
                        }
                    }
                    
                    if (loaded.selectedLanguages) settings.selectedLanguages = loaded.selectedLanguages;
                    if (loaded.parental) settings.parental = loaded.parental;
                    if (loaded.sortingEnabled !== undefined) settings.sortingEnabled = loaded.sortingEnabled;
                }
            }
        } catch (e) {
            console.error('Failed to load settings', e);
        } finally {
            const loadingEl = document.getElementById('streaming-loading');
            const contentEl = document.getElementById('streaming-content');
            if (loadingEl) loadingEl.style.display = 'none';
            if (contentEl) contentEl.style.display = 'block';
            renderUI();
        }
    }

    async function saveSettings() {
        try {
            const url = currentProfileId ? `/api/streaming/settings?settingsProfileId=${currentProfileId}` : '/api/streaming/settings';
            const res = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'xmlhttprequest'
                },
                body: JSON.stringify(settings)
            });
            if (res.ok) {
                if (window.showToast) window.showToast('success', 'Settings saved');
            } else {
                if (window.showToast) window.showToast('error', 'Failed to save settings');
            }
        } catch (e) {
            console.error('Failed to save settings', e);
            if (window.showToast) window.showToast('error', 'Network error');
        }
    }

    function renderUI() {
        renderResolutions();
        renderQualities();
        renderFileSize();
        renderSorting();
        renderLanguages();
        renderLanguagePriority();
        renderParental();
        renderSortingToggle();
    }

    function renderSortingToggle() {
        const toggle = document.getElementById('sorting-enabled');
        const content = document.getElementById('sorting-filters-content');
        
        if (toggle) {
            if (settings.sortingEnabled) toggle.classList.add('active');
            else toggle.classList.remove('active');
            
            toggle.onclick = (e) => {
                e.stopPropagation(); // Prevent collapsing the section when clicking toggle
                settings.sortingEnabled = !settings.sortingEnabled;
                renderSortingToggle();
                saveSettings();
            };
        }
        
        // Optional: Visually disable content if sorting is disabled
        if (content) {
            content.style.opacity = settings.sortingEnabled ? '1' : '0.5';
            content.style.pointerEvents = settings.sortingEnabled ? 'auto' : 'none';
        }
    }

    // Profile Management Functions
    async function createSettingsProfile() {
        const name = prompt("Enter name for new settings profile:");
        if (!name) return;
        try {
            const res = await fetch('/api/user/settings-profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'xmlhttprequest' },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                const profile = await res.json();
                currentProfileId = profile.data.id;
                loadProfiles();
            } else {
                alert("Failed to create profile");
            }
        } catch (e) { console.error(e); }
    }

    async function deleteSettingsProfile() {
        if (!currentProfileId) return;
        if (!confirm("Are you sure you want to delete this settings profile?")) return;
        try {
            const res = await fetch(`/api/user/settings-profiles/${currentProfileId}`, {
                method: 'DELETE',
                headers: { 'X-Requested-With': 'xmlhttprequest' }
            });
            if (res.ok) {
                currentProfileId = null;
                loadProfiles();
            } else {
                const err = await res.json();
                alert(err.error?.message || "Failed to delete profile");
            }
        } catch (e) { console.error(e); }
    }

    async function renameSettingsProfile() {
        if (!currentProfileId) return;
        const name = prompt("Enter new name:");
        if (!name) return;
        try {
            const res = await fetch(`/api/user/settings-profiles/${currentProfileId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'xmlhttprequest' },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                loadProfiles();
            } else {
                alert("Failed to rename profile");
            }
        } catch (e) { console.error(e); }
    }

    // Event Listeners for Profile Buttons
    document.getElementById('create-settings-profile-btn')?.addEventListener('click', createSettingsProfile);
    document.getElementById('delete-settings-profile-btn')?.addEventListener('click', deleteSettingsProfile);
    document.getElementById('rename-settings-profile-btn')?.addEventListener('click', renameSettingsProfile);

    // Initialize
    loadProfiles().then(() => loadSettings());
});