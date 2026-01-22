'use client'

import { useEffect } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-white rounded-2xl max-w-[600px] w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="px-6 py-5 border-b border-[var(--border-light)] flex justify-between items-center">
          <h2 className="font-serif text-xl font-medium">{title}</h2>
          <button
            onClick={onClose}
            className="text-2xl text-[var(--text-muted)] hover:text-[var(--text)] leading-none"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-[var(--border-light)] flex gap-3 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
