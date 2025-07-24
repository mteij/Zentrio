import { h } from "preact";
import { useSignal } from "@preact/signals";
import { AddonManagerModal } from "./shared/components/AddonManagerModal";

export default function App() {
  const showAddonManager = useSignal(false);
  const authKey = /* logic to get user's Stremio authKey, e.g. from context or props */;

  return (
    <div>
      {/* ...existing code... */}
      <button
        class="px-4 py-2 bg-red-600 text-white rounded"
        onClick={() => showAddonManager.value = true}
      >
        Edit Addons
      </button>
      <AddonManagerModal
        isOpen={showAddonManager.value}
        onClose={() => showAddonManager.value = false}
        authKey={authKey}
      />
      {/* ...existing code... */}
    </div>
  );
}