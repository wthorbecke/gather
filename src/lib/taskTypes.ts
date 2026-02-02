/**
 * Task Types Utilities
 *
 * Helper functions for working with different task types:
 * - task: one-time actionable items (default)
 * - reminder: time-triggered notifications
 * - habit: recurring items with streak tracking
 * - event: calendar blocks with start/end times
 */

import { TaskType } from './constants'
import type { Task } from '@/hooks/useUserData'

// Type icons as SVG path data (14px size)
export const TaskTypeIcons: Record<TaskType, string> = {
  task: '', // No icon or subtle checkbox
  reminder: 'M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zm0 16a3 3 0 01-3-3h6a3 3 0 01-3 3z', // Bell
  habit: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', // Refresh/cycle
  event: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', // Calendar
}

// Type colors (CSS variable names)
export const TaskTypeColors: Record<TaskType, string> = {
  task: 'text-text-muted',
  reminder: 'text-accent',
  habit: 'text-success',
  event: 'text-text-soft',
}

// Type labels for display
export const TaskTypeLabels: Record<TaskType, string> = {
  task: 'Task',
  reminder: 'Reminder',
  habit: 'Habit',
  event: 'Event',
}

/**
 * Get the icon path for a task type
 */
export function getTaskTypeIcon(type: TaskType | undefined): string {
  return TaskTypeIcons[type || TaskType.TASK]
}

/**
 * Get the color class for a task type
 */
export function getTaskTypeColor(type: TaskType | undefined): string {
  return TaskTypeColors[type || TaskType.TASK]
}

/**
 * Get the label for a task type
 */
export function getTaskTypeLabel(type: TaskType | undefined): string {
  return TaskTypeLabels[type || TaskType.TASK]
}

/**
 * Check if a task can be marked as completed
 * - Reminders: no completion state (they're notifications)
 * - Events: typically read-only from external sources
 * - Tasks and Habits: can be completed
 */
export function isCompletable(task: Task): boolean {
  const type = task.type || TaskType.TASK

  // Reminders don't have completion state
  if (type === TaskType.REMINDER) {
    return false
  }

  // Events from external sources are read-only
  if (type === TaskType.EVENT && task.external_source?.readOnly) {
    return false
  }

  return true
}

/**
 * Check if a task is overdue
 */
export function isOverdue(task: Task): boolean {
  if (!task.due_date && !task.scheduled_at) return false

  const dueDate = task.scheduled_at || task.due_date
  if (!dueDate) return false

  const due = new Date(dueDate)
  const now = new Date()

  return due < now
}

/**
 * Get time period of day for a date
 */
export function getTimePeriod(date: Date): 'morning' | 'afternoon' | 'evening' {
  const hour = date.getHours()
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

/**
 * Format scheduled time for display
 */
export function formatScheduledTime(scheduledAt: string | null | undefined): string | null {
  if (!scheduledAt) return null

  const date = new Date(scheduledAt)
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * Check if a habit should be shown today based on recurrence
 */
export function isHabitDueToday(task: Task): boolean {
  if (task.type !== TaskType.HABIT || !task.recurrence) return false

  const today = new Date()
  const { frequency, days } = task.recurrence

  switch (frequency) {
    case 'daily':
      return true
    case 'weekly':
      // days is 0-6 (Sun-Sat)
      return !days || days.length === 0 || days.includes(today.getDay())
    case 'monthly':
      // days is 1-31
      return !days || days.length === 0 || days.includes(today.getDate())
    default:
      return true
  }
}

/**
 * Check if a habit was completed today
 */
export function isHabitCompletedToday(task: Task): boolean {
  if (task.type !== TaskType.HABIT || !task.streak?.lastCompleted) return false

  const lastCompleted = new Date(task.streak.lastCompleted)
  const today = new Date()

  return (
    lastCompleted.getFullYear() === today.getFullYear() &&
    lastCompleted.getMonth() === today.getMonth() &&
    lastCompleted.getDate() === today.getDate()
  )
}

/**
 * Calculate new streak after completing a habit
 */
export function calculateNewStreak(currentStreak: number, lastCompleted: string | undefined): { current: number; shouldIncrement: boolean } {
  if (!lastCompleted) {
    return { current: 1, shouldIncrement: true }
  }

  const last = new Date(lastCompleted)
  const today = new Date()

  // Same day - don't increment
  if (
    last.getFullYear() === today.getFullYear() &&
    last.getMonth() === today.getMonth() &&
    last.getDate() === today.getDate()
  ) {
    return { current: currentStreak, shouldIncrement: false }
  }

  // Yesterday - increment streak
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (
    last.getFullYear() === yesterday.getFullYear() &&
    last.getMonth() === yesterday.getMonth() &&
    last.getDate() === yesterday.getDate()
  ) {
    return { current: currentStreak + 1, shouldIncrement: true }
  }

  // More than a day ago - reset streak
  return { current: 1, shouldIncrement: true }
}

// Input prefix patterns for quick type creation
export const TypePrefixes: Record<string, TaskType> = {
  '/r ': TaskType.REMINDER,
  '! ': TaskType.REMINDER,
  '/h ': TaskType.HABIT,
  '/e ': TaskType.EVENT,
}

/**
 * Parse type prefix from input text
 * Returns the detected type and the text with prefix removed
 */
export function parseTypePrefix(text: string): { type: TaskType; cleanText: string } {
  const lowerText = text.toLowerCase()

  for (const [prefix, type] of Object.entries(TypePrefixes)) {
    if (lowerText.startsWith(prefix)) {
      return {
        type,
        cleanText: text.slice(prefix.length).trim(),
      }
    }
  }

  return {
    type: TaskType.TASK,
    cleanText: text,
  }
}
