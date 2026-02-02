'use client'

import { useEffect, useState } from 'react'
import type { UndoAction } from '@/hooks/useUndo'

interface UndoToastProps {
  action: UndoAction | null
  onUndo: () => void
  onDismiss: () => void
}

/**
 * Toast notification with undo button
 *
 * Appears at the bottom of the screen when an undoable action occurs.
 * Auto-dismisses after 5 seconds or when user taps undo/dismiss.
 */
export function UndoToast({ action, onUndo, onDismiss }: UndoToastProps) {
  const [isExiting, setIsExiting] = useState(false)
  const [progress, setProgress] = useState(100)

  const actionId = action?.id

  // Reset state when action changes
  useEffect(() => {
    if (actionId) {
      setIsExiting(false)
      setProgress(100)
    }
  }, [actionId])

  // Animate progress bar
  useEffect(() => {
    if (!actionId) return

    const duration = 5000 // 5 seconds
    const interval = 50 // Update every 50ms
    const decrement = (interval / duration) * 100

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - decrement
        if (next <= 0) {
          clearInterval(timer)
          return 0
        }
        return next
      })
    }, interval)

    return () => clearInterval(timer)
  }, [actionId])

  const handleDismiss = () => {
    setIsExiting(true)
    setTimeout(onDismiss, 150)
  }

  const handleUndo = () => {
    setIsExiting(true)
    setTimeout(onUndo, 150)
  }

  if (!action) return null

  return (
    <div
      className={`
        fixed bottom-20 left-4 right-4 z-50
        max-w-md mx-auto
        bg-text text-canvas
        rounded-lg shadow-lg
        overflow-hidden
        ${isExiting ? 'animate-fade-out' : 'animate-fade-in'}
      `}
      role="alert"
      aria-live="polite"
    >
      {/* Progress bar */}
      <div
        className="h-0.5 bg-canvas/30 transition-all duration-50 ease-linear"
        style={{ width: `${progress}%` }}
      />

      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="text-sm flex-1 truncate">{action.description}</span>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleUndo}
            className="
              px-3 py-1.5
              text-sm font-medium
              text-accent
              hover:bg-canvas/10
              rounded-md
              transition-colors duration-150
              btn-press
            "
          >
            Undo
          </button>

          <button
            onClick={handleDismiss}
            className="
              w-8 h-8
              flex items-center justify-center
              text-canvas/60 hover:text-canvas
              rounded-full
              hover:bg-canvas/10
              transition-colors duration-150
            "
            aria-label="Dismiss"
          >
            <svg width={14} height={14} viewBox="0 0 16 16">
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
