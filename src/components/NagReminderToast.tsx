'use client'

import { useState, useEffect } from 'react'
import { Task } from '@/hooks/useUserData'
import { NaggingPrefs, NAG_INTERVALS, EscalationLevel, ESCALATION_LEVELS } from '@/hooks/useNagging'

interface NagReminderToastProps {
  task: Task
  prefs: NaggingPrefs
  escalationLevel?: EscalationLevel
  onSnooze: (minutes: number) => void
  onDismiss: () => void
  onGoToTask: () => void
  onComplete?: () => void
}

// Get escalation-aware header message (non-judgmental per CLAUDE.md)
function getHeaderMessage(escalationLevel: EscalationLevel, nagCount: number): string {
  switch (escalationLevel) {
    case ESCALATION_LEVELS.CRITICAL:
      return `This one really needs your attention`
    case ESCALATION_LEVELS.URGENT:
      return `This keeps coming back (${nagCount}x)`
    case ESCALATION_LEVELS.PERSISTENT:
      return `Still here, still waiting`
    default:
      return `Hey, this one's still waiting`
  }
}

// Get a helpful suggestion based on escalation level
function getHelpfulSuggestion(escalationLevel: EscalationLevel): string | null {
  switch (escalationLevel) {
    case ESCALATION_LEVELS.CRITICAL:
      return 'Maybe this needs to be broken down smaller?'
    case ESCALATION_LEVELS.URGENT:
      return 'Could something else be done first?'
    default:
      return null
  }
}

/**
 * Toast notification for persistent nagging - appears when a nagged task
 * needs attention. Designed to be persistent but not annoying.
 * Escalates in intensity over time while remaining compassionate.
 */
export function NagReminderToast({
  task,
  prefs,
  escalationLevel = ESCALATION_LEVELS.GENTLE,
  onSnooze,
  onDismiss,
  onGoToTask,
  onComplete,
}: NagReminderToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true))
  }, [])

  // Handle close with animation
  const handleClose = (callback?: () => void) => {
    setIsClosing(true)
    setTimeout(() => {
      callback?.()
      onDismiss()
    }, 200)
  }

  // Get the next step text
  const steps = task.steps || []
  const nextStep = steps.find(s => !s.done)
  const doneCount = steps.filter(s => s.done).length

  // Progress indicator
  const progress = steps.length > 0 ? (doneCount / steps.length) * 100 : 0

  // Escalation-aware messaging
  const nagCount = prefs.nagCount || 1
  const headerMessage = getHeaderMessage(escalationLevel, nagCount)
  const helpfulSuggestion = getHelpfulSuggestion(escalationLevel)

  // Visual intensity based on escalation (subtle changes, not aggressive)
  const accentBarHeight = escalationLevel >= ESCALATION_LEVELS.URGENT ? 'h-1.5' : 'h-1'
  const accentBarColor = escalationLevel >= ESCALATION_LEVELS.CRITICAL
    ? 'bg-amber-500'
    : escalationLevel >= ESCALATION_LEVELS.URGENT
      ? 'bg-accent'
      : 'bg-accent'

  return (
    <div
      className={`
        fixed bottom-24 left-4 right-4 sm:left-auto sm:right-6 sm:w-[380px]
        z-50 bg-elevated border border-border rounded-2xl shadow-modal
        overflow-hidden
        transition-all duration-200 ease-out
        ${isVisible && !isClosing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
      role="alertdialog"
      aria-labelledby="nag-title"
      aria-describedby="nag-description"
    >
      {/* Accent bar at top - slightly taller for higher escalation */}
      <div className={`${accentBarHeight} ${accentBarColor}`} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`
            flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
            ${escalationLevel >= ESCALATION_LEVELS.CRITICAL ? 'bg-amber-500/10' : 'bg-accent/10'}
          `}>
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={escalationLevel >= ESCALATION_LEVELS.CRITICAL ? 'text-amber-500' : 'text-accent'}
            >
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
              {/* Add extra lines for higher escalation to indicate ringing */}
              {escalationLevel >= ESCALATION_LEVELS.PERSISTENT && (
                <>
                  <path d="M1 8c0-1.5.5-3 1.5-4" strokeLinecap="round" />
                  <path d="M23 8c0-1.5-.5-3-1.5-4" strokeLinecap="round" />
                </>
              )}
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className={`
              text-xs font-medium mb-1
              ${escalationLevel >= ESCALATION_LEVELS.CRITICAL ? 'text-amber-500' : 'text-accent'}
            `}>
              {headerMessage}
            </p>
            <h3 id="nag-title" className="text-base font-semibold text-text truncate">{task.title}</h3>
          </div>
          <button
            onClick={() => handleClose()}
            className="flex-shrink-0 p-2 -m-2 rounded-md text-text-muted hover:text-text hover:bg-surface transition-colors"
            aria-label="Dismiss reminder"
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Helpful suggestion for high escalation */}
        {helpfulSuggestion && (
          <div className="mb-3 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
            <p className="text-xs text-amber-700 dark:text-amber-300">{helpfulSuggestion}</p>
          </div>
        )}

        {/* Next step preview */}
        {nextStep && (
          <div id="nag-description" className="mb-4 p-3 bg-surface rounded-lg">
            <p className="text-xs text-text-muted mb-1">Next step:</p>
            <p className="text-sm text-text leading-relaxed">{nextStep.text}</p>
          </div>
        )}

        {/* Progress bar */}
        {steps.length > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs text-text-muted mb-1">
              <span>Progress</span>
              <span>{doneCount}/{steps.length} steps</span>
            </div>
            <div className="h-1.5 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => handleClose(onGoToTask)}
            className={`
              flex-1 py-3 px-4 rounded-xl
              font-medium text-sm
              active:scale-[0.98]
              transition-all duration-150
              ${escalationLevel >= ESCALATION_LEVELS.CRITICAL
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-accent text-white hover:bg-accent/90'
              }
            `}
          >
            Work on it
          </button>
          {onComplete && (
            <button
              onClick={() => handleClose(onComplete)}
              className="
                py-3 px-4 rounded-xl
                bg-success/10 text-success font-medium text-sm
                hover:bg-success/20
                active:scale-[0.98]
                transition-all duration-150
              "
            >
              Done
            </button>
          )}
        </div>

        {/* Snooze options */}
        <div className="flex gap-2">
          <button
            onClick={() => handleClose(() => onSnooze(5))}
            className="
              flex-1 py-2.5 px-3 rounded-lg
              bg-surface text-text-soft text-sm
              hover:bg-card-hover
              transition-colors
            "
          >
            5 min
          </button>
          <button
            onClick={() => handleClose(() => onSnooze(15))}
            className="
              flex-1 py-2.5 px-3 rounded-lg
              bg-surface text-text-soft text-sm
              hover:bg-card-hover
              transition-colors
            "
          >
            15 min
          </button>
          <button
            onClick={() => handleClose(() => onSnooze(60))}
            className="
              flex-1 py-2.5 px-3 rounded-lg
              bg-surface text-text-soft text-sm
              hover:bg-card-hover
              transition-colors
            "
          >
            1 hour
          </button>
        </div>

        {/* Footer info */}
        <div className="text-xs text-text-muted text-center mt-3 space-y-0.5">
          <p>
            Reminding every {prefs.interval === NAG_INTERVALS.FREQUENT ? 'minute' : `${prefs.interval} minutes`}
          </p>
          {nagCount > 1 && (
            <p className="text-text-muted/70">
              Reminder #{nagCount}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
