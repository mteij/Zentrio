import { h } from "preact";
import { JSX } from "preact";

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          confirmBg: "#dc2626", // red-600
          confirmHover: "#b91c1c", // red-700
        };
      case "warning":
        return {
          confirmBg: "#d97706", // amber-600
          confirmHover: "#b45309", // amber-700
        };
      case "info":
        return {
          confirmBg: "#2563eb", // blue-600
          confirmHover: "#1d4ed8", // blue-700
        };
      default:
        return {
          confirmBg: "#dc2626",
          confirmHover: "#b91c1c",
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <div class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50 transition-all duration-300 animate-fade-in">
      <div class="bg-gray-800 p-6 rounded-lg w-full max-w-md shadow-2xl transform transition-all duration-300 animate-modal-pop">
        <h3 class="text-xl font-bold mb-4 text-white">{title}</h3>
        <p class="text-gray-300 mb-6 leading-relaxed">{message}</p>
        <div class="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors duration-200"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            class="text-white font-bold py-2 px-4 rounded transition-colors duration-200"
            style={{
              backgroundColor: styles.confirmBg,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor = styles.confirmHover;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = styles.confirmBg;
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
      <style>
        {`
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease;
        }
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