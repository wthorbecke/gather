'use client'

import { useState, useEffect, useRef } from 'react'
import { formatPoints } from '@/lib/pointsCalculator'

interface MomentumPointsProps {
  points: number
  onClick?: () => void
  showAnimation?: boolean
}

export function MomentumPoints({
  points,
  onClick,
  showAnimation = true,
}: MomentumPointsProps) {
  const [isPulsing, setIsPulsing] = useState(false)
  const prevPointsRef = useRef(points)

  // Trigger pulse animation when points change
  useEffect(() => {
    if (showAnimation && points > prevPointsRef.current) {
      setIsPulsing(true)
      const timer = setTimeout(() => setIsPulsing(false), 600)
      prevPointsRef.current = points
      return () => clearTimeout(timer)
    }
    prevPointsRef.current = points
  }, [points, showAnimation])

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-1.5 px-3 py-1.5
        rounded-full
        bg-[var(--surface)]
        border border-[var(--border)]
        transition-all duration-200
        hover:bg-[var(--subtle)] hover:scale-[1.02]
        active:scale-[0.98]
        focus:outline-none focus:ring-2 focus:ring-accent/50
        ${isPulsing ? 'animate-points-pulse ring-2 ring-[var(--success)]/50' : ''}
      `}
      aria-label={`${points} momentum points. Click to view rewards.`}
    >
      <span className="text-sm" role="img" aria-hidden="true">
        ✨
      </span>
      <span className={`
        text-sm font-semibold tabular-nums
        ${isPulsing ? 'text-[var(--success)]' : 'text-[var(--text)]'}
        transition-colors duration-200
      `}>
        {formatPoints(points)}
      </span>
      <span className="text-xs text-[var(--text-muted)]">pts</span>
    </button>
  )
}

// Floating points animation component
interface PointsFloatProps {
  amount: number
  x: number
  y: number
  onComplete: () => void
}

export function PointsFloat({ amount, x, y, onComplete }: PointsFloatProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div
      className="
        fixed pointer-events-none z-50
        animate-points-float
        text-lg font-bold text-[var(--success)]
        drop-shadow-md
      "
      style={{
        left: x,
        top: y,
        transform: 'translateX(-50%)',
      }}
    >
      +{amount}
    </div>
  )
}

// Level up celebration component
interface LevelUpCelebrationProps {
  level: number
  message: string
  onComplete: () => void
}

export function LevelUpCelebration({
  level,
  message,
  onComplete,
}: LevelUpCelebrationProps) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div
      className="
        fixed inset-x-0 top-20 z-50
        flex justify-center
        pointer-events-none
        animate-level-up-enter
      "
    >
      <div
        className="
          px-6 py-4 rounded-2xl
          bg-[var(--success)] text-white
          shadow-lg
          flex items-center gap-3
        "
      >
        <span className="text-3xl animate-bounce">🌱</span>
        <div>
          <div className="text-sm font-medium opacity-90">Level {level}</div>
          <div className="text-lg font-bold">{message}</div>
        </div>
      </div>
    </div>
  )
}
