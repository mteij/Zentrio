import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  label: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  onClick: () => void
  variant?: 'default' | 'danger'
  disabled?: boolean
}

export interface ContextMenuSeparator {
  type: 'separator'
}

export type ContextMenuItemOrSeparator = ContextMenuItem | ContextMenuSeparator

interface ContextMenuProps {
  items: ContextMenuItemOrSeparator[]
  children: React.ReactNode
  title?: string
  onOpen?: () => void
  onClose?: () => void
}

export const ContextMenu = ({ items, children, title, onOpen, onClose }: ContextMenuProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [opacity, setOpacity] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPosition = useRef<{ x: number; y: number } | null>(null)
  const targetPosition = useRef<{ x: number; y: number } | null>(null)

  const close = useCallback(() => {
    setIsOpen(false)
    setOpacity(0)
    onClose?.()
  }, [onClose])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Check if click is on the trigger container (to allow re-opening elsewhere)
      // or outside the menu.
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }

    const handleScroll = () => close()

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleEscape)
      document.addEventListener('scroll', handleScroll, true)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen, close])

  useLayoutEffect(() => {
    if (isOpen && menuRef.current && targetPosition.current) {
      const { x, y } = targetPosition.current
      const rect = menuRef.current.getBoundingClientRect()
      
      let top = y
      let left = x

      // Horizontal positioning
      if (left + rect.width > window.innerWidth - 8) {
        // If not enough space on right, flip to left
        left = x - rect.width
        // If flipped left goes offscreen, just clamp to right edge
        if (left < 8) {
          left = window.innerWidth - rect.width - 8
        }
      }

      // Vertical positioning
      // Default: down
      if (top + rect.height > window.innerHeight - 8) {
        // Not enough space down, try up
        // Position bottom of menu at cursor Y
        top = y - rect.height
        
        // If not enough space up either, position at bottom of screen
        if (top < 8) {
          top = window.innerHeight - rect.height - 8
        }
      }

      setPosition({ top, left })
      setOpacity(1)
    }
  }, [isOpen])

  const openMenu = (x: number, y: number) => {
    targetPosition.current = { x, y }
    setIsOpen(true)
    setOpacity(0)
    onOpen?.()
  }

  // Right-click handler
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    openMenu(e.clientX, e.clientY)
  }

  // Long-press handlers for touch
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    startPosition.current = { x: touch.clientX, y: touch.clientY }
    
    longPressTimer.current = setTimeout(() => {
      e.preventDefault()
      // Vibrate on supported devices
      if (navigator.vibrate) navigator.vibrate(50)
      openMenu(touch.clientX, touch.clientY)
    }, 500)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startPosition.current && longPressTimer.current) {
      const touch = e.touches[0]
      const dx = Math.abs(touch.clientX - startPosition.current.x)
      const dy = Math.abs(touch.clientY - startPosition.current.y)
      
      if (dx > 10 || dy > 10) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
    }
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    startPosition.current = null
  }

  return (
    <>
      <div
        ref={containerRef}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{ display: 'contents' }}
      >
        {children}
      </div>

      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="context-menu"
          style={{
            position: 'fixed',
            top: position.top,
            left: position.left,
            minWidth: '200px',
            background: 'rgba(24, 24, 27, 0.98)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '6px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            zIndex: 9999,
            opacity: opacity,
            transform: opacity === 1 ? 'scale(1)' : 'scale(0.95)',
            transition: 'opacity 0.1s ease-out, transform 0.1s ease-out'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <>
              <div 
                style={{ 
                  padding: '8px 12px', 
                  fontSize: '0.85rem', 
                  fontWeight: 600, 
                  color: 'rgba(255,255,255,0.5)', 
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                  marginBottom: '4px'
                }}
              >
                {title}
              </div>
            </>
          )}

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

            const menuItem = item as ContextMenuItem
            return (
              <button
                key={idx}
                onClick={(e) => {
                  e.stopPropagation()
                  if (!menuItem.disabled) {
                    menuItem.onClick()
                    close()
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
    </>
  )
}
