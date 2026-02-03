'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { type GardenStage } from '@/lib/pointsCalculator'

interface ProgressGardenProps {
  stage: GardenStage
  level: number
  progress: number // 0-100 progress to next level
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
}

// Hook to detect reduced motion preference
function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}

// Sparkle component for occasional particle effects
interface SparkleProps {
  x: number
  y: number
  size: number
  delay: number
}

function Sparkle({ x, y, size, delay }: SparkleProps) {
  return (
    <span
      className="absolute pointer-events-none animate-garden-sparkle"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        fontSize: `${size}px`,
        animationDelay: `${delay}ms`,
      }}
      aria-hidden="true"
    >
      ✨
    </span>
  )
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
  const prefersReducedMotion = usePrefersReducedMotion()
  const [sparkles, setSparkles] = useState<SparkleProps[]>([])
  const [isHovering, setIsHovering] = useState(false)

  // Generate occasional sparkles when idle (not hovering/interacting)
  useEffect(() => {
    if (prefersReducedMotion || isHovering) return

    const interval = setInterval(() => {
      // 25% chance to spawn a sparkle every 4 seconds
      if (Math.random() > 0.75) {
        const newSparkle: SparkleProps = {
          x: 20 + Math.random() * 60, // Keep sparkles within center area
          y: 10 + Math.random() * 50,
          size: 8 + Math.random() * 6,
          delay: 0,
        }
        setSparkles(prev => [...prev, newSparkle])

        // Remove sparkle after animation completes
        setTimeout(() => {
          setSparkles(prev => prev.slice(1))
        }, 1200)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [prefersReducedMotion, isHovering])

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

  const handleMouseEnter = useCallback(() => setIsHovering(true), [])
  const handleMouseLeave = useCallback(() => setIsHovering(false), [])

  return (
    <button
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`
        relative ${sizeClasses.container}
        flex items-center justify-center
        rounded-full
        transition-transform duration-200
        hover:scale-105 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-offset-2
        ${!prefersReducedMotion ? 'animate-garden-breathe' : ''}
      `}
      aria-label={`${visual.label} - Level ${level}, ${progress}% to next level`}
    >
      {/* Progress ring with subtle glow animation */}
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
        {/* Progress ring with glow */}
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
          className={`transition-all duration-500 ease-out ${!prefersReducedMotion ? 'animate-garden-ring-glow' : ''}`}
        />
      </svg>

      {/* Sparkle particles */}
      {!prefersReducedMotion && sparkles.map((sparkle, i) => (
        <Sparkle key={`sparkle-${i}-${sparkle.x}-${sparkle.y}`} {...sparkle} />
      ))}

      {/* Garden emoji with idle animation */}
      <span
        className={`
          ${sizeClasses.emoji}
          select-none
          ${!prefersReducedMotion ? 'animate-garden-sway' : ''}
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
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-3 py-1.5
        rounded-full
        bg-[var(--surface)]
        border border-[var(--border)]
        transition-all duration-200
        hover:bg-[var(--subtle)] hover:scale-[1.02]
        active:scale-[0.98]
        focus:outline-none focus:ring-2 focus:ring-accent/50
        ${!prefersReducedMotion ? 'animate-garden-breathe-subtle' : ''}
      `}
      aria-label={`${visual.label} - Level ${level}`}
    >
      <span
        className={`text-lg ${!prefersReducedMotion ? 'animate-garden-sway' : ''}`}
        role="img"
        aria-hidden="true"
      >
        {visual.emoji}
      </span>
      <span className="text-xs font-medium text-[var(--text-soft)]">
        Lvl {level}
      </span>
      {/* Mini progress bar */}
      <div className="w-8 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
        <div
          className={`h-full bg-[var(--success)] rounded-full transition-all duration-300 ${!prefersReducedMotion ? 'animate-garden-progress-shimmer' : ''}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </button>
  )
}
