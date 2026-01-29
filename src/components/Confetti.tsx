'use client'

import { useEffect, useState } from 'react'

// Add the completion pop animation
const completionPopKeyframes = `
@keyframes completionPop {
  0% { opacity: 0; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 1; transform: scale(1); }
}
`

// Inject keyframes once
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = completionPopKeyframes
  document.head.appendChild(style)
}

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

// Brief, unexpected affirmations - matches StackView tone
const COMPLETION_WORDS = ['done', 'finished', 'cleared', 'complete', '✓']

interface CompletionCelebrationProps {
  taskName: string | null
  onDismiss?: () => void
}

export function CompletionCelebration({ taskName, onDismiss }: CompletionCelebrationProps) {
  const [word] = useState(() => COMPLETION_WORDS[Math.floor(Math.random() * COMPLETION_WORDS.length)])

  useEffect(() => {
    if (taskName) {
      const timer = setTimeout(() => {
        onDismiss?.()
      }, 2000) // Shorter - don't overstay
      return () => clearTimeout(timer)
    }
  }, [taskName, onDismiss])

  if (!taskName) return null

  // Minimal, restrained celebration - just the word and task name
  // Let the confetti do the celebrating, not the copy
  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] pointer-events-none">
      <div
        className="text-center animate-fade-in"
        style={{ animation: 'completionPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
      >
        <p
          className="text-4xl font-semibold text-success mb-2"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {word}
        </p>
        <p className="text-base text-text-soft max-w-[200px] truncate">{taskName}</p>
      </div>
    </div>
  )
}
