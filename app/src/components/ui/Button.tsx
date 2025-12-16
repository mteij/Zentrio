interface ButtonProps {
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'danger' | 'cta' | 'ghost'
  size?: 'normal' | 'small' | 'large'
  onClick?: (e: React.MouseEvent<HTMLElement>) => void
  disabled?: boolean
  children: React.ReactNode
  className?: string
  id?: string
  ariaLabel?: string
  title?: string
  style?: React.CSSProperties
  href?: string
}

export function Button({
  type = 'button',
  variant = 'primary',
  size = 'normal',
  onClick,
  disabled = false,
  children,
  className = '',
  id,
  ariaLabel,
  title,
  style,
  href
}: ButtonProps) {
  
  // Base styles shared by all buttons
  const baseClasses = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#141414] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none active:scale-[0.98]"
  
  // Size variants
  const sizeClasses = {
    small: "px-3 py-1.5 text-xs",
    normal: "px-5 py-2.5 text-sm",
    large: "px-6 py-3 text-base font-semibold"
  }
  
  // Color/Style variants
  const variantClasses = {
    primary: "bg-[#e50914] text-white border border-transparent shadow-[0_4px_15px_rgba(229,9,20,0.3)] hover:bg-[#f40612] hover:shadow-[0_6px_20px_rgba(229,9,20,0.4)] hover:-translate-y-px",
    cta: "bg-[#e50914] text-white border border-transparent py-4 text-base font-bold hover:bg-[#f40612]", // CTA matches primary but bigger usually
    secondary: "bg-white/10 text-white border border-white/10 backdrop-blur-md hover:bg-white/20 hover:border-white/30 hover:-translate-y-px shadow-sm",
    danger: "bg-red-600/80 text-white border border-red-600/30 hover:bg-red-600 hover:shadow-[0_4px_15px_rgba(220,53,69,0.3)] hover:-translate-y-px",
    ghost: "bg-transparent text-zinc-400 hover:text-white hover:bg-white/5"
  }

  // Combine classes
  const classes = `
    ${baseClasses}
    ${sizeClasses[size === 'small' ? 'small' : size === 'large' ? 'large' : 'normal']}
    ${variantClasses[variant] || variantClasses.primary}
    ${className}
  `.replace(/\s+/g, ' ').trim()

  if (href) {
    return (
      <a
        href={href}
        className={classes}
        onClick={onClick as any}
        id={id}
        aria-label={ariaLabel}
        title={title}
        style={style}
      >
        {children}
      </a>
    )
  }

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled}
      id={id}
      aria-label={ariaLabel}
      title={title}
      style={style}
    >
      {children}
    </button>
  )
}
