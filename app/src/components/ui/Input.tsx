import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

export function Input({
  className = '',
  wrapperClassName = '',
  type = 'text',
  label,
  error,
  id,
  ...props
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const baseInputClasses = "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[#e50914] focus:ring-1 focus:ring-[#e50914] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-md";
  
  return (
    <div className={`space-y-1.5 ${wrapperClassName}`}>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-zinc-400">
          {label}
        </label>
      )}
      
      <div className="relative">
        <input
          id={id}
          type={inputType}
          className={`${baseInputClasses} ${isPassword ? 'pr-12' : ''} ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} ${className}`}
          {...props}
        />
        
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-white/10"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <EyeOff className="w-5 h-5" />
            ) : (
              <Eye className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 mt-1">{error}</p>
      )}
    </div>
  );
}

// kept for backward compatibility if needed, but encouraged to use prop on Input
export function FormGroup({ label, htmlFor, children, className = '', id }: { label?: string, htmlFor?: string, children: React.ReactNode, className?: string, id?: string }) {
  return (
    <div id={id} className={`mb-5 ${className}`}>
      {label && <label htmlFor={htmlFor} className="block mb-2 text-[#b3b3b3] text-base">{label}</label>}
      {children}
    </div>
  )
}
