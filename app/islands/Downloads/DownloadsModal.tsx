
export default function DownloadsModal({
  onClose,
  isMobile,
}: {
  onClose: () => void;
  isMobile: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className={`bg-gray-900 rounded-lg shadow-2xl w-full ${isMobile ? 'max-w-md p-4' : 'max-w-2xl p-6'} relative animate-modal-pop max-h-[90vh] overflow-y-auto`}>
        <button
          type="button"
          className="absolute top-3 right-3 text-gray-400 hover:text-white text-2xl"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-2xl font-bold mb-6 text-white">Downloads</h2>

          <div class="mt-6">
            <h3 class="text-lg font-semibold mb-4 text-white">Downloaded Files</h3>
            <p class="text-gray-400">You have no downloaded files.</p>
            {/* TODO: Implement the list of downloaded files */}
          </div>
      </div>
    </div>
  );
}