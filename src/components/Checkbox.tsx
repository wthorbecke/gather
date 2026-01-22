'use client'

interface CheckboxProps {
  checked: boolean
  onToggle: () => void
  size?: number
}

export function Checkbox({ checked, onToggle, size = 22 }: CheckboxProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={`flex-shrink-0 flex items-center justify-center rounded-full border-2 transition-all duration-200 ease-spring active:scale-[0.85] ${
        checked
          ? 'bg-success border-success'
          : 'bg-transparent border-border hover:border-text-muted'
      }`}
      style={{ width: size, height: size }}
      aria-checked={checked}
      role="checkbox"
    >
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 14 14"
        className={checked ? 'checkbox-checked' : ''}
      >
        <path
          d="M2.5 7L6 10.5L11.5 4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`checkbox-check ${checked ? 'text-white dark:text-[#0a0a0a]' : 'text-transparent'}`}
        />
      </svg>
    </button>
  )
}
