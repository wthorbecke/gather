'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { SavedLocation, formatLocationName, LocationTriggerType } from '@/lib/location'
import type { Task } from '@/hooks/useUserData'

interface LocationReminderToastProps {
  task: Task | null
  location: SavedLocation | null
  triggerType: LocationTriggerType | null
  onDismiss: () => void
  onGoToTask: (taskId: string) => void
}

/**
 * LocationReminderToast - Notification shown when a location trigger fires
 *
 * Displays a gentle reminder with the task and location context.
 * Auto-dismisses after 10 seconds or when user taps.
 */
export function LocationReminderToast({
  task,
  location,
  triggerType,
  onDismiss,
  onGoToTask,
}: LocationReminderToastProps) {
  const [isExiting, setIsExiting] = useState(false)
  const [progress, setProgress] = useState(100)
  const onDismissRef = useRef(onDismiss)

  // Keep ref up to date
  useEffect(() => {
    onDismissRef.current = onDismiss
  }, [onDismiss])

  const handleDismiss = useCallback(() => {
    setIsExiting(true)
    setTimeout(() => onDismissRef.current(), 150)
  }, [])

  const taskId = task?.id

  // Reset state when task changes
  useEffect(() => {
    if (taskId) {
      setIsExiting(false)
      setProgress(100)
    }
  }, [taskId])

  // Animate progress bar and auto-dismiss
  useEffect(() => {
    if (!taskId) return

    const duration = 10000 // 10 seconds
    const interval = 50
    const decrement = (interval / duration) * 100

    const timer = setInterval(() => {
      setProgress((prev) => {
        const next = prev - decrement
        if (next <= 0) {
          clearInterval(timer)
          handleDismiss()
          return 0
        }
        return next
      })
    }, interval)

    return () => clearInterval(timer)
  }, [taskId, handleDismiss])

  const handleGoToTask = () => {
    if (task) {
      setIsExiting(true)
      setTimeout(() => {
        onGoToTask(task.id)
        onDismiss()
      }, 150)
    }
  }

  if (!task || !location) return null

  const locationName = formatLocationName(location)
  const actionText = triggerType === LocationTriggerType.ARRIVING
    ? `You're near ${locationName}`
    : `Leaving ${locationName}`

  return (
    <div
      className={`
        fixed top-4 left-4 right-4 z-50
        max-w-md mx-auto
        bg-elevated border border-border
        rounded-2xl shadow-lg
        overflow-hidden
        ${isExiting ? 'animate-fade-out' : 'animate-rise'}
      `}
      role="alert"
      aria-live="polite"
    >
      {/* Progress bar */}
      <div
        className="h-1 bg-accent/30 transition-all duration-50 ease-linear"
        style={{ width: `${progress}%` }}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-accent mb-0.5">
              {actionText}
            </div>
            <div className="text-text font-semibold truncate">
              {task.title}
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="
              w-8 h-8 flex items-center justify-center
              text-text-muted hover:text-text
              rounded-full hover:bg-surface
              transition-colors duration-150
              flex-shrink-0
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

        {/* First step preview if available */}
        {task.steps && task.steps.length > 0 && !task.steps[0].done && (
          <div className="mb-3 p-3 bg-surface rounded-lg">
            <div className="text-xs text-text-muted mb-1">First step</div>
            <div className="text-sm text-text-soft truncate">
              {task.steps[0].text}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleGoToTask}
            className="
              flex-1 py-2.5 min-h-[44px]
              bg-accent text-white
              rounded-xl text-sm font-medium
              hover:bg-accent/90 transition-colors
              btn-press
            "
          >
            Open task
          </button>
          <button
            onClick={handleDismiss}
            className="
              px-4 py-2.5 min-h-[44px]
              bg-surface text-text-soft
              rounded-xl text-sm font-medium
              hover:bg-card-hover transition-colors
              btn-press
            "
          >
            Later
          </button>
        </div>
      </div>
    </div>
  )
}
