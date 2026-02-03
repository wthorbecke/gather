'use client'

import { useMemo } from 'react'
import { type GardenStage } from '@/lib/pointsCalculator'

interface ProgressGardenProps {
  stage: GardenStage
  level: number
  progress: number // 0-100 progress to next level
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
}

// Garden visuals for each stage
const GARDEN_VISUALS: Record<GardenStage, { emoji: string; label: string }> = {
  'seed': { emoji: '🌰', label: 'Seed' },
  'sprout': { emoji: '🌱', label: 'Sprout' },
  'seedling': { emoji: '🌿', label: 'Seedling' },
  'small-plant': { emoji: '🪴', label: 'Small Plant' },
  'growing': { emoji: '🌾', label: 'Growing' },
  'budding': { emoji: '🌷', label: 'Budding' },
  'blooming': { emoji: '🌸', label: 'Blooming' },
  'flowering': { emoji: '🌺', label: 'Flowering' },
  'flourishing': { emoji: '🌻', label: 'Flourishing' },
  'full-garden': { emoji: '🏡', label: 'Full Garden' },
}

export function ProgressGarden({
  stage,
  level,
  progress,
  onClick,
  size = 'md',
}: ProgressGardenProps) {
  const visual = GARDEN_VISUALS[stage]

  const sizeClasses = useMemo(() => {
    switch (size) {
      case 'sm':
        return {
          container: 'w-12 h-12',
          emoji: 'text-xl',
          ring: 'w-12 h-12',
        }
      case 'lg':
        return {
          container: 'w-20 h-20',
          emoji: 'text-4xl',
          ring: 'w-20 h-20',
        }
      default:
        return {
          container: 'w-16 h-16',
          emoji: 'text-3xl',
          ring: 'w-16 h-16',
        }
    }
  }, [size])

  // Calculate stroke dasharray for progress ring
  const circumference = 2 * Math.PI * 45 // radius = 45
  const strokeDashoffset = circumference - (progress / 100) * circumference

  return (
    <button
      onClick={onClick}
      className={`
        relative ${sizeClasses.container}
        flex items-center justify-center
        rounded-full
        transition-transform duration-200
        hover:scale-105 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2
      `}
      aria-label={`${visual.label} - Level ${level}, ${progress}% to next level`}
    >
      {/* Progress ring */}
      <svg
        className={`absolute inset-0 ${sizeClasses.ring} -rotate-90`}
        viewBox="0 0 100 100"
      >
        {/* Background ring */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="var(--border)"
          strokeWidth="6"
        />
        {/* Progress ring */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="var(--success)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500 ease-out"
        />
      </svg>

      {/* Garden emoji with idle animation */}
      <span
        className={`
          ${sizeClasses.emoji}
          animate-garden-sway
          select-none
        `}
        role="img"
        aria-hidden="true"
      >
        {visual.emoji}
      </span>

      {/* Level badge */}
      <span
        className="
          absolute -bottom-1 -right-1
          w-5 h-5 rounded-full
          bg-[var(--accent)] text-white
          text-[10px] font-bold
          flex items-center justify-center
          shadow-sm
        "
      >
        {level}
      </span>
    </button>
  )
}

// Compact inline version for headers
export function ProgressGardenInline({
  stage,
  level,
  progress,
  onClick,
}: Omit<ProgressGardenProps, 'size'>) {
  const visual = GARDEN_VISUALS[stage]

  return (
    <button
      onClick={onClick}
      className="
        flex items-center gap-2 px-3 py-1.5
        rounded-full
        bg-[var(--surface)]
        border border-[var(--border)]
        transition-all duration-200
        hover:bg-[var(--subtle)] hover:scale-[1.02]
        active:scale-[0.98]
        focus:outline-none focus:ring-2 focus:ring-accent/50
      "
      aria-label={`${visual.label} - Level ${level}`}
    >
      <span className="text-lg animate-garden-sway" role="img" aria-hidden="true">
        {visual.emoji}
      </span>
      <span className="text-xs font-medium text-[var(--text-soft)]">
        Lvl {level}
      </span>
      {/* Mini progress bar */}
      <div className="w-8 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
        <div
          className="h-full bg-[var(--success)] rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </button>
  )
}
