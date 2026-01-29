'use client'

import { useState, useEffect, useRef, memo } from 'react'
import { hapticLight } from '@/lib/haptics'

interface CheckboxProps {
  checked: boolean
  onToggle: () => void
  size?: number
}

export const Checkbox = memo(function Checkbox({ checked, onToggle, size = 22 }: CheckboxProps) {
  const padding = Math.max((44 - size) / 2, 0)
  const [isHovered, setIsHovered] = useState(false)
  const [justChecked, setJustChecked] = useState(false)
  const prevCheckedRef = useRef(checked)

  // Detect when going from unchecked to checked
  useEffect(() => {
    if (!prevCheckedRef.current && checked) {
      setJustChecked(true)
      hapticLight() // Haptic feedback on completion
      const timer = setTimeout(() => setJustChecked(false), 600)
      return () => clearTimeout(timer)
    }
    prevCheckedRef.current = checked
  }, [checked])

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex-shrink-0 flex items-center justify-center rounded-full btn-press group"
      style={{ padding, margin: -padding }}
      aria-checked={checked}
      role="checkbox"
    >
      <span
        className={`
          relative flex items-center justify-center rounded-full border-2
          transition-all duration-200 ease-out
          ${checked
            ? 'bg-success border-success scale-100'
            : 'bg-transparent border-border group-hover:border-success/50 group-hover:scale-105'
          }
          ${justChecked ? 'animate-check-pop' : ''}
        `}
        style={{ width: size, height: size }}
      >
        {/* Hover glow ring - only when unchecked */}
        {!checked && (
          <span
            className={`
              absolute inset-[-4px] rounded-full
              bg-success/10
              transition-all duration-200 ease-out
              ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
            `}
          />
        )}

        {/* Success burst - plays on check */}
        {justChecked && (
          <span className="absolute inset-[-8px] rounded-full bg-success/20 animate-check-burst" />
        )}

        <svg
          width={size * 0.5}
          height={size * 0.5}
          viewBox="0 0 14 14"
          className={`relative z-10 ${checked ? 'checkbox-checked' : ''}`}
        >
          <path
            d="M2.5 7L6 10.5L11.5 4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`checkbox-check ${checked ? 'text-white dark:text-[#0a0a0a]' : 'text-transparent'}`}
          />
        </svg>
      </span>
    </button>
  )
})
