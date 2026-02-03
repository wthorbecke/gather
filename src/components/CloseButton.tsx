'use client'

interface CloseButtonProps {
  onClick: () => void
  className?: string
}

export function CloseButton({ onClick, className = '' }: CloseButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors ${className}`}
      aria-label="Close"
    >
      <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  )
}
