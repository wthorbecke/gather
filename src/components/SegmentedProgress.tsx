'use client'

import { useState, useEffect, useRef } from 'react'

interface SegmentedProgressProps {
  completed: number
  total: number
  height?: number
}

export function SegmentedProgress({ completed, total, height = 4 }: SegmentedProgressProps) {
  const prevCompleted = useRef(completed)
  const [justFilledIndex, setJustFilledIndex] = useState<number | null>(null)

  // Detect when a new segment fills
  useEffect(() => {
    if (completed > prevCompleted.current) {
      // A new segment was just filled
      setJustFilledIndex(completed - 1)
      const timer = setTimeout(() => setJustFilledIndex(null), 600)
      prevCompleted.current = completed
      return () => clearTimeout(timer)
    }
    prevCompleted.current = completed
  }, [completed])

  if (total === 0) return null

  return (
    <div className="flex gap-[3px]" style={{ height }}>
      {Array.from({ length: total }).map((_, i) => {
        const isFilled = i < completed
        const justFilled = i === justFilledIndex

        return (
          <div
            key={i}
            className={`flex-1 rounded-sm progress-segment relative overflow-hidden ${
              isFilled ? 'bg-success' : 'bg-border'
            }`}
            style={{
              transitionDelay: `${i * 30}ms`,
              boxShadow: justFilled ? '0 0 8px var(--success), 0 0 4px var(--success)' : 'none',
              transition: 'background-color 0.2s ease-out, box-shadow 0.3s ease-out',
            }}
          >
            {/* Subtle pulse on fill */}
            {justFilled && (
              <div
                className="absolute inset-0 bg-success"
                style={{
                  animation: 'segmentPulse 0.6s ease-out forwards',
                }}
              />
            )}
          </div>
        )
      })}
      <style jsx>{`
        @keyframes segmentPulse {
          0% { opacity: 1; transform: scaleX(1); }
          50% { opacity: 0.8; transform: scaleX(1.1); }
          100% { opacity: 1; transform: scaleX(1); }
        }
      `}</style>
    </div>
  )
}
