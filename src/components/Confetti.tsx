'use client'

import { useEffect, useState } from 'react'

const CONFETTI_COLORS = ['#E07A5F', '#6B9080', '#F4D35E', '#EE6C4D', '#98C1D9', '#81B29A']
const PIECE_COUNT = 50

interface ConfettiPiece {
  id: number
  left: number
  size: number
  color: string
  isCircle: boolean
  duration: number
  delay: number
}

interface ConfettiProps {
  active: boolean
  onComplete?: () => void
}

export function Confetti({ active, onComplete }: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])

  useEffect(() => {
    if (active) {
      const newPieces: ConfettiPiece[] = Array.from({ length: PIECE_COUNT }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: Math.random() * 10 + 6,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        isCircle: Math.random() > 0.5,
        duration: Math.random() * 2 + 2,
        delay: Math.random() * 0.5,
      }))
      setPieces(newPieces)

      // Clean up after animation completes
      const maxDuration = Math.max(...newPieces.map(p => p.duration + p.delay))
      const timer = setTimeout(() => {
        setPieces([])
        onComplete?.()
      }, maxDuration * 1000)

      return () => clearTimeout(timer)
    } else {
      setPieces([])
    }
  }, [active, onComplete])

  if (pieces.length === 0) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {pieces.map((piece) => (
        <div
          key={piece.id}
          className="absolute confetti-piece"
          style={{
            left: `${piece.left}%`,
            top: -20,
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
            borderRadius: piece.isCircle ? '50%' : '2px',
            '--fall-duration': `${piece.duration}s`,
            '--fall-delay': `${piece.delay}s`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}

interface CompletionCelebrationProps {
  taskName: string | null
  onDismiss?: () => void
}

export function CompletionCelebration({ taskName, onDismiss }: CompletionCelebrationProps) {
  useEffect(() => {
    if (taskName) {
      const timer = setTimeout(() => {
        onDismiss?.()
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [taskName, onDismiss])

  if (!taskName) return null

  return (
    <div className="fixed top-1/2 left-1/2 z-[101] pointer-events-none animate-celebrate">
      <div className="bg-elevated p-6 px-10 rounded-2xl shadow-modal border border-border text-center">
        <div className="text-5xl mb-3">🎉</div>
        <p className="text-sm text-text-muted mb-1">You finished</p>
        <p className="text-xl font-semibold text-text">{taskName}</p>
        <p className="text-sm text-success mt-2">Nice work!</p>
      </div>
    </div>
  )
}
