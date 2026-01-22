'use client'

import { useEffect, useState, useCallback } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  maxWidth?: string
  showHeader?: boolean
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  maxWidth = '480px',
  showHeader = true
}: ModalProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      // Small delay to trigger enter animation
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      document.body.style.overflow = 'unset'
      setIsVisible(false)
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 250) // Match modal-out animation duration
  }, [onClose])

  if (!isOpen && !isClosing) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm ${
          isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
        }`}
      />

      {/* Modal */}
      <div
        className={`relative w-full bg-elevated rounded-2xl overflow-hidden flex flex-col shadow-modal border border-border ${
          isClosing ? 'animate-modal-out' : isVisible ? 'animate-modal-in' : 'opacity-0'
        }`}
        style={{ maxWidth, maxHeight: '90vh' }}
      >
        {showHeader && title && (
          <div className="px-5 py-4 border-b border-border flex justify-between items-start">
            <div className="flex-1 pr-3">
              <h2 className="text-xl font-semibold text-text">{title}</h2>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface text-text-muted hover:text-text hover:scale-105 active:scale-95 transition-all"
              aria-label="Close modal"
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {footer && (
          <div className="px-5 py-4 border-t border-border flex gap-3 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
