'use client'

import { useMemo } from 'react'
import { Task } from '@/hooks/useUserData'
import { TaskType } from '@/lib/constants'

interface StatsCardProps {
  tasks: Task[]
}

// Day names for display
const SHORT_DAY_NAMES = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

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
      </div>
    </div>
  )
}
