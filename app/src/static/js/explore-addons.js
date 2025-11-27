document.addEventListener('DOMContentLoaded', () => {
  const addonsList = document.getElementById('exploreAddonsList');
  const backButton = document.getElementById('backButton');
  let installedAddons = [];

  if (backButton) {
    backButton.addEventListener('click', () => {
      window.location.href = '/settings#addons';
    });
  }

  async function fetchInstalledAddons() {
    try {
      const lastSelectedProfileId = localStorage.getItem('lastSelectedAddonProfile');
      if (!lastSelectedProfileId) {
        console.warn('No addon profile selected');
        return;
      }
      const response = await fetch(`/api/addons/settings-profile/${lastSelectedProfileId}/manage`);
      if (response.ok) {
        installedAddons = await response.json();
      }
    } catch (error) {
      console.error('Error fetching installed addons:', error);
    }
  }

  async function fetchAddons() {
    try {
      await fetchInstalledAddons();
      const response = await fetch('https://api.strem.io/addonscollection.json');
      if (!response.ok) {
        throw new Error('Failed to fetch addons');
      }
      const addons = await response.json();
      renderAddons(addons);
    } catch (error) {
      console.error('Error fetching addons:', error);
      addonsList.innerHTML = '<p style="color: #d33;">Could not load addons. Please try again later.</p>';
    }
  }

  function renderAddons(addons) {
    addonsList.innerHTML = '';
    addons.forEach(addon => {
      const isInstalled = installedAddons.some(installed => installed.manifest_url === addon.transportUrl);
      const installedAddon = isInstalled ? installedAddons.find(installed => installed.manifest_url === addon.transportUrl) : null;

      const addonCard = document.createElement('div');
      addonCard.className = 'addon-card';
      addonCard.style.background = 'rgba(255,255,255,0.05)';
      addonCard.style.borderRadius = '8px';
      addonCard.style.padding = '20px';
      addonCard.style.display = 'flex';
      addonCard.style.flexDirection = 'column';
      addonCard.style.justifyContent = 'space-between';

      addonCard.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px;">
          <img src="${addon.manifest.logo || 'https://www.stremio.com/website/stremio-logo-small.png'}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;" onerror="this.onerror=null;this.src='https://www.stremio.com/website/stremio-logo-small.png';" />
          <div>
            <h3 style="font-size: 18px;">${addon.manifest.name}</h3>
          </div>
        </div>
        <div>
          <p style="color: #b3b3b3; font-size: 14px; margin-bottom: 20px;">${addon.manifest.description}</p>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <button class="btn ${isInstalled ? 'btn-secondary' : 'btn-primary'} install-addon-btn" data-manifest-url="${addon.transportUrl}" data-addon-id="${installedAddon?.id}">${isInstalled ? 'Uninstall' : 'Install'}</button>
          <div class="dropdown">
            <button class="btn btn-secondary dropdown-toggle" type="button" style="padding: 5px; min-width: 30px;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
            </button>
            <div class="dropdown-menu">
              ${addon.manifest.behaviorHints?.configurable ? `<a href="#" class="dropdown-item configure-addon-btn" data-manifest-url="${addon.transportUrl}">Configure</a>` : ''}
              <a href="#" class="dropdown-item copy-url-btn" data-manifest-url="${addon.transportUrl}">Copy URL</a>
            </div>
          </div>
        </div>
      `;
      addonsList.appendChild(addonCard);
    });

    document.querySelectorAll('.install-addon-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        const manifestUrl = e.target.getAttribute('data-manifest-url');
        const addonId = e.target.getAttribute('data-addon-id');
        if (button.textContent === 'Install') {
          installAddon(manifestUrl, e.target);
        } else {
          uninstallAddon(addonId, e.target);
        }
      });
    });

    document.querySelectorAll('.dropdown-toggle').forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = e.currentTarget.nextElementSibling;
        // Close all other menus
        document.querySelectorAll('.dropdown-menu').forEach(m => {
          if (m !== menu) m.style.display = 'none';
        });
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      });
    });

    window.addEventListener('click', (e) => {
      if (!e.target.matches('.dropdown-toggle')) {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
          if (!menu.contains(e.target)) {
            menu.style.display = 'none';
          }
        });
      }
    });

    document.querySelectorAll('.copy-url-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const manifestUrl = e.target.getAttribute('data-manifest-url');
        navigator.clipboard.writeText(manifestUrl).then(() => {
          alert('URL copied to clipboard!');
        });
        e.target.closest('.dropdown-menu').style.display = 'none';
      });
    });
  }

  async function installAddon(manifestUrl, button) {
    button.disabled = true;
    button.textContent = 'Installing...';

    try {
     const lastSelectedProfileId = localStorage.getItem('lastSelectedAddonProfile');
     if (!lastSelectedProfileId) {
       alert('Please select a profile in the addon settings before installing.');
       button.disabled = false;
       button.textContent = 'Install';
       return;
     }

      const res = await fetch('/api/addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifestUrl, settingsProfileId: lastSelectedProfileId })
      });

      if (res.ok) {
        button.textContent = 'Uninstall';
        button.classList.remove('btn-primary');
        button.classList.add('btn-secondary');
        button.disabled = false;
        fetchAddons(); // Refresh list
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to install addon');
        button.disabled = false;
        button.textContent = 'Install';
      }
    } catch (e) {
      alert('Network error. Please try again.');
      button.disabled = false;
      button.textContent = 'Install';
    }
  }

  async function uninstallAddon(addonId, button) {
    button.disabled = true;
    button.textContent = 'Uninstalling...';

    try {
      const res = await fetch(`/api/addons/${addonId}`, { method: 'DELETE' });
      if (res.ok) {
        button.textContent = 'Install';
        button.classList.remove('btn-secondary');
        button.classList.add('btn-primary');
        button.disabled = false;
        fetchAddons(); // Refresh list
      } else {
        alert('Failed to uninstall addon');
        button.disabled = false;
        button.textContent = 'Uninstall';
      }
    } catch (e) {
      alert('Network error. Please try again.');
      button.disabled = false;
      button.textContent = 'Uninstall';
    }
  }

  fetchAddons();
});