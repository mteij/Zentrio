import { h, ComponentChildren } from "preact";
import { formStyles, animations } from "../../constants/styles.ts";

interface FormWrapperProps {
  children: ComponentChildren;
  onSubmit?: (e: Event) => void;
  title?: string;
  subtitle?: string;
  className?: string;
}

export function FormWrapper({ 
  children, 
  onSubmit, 
  title, 
  subtitle, 
  className = "" 
}: FormWrapperProps) {
  return (
    <div class={formStyles.container}>
      <style>{animations.fadeIn}</style>
      <div class={`bg-gray-800 p-8 rounded-lg shadow-2xl w-full max-w-md mx-auto ${className}`} 
           style="animation: fadeIn 0.6s ease-out;">
        {title && (
          <div class="text-center mb-6">
            <h1 class="text-3xl font-bold text-white mb-2">{title}</h1>
            {subtitle && <p class="text-gray-400">{subtitle}</p>}
          </div>
        )}
        <form class={formStyles.form} onSubmit={onSubmit}>
          {children}
        </form>
      </div>
    </div>
  );
}