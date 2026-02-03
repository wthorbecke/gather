'use client'

import { useMemo } from 'react'
import { Task } from '@/hooks/useUserData'
import { TaskType } from '@/lib/constants'

interface StatsCardProps {
  tasks: Task[]
}

/**
 * Simple statistics card showing productivity insights
 * Designed to be non-overwhelming for ADHD users
 */
export function StatsCard({ tasks }: StatsCardProps) {
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

    // Only show if there's meaningful progress
    const hasProgress = stepsCompleted > 0 || activeStreaks.length > 0

    return {
      completedTasks,
      stepsCompleted,
      totalSteps,
      activeStreaks,
      bestStreak,
      hasProgress,
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
      </div>
    </div>
  )
}
