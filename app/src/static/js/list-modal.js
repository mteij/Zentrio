class ListModal {
  constructor(profileId) {
    this.profileId = profileId;
    this.modal = null;
    this.meta = null;
    this.onUpdate = null;
  }

  async open(meta, onUpdate) {
    this.meta = meta;
    this.onUpdate = onUpdate;
    
    if (!this.modal) {
      this.createModal();
    }
    
    await this.loadLists();
    this.modal.style.display = 'flex';
  }

  close() {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
  }

  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'modal';
    this.modal.style.display = 'none';
    this.modal.style.zIndex = '2000'; // Ensure it's above everything
    this.modal.style.alignItems = 'center';
    this.modal.style.justifyContent = 'center';
    
    this.modal.innerHTML = `
      <div class="modal-content" style="max-width: 400px; margin: 0; max-height: 80vh; display: flex; flex-direction: column;">
        <div class="modal-header" style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
          <h2 style="margin: 0; font-size: 1.5rem;">Manage Lists</h2>
          <button class="close-btn" style="background: none; border: none; color: #aaa; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; transition: color 0.2s;">
            <span class="iconify" data-icon="lucide:x" data-width="24" data-height="24"></span>
          </button>
        </div>
        <div class="modal-body" style="overflow-y: auto; flex: 1;">
          <div id="listsContainer" class="lists-container" style="margin-bottom: 20px;">
            <div class="loading">Loading lists...</div>
          </div>
          <div class="create-list-form" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; display: flex; gap: 10px; align-items: center;">
            <input type="text" id="newListName" placeholder="New list name" class="input-field" style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 10px; color: white; outline: none;">
            <button id="createListBtn" style="background: var(--accent); border: none; border-radius: 8px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; transition: transform 0.2s;">
              <span class="iconify" data-icon="lucide:plus" data-width="20" data-height="20"></span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modal);

    this.modal.querySelector('.close-btn').onclick = () => this.close();
    this.modal.querySelector('.close-btn').onmouseenter = (e) => e.currentTarget.style.color = '#fff';
    this.modal.querySelector('.close-btn').onmouseleave = (e) => e.currentTarget.style.color = '#aaa';
    this.modal.onclick = (e) => {
      if (e.target === this.modal) this.close();
    };

    this.modal.querySelector('#createListBtn').onclick = () => this.createList();
  }

  async loadLists() {
    const container = this.modal.querySelector('#listsContainer');
    try {
      const [listsRes, checkRes] = await Promise.all([
        fetch(`/api/lists?profileId=${this.profileId}`),
        fetch(`/api/lists/check/${this.meta.id}?profileId=${this.profileId}`)
      ]);

      const listsData = await listsRes.json();
      const checkData = await checkRes.json();
      const inListIds = new Set(checkData.listIds);

      container.innerHTML = listsData.lists.map(list => `
        <div class="list-item" style="display: flex; align-items: center; padding: 10px; background: rgba(255,255,255,0.05); margin-bottom: 8px; border-radius: 8px; cursor: pointer;" onclick="listModal.toggleItem(${list.id}, ${inListIds.has(list.id)})">
          <div class="checkbox" style="width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.3); border-radius: 4px; margin-right: 12px; display: flex; align-items: center; justify-content: center; background: ${inListIds.has(list.id) ? 'var(--accent)' : 'transparent'}; border-color: ${inListIds.has(list.id) ? 'var(--accent)' : 'rgba(255,255,255,0.3)'}">
            ${inListIds.has(list.id) ? '<span class="iconify" data-icon="lucide:check" data-width="14" data-height="14" style="color: white;"></span>' : ''}
          </div>
          <span style="flex: 1;">${list.name}</span>
          ${list.name !== 'My List' ? `
            <button onclick="event.stopPropagation(); listModal.deleteList(${list.id})" style="background: none; border: none; color: #ff4444; cursor: pointer; padding: 4px;">
              <span class="iconify" data-icon="lucide:trash-2" data-width="16" data-height="16"></span>
            </button>
          ` : ''}
        </div>
      `).join('');
    } catch (e) {
      container.innerHTML = '<div class="error">Failed to load lists</div>';
    }
  }

  async toggleItem(listId, currentlyIn) {
    try {
      const method = currentlyIn ? 'DELETE' : 'POST';
      const url = currentlyIn 
        ? `/api/lists/${listId}/items/${this.meta.id}`
        : `/api/lists/${listId}/items`;
      
      const body = currentlyIn ? undefined : JSON.stringify({
        metaId: this.meta.id,
        type: this.meta.type,
        title: this.meta.name || this.meta.title,
        poster: this.meta.poster,
        imdbRating: this.meta.imdbRating
      });

      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body
      });

      await this.loadLists();
      if (this.onUpdate) this.onUpdate();
    } catch (e) {
      console.error('Failed to toggle item', e);
    }
  }

  async createList() {
    const input = this.modal.querySelector('#newListName');
    const name = input.value.trim();
    if (!name) return;

    try {
      await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId: this.profileId,
          name
        })
      });

      input.value = '';
      await this.loadLists();
    } catch (e) {
      console.error('Failed to create list', e);
    }
  }

  async deleteList(listId) {
    if (!confirm('Are you sure you want to delete this list?')) return;

    try {
      await fetch(`/api/lists/${listId}`, { method: 'DELETE' });
      await this.loadLists();
    } catch (e) {
      console.error('Failed to delete list', e);
    }
  }
}

window.ListModal = ListModal;