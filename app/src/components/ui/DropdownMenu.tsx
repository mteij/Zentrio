import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'

interface MenuItem {
  label: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
}

interface MenuSeparator {
  type: 'separator'
}

type MenuItemOrSeparator = MenuItem | MenuSeparator

interface DropdownMenuProps {
  items: MenuItemOrSeparator[]
  triggerIcon?: React.ReactNode
  className?: string
}

export const DropdownMenu = ({ items, triggerIcon, className = '' }: DropdownMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleToggle = () => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const menuWidth = 200
      const menuHeight = items.length * 40 + 16 // Rough estimate
      
      let left = rect.right - menuWidth
      let top = rect.bottom + 4
      
      // Adjust if would go off screen
      if (left < 8) left = 8
      if (left + menuWidth > window.innerWidth - 8) {
        left = window.innerWidth - menuWidth - 8
      }
      if (top + menuHeight > window.innerHeight - 8) {
        top = rect.top - menuHeight - 4
      }
      
      setPosition({ top, left })
    }
    setIsOpen(!isOpen)
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation()
          handleToggle()
        }}
        className={`dropdown-trigger ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '44px',
          height: '44px',
          padding: '0',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '50%',
          color: '#fff',
          cursor: 'pointer',
          transition: 'all 0.2s',
          flexShrink: 0
        }}
      >
        {triggerIcon || <MoreVertical size={20} />}
      </button>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="dropdown-menu"
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            minWidth: '180px',
            background: 'rgba(24, 24, 27, 0.98)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '6px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            zIndex: 9999,
            animation: 'fadeInScale 0.15s ease-out'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, idx) => {
            if ('type' in item && item.type === 'separator') {
              return (
                <div
                  key={`sep-${idx}`}
                  style={{
                    height: '1px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    margin: '6px 8px'
                  }}
                />
              )
            }

            const menuItem = item as MenuItem
            return (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!menuItem.disabled) {
                    menuItem.onClick()
                    setIsOpen(false)
                  }
                }}
                disabled={menuItem.disabled}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: '8px',
                  color: menuItem.variant === 'danger' ? '#ef4444' : '#fff',
                  fontSize: '0.9rem',
                  cursor: menuItem.disabled ? 'not-allowed' : 'pointer',
                  opacity: menuItem.disabled ? 0.5 : 1,
                  textAlign: 'left',
                  transition: 'background 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (!menuItem.disabled) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {menuItem.icon && <menuItem.icon size={18} />}
                <span>{menuItem.label}</span>
              </button>
            )
          })}
        </div>,
        document.body
      )}

      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  )
}
