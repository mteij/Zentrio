import { h } from "preact";
import { useSignal, useComputed } from "@preact/signals";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  presets?: string[];
  disabled?: boolean;
}

export function ColorPicker({ 
  value, 
  onChange, 
  label, 
  presets = ["#dc2626", "#2563eb", "#059669", "#7c3aed", "#ea580c", "#0891b2", "#be123c"], 
  disabled = false 
}: ColorPickerProps) {
  const customInputRef = useSignal<HTMLInputElement | null>(null);
  const selectedColor = useComputed(() => value);

  const handlePresetClick = (color: string) => {
    onChange(color);
  };

  const handleCustomColorChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    onChange(target.value);
  };

  // When "Custom Color..." is clicked, focus the color input immediately
  const handleCustomColorButtonClick = () => {
    setTimeout(() => {
      customInputRef.value?.focus();
      customInputRef.value?.click();
    }, 0);
  };

  return (
    <div class="space-y-3">
      {label && (
        <label class="block text-gray-200 mb-2 font-medium">
          {label}
        </label>
      )}

      <div class="grid grid-cols-7 gap-2">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => handlePresetClick(color)}
            disabled={disabled}
            class={`w-8 h-8 rounded border-2 transition-all ${
              selectedColor.value === color 
                ? 'border-white ring-2 ring-gray-400' 
                : 'border-gray-600 hover:border-gray-400'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            style={{ backgroundColor: color }}
            title={color}
            tabIndex={0}
          />
        ))}
      </div>

      {/* Custom Color Button always opens the color picker */}
      <button
        type="button"
        onClick={handleCustomColorButtonClick}
        disabled={disabled}
        class="text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
      >
        Custom Color...
      </button>
    </div>
  );
}