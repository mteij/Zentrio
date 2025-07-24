import { h } from "preact";
import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";

interface Addon {
  transportUrl: string;
  manifest: {
    id: string;
    name: string;
    logo?: string;
    description?: string;
  };
  flags?: {
    official?: boolean;
    protected?: boolean;
  };
}

interface AddonManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  authKey: string;
}

export function AddonManagerModal({ isOpen, onClose, authKey }: AddonManagerModalProps) {
  const addons = useSignal<Addon[]>([]);
  const isLoading = useSignal(false);
  const error = useSignal<string | null>(null);
  const isSaving = useSignal(false);
  const draggedIndex = useSignal<number | null>(null);
  const dragOverIndex = useSignal<number | null>(null);

  // Fetch addons from Stremio API
  const fetchAddons = async () => {
    if (!authKey) return;
    
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/stremio/api/addonCollectionGet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'AddonCollectionGet',
          authKey,
          update: true
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch addons: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.result && Array.isArray(data.result.addons)) {
        addons.value = data.result.addons;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching addons:', err);
      error.value = err instanceof Error ? err.message : 'Failed to fetch addons';
    } finally {
      isLoading.value = false;
    }
  };

  // Save addon order to Stremio API
  const saveAddonOrder = async () => {
    if (!authKey || addons.value.length === 0) return;

    isSaving.value = true;
    error.value = null;

    try {
      const response = await fetch('/stremio/api/addonCollectionSet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'AddonCollectionSet',
          authKey,
          addons: addons.value
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save addon order: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.result?.success !== undefined && !data.result.success) {
        throw new Error(data.result.error || 'Failed to save changes');
      }

      // Show success message briefly
      const originalError = error.value;
      error.value = 'Addon order saved successfully!';
      setTimeout(() => {
        if (error.value === 'Addon order saved successfully!') {
          error.value = originalError;
        }
      }, 3000);

    } catch (err) {
      console.error('Error saving addon order:', err);
      error.value = err instanceof Error ? err.message : 'Failed to save addon order';
    } finally {
      isSaving.value = false;
    }
  };

  // Load addons when modal opens
  useEffect(() => {
    if (isOpen && authKey) {
      fetchAddons();
    }
  }, [isOpen, authKey]);

  // Drag and drop handlers
  const handleDragStart = (e: DragEvent, index: number) => {
    draggedIndex.value = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', ''); // Required for Firefox
    }
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    dragOverIndex.value = index;
  };

  const handleDragLeave = () => {
    dragOverIndex.value = null;
  };

  const handleDrop = (e: DragEvent, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = draggedIndex.value;
    
    if (dragIndex !== null && dragIndex !== dropIndex) {
      const newAddons = [...addons.value];
      const draggedAddon = newAddons[dragIndex];
      
      // Remove dragged item
      newAddons.splice(dragIndex, 1);
      
      // Insert at new position
      newAddons.splice(dropIndex, 0, draggedAddon);
      
      addons.value = newAddons;
    }
    
    draggedIndex.value = null;
    dragOverIndex.value = null;
  };

  const handleDragEnd = () => {
    draggedIndex.value = null;
    dragOverIndex.value = null;
  };

  const removeAddon = (index: number) => {
    const addon = addons.value[index];
    
    // Don't allow removing protected addons
    if (addon.flags?.protected) {
      error.value = 'Cannot remove protected addons';
      return;
    }

    const newAddons = [...addons.value];
    newAddons.splice(index, 1);
    addons.value = newAddons;
  };

  if (!isOpen) return null;

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div class="bg-gray-900 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 class="text-2xl font-bold text-white">Addon Manager</h2>
            <p class="text-gray-400 text-sm mt-1">Drag and drop to reorder your Stremio addons</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            class="text-gray-400 hover:text-white text-2xl"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-y-auto p-6">
          {error.value && (
            <div class={`mb-4 p-3 rounded ${
              error.value.includes('successfully') 
                ? 'bg-green-900 text-green-200' 
                : 'bg-red-900 text-red-200'
            }`}>
              {error.value}
            </div>
          )}

          {isLoading.value ? (
            <div class="flex items-center justify-center py-12">
              <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
              <span class="ml-3 text-gray-300">Loading addons...</span>
            </div>
          ) : addons.value.length === 0 ? (
            <div class="text-center py-12 text-gray-400">
              No addons found. Make sure you're logged in to Stremio.
            </div>
          ) : (
            <div class="space-y-2">
              {addons.value.map((addon, index) => (
                <div
                  key={`${addon.manifest.id}-${index}`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  class={`flex items-center p-4 bg-gray-800 rounded-lg border transition-all cursor-move ${
                    draggedIndex.value === index 
                      ? 'opacity-50 border-red-500' 
                      : dragOverIndex.value === index
                      ? 'border-red-500 bg-gray-700'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  {/* Drag Handle */}
                  <div class="text-gray-500 mr-3 cursor-move">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                    </svg>
                  </div>

                  {/* Addon Logo */}
                  <div class="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
                    {addon.manifest.logo ? (
                      <img 
                        src={addon.manifest.logo} 
                        alt={addon.manifest.name}
                        class="w-10 h-10 rounded object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          if (e.currentTarget.nextElementSibling) {
                            (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                          }
                        }}
                      />
                    ) : null}
                    <div 
                      class={`text-gray-400 text-xs font-bold ${addon.manifest.logo ? 'hidden' : 'block'}`}
                      style={{ display: addon.manifest.logo ? 'none' : 'block' }}
                    >
                      {addon.manifest.name.slice(0, 2).toUpperCase()}
                    </div>
                  </div>

                  {/* Addon Info */}
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center">
                      <h3 class="text-white font-medium truncate">{addon.manifest.name}</h3>
                      {addon.flags?.official && (
                        <span class="ml-2 px-2 py-1 bg-blue-600 text-blue-100 text-xs rounded">
                          Official
                        </span>
                      )}
                      {addon.flags?.protected && (
                        <span class="ml-2 px-2 py-1 bg-green-600 text-green-100 text-xs rounded">
                          Protected
                        </span>
                      )}
                    </div>
                    {addon.manifest.description && (
                      <p class="text-gray-400 text-sm truncate mt-1">
                        {addon.manifest.description}
                      </p>
                    )}
                    <p class="text-gray-500 text-xs mt-1 truncate">
                      {addon.transportUrl}
                    </p>
                  </div>

                  {/* Remove Button */}
                  {!addon.flags?.protected && (
                    <button
                      type="button"
                      onClick={() => removeAddon(index)}
                      class="ml-4 text-gray-500 hover:text-red-400 transition-colors"
                      title="Remove addon"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div class="flex items-center justify-between p-6 border-t border-gray-700">
          <div class="text-sm text-gray-400">
            {addons.value.length} addons • Drag to reorder, click × to remove
          </div>
          <div class="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              class="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveAddonOrder}
              disabled={isSaving.value}
              class="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded transition-colors"
            >
              {isSaving.value ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}