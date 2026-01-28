'use client'

import { useState, useEffect, useMemo } from 'react'
import { Task } from '@/hooks/useUserData'

interface StatsCardProps {
  tasks: Task[]
  completedTasksThisWeek?: number
}

/**
 * User stats card showing completion progress, streaks, and patterns
 */
export function StatsCard({ tasks, completedTasksThisWeek = 0 }: StatsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Calculate stats from tasks
  const stats = useMemo(() => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // Tasks with steps
    const tasksWithSteps = tasks.filter(t => t.steps && t.steps.length > 0)
    const totalSteps = tasksWithSteps.reduce((sum, t) => sum + (t.steps?.length || 0), 0)
    const completedSteps = tasksWithSteps.reduce(
      (sum, t) => sum + (t.steps?.filter(s => s.done).length || 0),
      0
    )

    // Tasks due soon (next 7 days)
    const weekFromNow = new Date(now)
    weekFromNow.setDate(weekFromNow.getDate() + 7)
    const dueSoon = tasks.filter(t => {
      if (!t.due_date) return false
      const dueDate = new Date(t.due_date)
      return dueDate >= now && dueDate <= weekFromNow
    }).length

    // Overdue tasks
    const overdue = tasks.filter(t => {
      if (!t.due_date) return false
      return new Date(t.due_date) < now
    }).length

    // Quick wins (tasks with steps that take <10 min total or single simple tasks)
    const quickWins = tasks.filter(t => {
      if (!t.steps || t.steps.length === 0) return true // Simple tasks without steps
      const incompleteSteps = t.steps.filter(s => !s.done)
      if (incompleteSteps.length === 0) return false // All done
      if (incompleteSteps.length === 1) return true // Just one step left

      // Check if remaining steps are quick
      const totalTime = incompleteSteps.reduce((sum, s) => {
        if (!s.time) return sum + 10 // Assume 10 min if no estimate
        const match = s.time.match(/(\d+)/)
        return sum + (match ? parseInt(match[1]) : 10)
      }, 0)
      return totalTime <= 15
    }).length

    // Progress percentage
    const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0

    return {
      totalTasks: tasks.length,
      totalSteps,
      completedSteps,
      progressPercent,
      dueSoon,
      overdue,
      quickWins,
      completedThisWeek: completedTasksThisWeek,
    }
  }, [tasks, completedTasksThisWeek])

  // Don't show if no tasks
  if (tasks.length === 0) return null

  return (
    <div className="mb-6">
      {/* Compact summary bar */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 bg-surface rounded-xl hover:bg-surface/80 transition-all"
      >
        <div className="flex items-center gap-4">
          {/* Progress ring */}
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="var(--border)"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="14"
                fill="none"
                stroke="var(--success)"
                strokeWidth="3"
                strokeDasharray={`${stats.progressPercent * 0.88} 88`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
              {stats.progressPercent}%
            </span>
          </div>

          {/* Quick stats */}
          <div className="flex gap-4 text-sm">
            {stats.overdue > 0 && (
              <span className="text-danger font-medium">
                {stats.overdue} overdue
              </span>
            )}
            {stats.dueSoon > 0 && (
              <span className="text-text-soft">
                {stats.dueSoon} due soon
              </span>
            )}
            {stats.quickWins > 0 && (
              <span className="text-success">
                {stats.quickWins} quick wins
              </span>
            )}
          </div>
        </div>

        <svg
          width={16}
          height={16}
          viewBox="0 0 16 16"
          className={`text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
        >
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        </svg>
      </button>

      {/* Expanded stats */}
      {isExpanded && (
        <div className="mt-2 p-4 bg-surface rounded-xl animate-rise">
          <div className="grid grid-cols-2 gap-4">
            <StatBox
              label="Steps done"
              value={`${stats.completedSteps}/${stats.totalSteps}`}
              subtext="across all tasks"
            />
            <StatBox
              label="Completed this week"
              value={String(stats.completedThisWeek)}
              subtext="tasks finished"
              highlight={stats.completedThisWeek > 0}
            />
            <StatBox
              label="Active tasks"
              value={String(stats.totalTasks)}
              subtext="in progress"
            />
            <StatBox
              label="Quick wins"
              value={String(stats.quickWins)}
              subtext="under 15 min"
              highlight={stats.quickWins > 0}
            />
          </div>

          {/* Motivational message */}
          <div className="mt-4 pt-4 border-t border-border text-center">
            <p className="text-sm text-text-soft">
              {getMotivationalMessage(stats)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

interface StatBoxProps {
  label: string
  value: string
  subtext: string
  highlight?: boolean
}

function StatBox({ label, value, subtext, highlight }: StatBoxProps) {
  return (
    <div className="text-center p-3 bg-elevated rounded-lg">
      <div className={`text-2xl font-bold ${highlight ? 'text-success' : 'text-text'}`}>
        {value}
      </div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
      <div className="text-xs text-text-muted opacity-70">{subtext}</div>
    </div>
  )
}

function getMotivationalMessage(stats: {
  progressPercent: number
  overdue: number
  quickWins: number
  completedThisWeek: number
}): string {
  if (stats.overdue > 0 && stats.quickWins > 0) {
    return `You have ${stats.quickWins} quick wins available. Start there to build momentum.`
  }
  if (stats.progressPercent >= 75) {
    return "You're almost there. Keep going."
  }
  if (stats.completedThisWeek >= 5) {
    return "Strong week. You're getting things done."
  }
  if (stats.progressPercent >= 50) {
    return "Halfway there. One step at a time."
  }
  if (stats.quickWins > 0) {
    return `${stats.quickWins} tasks can be done quickly. Pick one.`
  }
  return "Every step forward counts."
}
