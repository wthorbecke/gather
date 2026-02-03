'use client'

import { useState, useMemo } from 'react'

interface SnoozeMenuProps {
  onSnooze: (date: string) => void
  onCancel: () => void
}

/**
 * Menu for snoozing a task to a later date or time
 */
export function SnoozeMenu({ onSnooze, onCancel }: SnoozeMenuProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customDate, setCustomDate] = useState('')

  const getDateString = (daysFromNow: number): string => {
    const date = new Date()
    date.setDate(date.getDate() + daysFromNow)
    return date.toISOString().split('T')[0]
  }

  const getDateTimeString = (hoursFromNow: number): string => {
    const date = new Date()
    date.setHours(date.getHours() + hoursFromNow)
    return date.toISOString()
  }

  const formatDate = (daysFromNow: number): string => {
    const date = new Date()
    date.setDate(date.getDate() + daysFromNow)
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  const formatTime = (hoursFromNow: number): string => {
    const date = new Date()
    date.setHours(date.getHours() + hoursFromNow)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  // Calculate quick snooze options based on current time
  const quickOptions = useMemo(() => {
    const now = new Date()
    const currentHour = now.getHours()
    const options: { label: string; datetime: string; time: string; isToday: boolean }[] = []

    // "Later today" options (before 9 PM)
    if (currentHour < 21) {
      // In 1 hour
      options.push({
        label: 'In 1 hour',
        datetime: getDateTimeString(1),
        time: formatTime(1),
        isToday: true
      })

      // In 2 hours (if before 8 PM)
      if (currentHour < 20) {
        options.push({
          label: 'In 2 hours',
          datetime: getDateTimeString(2),
          time: formatTime(2),
          isToday: true
        })
      }
    }

    // "Tomorrow morning" (9 AM) - always show as a quick option
    const tomorrowMorning = new Date()
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1)
    tomorrowMorning.setHours(9, 0, 0, 0)
    options.push({
      label: 'Tomorrow morning',
      datetime: tomorrowMorning.toISOString(),
      time: '9:00 AM',
      isToday: false
    })

    return options
  }, [])

  const hasTodayOptions = quickOptions.some(o => o.isToday)

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

  const minDate = getDateString(1)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-backdrop-in"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Menu */}
      <div className="relative z-10 bg-elevated border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-4 shadow-modal animate-rise">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-text">Snooze until...</h3>
          <p className="text-sm text-text-muted mt-1">
            No guilt. Come back when you&apos;re ready.
          </p>
        </div>

        {!showCustom ? (
          <>
            <div className="space-y-2">
              {/* Quick options (today + tomorrow morning) */}
              {quickOptions.length > 0 && (
                <>
                  {hasTodayOptions && (
                    <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
                      Later today
                    </div>
                  )}
                  {quickOptions.filter(o => o.isToday).map((option) => (
                    <button
                      key={option.label}
                      onClick={() => onSnooze(option.datetime)}
                      className="
                        w-full flex items-center justify-between
                        p-3 rounded-lg
                        bg-accent/10 hover:bg-accent/20
                        transition-all duration-150 ease-out
                        btn-press
                      "
                    >
                      <span className="font-medium text-accent">{option.label}</span>
                      <span className="text-sm text-accent/70">{option.time}</span>
                    </button>
                  ))}
                  {/* Tomorrow morning as featured option */}
                  {quickOptions.filter(o => !o.isToday).map((option) => (
                    <button
                      key={option.label}
                      onClick={() => onSnooze(option.datetime)}
                      className="
                        w-full flex items-center justify-between
                        p-3 rounded-lg
                        bg-success/10 hover:bg-success/20
                        transition-all duration-150 ease-out
                        btn-press
                      "
                    >
                      <span className="font-medium text-success">{option.label}</span>
                      <span className="text-sm text-success/70">{option.time}</span>
                    </button>
                  ))}
                  <div className="text-xs font-medium text-text-muted uppercase tracking-wide mt-3 mb-3">
                    Later this week
                  </div>
                </>
              )}
              {snoozeOptions.map((option) => (
                <button
                  key={option.days}
                  onClick={() => onSnooze(getDateString(option.days))}
                  className="
                    w-full flex items-center justify-between
                    p-3 rounded-lg
                    bg-subtle hover:bg-surface
                    transition-all duration-150 ease-out
                    btn-press
                  "
                >
                  <span className="font-medium text-text">{option.label}</span>
                  <span className="text-sm text-text-muted">{formatDate(option.days)}</span>
                </button>
              ))}

              <button
                onClick={() => setShowCustom(true)}
                className="
                  w-full flex items-center justify-center gap-2
                  p-3 rounded-lg
                  border border-border
                  text-text-soft
                  hover:border-accent hover:text-accent
                  transition-all duration-150 ease-out
                "
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
              className="w-full mt-4 p-3 min-h-[44px] text-text-muted hover:text-text transition-colors duration-150 ease-out"
            >
              Cancel
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <input
              type="date"
              min={minDate}
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="
                w-full p-3 rounded-lg
                bg-subtle border border-border
                text-text
                focus:border-accent focus:outline-none
                transition-colors
              "
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowCustom(false)}
                className="
                  flex-1 p-3 rounded-lg
                  border border-border
                  text-text-soft
                  hover:bg-subtle
                  transition-all duration-150 ease-out
                "
              >
                Back
              </button>
              <button
                onClick={handleCustomSnooze}
                disabled={!customDate}
                className="
                  flex-1 p-3 rounded-lg
                  bg-accent text-white font-medium
                  hover:bg-accent/90
                  transition-all duration-150 ease-out
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
              >
                Snooze
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
