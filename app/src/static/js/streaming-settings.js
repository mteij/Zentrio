document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('streaming-settings-container');
    if (!container) return;

    const defaultSettings = {
        filters: {
            cache: { cached: true, uncached: true, applyMode: 'OR' },
            resolution: { preferred: ['4k', '1080p', '720p'], required: [], excluded: [] },
            encode: { preferred: [], required: [], excluded: [] },
            streamType: { preferred: [], required: [], excluded: [] },
            visualTag: { preferred: [], required: [], excluded: [] },
            audioTag: { preferred: [], required: [], excluded: [] },
            audioChannel: { preferred: [], required: [], excluded: [] },
            language: { preferred: [], required: [], excluded: [] },
            seeders: {},
            matching: { title: { enabled: true, mode: 'Partial' }, seasonEpisode: { enabled: true } },
            keyword: { preferred: [], required: [], excluded: [] },
            regex: { preferred: [], required: [], excluded: [] },
            size: {}
        },
        limits: { maxResults: 20 },
        deduplication: { mode: 'Per Addon', detection: { filename: true, infoHash: true, smartDetect: true } },
        sorting: { global: ['quality', 'seeders'] }
    };

    let settings = JSON.parse(JSON.stringify(defaultSettings));
    let currentProfileId = '';

    async function loadProfiles() {
        try {
            const res = await fetch('/api/user/settings-profiles');
            if (res.ok) {
                const data = await res.json();
                const profiles = data.data || data; // Handle { data: [] } or []
                const select = document.getElementById('streaming-profile-select');
                if (select && Array.isArray(profiles)) {
                    select.innerHTML = '';
                    
                    profiles.forEach(p => {
                        const opt = document.createElement('option');
                        opt.value = p.id;
                        opt.textContent = p.name;
                        // Select the first one by default if none selected
                        if (!currentProfileId) currentProfileId = p.id;
                        select.appendChild(opt);
                    });
                    
                    // If we have a currentProfileId, select it
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
        // Assuming "Default" is the first one or we can check text content or data attribute if we added one
        // But we don't have is_default in the option value.
        // Let's assume the first one is default for now, or check if text contains "Default"
        // Actually, the backend returns is_default, but we didn't store it in DOM.
        // Let's assume we can't delete the one named "Default".
        
        const isDefault = selectedOption.textContent === 'Default';
        
        deleteBtn.style.display = isDefault ? 'none' : 'inline-block';
        renameBtn.style.display = isDefault ? 'none' : 'inline-block';
    }

    async function createSettingsProfile() {
        const name = prompt("Enter name for new settings profile:");
        if (!name) return;
        
        try {
            const res = await fetch('/api/user/settings-profiles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'xmlhttprequest'
                },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                const profile = await res.json();
                // Reload profiles and select new one
                currentProfileId = profile.data.id; // API returns { ok: true, data: profile }
                loadProfiles();
            } else {
                alert("Failed to create profile");
            }
        } catch (e) {
            console.error(e);
        }
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
                currentProfileId = null; // Will select default on reload
                loadProfiles();
            } else {
                const err = await res.json();
                alert(err.error?.message || "Failed to delete profile");
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function renameSettingsProfile() {
        if (!currentProfileId) return;
        const name = prompt("Enter new name:");
        if (!name) return;
        
        try {
            const res = await fetch(`/api/user/settings-profiles/${currentProfileId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'xmlhttprequest'
                },
                body: JSON.stringify({ name })
            });
            if (res.ok) {
                loadProfiles();
            } else {
                alert("Failed to rename profile");
            }
        } catch (e) {
            console.error(e);
        }
    }

    async function loadSettings() {
        try {
            const url = currentProfileId ? `/api/streaming/settings?settingsProfileId=${currentProfileId}` : '/api/streaming/settings';
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.data) {
                    // Deep merge
                    settings = {
                        ...settings,
                        ...data.data,
                        filters: { ...settings.filters, ...data.data.filters },
                        limits: { ...settings.limits, ...data.data.limits },
                        deduplication: { ...settings.deduplication, ...data.data.deduplication },
                        sorting: { ...settings.sorting, ...data.data.sorting }
                    };
                    // Ensure sub-objects in filters exist
                    Object.keys(defaultSettings.filters).forEach(key => {
                        if (!settings.filters[key]) settings.filters[key] = defaultSettings.filters[key];
                    });
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
                if (window.showToast) window.showToast('message', 'Settings saved');
            } else {
                if (window.showToast) window.showToast('error', 'Failed to save settings');
            }
        } catch (e) {
            console.error('Failed to save settings', e);
            if (window.showToast) window.showToast('error', 'Network error');
        }
    }

    function renderUI() {
        // Cache
        updateToggle('cache-cached', settings.filters.cache.cached);
        updateToggle('cache-uncached', settings.filters.cache.uncached);
        updateSelect('cache-mode', settings.filters.cache.applyMode);

        // Resolutions
        renderChipList('resolution', 'preferred', ['4k', '1080p', '720p', '480p', 'SD']);
        renderChipList('resolution', 'required', ['4k', '1080p', '720p', '480p', 'SD']);
        renderChipList('resolution', 'excluded', ['4k', '1080p', '720p', '480p', 'SD']);

        // Encodes
        renderChipList('encode', 'preferred', ['hevc', 'avc', 'av1', 'h264', 'h265']);
        renderChipList('encode', 'required', ['hevc', 'avc', 'av1', 'h264', 'h265']);
        renderChipList('encode', 'excluded', ['hevc', 'avc', 'av1', 'h264', 'h265']);

        // Visual Tags
        renderChipList('visualTag', 'preferred', ['hdr', 'dv', '10bit', 'remux', 'bluray', 'web-dl']);
        renderChipList('visualTag', 'required', ['hdr', 'dv', '10bit', 'remux', 'bluray', 'web-dl']);
        renderChipList('visualTag', 'excluded', ['hdr', 'dv', '10bit', 'remux', 'bluray', 'web-dl']);

        // Audio Tags
        renderChipList('audioTag', 'preferred', ['atmos', 'dts', 'dd+', 'aac', 'ac3', 'eac3', 'truehd']);
        renderChipList('audioTag', 'required', ['atmos', 'dts', 'dd+', 'aac', 'ac3', 'eac3', 'truehd']);
        renderChipList('audioTag', 'excluded', ['atmos', 'dts', 'dd+', 'aac', 'ac3', 'eac3', 'truehd']);

        // Matching
        updateToggle('matching-title-enabled', settings.filters.matching.title.enabled);
        updateSelect('matching-title-mode', settings.filters.matching.title.mode);
        const titleModeContainer = document.getElementById('matching-title-mode-container');
        if (titleModeContainer) titleModeContainer.style.display = settings.filters.matching.title.enabled ? 'flex' : 'none';
        
        updateToggle('matching-season-enabled', settings.filters.matching.seasonEpisode.enabled);

        // Limits
        updateInput('limit-maxResults', settings.limits.maxResults);
        updateInput('limit-perAddon', settings.limits.perAddon || '');

        // Deduplication
        updateSelect('dedup-mode', settings.deduplication.mode);
        updateCheckbox('dedup-filename', settings.deduplication.detection.filename);
        updateCheckbox('dedup-infoHash', settings.deduplication.detection.infoHash);
        updateCheckbox('dedup-smartDetect', settings.deduplication.detection.smartDetect);
    }

    function updateToggle(id, active) {
        const el = document.getElementById(id);
        if (el) {
            if (active) el.classList.add('active');
            else el.classList.remove('active');
        }
    }

    function updateSelect(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    function updateInput(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    function updateCheckbox(id, checked) {
        const el = document.getElementById(id);
        if (el) el.checked = checked;
    }

    function renderChipList(category, type, options) {
        const container = document.getElementById(`chips-${category}-${type}`);
        if (!container) return;
        
        const selected = settings.filters[category][type] || [];
        const color = type === 'preferred' ? 'var(--accent)' : (type === 'required' ? '#28a745' : '#dc3545');

        container.innerHTML = '';
        options.forEach(item => {
            const chip = document.createElement('div');
            const isSelected = selected.includes(item);
            chip.textContent = item;
            chip.style.padding = '4px 8px';
            chip.style.borderRadius = '4px';
            chip.style.cursor = 'pointer';
            chip.style.fontSize = '12px';
            chip.style.border = '1px solid #444';
            chip.style.background = isSelected ? color : 'transparent';
            chip.style.color = isSelected ? 'white' : '#ccc';
            chip.style.borderColor = isSelected ? color : '#444';
            
            chip.onclick = () => toggleArrayItem(category, type, item);
            container.appendChild(chip);
        });
    }

    function toggleArrayItem(category, type, item) {
        const list = settings.filters[category][type] || [];
        if (list.includes(item)) {
            settings.filters[category][type] = list.filter(i => i !== item);
        } else {
            if (!settings.filters[category][type]) settings.filters[category][type] = [];
            settings.filters[category][type].push(item);

            // Mutual exclusivity: remove from other lists
            ['preferred', 'required', 'excluded'].forEach(otherType => {
                if (otherType !== type) {
                    const otherList = settings.filters[category][otherType] || [];
                    if (otherList.includes(item)) {
                        settings.filters[category][otherType] = otherList.filter(i => i !== item);
                    }
                }
            });
        }
        renderUI();
        saveSettings();
    }

    // Event Listeners
    function setupListeners() {
        // Cache
        document.getElementById('cache-cached')?.addEventListener('click', () => {
            settings.filters.cache.cached = !settings.filters.cache.cached;
            renderUI(); saveSettings();
        });
        document.getElementById('cache-uncached')?.addEventListener('click', () => {
            settings.filters.cache.uncached = !settings.filters.cache.uncached;
            renderUI(); saveSettings();
        });
        document.getElementById('cache-mode')?.addEventListener('change', (e) => {
            settings.filters.cache.applyMode = e.target.value;
            saveSettings();
        });

        // Matching
        document.getElementById('matching-title-enabled')?.addEventListener('click', () => {
            settings.filters.matching.title.enabled = !settings.filters.matching.title.enabled;
            renderUI(); saveSettings();
        });
        document.getElementById('matching-title-mode')?.addEventListener('change', (e) => {
            settings.filters.matching.title.mode = e.target.value;
            saveSettings();
        });
        document.getElementById('matching-season-enabled')?.addEventListener('click', () => {
            settings.filters.matching.seasonEpisode.enabled = !settings.filters.matching.seasonEpisode.enabled;
            renderUI(); saveSettings();
        });

        // Limits
        document.getElementById('limit-maxResults')?.addEventListener('change', (e) => {
            settings.limits.maxResults = parseInt(e.target.value);
            saveSettings();
        });
        document.getElementById('limit-perAddon')?.addEventListener('change', (e) => {
            settings.limits.perAddon = parseInt(e.target.value);
            saveSettings();
        });

        // Dedup
        document.getElementById('dedup-mode')?.addEventListener('change', (e) => {
            settings.deduplication.mode = e.target.value;
            saveSettings();
        });
        document.getElementById('dedup-filename')?.addEventListener('change', (e) => {
            settings.deduplication.detection.filename = e.target.checked;
            saveSettings();
        });
        document.getElementById('dedup-infoHash')?.addEventListener('change', (e) => {
            settings.deduplication.detection.infoHash = e.target.checked;
            saveSettings();
        });
        document.getElementById('dedup-smartDetect')?.addEventListener('change', (e) => {
            settings.deduplication.detection.smartDetect = e.target.checked;
            saveSettings();
        });
    }

    setupListeners();
    
    // Add listeners for profile actions
    document.getElementById('create-settings-profile-btn')?.addEventListener('click', createSettingsProfile);
    document.getElementById('delete-settings-profile-btn')?.addEventListener('click', deleteSettingsProfile);
    document.getElementById('rename-settings-profile-btn')?.addEventListener('click', renameSettingsProfile);

    loadProfiles().then(() => loadSettings());
});