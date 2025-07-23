import { useSignal } from "@preact/signals";

export default function SettingsModal({
  // Rename unused prop to _show to avoid linter warning
  _show,
  onClose,
  addonOrderEnabled,
  setAddonOrderEnabled,
}: {
  _show: boolean;
  onClose: () => void;
  addonOrderEnabled: { value: boolean };
  setAddonOrderEnabled: (v: boolean) => void;
}) {
  const experimentalTab = useSignal(true);

  // Modal is only rendered when open, so no need for if (!show) return null;

  return (
    <div class="bg-gray-900 rounded-lg shadow-2xl w-full max-w-md p-6 relative animate-modal-pop">
      <button
        type="button"
        class="absolute top-3 right-3 text-gray-400 hover:text-white text-2xl"
        onClick={onClose}
        aria-label="Close"
      >
        ×
      </button>
      <h2 class="text-xl font-bold mb-4 text-white">Settings</h2>
      <div class="flex border-b border-gray-700 mb-4">
        <button
          type="button"
          class={`px-4 py-2 font-semibold ${experimentalTab.value ? "text-red-500 border-b-2 border-red-500" : "text-gray-400"}`}
          onClick={() => experimentalTab.value = true}
        >
          Experimental
        </button>
        {/* Future: Add more tabs here */}
      </div>
      {experimentalTab.value && (
        <div>
          <h3 class="text-lg font-semibold mb-2 text-white">Experimental Features</h3>
          <div class="flex items-center justify-between mb-4">
            <span class="text-gray-200">Edit add on order</span>
            <label class="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={addonOrderEnabled.value}
                onChange={e => setAddonOrderEnabled(e.currentTarget.checked)}
                class="form-checkbox h-5 w-5 text-red-600"
              />
              <span class="ml-2 text-gray-400 text-sm">
                {addonOrderEnabled.value ? "Enabled" : "Disabled"}
              </span>
            </label>
          </div>
          <p class="text-xs text-gray-500">
            Adds a button to the Zentrio Addons page to copy your auth key and open the community Addon Manager.
          </p>
        </div>
      )}
      <style>
        {`
          @keyframes modal-pop {
            0% { opacity: 0; transform: scale(0.95);}
            100% { opacity: 1; transform: scale(1);}
          }
          .animate-modal-pop {
            animation: modal-pop 0.3s cubic-bezier(.4,2,.6,1) both;
          }
        `}
      </style>
    </div>
  );
}