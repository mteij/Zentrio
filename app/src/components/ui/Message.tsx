interface MessageProps {
  type?: 'success' | 'error' | 'info'
  children?: any
  id?: string
  className?: string
  style?: Record<string, string>
  show?: boolean
  ariaLive?: 'polite' | 'assertive'
  role?: string
}

export function Message({ 
  type = 'info', 
  children, 
  id, 
  className = '', 
  style, 
  show = true,
  ariaLive = 'polite',
  role = 'alert'
}: MessageProps) {
  const messageClass = `message ${type} ${className}`
  const displayStyle = show ? { display: 'block', ...style } : { display: 'none', ...style }
  
  return (
    <div 
      id={id}
      className={messageClass}
      style={displayStyle}
      role={role}
      aria-live={ariaLive}
    >
      {children}
    </div>
  )
}