import { h } from "preact";

interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title = "Are you sure?",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div class="bg-gray-800 rounded-lg shadow-xl p-8 max-w-xs w-full flex flex-col items-center animate-modal-pop">
        <h3 class="text-xl font-bold text-white mb-4">{title}</h3>
        <p class="text-gray-300 mb-6 text-center">{message}</p>
        <div class="flex gap-4 w-full justify-center">
          <button
            class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <button
            class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
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
