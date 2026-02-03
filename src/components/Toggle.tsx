'use client'

interface ToggleProps {
  /** Whether the toggle is checked/on */
  checked: boolean
  /** Callback when the toggle state changes */
  onChange: (checked: boolean) => void
  /** Optional label text displayed next to the toggle */
  label?: string
  /** Optional description text displayed below the label */
  description?: string
  /** Whether the toggle is disabled */
  disabled?: boolean
  /** Size variant of the toggle */
  size?: 'sm' | 'md'
  /** Optional className for the container */
  className?: string
}

/**
 * Reusable toggle/switch component for boolean inputs.
 * Follows the Gather design system with smooth transitions and accessibility.
 */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  size = 'md',
  className = '',
}: ToggleProps) {
  const handleClick = () => {
    if (!disabled) {
      onChange(!checked)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!disabled) {
        onChange(!checked)
      }
    }
  }

  // Size variants
  const sizes = {
    sm: {
      track: 'w-10 h-5',
      thumb: 'w-4 h-4',
      thumbTranslate: checked ? 'translate-x-5' : 'translate-x-0.5',
    },
    md: {
      track: 'w-14 h-8',
      thumb: 'w-6 h-6',
      thumbTranslate: checked ? 'translate-x-7' : 'translate-x-1',
    },
  }

  const currentSize = sizes[size]

  const toggle = (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`
        relative ${currentSize.track} rounded-full
        transition-colors duration-200 ease-out
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
        ${checked ? 'bg-accent' : 'bg-surface'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span
        className={`
          absolute top-1/2 -translate-y-1/2
          ${currentSize.thumb} rounded-full bg-white shadow-sm
          transition-transform duration-200 ease-out
          ${currentSize.thumbTranslate}
        `}
      />
    </button>
  )

  // If no label, return just the toggle
  if (!label) {
    return <div className={className}>{toggle}</div>
  }

  // With label, return a flex container
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-text">{label}</p>
        {description && (
          <p className="text-sm text-text-muted">{description}</p>
        )}
      </div>
      {toggle}
    </div>
  )
}
