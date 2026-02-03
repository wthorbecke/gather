'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { Task, MoodEntry } from '@/hooks/useUserData'
import { TaskType, EnergyLevel } from '@/lib/constants'
import type { TaskIntelligenceObservation } from '@/lib/ai'
import { EnergyBadge } from './EnergyBadge'

// Types for unified insight system
interface BaseInsight {
  id: string
  type: 'stuck' | 'pattern' | 'stat' | 'energy' | 'streak' | 'productivity'
  priority: number // Lower = higher priority
  message: string
  detail?: string
  actionLabel?: string
  actionTaskId?: string
  icon?: 'lightbulb' | 'trending' | 'fire' | 'sun' | 'moon' | 'calendar' | 'energy' | 'info'
}

interface StuckInsight extends BaseInsight {
  type: 'stuck'
  taskId: string
  suggestion: string
  insightId?: string
}

interface PatternInsight extends BaseInsight {
  type: 'pattern' | 'productivity'
}

interface StatInsight extends BaseInsight {
  type: 'stat' | 'streak'
}

interface EnergyInsight extends BaseInsight {
  type: 'energy'
  lowEnergyTasks: Task[]
}

type CoachInsight = StuckInsight | PatternInsight | StatInsight | EnergyInsight

interface CoachCardProps {
  tasks: Task[]
  moodEntries?: MoodEntry[]
  currentTaskId?: string // The "Do this now" task to potentially exclude
  onGoToTask: (taskId: string) => void
}

// Day names for patterns
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// Storage key for daily rotation
const COACH_INSIGHT_KEY = 'gather:coach-insight-date'

/**
 * Get time-based context message for energy suggestions
 */
function getTimeBasedEnergyMessage(): string {
  const hour = new Date().getHours()

  if (hour >= 21 || hour < 6) return "Late night? Try something easy"
  if (hour >= 17) return "Winding down? Here are some lighter tasks"
  if (hour >= 14) return "Afternoon slump? Try a quick win"
  return "Not feeling the main task? Try these instead"
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
 * Analyze patterns from task data
 */
function analyzePatterns(tasks: Task[]): PatternInsight[] {
  const insights: PatternInsight[] = []

  // Get habit data
  const habits = tasks.filter(t => t.type === TaskType.HABIT)
  const completionDates: string[] = []

  for (const habit of habits) {
    if (habit.streak?.completions) {
      completionDates.push(...habit.streak.completions)
    }
  }

  // Also count completed steps
  let completedStepsCount = 0
  for (const task of tasks) {
    if (task.steps) {
      completedStepsCount += task.steps.filter(s => s.done).length
    }
  }

  const totalCompletions = completionDates.length + completedStepsCount

  // Need enough data for meaningful insights
  if (totalCompletions < 5) return []

  // Analyze time-of-day patterns from habit titles
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

  const total = morningCompletions + eveningCompletions
  if (total > 2) {
    if (morningCompletions / total > 0.6) {
      insights.push({
        id: 'pattern-morning',
        type: 'pattern',
        priority: 30,
        message: "You're most productive in the morning",
        detail: "Schedule your toughest tasks for morning hours when you have the most energy.",
        icon: 'sun'
      })
    } else if (eveningCompletions / total > 0.6) {
      insights.push({
        id: 'pattern-evening',
        type: 'pattern',
        priority: 30,
        message: "You tend to get things done in the evening",
        detail: "Your natural rhythm leans toward evenings. Work with it, not against it.",
        icon: 'moon'
      })
    }
  }

  // Analyze weekly streaks
  const today = new Date()
  const recentDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    return date.toISOString().split('T')[0]
  })

  const activeDays = new Set<string>()
  for (const dateStr of completionDates) {
    activeDays.add(dateStr.split('T')[0])
  }

  const streak = recentDays.filter(d => activeDays.has(d)).length
  if (streak >= 3) {
    insights.push({
      id: 'pattern-streak',
      type: 'pattern',
      priority: 25,
      message: `${streak} day streak! Keep it going`,
      detail: "You've been consistent this week. That's building momentum.",
      icon: 'fire'
    })
  }

  // Week-over-week improvement
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
        id: 'pattern-improvement',
        type: 'productivity',
        priority: 20,
        message: `${increase}% more tasks completed this week`,
        detail: "You're doing more this week than last. Nice momentum.",
        icon: 'trending'
      })
    }
  }

  // Power day analysis
  const dayOfWeekCounts: Record<number, number> = {}
  for (const dateStr of completionDates) {
    const date = new Date(dateStr)
    const day = date.getDay()
    dayOfWeekCounts[day] = (dayOfWeekCounts[day] || 0) + 1
  }

  const maxDay = Object.entries(dayOfWeekCounts)
    .sort((a, b) => b[1] - a[1])[0]

  if (maxDay && maxDay[1] >= 3) {
    const dayName = FULL_DAY_NAMES[parseInt(maxDay[0])]
    const avgOtherDays = Object.entries(dayOfWeekCounts)
      .filter(([d]) => d !== maxDay[0])
      .reduce((sum, [, count]) => sum + count, 0) / 6

    if (maxDay[1] > avgOtherDays * 1.5) {
      insights.push({
        id: 'pattern-power-day',
        type: 'pattern',
        priority: 35,
        message: `${dayName}s are your power day`,
        detail: `You consistently get more done on ${dayName}s. Plan big tasks for then.`,
        icon: 'calendar'
      })
    }
  }

  return insights
}

/**
 * Analyze stats for insight
 */
function analyzeStats(tasks: Task[]): StatInsight[] {
  const insights: StatInsight[] = []

  // Count completed tasks and steps
  const completedTasks = tasks.filter(t => t.category === 'completed').length
  let stepsCompleted = 0
  let totalSteps = 0

  tasks.forEach(task => {
    if (!task.steps) return
    task.steps.forEach(step => {
      totalSteps++
      if (step.done) stepsCompleted++
    })
  })

  // Get active streaks from habits
  const habits = tasks.filter(t => t.type === TaskType.HABIT)
  const activeStreaks = habits
    .filter(h => h.streak && h.streak.current > 0)
    .sort((a, b) => (b.streak?.current || 0) - (a.streak?.current || 0))

  // Best active streak
  if (activeStreaks.length > 0) {
    const bestStreak = activeStreaks[0]
    if (bestStreak.streak && bestStreak.streak.current >= 3) {
      insights.push({
        id: 'stat-streak',
        type: 'streak',
        priority: 15,
        message: `${bestStreak.streak.current} day streak on "${bestStreak.title}"`,
        detail: bestStreak.streak.current >= 7
          ? "A week strong! You're building a real habit."
          : "Keep it up - you're building consistency.",
        icon: 'fire'
      })
    }
  }

  // Steps milestone
  if (stepsCompleted >= 10 && stepsCompleted % 5 === 0) {
    insights.push({
      id: 'stat-steps',
      type: 'stat',
      priority: 40,
      message: `${stepsCompleted} steps completed`,
      detail: "Each small step adds up. You're making real progress.",
      icon: 'trending'
    })
  }

  return insights
}

/**
 * Find low-energy alternatives for energy insight
 */
function findLowEnergyTasks(tasks: Task[], currentTaskId?: string): Task[] {
  return tasks.filter(task => {
    if (task.id === currentTaskId) return false
    if (task.energy !== EnergyLevel.LOW) return false
    const steps = task.steps || []
    if (steps.length === 0) return false
    if (steps.every(s => s.done)) return false
    if (task.snoozed_until) {
      const today = new Date().toISOString().split('T')[0]
      if (task.snoozed_until > today) return false
    }
    return true
  }).slice(0, 3)
}

/**
 * Get the daily rotation seed to ensure same insight shows all day
 */
function getDailyRotationSeed(): number {
  const today = new Date().toISOString().split('T')[0]
  // Simple hash of date string
  let hash = 0
  for (let i = 0; i < today.length; i++) {
    const char = today.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash)
}

/**
 * CoachCard - Unified insight component showing ONE contextual message at a time
 *
 * Priority system (lower = shown first):
 * 1. Stuck tasks (priority 10) - Most actionable, user needs help
 * 2. Active streaks (priority 15) - Motivating, time-sensitive
 * 3. Week improvement (priority 20) - Positive reinforcement
 * 4. Pattern streaks (priority 25) - Encouraging consistency
 * 5. Time patterns (priority 30) - Helpful but not urgent
 * 6. Power day (priority 35) - Nice to know
 * 7. Steps completed (priority 40) - General encouragement
 * 8. Energy suggestions (priority 50) - Alternative when main isn't working
 */
export function CoachCard({ tasks, moodEntries = [], currentTaskId, onGoToTask }: CoachCardProps) {
  const { session } = useAuth()
  const [stuckInsight, setStuckInsight] = useState<StuckInsight | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showMore, setShowMore] = useState(false)

  // Record that an insight was shown
  const recordInsightShown = useCallback(async (obs: TaskIntelligenceObservation) => {
    if (!session?.access_token) return null

    try {
      const response = await fetch('/api/task-intelligence/record', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          taskId: obs.taskId,
          insightType: obs.type,
          observation: obs.observation,
          suggestion: obs.suggestion,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        return data.id
      }
    } catch {
      // Silently fail - tracking is non-critical
    }
    return null
  }, [session?.access_token])

  // Record outcome (dismissed or acted)
  const recordOutcome = useCallback(async (outcome: 'acted' | 'dismissed') => {
    if (!session?.access_token || !stuckInsight?.insightId) return

    try {
      await fetch('/api/task-intelligence/record', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          insightId: stuckInsight.insightId,
          outcome,
        }),
      })
    } catch {
      // Silently fail
    }
  }, [session?.access_token, stuckInsight?.insightId])

  // Fetch stuck task insight from API
  useEffect(() => {
    if (!session?.access_token || dismissed) return

    // Check sessionStorage to avoid fetching again in same session
    const cachedDismissed = sessionStorage.getItem('coach-insight-dismissed')
    if (cachedDismissed) {
      setDismissed(true)
      return
    }

    const cachedObservation = sessionStorage.getItem('coach-insight-observation')
    if (cachedObservation) {
      try {
        const cached = JSON.parse(cachedObservation) as StuckInsight
        setStuckInsight(cached)
        return
      } catch {
        // Invalid cache, fetch fresh
      }
    }

    async function fetchInsight() {
      setLoading(true)
      try {
        const response = await fetch('/api/task-intelligence', {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        })

        if (!response.ok) {
          setLoading(false)
          return
        }

        const data = await response.json()
        if (data.observations && data.observations.length > 0) {
          const obs = data.observations[0] as TaskIntelligenceObservation

          // Record that we showed this insight
          const insightId = await recordInsightShown(obs)

          const typeLabels: Record<string, string> = {
            stuck: 'This task seems stuck',
            vague: 'This task needs clarity',
            needs_deadline: 'This task is floating',
            pattern: 'Pattern noticed',
          }

          const storedInsight: StuckInsight = {
            id: `stuck-${obs.taskId}`,
            type: 'stuck',
            priority: 10,
            message: typeLabels[obs.type] || obs.observation,
            taskId: obs.taskId,
            suggestion: obs.suggestion,
            actionLabel: 'Go to task',
            actionTaskId: obs.taskId,
            insightId,
            icon: 'lightbulb'
          }

          setStuckInsight(storedInsight)
          sessionStorage.setItem('coach-insight-observation', JSON.stringify(storedInsight))
        }
      } catch {
        // Silently fail
      }
      setLoading(false)
    }

    fetchInsight()
  }, [session?.access_token, dismissed, recordInsightShown])

  // Gather all insights
  const allInsights = useMemo((): CoachInsight[] => {
    const insights: CoachInsight[] = []

    // Add stuck insight if we have one
    if (stuckInsight && !dismissed) {
      insights.push(stuckInsight)
    }

    // Add pattern insights
    const patterns = analyzePatterns(tasks)
    insights.push(...patterns)

    // Add stat insights
    const stats = analyzeStats(tasks)
    insights.push(...stats)

    // Add energy insight if we have low-energy alternatives
    const lowEnergyTasks = findLowEnergyTasks(tasks, currentTaskId)
    if (lowEnergyTasks.length > 0 && currentTaskId) {
      insights.push({
        id: 'energy-alternatives',
        type: 'energy',
        priority: 50,
        message: getTimeBasedEnergyMessage(),
        lowEnergyTasks,
        icon: 'energy'
      })
    }

    // Sort by priority
    return insights.sort((a, b) => a.priority - b.priority)
  }, [tasks, currentTaskId, stuckInsight, dismissed])

  // Select which insight to show (highest priority, with daily rotation for ties)
  const selectedInsight = useMemo(() => {
    if (allInsights.length === 0) return null

    // If there's a clear winner (priority 10-15), show it
    if (allInsights[0].priority <= 15) {
      return allInsights[0]
    }

    // For lower priority insights, use daily rotation
    const seed = getDailyRotationSeed()
    return allInsights[seed % allInsights.length]
  }, [allInsights])

  const otherInsights = useMemo(() => {
    if (!selectedInsight) return []
    return allInsights.filter(i => i.id !== selectedInsight.id)
  }, [allInsights, selectedInsight])

  const handleDismiss = async () => {
    if (selectedInsight?.type === 'stuck') {
      await recordOutcome('dismissed')
    }
    setDismissed(true)
    sessionStorage.setItem('coach-insight-dismissed', 'true')
  }

  const handleAction = async (insight: CoachInsight) => {
    if (insight.type === 'stuck' && insight.actionTaskId) {
      await recordOutcome('acted')
      onGoToTask(insight.actionTaskId)
      setDismissed(true)
      sessionStorage.setItem('coach-insight-dismissed', 'true')
    }
  }

  // Don't render while loading or if no insights
  if (loading || !selectedInsight || dismissed) {
    return null
  }

  // Icon component based on insight type
  const InsightIcon = ({ icon }: { icon?: string }) => {
    switch (icon) {
      case 'lightbulb':
        return (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <path d="M9 18h6M10 22h4M12 2v1M4.22 4.22l.71.71M1 12h1M4.22 19.78l.71-.71M19.78 4.22l-.71.71M23 12h-1M19.78 19.78l-.71-.71" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9 18V14.5A4.5 4.5 0 0 1 7.5 10.5 4.5 4.5 0 1 1 16.5 10.5 4.5 4.5 0 0 1 15 14.5V18" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      case 'trending':
        return (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        )
      case 'fire':
        return (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" className="text-orange-500">
            <path d="M12 23c-4.97 0-9-3.134-9-7 0-2.195 1.034-4.254 2.5-5.88.534-.593 1.23-.69 1.783-.168.553.523.61 1.368.125 1.947C6.515 13.04 6 14.434 6 16c0 3.308 2.692 6 6 6s6-2.692 6-6c0-1.566-.515-2.96-1.408-4.101-.485-.579-.428-1.424.125-1.947.553-.522 1.249-.425 1.783.168C19.966 11.746 21 13.805 21 16c0 3.866-4.03 7-9 7z" fill="currentColor"/>
            <path d="M12 19c-2.21 0-4-1.343-4-3 0-.879.402-1.686 1.042-2.3.384-.37.98-.37 1.364 0 .385.37.385.97 0 1.34-.213.204-.406.522-.406.96 0 .552.897 1 2 1s2-.448 2-1c0-.438-.193-.756-.406-.96a.97.97 0 0 1 0-1.34c.384-.37.98-.37 1.364 0C15.598 14.314 16 15.121 16 16c0 1.657-1.79 3-4 3z" fill="currentColor"/>
          </svg>
        )
      case 'sun':
        return (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500">
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
        )
      case 'moon':
        return (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-400">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )
      case 'calendar':
        return (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        )
      case 'energy':
        return (
          <span className="text-sm">🌿</span>
        )
      default:
        return (
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" strokeLinecap="round" />
            <path d="M12 8h.01" strokeLinecap="round" />
          </svg>
        )
    }
  }

  return (
    <div className="mb-4 animate-rise">
      <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 relative">
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1 text-text-muted hover:text-text transition-colors"
          aria-label="Dismiss insight"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* Main insight */}
        <div className="flex items-start gap-3 pr-6">
          <div className="mt-0.5 flex-shrink-0">
            <InsightIcon icon={selectedInsight.icon} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-text font-medium leading-snug">
              {selectedInsight.message}
            </p>

            {/* Stuck task suggestion */}
            {selectedInsight.type === 'stuck' && (
              <p className="text-sm text-text-soft mt-1.5 leading-relaxed">
                {(selectedInsight as StuckInsight).suggestion}
              </p>
            )}

            {/* Pattern/stat detail */}
            {selectedInsight.detail && selectedInsight.type !== 'stuck' && (
              <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
                {selectedInsight.detail}
              </p>
            )}

            {/* Energy alternatives */}
            {selectedInsight.type === 'energy' && (
              <div className="flex flex-wrap gap-2 mt-3">
                {(selectedInsight as EnergyInsight).lowEnergyTasks.map(task => (
                  <button
                    key={task.id}
                    onClick={() => onGoToTask(task.id)}
                    className="
                      px-2.5 py-1.5
                      bg-success/5 border border-success/20 rounded-lg
                      text-xs text-text
                      hover:bg-success/10 hover:border-success/30
                      transition-all duration-150
                      flex items-center gap-1.5
                      max-w-[180px]
                    "
                  >
                    <span className="truncate">{task.title}</span>
                    <EnergyBadge energy={EnergyLevel.LOW} size="sm" />
                  </button>
                ))}
              </div>
            )}

            {/* Action for stuck tasks */}
            {selectedInsight.type === 'stuck' && selectedInsight.actionTaskId && (
              <button
                onClick={() => handleAction(selectedInsight)}
                className="
                  mt-3 text-sm font-medium text-accent
                  hover:underline
                  transition-colors
                "
              >
                Go to task
              </button>
            )}
          </div>
        </div>

        {/* See more toggle */}
        {otherInsights.length > 0 && (
          <div className="mt-3 pt-3 border-t border-accent/10">
            <button
              onClick={() => setShowMore(!showMore)}
              className="text-xs text-text-muted hover:text-text-soft transition-colors flex items-center gap-1"
            >
              {showMore ? 'Show less' : `${otherInsights.length} more insight${otherInsights.length > 1 ? 's' : ''}`}
              <svg
                width={12}
                height={12}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`}
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {showMore && (
              <div className="mt-3 space-y-3 animate-rise">
                {otherInsights.slice(0, 3).map(insight => (
                  <div key={insight.id} className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex-shrink-0 opacity-70">
                      <InsightIcon icon={insight.icon} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-soft leading-snug">
                        {insight.message}
                      </p>
                      {insight.type === 'stuck' && (
                        <button
                          onClick={() => onGoToTask((insight as StuckInsight).taskId)}
                          className="text-xs text-accent hover:underline mt-1"
                        >
                          View task
                        </button>
                      )}
                      {insight.type === 'energy' && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {(insight as EnergyInsight).lowEnergyTasks.slice(0, 2).map(task => (
                            <button
                              key={task.id}
                              onClick={() => onGoToTask(task.id)}
                              className="
                                px-2 py-1
                                bg-success/5 border border-success/15 rounded-md
                                text-[11px] text-text-soft
                                hover:bg-success/10
                                transition-colors
                                truncate max-w-[140px]
                              "
                            >
                              {task.title}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
