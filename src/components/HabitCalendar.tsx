'use client'

import { useMemo } from 'react'

interface HabitCalendarProps {
  completions: string[] // Array of ISO date strings (YYYY-MM-DD)
  className?: string
}

/**
 * Mini calendar showing habit completion history
 * Displays last 4 weeks with dots for completed days
 */
export function HabitCalendar({ completions, className = '' }: HabitCalendarProps) {
  const calendarData = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Create set of completion dates for O(1) lookup
    const completionSet = new Set(completions)

    // Generate 4 weeks of data (28 days)
    const days: { date: Date; dateStr: string; completed: boolean; isToday: boolean; isFuture: boolean }[] = []

    // Start from 27 days ago to show 4 complete weeks
    for (let i = 27; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      days.push({
        date,
        dateStr,
        completed: completionSet.has(dateStr),
        isToday: i === 0,
        isFuture: false,
      })
    }

    // Group by weeks (7 days each)
    const weeks: typeof days[] = []
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7))
    }

    return { weeks, days }
  }, [completions])

  // Day labels
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className={`${className}`}>
      {/* Day labels */}
      <div className="flex justify-between mb-1.5 px-0.5">
        {dayLabels.map((label, i) => (
          <div key={i} className="w-6 text-center text-[10px] text-text-muted font-medium">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex flex-col gap-1">
        {calendarData.weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex justify-between">
            {week.map((day) => (
              <div
                key={day.dateStr}
                className={`
                  w-6 h-6 rounded-md flex items-center justify-center
                  transition-all duration-150
                  ${day.isToday ? 'ring-1 ring-accent ring-offset-1 ring-offset-canvas' : ''}
                  ${day.completed
                    ? 'bg-success/20'
                    : 'bg-surface'
                  }
                `}
                title={`${day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${day.completed ? ' - Completed' : ''}`}
              >
                {day.completed && (
                  <div className="w-2.5 h-2.5 rounded-full bg-success" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-text-muted">
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-success" />
          <span>completed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-md bg-surface border border-border" />
          <span>missed</span>
        </div>
      </div>
    </div>
  )
}
