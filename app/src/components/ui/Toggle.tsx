import React from 'react'
import { hapticTick } from '../../lib/haptics'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  title?: string
}

export function Toggle({ checked, onChange, disabled, title }: ToggleProps) {
  const handleToggle = () => {
    if (disabled) return
    hapticTick()
    onChange(!checked)
  }

  const containerStyle: React.CSSProperties = {
    appearance: 'none',
    width: 'var(--toggle-width, 44px)',
    height: 'var(--toggle-height, 24px)',
    backgroundColor: checked ? 'var(--accent, #e50914)' : 'rgba(255, 255, 255, 0.1)',
    borderRadius: 'calc(var(--toggle-height, 24px) / 2)',
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'background-color 0.3s ease',
    opacity: disabled ? 0.5 : 1,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    flexShrink: 0,
    padding: 0
  }

  const knobStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'var(--toggle-padding, 2px)',
    left: checked
      ? 'calc(var(--toggle-width, 44px) - var(--toggle-knob-size, 18px) - var(--toggle-padding, 2px))'
      : 'var(--toggle-padding, 2px)',
    width: 'var(--toggle-knob-size, 18px)',
    height: 'var(--toggle-knob-size, 18px)',
    backgroundColor: '#ffffff',
    borderRadius: '50%',
    transition: 'left 0.3s ease',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
  }

  return (
    <button
      type="button"
      style={containerStyle}
      onClick={handleToggle}
      title={title}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      aria-label={title}
    >
      <div style={knobStyle} />
    </button>
  )
}
