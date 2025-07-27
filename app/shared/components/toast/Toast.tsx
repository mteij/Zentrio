import { h as _h } from "preact";
import { useEffect, useState } from "preact/hooks";

export type ToastType = "Success" | "Warning" | "Message" | "Error";

export interface ToastProps {
  id: number;
  message: string;
  type: ToastType;
  duration?: number;
  onClose: (id: number) => void;
}

export function Toast({ id, message, type, duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onClose(id), 500); // wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const toastStyles = {
    Success: "bg-green-500",
    Warning: "bg-yellow-500",
    Message: "bg-blue-500",
    Error: "bg-red-500",
  };

  return (
    <div
      class={`p-4 rounded-md text-white transition-opacity duration-500 ${
        toastStyles[type]
      } ${visible ? "opacity-100" : "opacity-0"}`}
    >
      {message}
    </div>
  );
}