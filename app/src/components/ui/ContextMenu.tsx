import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

export interface ContextMenuItem {
  label: string
  icon?: React.ReactNode
  action: () => void
  danger?: boolean
  disabled?: boolean
}

interface ContextMenuProps {
  isOpen: boolean
  onClose: () => void
  position: { x: number; y: number }
  items: ContextMenuItem[]
  title?: string
}

export function ContextMenu({ isOpen, onClose, position, items, title }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState(position)

  // Adjust position to keep menu on screen
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const { innerWidth, innerHeight } = window
      
      let x = position.x
      let y = position.y
      
      // Check right edge
      if (x + rect.width > innerWidth) {
        x = innerWidth - rect.width - 10
      }
      
      // Check bottom edge
      if (y + rect.height > innerHeight) {
        y = innerHeight - rect.height - 10
      }
      
      setAdjustedPosition({ x, y })
    }
  }, [isOpen, position])

  // Click outside to close
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    
    // Scroll to close
    const handleScroll = () => {
       if (isOpen) onClose()
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClick)
      window.addEventListener('scroll', handleScroll, true)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, zIndex: 9999 }}>
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{
              position: 'fixed',
              top: adjustedPosition.y,
              left: adjustedPosition.x,
              background: 'rgba(20, 20, 25, 0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
              minWidth: '220px',
              padding: '6px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {title && (
              <div style={{ 
                padding: '8px 12px', 
                fontSize: '0.85rem', 
                color: '#888', 
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                marginBottom: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span>{title}</span>
                <button 
                  onClick={(e) => { e.stopPropagation(); onClose(); }}
                  style={{ background: 'transparent', border: 'none', color: '#666', cursor: 'pointer', padding: 0, display: 'flex' }}
                >
                    <X size={14} />
                </button>
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {items.map((item, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!item.disabled) {
                        item.action()
                        onClose()
                    }
                  }}
                  disabled={item.disabled}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: item.danger ? '#ef4444' : (item.disabled ? '#555' : '#eee'),
                    fontSize: '0.95rem',
                    cursor: item.disabled ? 'default' : 'pointer',
                    transition: 'background 0.2s',
                    textAlign: 'left',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => {
                    if (!item.disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  {item.icon && <span style={{ opacity: item.disabled ? 0.5 : 0.8 }}>{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  )
}
