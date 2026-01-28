'use client'

import { useState } from 'react'

interface SnoozeMenuProps {
  onSnooze: (date: string) => void
  onCancel: () => void
}

/**
 * Menu for snoozing a task to a later date
 */
export function SnoozeMenu({ onSnooze, onCancel }: SnoozeMenuProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customDate, setCustomDate] = useState('')

  const getDateString = (daysFromNow: number): string => {
    const date = new Date()
    date.setDate(date.getDate() + daysFromNow)
    return date.toISOString().split('T')[0]
  }

  const formatDate = (daysFromNow: number): string => {
    const date = new Date()
    date.setDate(date.getDate() + daysFromNow)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const snoozeOptions = [
    { label: 'Tomorrow', days: 1 },
    { label: 'In 3 days', days: 3 },
    { label: 'Next week', days: 7 },
    { label: 'In 2 weeks', days: 14 },
    { label: 'Next month', days: 30 },
  ]

  const handleCustomSnooze = () => {
    if (customDate) {
      onSnooze(customDate)
    }
  }

  // Get minimum date (tomorrow)
  const minDate = getDateString(1)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Menu */}
      <div className="relative bg-elevated rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-4 animate-rise">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-text">Snooze until...</h3>
          <p className="text-sm text-text-muted mt-1">
            No guilt. Come back when you're ready.
          </p>
        </div>

        {!showCustom ? (
          <>
            <div className="space-y-2">
              {snoozeOptions.map((option) => (
                <button
                  key={option.days}
                  onClick={() => onSnooze(getDateString(option.days))}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-surface hover:bg-surface/80 transition-all btn-press"
                >
                  <span className="font-medium text-text">{option.label}</span>
                  <span className="text-sm text-text-muted">{formatDate(option.days)}</span>
                </button>
              ))}

              <button
                onClick={() => setShowCustom(true)}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-border hover:border-accent hover:text-accent transition-all"
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Pick a date</span>
              </button>
            </div>

            <button
              onClick={onCancel}
              className="w-full mt-4 p-3 text-text-muted hover:text-text transition-colors"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <input
                type="date"
                min={minDate}
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="w-full p-3 rounded-xl bg-surface border border-border text-text focus:border-accent focus:outline-none"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setShowCustom(false)}
                  className="flex-1 p-3 rounded-xl border border-border text-text-soft hover:bg-surface transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleCustomSnooze}
                  disabled={!customDate}
                  className="flex-1 p-3 rounded-xl bg-accent text-white font-medium hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Snooze
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
