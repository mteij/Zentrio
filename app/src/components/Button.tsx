interface ButtonProps {
  type?: 'button' | 'submit' | 'reset'
  variant?: 'primary' | 'secondary' | 'danger' | 'cta'
  size?: 'normal' | 'small'
  onClick?: () => void
  disabled?: boolean
  children: any
  className?: string
  id?: string
  ariaLabel?: string
  title?: string
  style?: Record<string, string>
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
  style
}: ButtonProps) {
  const getClasses = () => {
    const base = variant === 'cta' ? 'cta-button' : 'btn'
    const variantClass = variant !== 'cta' ? `btn-${variant}` : ''
    const sizeClass = size === 'small' && variant !== 'cta' ? 'btn-small' : ''
    
    return [base, variantClass, sizeClass, className]
      .filter(Boolean)
      .join(' ')
  }

  return (
    <button
      type={type}
      className={getClasses()}
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