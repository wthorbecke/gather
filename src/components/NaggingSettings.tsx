'use client'

import { useState, useCallback, useEffect } from 'react'
import { NAG_INTERVALS, NagInterval, NaggingPrefs, ESCALATION_LEVELS, getEscalationLevel, EscalationLevel } from '@/hooks/useNagging'
import { CloseButton } from './CloseButton'

interface NaggingSettingsProps {
  taskId: string
  prefs: NaggingPrefs | null
  hasPermission: boolean
  onRequestPermission: () => Promise<boolean>
  onSetNagging: (taskId: string, enabled: boolean, interval?: NagInterval) => void
  onSetInterval: (taskId: string, interval: NagInterval) => void
  onClose: () => void
}

// Get human-readable escalation level name
function getEscalationName(level: EscalationLevel): string {
  switch (level) {
    case ESCALATION_LEVELS.CRITICAL:
      return 'Maximum'
    case ESCALATION_LEVELS.URGENT:
      return 'High'
    case ESCALATION_LEVELS.PERSISTENT:
      return 'Medium'
    default:
      return 'Gentle'
  }
}

// Get escalation color
function getEscalationColor(level: EscalationLevel): string {
  switch (level) {
    case ESCALATION_LEVELS.CRITICAL:
      return 'text-warning'
    case ESCALATION_LEVELS.URGENT:
      return 'text-warning'
    case ESCALATION_LEVELS.PERSISTENT:
      return 'text-accent'
    default:
      return 'text-text-muted'
  }
}

/**
 * Modal for configuring nagging settings on a task.
 * "Nag me until done" - persistent reminders for ADHD brains.
 */
export function NaggingSettings({
  taskId,
  prefs,
  hasPermission,
  onRequestPermission,
  onSetNagging,
  onSetInterval,
  onClose,
}: NaggingSettingsProps) {
  const [enabled, setEnabled] = useState(prefs?.enabled ?? false)
  const [interval, setIntervalState] = useState<NagInterval>(prefs?.interval ?? NAG_INTERVALS.NORMAL)
  const [requestingPermission, setRequestingPermission] = useState(false)

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Calculate current escalation level
  const nagCount = prefs?.nagCount || 0
  const escalationLevel = getEscalationLevel(nagCount)
  const escalationName = getEscalationName(escalationLevel)
  const escalationColor = getEscalationColor(escalationLevel)

  // Handle enabling nagging - may need to request permission first
  const handleToggle = useCallback(async () => {
    const newEnabled = !enabled

    if (newEnabled && !hasPermission) {
      // Need to request permission first
      setRequestingPermission(true)
      const granted = await onRequestPermission()
      setRequestingPermission(false)

      if (!granted) {
        // Permission denied, don't enable
        return
      }
    }

    setEnabled(newEnabled)
    onSetNagging(taskId, newEnabled, interval)
  }, [enabled, hasPermission, onRequestPermission, onSetNagging, taskId, interval])

  // Handle interval change
  const handleIntervalChange = useCallback((newInterval: NagInterval) => {
    setIntervalState(newInterval)
    if (enabled) {
      onSetInterval(taskId, newInterval)
    }
  }, [enabled, onSetInterval, taskId])

  // Reset escalation (re-enable nagging to reset nag count)
  const handleResetEscalation = useCallback(() => {
    // Re-enable nagging to reset the count
    onSetNagging(taskId, true, interval)
  }, [onSetNagging, taskId, interval])

  const intervalOptions: { value: NagInterval; label: string; description: string }[] = [
    { value: NAG_INTERVALS.FREQUENT, label: 'Every minute', description: 'For urgent tasks' },
    { value: NAG_INTERVALS.NORMAL, label: 'Every 5 minutes', description: 'Recommended' },
    { value: NAG_INTERVALS.RELAXED, label: 'Every 15 minutes', description: 'Gentle nudges' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-backdrop-in" />

      {/* Modal */}
      <div className="relative z-10 bg-elevated border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm mx-0 sm:mx-4 shadow-modal animate-rise">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-text">Nag me until done</h3>
              <p className="text-sm text-text-muted">Persistent reminders that keep coming back</p>
            </div>
            <CloseButton onClick={onClose} className="-mr-2" />
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-text">Enable nagging</p>
              <p className="text-sm text-text-muted">Send me reminders until it&apos;s done</p>
            </div>
            <button
              onClick={handleToggle}
              disabled={requestingPermission}
              className={`
                relative w-14 h-8 rounded-full transition-colors duration-200
                ${enabled ? 'bg-accent' : 'bg-surface'}
                ${requestingPermission ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
              `}
              role="switch"
              aria-checked={enabled}
            >
              <span
                className={`
                  absolute top-1 w-6 h-6 rounded-full bg-white shadow-sm
                  transition-transform duration-200
                  ${enabled ? 'translate-x-7' : 'translate-x-1'}
                `}
              />
            </button>
          </div>

          {/* Permission warning */}
          {!hasPermission && (
            <div className="p-3 bg-warning-soft border border-warning/20 rounded-lg">
              <div className="flex gap-2">
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning flex-shrink-0 mt-0.5">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" />
                  <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-warning">Notifications required</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    We&apos;ll ask for permission when you enable nagging
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Interval selector - only show when enabled */}
          {enabled && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-text">Reminder frequency</p>
              <div className="space-y-2">
                {intervalOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleIntervalChange(option.value)}
                    className={`
                      w-full p-3 rounded-lg text-left
                      border transition-all duration-150
                      ${interval === option.value
                        ? 'border-accent bg-accent/5'
                        : 'border-border hover:border-accent/50 hover:bg-surface'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-medium ${interval === option.value ? 'text-accent' : 'text-text'}`}>
                          {option.label}
                        </p>
                        <p className="text-xs text-text-muted">{option.description}</p>
                      </div>
                      {interval === option.value && (
                        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Escalation status - only show when enabled and has been nagged */}
          {enabled && nagCount > 0 && (
            <div className="p-3 bg-surface rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-text">Escalation level</p>
                <span className={`text-sm font-medium ${escalationColor}`}>
                  {escalationName}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                {/* Progress dots showing escalation */}
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((level) => (
                    <div
                      key={level}
                      className={`
                        w-2 h-2 rounded-full transition-colors
                        ${level <= escalationLevel
                          ? level >= ESCALATION_LEVELS.URGENT
                            ? 'bg-warning'
                            : 'bg-accent'
                          : 'bg-border'
                        }
                      `}
                    />
                  ))}
                </div>
                <span className="text-xs text-text-muted">
                  {nagCount} reminder{nagCount !== 1 ? 's' : ''} sent
                </span>
              </div>
              <p className="text-xs text-text-muted mb-2">
                Reminders become more frequent and persistent over time to help you stay on track.
              </p>
              {escalationLevel > ESCALATION_LEVELS.GENTLE && (
                <button
                  onClick={handleResetEscalation}
                  className="text-xs text-accent hover:underline"
                >
                  Reset to gentle reminders
                </button>
              )}
            </div>
          )}

          {/* How it works */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-text-muted">
              When enabled, you&apos;ll get notifications at your chosen interval until the task is complete.
              Reminders gradually become more persistent if you keep snoozing. You can always snooze individual reminders.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="w-full py-3 bg-accent text-white font-medium rounded-xl hover:bg-accent/90 active:scale-[0.98] transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Compact toggle button for nagging - used in task menu
 */
interface NaggingToggleProps {
  enabled: boolean
  onClick: () => void
}

export function NaggingToggle({ enabled, onClick }: NaggingToggleProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full px-3 py-3 min-h-[44px] text-left text-sm
        hover:bg-subtle flex items-center gap-2.5
        transition-colors duration-150 ease-out
        ${enabled ? 'text-accent' : 'text-text'}
      `}
    >
      <svg
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill={enabled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        className={enabled ? 'text-accent' : 'text-text-muted'}
      >
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {enabled ? 'Nagging enabled' : 'Nag me until done'}
    </button>
  )
}
