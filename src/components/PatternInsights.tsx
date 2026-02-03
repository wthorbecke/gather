'use client'

import { useMemo } from 'react'
import { Task } from '@/hooks/useUserData'
import { TaskType } from '@/lib/constants'

interface PatternInsightsProps {
  tasks: Task[]
}

interface Insight {
  icon: string
  message: string
  type: 'positive' | 'neutral' | 'suggestion'
}

/**
 * Analyzes task completion patterns and surfaces productivity insights.
 * Designed to be helpful without being overwhelming for ADHD users.
 */
export function PatternInsights({ tasks }: PatternInsightsProps) {
  const insights = useMemo(() => {
    const insights: Insight[] = []

    // Get all completion timestamps from habits
    const habits = tasks.filter(t => t.type === TaskType.HABIT)
    const completionDates: string[] = []

    for (const habit of habits) {
      if (habit.streak?.completions) {
        completionDates.push(...habit.streak.completions)
      }
    }

    // Also count completed steps as signal
    let completedStepsCount = 0
    for (const task of tasks) {
      if (task.steps) {
        completedStepsCount += task.steps.filter(s => s.done).length
      }
    }

    const totalCompletions = completionDates.length + completedStepsCount

    // Need enough data for meaningful insights
    if (totalCompletions < 5) return []

    // Analyze completion times (based on habit completion days)
    // Since we only have dates, we infer time based on habit titles
    const morningHabits = habits.filter(h =>
      h.title.toLowerCase().includes('morning') ||
      h.title.toLowerCase().includes('wake') ||
      h.title.toLowerCase().includes('breakfast')
    )
    const eveningHabits = habits.filter(h =>
      h.title.toLowerCase().includes('evening') ||
      h.title.toLowerCase().includes('night') ||
      h.title.toLowerCase().includes('bed') ||
      h.title.toLowerCase().includes('sleep')
    )

    const morningCompletions = morningHabits.reduce(
      (sum, h) => sum + (h.streak?.completions?.length || 0), 0
    )
    const eveningCompletions = eveningHabits.reduce(
      (sum, h) => sum + (h.streak?.completions?.length || 0), 0
    )

    // Calculate based on proportion of completions
    const total = morningCompletions + eveningCompletions
    if (total > 2) {
      if (morningCompletions / total > 0.6) {
        insights.push({
          icon: 'sun',
          message: "You're most productive in the morning",
          type: 'positive'
        })
      } else if (eveningCompletions / total > 0.6) {
        insights.push({
          icon: 'moon',
          message: "You tend to get things done in the evening",
          type: 'neutral'
        })
      }
    }

    // Analyze streaks
    const today = new Date()
    const recentDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      return date.toISOString().split('T')[0]
    })

    const activeDays = new Set<string>()

    // Add habit completion dates
    for (const dateStr of completionDates) {
      activeDays.add(dateStr.split('T')[0])
    }

    const streak = recentDays.filter(d => activeDays.has(d)).length
    if (streak >= 3) {
      insights.push({
        icon: 'fire',
        message: `${streak} day streak! Keep it going`,
        type: 'positive'
      })
    }

    // Check for week-over-week improvement
    const thisWeekDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      return date.toISOString().split('T')[0]
    })

    const lastWeekDates = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today)
      date.setDate(date.getDate() - 7 - i)
      return date.toISOString().split('T')[0]
    })

    const thisWeekCompletions = completionDates.filter(d =>
      thisWeekDates.includes(d.split('T')[0])
    ).length

    const lastWeekCompletions = completionDates.filter(d =>
      lastWeekDates.includes(d.split('T')[0])
    ).length

    if (thisWeekCompletions > lastWeekCompletions && lastWeekCompletions > 0) {
      const increase = Math.round(((thisWeekCompletions - lastWeekCompletions) / lastWeekCompletions) * 100)
      if (increase >= 10) {
        insights.push({
          icon: 'trending',
          message: `${increase}% more tasks completed this week`,
          type: 'positive'
        })
      }
    }

    // Check for consistency - completing similar habits on same days
    const dayOfWeekCounts: Record<number, number> = {}
    for (const dateStr of completionDates) {
      const date = new Date(dateStr)
      const day = date.getDay()
      dayOfWeekCounts[day] = (dayOfWeekCounts[day] || 0) + 1
    }

    // Find if there's a standout day
    const maxDay = Object.entries(dayOfWeekCounts)
      .sort((a, b) => b[1] - a[1])[0]

    if (maxDay && maxDay[1] >= 3) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      const dayName = dayNames[parseInt(maxDay[0])]
      const avgOtherDays = Object.entries(dayOfWeekCounts)
        .filter(([d]) => d !== maxDay[0])
        .reduce((sum, [, count]) => sum + count, 0) / 6

      if (maxDay[1] > avgOtherDays * 1.5 && insights.length < 2) {
        insights.push({
          icon: 'calendar',
          message: `${dayName}s are your power day`,
          type: 'positive'
        })
      }
    }

    return insights.slice(0, 2) // Max 2 insights at a time
  }, [tasks])

  if (insights.length === 0) return null

  return (
    <div className="bg-surface rounded-xl p-4 mb-4">
      <h3 className="text-sm font-medium text-text-muted mb-3">
        Your patterns
      </h3>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xl flex-shrink-0" aria-hidden="true">
              {insight.icon === 'sun' && (
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              )}
              {insight.icon === 'moon' && (
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
              {insight.icon === 'fire' && (
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" className="text-orange-500">
                  <path d="M12 23c-4.97 0-9-3.134-9-7 0-2.195 1.034-4.254 2.5-5.88.534-.593 1.23-.69 1.783-.168.553.523.61 1.368.125 1.947C6.515 13.04 6 14.434 6 16c0 3.308 2.692 6 6 6s6-2.692 6-6c0-1.566-.515-2.96-1.408-4.101-.485-.579-.428-1.424.125-1.947.553-.522 1.249-.425 1.783.168C19.966 11.746 21 13.805 21 16c0 3.866-4.03 7-9 7z" fill="currentColor"/>
                  <path d="M12 19c-2.21 0-4-1.343-4-3 0-.879.402-1.686 1.042-2.3.384-.37.98-.37 1.364 0 .385.37.385.97 0 1.34-.213.204-.406.522-.406.96 0 .552.897 1 2 1s2-.448 2-1c0-.438-.193-.756-.406-.96a.97.97 0 0 1 0-1.34c.384-.37.98-.37 1.364 0C15.598 14.314 16 15.121 16 16c0 1.657-1.79 3-4 3z" fill="currentColor"/>
                  <path d="M12 12c-1.1 0-2-.45-2-1 0-.34.19-.657.5-.857.27-.175.5-.52.5-.893 0-.69-.897-1.25-2-1.25-.39 0-.77.08-1.1.21-.58.24-1.24-.04-1.48-.62s.04-1.24.62-1.48c.62-.26 1.29-.36 1.96-.36 2.21 0 4 1.343 4 3 0 .34-.19.657-.5.857-.27.175-.5.52-.5.893 0 .69.897 1.25 2 1.25s2-.56 2-1.25c0-.373-.23-.718-.5-.893-.31-.2-.5-.517-.5-.857 0-1.657 1.79-3 4-3 .67 0 1.34.1 1.96.36.58.24.86.9.62 1.48s-.9.86-1.48.62c-.33-.13-.71-.21-1.1-.21-1.103 0-2 .56-2 1.25 0 .373.23.718.5.893.31.2.5.517.5.857 0 .55-.9 1-2 1z" fill="currentColor"/>
                </svg>
              )}
              {insight.icon === 'trending' && (
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              )}
              {insight.icon === 'calendar' && (
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              )}
            </span>
            <p className="text-sm text-text">{insight.message}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
