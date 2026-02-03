'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { CloseButton } from './CloseButton'

interface SheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
}

/**
 * Bottom sheet component for mobile-first UI.
 *
 * Use this for:
 * - SnoozeMenu
 * - Pickers (date, time, energy level)
 * - Quick action menus
 * - Settings panels
 *
 * Features:
 * - Mobile: slides up from bottom with rounded top corners
 * - Desktop: centered with full rounded corners
 * - Backdrop click to close
 * - Escape key to close
 * - Proper accessibility attributes
 */
export function Sheet({ isOpen, onClose, title, children }: SheetProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)

  // Handle body scroll lock
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

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 250) // Match Modal animation duration
  }, [onClose])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  // Focus trap - focus sheet when opened
  useEffect(() => {
    if (isOpen && isVisible && sheetRef.current) {
      sheetRef.current.focus()
    }
  }, [isOpen, isVisible])

  if (!isOpen && !isClosing) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm ${
          isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
        }`}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`
          relative z-10
          bg-elevated border border-border
          rounded-t-2xl sm:rounded-2xl
          w-full sm:max-w-md
          mx-0 sm:mx-4
          shadow-modal
          outline-none
          ${isClosing
            ? 'animate-modal-out'
            : isVisible
              ? 'animate-rise'
              : 'opacity-0 translate-y-4'
          }
        `}
      >
        {/* Optional title header */}
        {title && (
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text">{title}</h3>
            <CloseButton onClick={handleClose} className="-mr-2" />
          </div>
        )}

        {/* Content */}
        <div className={title ? '' : 'pt-4'}>
          {children}
        </div>
      </div>
    </div>
  )
}
