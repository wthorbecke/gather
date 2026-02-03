'use client'

import { useState, ReactNode } from 'react'

interface CollapsibleSectionProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  storageKey: string
  rightElement?: ReactNode
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  storageKey,
  rightElement
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return defaultOpen
    const stored = localStorage.getItem(`gather_section_${storageKey}`)
    return stored !== null ? stored === 'true' : defaultOpen
  })

  const toggle = () => {
    const newState = !isOpen
    setIsOpen(newState)
    localStorage.setItem(`gather_section_${storageKey}`, String(newState))
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between py-2">
        <button
          onClick={toggle}
          className="flex items-center gap-2 text-text-muted hover:text-text transition-colors"
        >
          <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{title}</span>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {rightElement && (
          <div onClick={(e) => e.stopPropagation()}>
            {rightElement}
          </div>
        )}
      </div>
      <div
        className={`
          overflow-hidden transition-all duration-200 ease-out
          ${isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}
        `}
      >
        <div className="pt-2">
          {children}
        </div>
      </div>
    </div>
  )
}
