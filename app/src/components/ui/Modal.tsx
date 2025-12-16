import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  id?: string;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

export function Modal({ 
  id, 
  isOpen, 
  onClose, 
  title, 
  children, 
  className = '',
  maxWidth = 'max-w-lg'
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div 
                ref={modalRef}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ duration: 0.2 }}
                className={`relative w-full ${maxWidth} bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col ${className}`}
                id={id}
            >
                {/* Header */}
                {title && (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                        <h3 className="text-lg font-semibold text-white">{title}</h3>
                        <button 
                            onClick={onClose}
                            className="text-zinc-400 hover:text-white transition-colors p-1 rounded-md hover:bg-zinc-800"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}
                {!title && (
                     <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors p-1 rounded-md hover:bg-zinc-800 z-10"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[calc(100vh-200px)]">
                    {children}
                </div>
            </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ModalWithFooter({ 
  id, 
  isOpen, 
  onClose, 
  title, 
  children, 
  footer,
  className = '',
  maxWidth = 'max-w-lg'
}: ModalProps & { footer: React.ReactNode }) {
  // We reuse Modal but inject footer
  return (
    <Modal id={id} isOpen={isOpen} onClose={onClose} title={title} className={className} maxWidth={maxWidth}>
        <div className="space-y-6">
            <div>{children}</div>
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800 mt-4">
                {footer}
            </div>
        </div>
    </Modal>
  );
}