/**
 * Task Intelligence Utilities
 *
 * Shared logic for task intelligence analysis used by both:
 * - On-demand API route (/api/task-intelligence)
 * - Cron job route (/api/cron/task-intelligence)
 */

import type { TaskForIntelligence, UserPatterns, InsightHistory } from './prompts'

// Database row types
export interface TaskRow {
  id: string
  title: string
  created_at: string
  category: string
  due_date: string | null
  steps: Array<{ done?: boolean }> | null
  updated_at: string | null
  notes: string | null
}

export interface TaskRowWithUser extends TaskRow {
  user_id: string
}

export interface CompletedTaskRow {
  created_at: string
  completed_at: string
}

export interface CompletionRow {
  completed_at: string
  completion_day_of_week: number
  completion_hour: number
}

export interface CompletionRowWithUser extends CompletionRow {
  user_id: string
}

export interface InsightRow {
  task_id: string
  outcome: string | null
  action_delay_hours: number | null
  shown_at: string
}

export interface InsightRowWithUser extends InsightRow {
  user_id: string
}

/**
 * Calculate average days from creation to completion
 */
export function calculateAvgCompletionDays(completedTasks: CompletedTaskRow[]): number {
  if (completedTasks.length === 0) return 7 // Default

  let totalDays = 0
  let validCount = 0

  for (const task of completedTasks) {
    if (task.created_at && task.completed_at) {
      const created = new Date(task.created_at)
      const completed = new Date(task.completed_at)
      const days = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)

      // Only count reasonable values (0-365 days)
      if (days >= 0 && days <= 365) {
        totalDays += days
        validCount++
      }
    }
  }

  if (validCount === 0) return 7

  // Round to 1 decimal place
  return Math.round((totalDays / validCount) * 10) / 10
}

/**
 * Format hour to 12-hour time string
 */
function formatHour(h: number): string {
  if (h === 12) return '12pm'
  if (h > 12) return `${h - 12}pm`
  return `${h}am`
}

/**
 * Analyze user patterns from completion history
 */
export function analyzeUserPatterns(
  completions: CompletionRow[],
  avgCompletionDays: number = 7
): UserPatterns {
  if (completions.length === 0) {
    return {
      avgCompletionDays,
      preferredDays: [],
      productiveHours: 'unknown',
      recentCompletions: 0,
    }
  }

  // Count completions by day of week
  const dayCount: Record<number, number> = {}
  const hourCount: Record<number, number> = {}

  for (const c of completions) {
    dayCount[c.completion_day_of_week] = (dayCount[c.completion_day_of_week] || 0) + 1
    hourCount[c.completion_hour] = (hourCount[c.completion_hour] || 0) + 1
  }

  // Find preferred days (top 2)
  const sortedDays = Object.entries(dayCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([day]) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseInt(day)])

  // Find productive hours (peak cluster)
  let peakHour = 10
  let maxCount = 0
  for (let h = 6; h <= 20; h++) {
    const cluster = (hourCount[h] || 0) + (hourCount[h + 1] || 0)
    if (cluster > maxCount) {
      maxCount = cluster
      peakHour = h
    }
  }

  return {
    avgCompletionDays,
    preferredDays: sortedDays,
    productiveHours: `${formatHour(peakHour)}-${formatHour(peakHour + 2)}`,
    recentCompletions: completions.length,
  }
}

/**
 * Analyze insight history for learning
 */
export function analyzeInsightHistory(insights: InsightRow[]): InsightHistory {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const recentTaskIds = insights
    .filter(i => new Date(i.shown_at) > sevenDaysAgo)
    .map(i => i.task_id)

  const withOutcome = insights.filter(i => i.outcome)
  const acted = withOutcome.filter(i => i.outcome === 'acted' || i.outcome === 'task_completed').length
  const dismissed = withOutcome.filter(i => i.outcome === 'dismissed').length

  const delayHours = withOutcome
    .filter(i => i.action_delay_hours !== null)
    .map(i => i.action_delay_hours!)

  const avgDelay = delayHours.length > 0
    ? delayHours.reduce((a, b) => a + b, 0) / delayHours.length
    : 0

  return {
    totalShown: insights.length,
    actedOn: acted,
    dismissed,
    avgActionDelayHours: avgDelay,
    recentTaskIds,
  }
}

/**
 * Transform database task to prompt format
 */
export function transformTask(task: TaskRow): TaskForIntelligence {
  const steps = task.steps || []
  return {
    id: task.id,
    title: task.title,
    createdAt: task.created_at,
    category: task.category as 'urgent' | 'soon' | 'waiting',
    dueDate: task.due_date,
    stepsTotal: steps.length,
    stepsDone: steps.filter(s => s.done).length,
    lastInteraction: task.updated_at,
    notes: task.notes,
  }
}

/**
 * Minimum hours between insights based on frequency preference
 */
export const INSIGHT_FREQUENCY_HOURS: Record<'minimal' | 'normal' | 'frequent', number> = {
  minimal: 168, // 7 days
  normal: 72,   // 3 days
  frequent: 24, // 1 day
}
