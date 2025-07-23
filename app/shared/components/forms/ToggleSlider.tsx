import { h } from "preact";

interface ToggleSliderProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function ToggleSlider({ 
  enabled, 
  onChange, 
  disabled = false, 
  label,
  className = "" 
}: ToggleSliderProps) {
  return (
    <label class={`inline-flex items-center cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}>
      <div class="relative">
        <input
          type="checkbox"
          class="sr-only"
          checked={enabled}
          onChange={(e) => !disabled && onChange(e.currentTarget.checked)}
          disabled={disabled}
        />
        <div class={`block w-14 h-8 rounded-full transition-colors duration-200 ${
          enabled 
            ? 'bg-red-600' 
            : 'bg-gray-600'
        }`}></div>
        <div class={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-200 ${
          enabled ? 'transform translate-x-6' : ''
        }`}></div>
      </div>
      {label && (
        <span class={`ml-3 text-sm ${enabled ? 'text-gray-200' : 'text-gray-400'}`}>
          {label}
        </span>
      )}
    </label>
  );
}