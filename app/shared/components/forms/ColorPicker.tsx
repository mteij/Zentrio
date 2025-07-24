import { h } from "preact";
import { useSignal } from "@preact/signals";

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
  const showCustom = useSignal(false);

  const handlePresetClick = (color: string) => {
    onChange(color);
    showCustom.value = false;
  };

  const handleCustomColorChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    onChange(target.value);
  };

  return (
    <div class="space-y-3">
      {label && (
        <label class="block text-gray-200 mb-2 font-medium">
          {label}
        </label>
      )}
      
      {/* Currently Selected Color */}
      <div class="space-y-2">
        <div class="flex items-center space-x-3">
          <span class="text-sm text-gray-400">Currently selected:</span>
          <div 
            class="w-8 h-8 rounded border-2 border-gray-600"
            style={{ backgroundColor: value }}
          ></div>
          <span class="text-sm text-gray-400 font-mono">{value}</span>
        </div>
      </div>

      {/* Preset Colors */}
      <div class="grid grid-cols-7 gap-2">
        {presets.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => handlePresetClick(color)}
            disabled={disabled}
            class={`w-8 h-8 rounded border-2 transition-all ${
              value === color 
                ? 'border-white ring-2 ring-gray-400' 
                : 'border-gray-600 hover:border-gray-400'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Custom Color Toggle */}
      <button
        type="button"
        onClick={() => showCustom.value = !showCustom.value}
        disabled={disabled}
        class="text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
      >
        {showCustom.value ? 'Hide Custom Color' : 'Custom Color...'}
      </button>

      {/* Custom Color Input */}
      {showCustom.value && (
        <div class="flex items-center space-x-2">
          <input
            type="color"
            value={value}
            onChange={handleCustomColorChange}
            disabled={disabled}
            class="w-12 h-8 border border-gray-600 rounded cursor-pointer disabled:cursor-not-allowed"
          />
          <input
            type="text"
            value={value}
            onChange={handleCustomColorChange}
            disabled={disabled}
            placeholder="#dc2626"
            pattern="^#[0-9A-Fa-f]{6}$"
            class="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all duration-200 disabled:opacity-50 font-mono text-sm"
          />
        </div>
      )}
    </div>
  );
}