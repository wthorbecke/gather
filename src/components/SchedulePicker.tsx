'use client'

import { useState, useMemo } from 'react'

interface SchedulePickerProps {
  currentSchedule?: string | null
  onSchedule: (datetime: string | null) => void
  onCancel: () => void
}

/**
 * Simple datetime picker for scheduling tasks
 */
export function SchedulePicker({ currentSchedule, onSchedule, onCancel }: SchedulePickerProps) {
  // Parse current schedule or default to tomorrow 9am
  const defaultDatetime = useMemo(() => {
    if (currentSchedule) {
      return currentSchedule.slice(0, 16) // Get YYYY-MM-DDTHH:MM
    }
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    return tomorrow.toISOString().slice(0, 16)
  }, [currentSchedule])

  const [datetime, setDatetime] = useState(defaultDatetime)

  // Quick options
  const quickOptions = useMemo(() => {
    const now = new Date()
    const options: { label: string; datetime: string }[] = []

    // Later today (if before 6 PM)
    if (now.getHours() < 18) {
      const laterToday = new Date()
      laterToday.setHours(laterToday.getHours() + 2, 0, 0, 0)
      options.push({
        label: 'Later today',
        datetime: laterToday.toISOString().slice(0, 16)
      })
    }

    // Tomorrow morning
    const tomorrowAM = new Date()
    tomorrowAM.setDate(tomorrowAM.getDate() + 1)
    tomorrowAM.setHours(9, 0, 0, 0)
    options.push({
      label: 'Tomorrow 9 AM',
      datetime: tomorrowAM.toISOString().slice(0, 16)
    })

    // Tomorrow afternoon
    const tomorrowPM = new Date()
    tomorrowPM.setDate(tomorrowPM.getDate() + 1)
    tomorrowPM.setHours(14, 0, 0, 0)
    options.push({
      label: 'Tomorrow 2 PM',
      datetime: tomorrowPM.toISOString().slice(0, 16)
    })

    // Next Monday 9 AM (if not already Monday)
    const nextMonday = new Date()
    const daysUntilMonday = (8 - nextMonday.getDay()) % 7 || 7
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday)
    nextMonday.setHours(9, 0, 0, 0)
    options.push({
      label: 'Next Monday',
      datetime: nextMonday.toISOString().slice(0, 16)
    })

    return options
  }, [])

  const handleSchedule = () => {
    if (datetime) {
      // Convert to full ISO string
      const fullDatetime = new Date(datetime).toISOString()
      onSchedule(fullDatetime)
    }
  }

  const handleClear = () => {
    onSchedule(null)
  }

  // Minimum datetime is now
  const minDatetime = new Date().toISOString().slice(0, 16)

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

      {/* Picker */}
      <div className="relative z-10 bg-elevated border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm p-4 shadow-modal animate-rise">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold text-text">Schedule this task</h3>
          <p className="text-sm text-text-muted mt-1">
            Block time on your calendar
          </p>
        </div>

        {/* Quick options */}
        <div className="space-y-2 mb-4">
          {quickOptions.map((option) => (
            <button
              key={option.label}
              onClick={() => setDatetime(option.datetime)}
              className={`
                w-full flex items-center justify-between
                p-3 rounded-lg
                transition-all duration-150 ease-out
                btn-press
                ${datetime === option.datetime
                  ? 'bg-accent/20 text-accent border border-accent'
                  : 'bg-subtle hover:bg-surface'
                }
              `}
            >
              <span className="font-medium">{option.label}</span>
              <span className="text-sm text-text-muted">
                {new Date(option.datetime).toLocaleString('en-US', {
                  weekday: 'short',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </span>
            </button>
          ))}
        </div>

        {/* Custom datetime picker */}
        <div className="mb-4">
          <label className="text-xs text-text-muted font-medium uppercase tracking-wide mb-2 block">
            Or pick a time
          </label>
          <input
            type="datetime-local"
            min={minDatetime}
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
            className="
              w-full p-3 rounded-lg
              bg-subtle border border-border
              text-text
              focus:border-accent focus:outline-none
              transition-colors
            "
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {currentSchedule && (
            <button
              onClick={handleClear}
              className="
                flex-1 p-3 rounded-lg
                border border-danger/50 text-danger
                hover:bg-danger/10
                transition-all duration-150 ease-out
              "
            >
              Clear
            </button>
          )}
          <button
            onClick={onCancel}
            className="
              flex-1 p-3 rounded-lg
              border border-border
              text-text-soft
              hover:bg-subtle
              transition-all duration-150 ease-out
            "
          >
            Cancel
          </button>
          <button
            onClick={handleSchedule}
            disabled={!datetime}
            className="
              flex-1 p-3 rounded-lg
              bg-accent text-white font-medium
              hover:bg-accent/90
              transition-all duration-150 ease-out
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  )
}
