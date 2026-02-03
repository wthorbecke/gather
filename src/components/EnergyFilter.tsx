'use client'

import { memo } from 'react'
import { EnergyLevel } from '@/lib/constants'

export type EnergyFilterValue = EnergyLevel | 'all'

interface EnergyFilterProps {
  value: EnergyFilterValue
  onChange: (value: EnergyFilterValue) => void
}

const filterOptions: { value: EnergyFilterValue; label: string; icon?: string }[] = [
  { value: 'all', label: 'All' },
  { value: EnergyLevel.HIGH, label: 'High', icon: '\uD83D\uDD0B' },
  { value: EnergyLevel.MEDIUM, label: 'Medium', icon: '\u26A1' },
  { value: EnergyLevel.LOW, label: 'Low', icon: '\uD83E\uDEAB' },
]

/**
 * Quick filter buttons for filtering tasks by energy level.
 * Displays pill-style buttons: All, High, Medium, Low
 */
export const EnergyFilter = memo(function EnergyFilter({ value, onChange }: EnergyFilterProps) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto scrollbar-hide"
      role="radiogroup"
      aria-label="Filter tasks by energy level"
    >
      {filterOptions.map((option) => {
        const isSelected = value === option.value
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            role="radio"
            aria-checked={isSelected}
            data-testid={`energy-filter-${option.value}`}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium
              whitespace-nowrap flex-shrink-0
              transition-all duration-200 ease-out
              ${isSelected
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'bg-[var(--surface)] text-[var(--text-soft)] hover:text-[var(--text)] hover:bg-[var(--card-hover)]'
              }
            `}
          >
            {option.icon && <span className="mr-1">{option.icon}</span>}
            {option.label}
          </button>
        )
      })}
    </div>
  )
})
