import { h, ComponentChildren } from "preact";
import { useSignal } from "@preact/signals";

interface PluginSettingProps {
  title: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  isExperimental?: boolean;
  warning?: ComponentChildren;
  credits?: ComponentChildren;
  howItWorks?: ComponentChildren;
  children: ComponentChildren;
}

export default function PluginSetting({
  title,
  enabled,
  onChange,
  isExperimental,
  warning,
  credits,
  howItWorks,
  children,
}: PluginSettingProps) {
  const collapsed = useSignal(true);

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-2">
        <button
          type="button"
          onClick={() => (collapsed.value = !collapsed.value)}
          className="flex items-center gap-3 flex-1 text-left bg-transparent border-none p-0 cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <svg
              className={`w-5 h-5 text-gray-300 transition-transform duration-200 ${
                collapsed.value ? "" : "rotate-90"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-200 font-medium text-base group-hover:text-white transition-colors">
                {title}
              </span>
              {isExperimental && (
                <span className="text-xs font-semibold text-red-500">Experimental</span>
              )}
            </div>
          </div>
        </button>
        <div className="flex items-center">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={enabled}
              onChange={(e) => onChange(e.currentTarget.checked)}
            />
            <div
              className={`block w-14 h-8 rounded-full transition-colors duration-200 cursor-pointer ${
                enabled ? "bg-red-600" : "bg-gray-600"
              }`}
              onClick={() => onChange(!enabled)}
            ></div>
            <div
              className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-200 pointer-events-none ${
                enabled ? "transform translate-x-6" : ""
              }`}
            ></div>
          </div>
          <span className="ml-3 text-sm font-medium text-gray-300">
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </div>
      </div>
      {collapsed.value ? (
        <p className="text-xs text-gray-400 mt-2">
          Click to expand for options and more information.
        </p>
      ) : (
        <div className="space-y-4 border-t border-gray-700 pt-4 animate-fadeIn">
          {children}
          {(howItWorks || warning || credits) && (
            <div className="text-xs text-gray-400 bg-gray-700 rounded p-3 mt-4 space-y-2">
              {howItWorks && (
                <div>
                  <strong>How it works:</strong> {howItWorks}
                </div>
              )}
              {warning && (
                <div className={howItWorks ? "border-t border-gray-600 pt-2" : ""}>
                  <strong>Warning:</strong> {warning}
                </div>
              )}
              {credits && (
                <div
                  className={
                    howItWorks || warning ? "border-t border-gray-600 pt-2" : ""
                  }
                >
                  <strong>Credits:</strong> {credits}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}