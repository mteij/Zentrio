import React from 'react'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  title?: string
}

export function Toggle({ checked, onChange, disabled, title }: ToggleProps) {
  const containerStyle: React.CSSProperties = {
    width: '44px',
    height: '24px',
    backgroundColor: checked ? 'var(--accent, #e50914)' : 'rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    position: 'relative',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.3s ease',
    opacity: disabled ? 0.5 : 1,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    flexShrink: 0
  }

  const knobStyle: React.CSSProperties = {
    position: 'absolute',
    top: '2px',
    left: checked ? '22px' : '2px',
    width: '18px',
    height: '18px',
    backgroundColor: '#ffffff',
    borderRadius: '50%',
    transition: 'left 0.3s ease',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
  }

  return (
    <div 
      style={containerStyle}
      onClick={() => !disabled && onChange(!checked)}
      title={title}
      role="switch"
      aria-checked={checked}
    >
      <div style={knobStyle} />
    </div>
  )
}
