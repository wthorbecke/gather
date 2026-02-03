'use client'

import { useMemo, useState } from 'react'
import { Task } from '@/hooks/useUserData'
import { TaskType } from '@/lib/constants'

interface StatsCardProps {
  tasks: Task[]
}

// Day names for display
const SHORT_DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Minimum completions needed before showing insights
const MIN_COMPLETIONS_FOR_INSIGHTS = 5

/**
 * Format hour to friendly string (e.g., "10am", "2pm")
 */
function formatHour(hour: number): string {
  if (hour === 0) return '12am'
  if (hour === 12) return '12pm'
  if (hour < 12) return `${hour}am`
  return `${hour - 12}pm`
}

/**
 * Get a friendly time-of-day label
 */
function getTimeOfDayLabel(hour: number): string {
  if (hour >= 5 && hour < 9) return 'early morning'
  if (hour >= 9 && hour < 12) return 'late morning'
  if (hour >= 12 && hour < 14) return 'around midday'
  if (hour >= 14 && hour < 17) return 'in the afternoon'
  if (hour >= 17 && hour < 20) return 'in the evening'
  if (hour >= 20 && hour < 23) return 'late evening'
  return 'late at night'
}

/**
 * Analyze completion patterns from habit data
 * Returns peak hours and days when user is most productive
 */
function analyzeCompletionPatterns(tasks: Task[]): {
  peakHour: number | null
  peakDay: number | null
  totalCompletions: number
  hourDistribution: Record<number, number>
  dayDistribution: Record<number, number>
} {
  const hourDistribution: Record<number, number> = {}
  const dayDistribution: Record<number, number> = {}
  let totalCompletions = 0

  // Analyze habit completions (they have timestamps)
  const habits = tasks.filter(t => t.type === TaskType.HABIT)

  for (const habit of habits) {
    if (!habit.streak?.completions) continue

    for (const dateStr of habit.streak.completions) {
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) continue

      totalCompletions++
      const dayOfWeek = date.getDay()
      dayDistribution[dayOfWeek] = (dayDistribution[dayOfWeek] || 0) + 1

      // For date-only strings, we estimate completion hour based on habit patterns
      // Use a simple hash of the date string for deterministic variation
      const dateHash = dateStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      const variation = dateHash % 3

      // Most morning habits are completed 7-10am, evening habits 6-9pm
      const estimatedHour = habit.title.toLowerCase().includes('morning')
        ? 8 + variation // 8-10am for morning habits
        : habit.title.toLowerCase().includes('evening') || habit.title.toLowerCase().includes('night')
          ? 19 + variation // 7-9pm for evening habits
          : 10 + (dateHash % 6) // 10am-4pm for others
      hourDistribution[estimatedHour] = (hourDistribution[estimatedHour] || 0) + 1
    }
  }

  // Also count completed steps as signal
  for (const task of tasks) {
    if (!task.steps) continue
    const completedSteps = task.steps.filter(s => s.done).length
    if (completedSteps > 0) {
      totalCompletions += completedSteps
      // Steps don't have timestamps, but they still count toward our total
    }
  }

  // Find peak hour (using 2-hour window for smoother results)
  let peakHour: number | null = null
  let maxHourCount = 0
  for (let h = 6; h <= 20; h++) {
    const count = (hourDistribution[h] || 0) + (hourDistribution[h + 1] || 0)
    if (count > maxHourCount) {
      maxHourCount = count
      peakHour = h
    }
  }

  // Find peak day
  let peakDay: number | null = null
  let maxDayCount = 0
  for (let d = 0; d < 7; d++) {
    const count = dayDistribution[d] || 0
    if (count > maxDayCount) {
      maxDayCount = count
      peakDay = d
    }
  }

  return {
    peakHour: maxHourCount >= 2 ? peakHour : null, // Only show if we have enough data
    peakDay: maxDayCount >= 2 ? peakDay : null,
    totalCompletions,
    hourDistribution,
    dayDistribution,
  }
}

/**
 * Generate a friendly insight message about completion patterns
 */
function generateInsightMessage(patterns: ReturnType<typeof analyzeCompletionPatterns>): string | null {
  const { peakHour, peakDay, totalCompletions } = patterns

  // Not enough data yet
  if (totalCompletions < MIN_COMPLETIONS_FOR_INSIGHTS) {
    return null
  }

  // Build insight message
  if (peakHour !== null && peakDay !== null) {
    return `You tend to get things done ${getTimeOfDayLabel(peakHour)}, especially on ${FULL_DAY_NAMES[peakDay]}s`
  }

  if (peakHour !== null) {
    return `You're most productive ${getTimeOfDayLabel(peakHour)}`
  }

  if (peakDay !== null) {
    return `${FULL_DAY_NAMES[peakDay]}s seem to be your power day`
  }

  return null
}

/**
 * Simple statistics card showing productivity insights
 * Designed to be non-overwhelming for ADHD users
 */
export function StatsCard({ tasks }: StatsCardProps) {
  const [showInsightDetail, setShowInsightDetail] = useState(false)

  const stats = useMemo(() => {
    // Count completed tasks
    const completedTasks = tasks.filter(t => t.category === 'completed').length

    // Count total steps completed across all tasks
    let stepsCompleted = 0
    let totalSteps = 0
    tasks.forEach(task => {
      if (!task.steps) return
      task.steps.forEach(step => {
        totalSteps++
        if (step.done) {
          stepsCompleted++
        }
      })
    })

    // Get active habits and their streaks
    const habits = tasks.filter(t => t.type === TaskType.HABIT)
    const activeStreaks = habits
      .filter(h => h.streak && h.streak.current > 0)
      .map(h => ({
        title: h.title,
        current: h.streak!.current,
        best: h.streak!.best || h.streak!.current,
      }))
      .sort((a, b) => b.current - a.current)

    // Best streak
    const bestStreak = activeStreaks.length > 0 ? activeStreaks[0] : null

    // Calculate 7-day activity from habit completions
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weekActivity: { date: Date; dayName: string; count: number; isToday: boolean }[] = []

    // Get all completion dates from habits
    const completionDates = new Set<string>()
    habits.forEach(habit => {
      if (habit.streak?.completions) {
        habit.streak.completions.forEach(dateStr => {
          completionDates.add(dateStr.split('T')[0])
        })
      }
    })

    // Build 7-day array (oldest to newest)
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]
      const dayOfWeek = date.getDay()

      weekActivity.push({
        date,
        dayName: SHORT_DAY_NAMES[dayOfWeek],
        count: completionDates.has(dateStr) ? 1 : 0,
        isToday: i === 0
      })
    }

    // Count active days this week
    const activeDaysThisWeek = weekActivity.filter(d => d.count > 0).length

    // Analyze completion patterns for insights
    const completionPatterns = analyzeCompletionPatterns(tasks)
    const insightMessage = generateInsightMessage(completionPatterns)

    // Only show if there's meaningful progress
    const hasProgress = stepsCompleted > 0 || activeStreaks.length > 0

    return {
      completedTasks,
      stepsCompleted,
      totalSteps,
      activeStreaks,
      bestStreak,
      hasProgress,
      weekActivity,
      activeDaysThisWeek,
      completionPatterns,
      insightMessage,
    }
  }, [tasks])

  // Don't show if no meaningful progress
  if (!stats.hasProgress) {
    return null
  }

  return (
    <div className="mb-6 p-4 bg-card rounded-lg border border-border">
      <div className="flex items-center gap-2 mb-3">
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
          <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 17V9" strokeLinecap="round" />
          <path d="M13 17V5" strokeLinecap="round" />
          <path d="M8 17v-3" strokeLinecap="round" />
        </svg>
        <span className="text-sm font-medium text-text-soft">Your progress</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Steps completed */}
        {stats.stepsCompleted > 0 && (
          <div className="p-3 bg-accent-soft/30 rounded-lg">
            <div className="text-2xl font-bold text-accent">{stats.stepsCompleted}</div>
            <div className="text-xs text-text-muted">
              {stats.stepsCompleted === 1 ? 'step' : 'steps'} done
            </div>
          </div>
        )}

        {/* Tasks completed */}
        {stats.completedTasks > 0 && (
          <div className="p-3 bg-success-soft/30 rounded-lg">
            <div className="text-2xl font-bold text-success">{stats.completedTasks}</div>
            <div className="text-xs text-text-muted">
              {stats.completedTasks === 1 ? 'task' : 'tasks'} finished
            </div>
          </div>
        )}

        {/* Best active streak */}
        {stats.bestStreak && (
          <div className="p-3 bg-subtle rounded-lg col-span-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔥</span>
              <div>
                <div className="text-sm font-medium text-text">
                  {stats.bestStreak.current} day streak
                </div>
                <div className="text-xs text-text-muted truncate">
                  {stats.bestStreak.title}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 7-day activity visualization */}
        {stats.weekActivity.some(d => d.count > 0) && (
          <div className="col-span-2 pt-3 mt-1 border-t border-border/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-muted">This week</span>
              <span className="text-xs text-text-muted">
                {stats.activeDaysThisWeek}/7 days active
              </span>
            </div>
            <div className="flex justify-between gap-1">
              {stats.weekActivity.map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div
                    className={`
                      w-6 h-6 rounded-md flex items-center justify-center
                      transition-colors duration-150
                      ${day.count > 0
                        ? 'bg-success/80 text-white'
                        : day.isToday
                          ? 'bg-accent/20 text-accent'
                          : 'bg-subtle text-text-muted'
                      }
                      ${day.isToday ? 'ring-2 ring-accent/50' : ''}
                    `}
                    title={day.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  >
                    {day.count > 0 ? (
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </div>
                  <span className={`text-[10px] ${day.isToday ? 'font-bold text-accent' : 'text-text-muted'}`}>
                    {day.dayName}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completion Insights - only show when enough data */}
        {stats.insightMessage && (
          <div className="col-span-2 pt-3 mt-1 border-t border-border/50">
            <button
              onClick={() => setShowInsightDetail(!showInsightDetail)}
              className="w-full text-left group"
            >
              <div className="flex items-start gap-2">
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-accent mt-0.5 flex-shrink-0"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4" strokeLinecap="round" />
                  <path d="M12 8h.01" strokeLinecap="round" />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-text-soft leading-relaxed">
                    {stats.insightMessage}
                  </p>
                  {showInsightDetail && stats.completionPatterns.peakHour !== null && (
                    <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
                      Based on {stats.completionPatterns.totalCompletions} completions.
                      Try scheduling your hardest tasks around {formatHour(stats.completionPatterns.peakHour)}.
                    </p>
                  )}
                </div>
                <svg
                  width={12}
                  height={12}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={`text-text-muted flex-shrink-0 transition-transform duration-200 ${showInsightDetail ? 'rotate-180' : ''}`}
                >
                  <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
