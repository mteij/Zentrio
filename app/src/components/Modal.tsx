interface ModalProps {
  id?: string
  isOpen?: boolean
  onClose?: () => void
  title?: string
  children: any
  className?: string
}

interface ModalHeaderProps {
  title: string
  onClose?: () => void
}

interface ModalFooterProps {
  children: any
}

export function Modal({ id, isOpen = false, onClose, title, children, className = '' }: ModalProps) {
  const modalClass = isOpen ? 'modal active' : 'modal'
  
  return (
    <div id={id} className={`${modalClass} ${className}`}>
      <div className="modal-content">
        {title && <ModalHeader title={title} onClose={onClose} />}
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}

export function ModalHeader({ title, onClose }: ModalHeaderProps) {
  return (
    <div className="modal-header">
      <h3 className="modal-title">{title}</h3>
      {onClose && (
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>
      )}
    </div>
  )
}

export function ModalFooter({ children }: ModalFooterProps) {
  return (
    <div className="modal-footer">
      {children}
    </div>
  )
}

export function ModalWithFooter({ 
  id, 
  isOpen = false, 
  onClose, 
  title, 
  children, 
  footer,
  className = '' 
}: ModalProps & { footer: any }) {
  const modalClass = isOpen ? 'modal active' : 'modal'
  
  return (
    <div id={id} className={`${modalClass} ${className}`}>
      <div className="modal-content">
        {title && <ModalHeader title={title} onClose={onClose} />}
        <div className="modal-body">
          {children}
        </div>
        <ModalFooter>
          {footer}
        </ModalFooter>
      </div>
    </div>
  )
}