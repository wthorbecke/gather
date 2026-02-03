'use client'

import { EnergyLevel } from '@/lib/constants'

interface EnergyBadgeProps {
  energy: EnergyLevel
  size?: 'sm' | 'md'
  showLabel?: boolean
}

// Energy level configuration
const energyConfig = {
  [EnergyLevel.LOW]: {
    label: 'Low energy',
    shortLabel: 'Low',
    icon: '🌿', // Calm, easy
    bgClass: 'bg-success/10',
    textClass: 'text-success',
    borderClass: 'border-success/30',
  },
  [EnergyLevel.MEDIUM]: {
    label: 'Medium energy',
    shortLabel: 'Med',
    icon: '⚡',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-500/30',
  },
  [EnergyLevel.HIGH]: {
    label: 'High energy',
    shortLabel: 'High',
    icon: '🔥',
    bgClass: 'bg-accent/10',
    textClass: 'text-accent',
    borderClass: 'border-accent/30',
  },
}

export function EnergyBadge({ energy, size = 'sm', showLabel = false }: EnergyBadgeProps) {
  const config = energyConfig[energy]
  if (!config) return null

  const sizeClasses = size === 'sm'
    ? 'text-xs px-1.5 py-0.5 gap-0.5'
    : 'text-sm px-2 py-1 gap-1'

  return (
    <span
      className={`
        inline-flex items-center rounded
        border ${config.bgClass} ${config.borderClass} ${config.textClass}
        ${sizeClasses}
      `}
      title={config.label}
    >
      <span className={size === 'sm' ? 'text-[10px]' : 'text-xs'}>{config.icon}</span>
      {showLabel && <span className="font-medium">{config.shortLabel}</span>}
    </span>
  )
}

// Helper component for setting energy level (used in task view)
interface EnergyPickerProps {
  value: EnergyLevel | null | undefined
  onChange: (energy: EnergyLevel | null) => void
}

export function EnergyPicker({ value, onChange }: EnergyPickerProps) {
  const options = [
    { value: null, label: 'No energy set' },
    { value: EnergyLevel.LOW, ...energyConfig[EnergyLevel.LOW] },
    { value: EnergyLevel.MEDIUM, ...energyConfig[EnergyLevel.MEDIUM] },
    { value: EnergyLevel.HIGH, ...energyConfig[EnergyLevel.HIGH] },
  ]

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value ?? 'none'}
          onClick={() => onChange(option.value)}
          className={`
            px-3 py-2 rounded-lg text-sm font-medium
            border transition-all duration-150
            ${value === option.value
              ? option.value
                ? `${energyConfig[option.value].bgClass} ${energyConfig[option.value].borderClass} ${energyConfig[option.value].textClass}`
                : 'bg-text text-canvas border-text'
              : 'bg-surface border-border text-text-soft hover:bg-card-hover hover:text-text'
            }
          `}
        >
          {option.value ? (
            <span className="flex items-center gap-1.5">
              <span>{energyConfig[option.value].icon}</span>
              <span>{energyConfig[option.value].shortLabel}</span>
            </span>
          ) : (
            'None'
          )}
        </button>
      ))}
    </div>
  )
}
