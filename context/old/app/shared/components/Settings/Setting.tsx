import { ComponentChildren } from "preact";
import { usePwa } from "../../hooks/usePwa.ts";

interface SettingProps {
  title: string;
  description: ComponentChildren;
  children: ComponentChildren;
  pwaOnly?: boolean;
}

export default function Setting({ title, description, children, pwaOnly }: SettingProps) {
  const isPwa = usePwa();

  if (pwaOnly && !isPwa) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 mb-4">
      <div className="mb-0">
        <label className="block text-base font-medium text-gray-200 mb-2">{title}</label>
        {children}
        <p className="text-xs text-gray-400 mt-2">{description}</p>
      </div>
    </div>
  );
}