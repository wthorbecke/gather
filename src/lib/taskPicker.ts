/**
 * Task Picker - Smart Task Selection Algorithm
 *
 * Picks the ONE best task for the user to work on now, eliminating decision paralysis.
 * Uses multiple signals to rank tasks intelligently.
 */

import { Task } from '@/hooks/useUserData'
import { getDeadlineUrgency } from '@/components/DeadlineBadge'
import { EnergyLevel } from '@/lib/constants'

interface TaskScore {
  task: Task
  score: number
  reasons: string[]
}

/**
 * Calculate a score for a task based on multiple factors.
 * Higher score = higher priority.
 */
function scoreTask(task: Task, userEnergy?: EnergyLevel | null): TaskScore {
  let score = 0
  const reasons: string[] = []

  // Skip completed tasks
  const incompleteSteps = task.steps?.filter(s => !s.done) || []
  if (incompleteSteps.length === 0) {
    return { task, score: -1000, reasons: ['Completed'] }
  }

  // 1. Pinned tasks get high priority
  if (task.pinned) {
    score += 50
    reasons.push('Pinned')
  }

  // 2. Deadline urgency (most important factor)
  const urgency = getDeadlineUrgency(task.due_date)
  if (urgency < 0) {
    // Overdue - highest priority
    score += 100 + Math.abs(urgency) * 10
    reasons.push(`Overdue by ${Math.abs(urgency)} days`)
  } else if (urgency === 0) {
    // Due today
    score += 80
    reasons.push('Due today')
  } else if (urgency === 1) {
    // Due tomorrow
    score += 60
    reasons.push('Due tomorrow')
  } else if (urgency <= 3) {
    // Due within 3 days
    score += 40
    reasons.push(`Due in ${urgency} days`)
  } else if (urgency <= 7) {
    // Due within a week
    score += 20
    reasons.push(`Due in ${urgency} days`)
  }

  // 3. Energy level match (if user provides their current energy)
  if (userEnergy && task.energy) {
    if (task.energy === userEnergy) {
      score += 30
      reasons.push('Matches your energy')
    } else if (
      (userEnergy === EnergyLevel.LOW && task.energy === EnergyLevel.MEDIUM) ||
      (userEnergy === EnergyLevel.MEDIUM && task.energy === EnergyLevel.HIGH)
    ) {
      // Slightly higher energy task is okay
      score += 10
    } else if (
      (userEnergy === EnergyLevel.LOW && task.energy === EnergyLevel.HIGH)
    ) {
      // High energy task when user has low energy - deprioritize
      score -= 20
      reasons.push('May be too demanding')
    }
  }

  // 4. Task progress - tasks that are started get slight boost
  const totalSteps = task.steps?.length || 0
  const completedSteps = totalSteps - incompleteSteps.length
  if (completedSteps > 0 && totalSteps > 1) {
    score += 15
    reasons.push(`${completedSteps}/${totalSteps} steps done`)
  }

  // 5. Time of day preferences (morning = high energy tasks, evening = low energy)
  const hour = new Date().getHours()
  if (hour >= 9 && hour <= 11 && task.energy === EnergyLevel.HIGH) {
    score += 10
    reasons.push('Good for morning')
  } else if (hour >= 20 && task.energy === EnergyLevel.LOW) {
    score += 10
    reasons.push('Good for evening')
  }

  // 6. Quick wins - tasks with short time estimates get small boost
  const firstStep = incompleteSteps[0]
  if (firstStep?.time) {
    const timeMatch = firstStep.time.match(/(\d+)/)
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10)
      if (minutes <= 5) {
        score += 15
        reasons.push('Quick win')
      } else if (minutes <= 15) {
        score += 5
      }
    }
  }

  return { task, score, reasons }
}

/**
 * Filter tasks to only those with incomplete steps (workable tasks).
 * Optionally excludes a specific task by ID.
 */
function getWorkableTasks(tasks: Task[], excludeId?: string | null): Task[] {
  return tasks.filter(t => {
    if (excludeId && t.id === excludeId) return false
    return t.steps?.some(s => !s.done)
  })
}

/**
 * Pick the best task for the user to work on right now.
 * Returns null if no tasks are available.
 */
export function pickBestTask(
  tasks: Task[],
  userEnergy?: EnergyLevel | null
): Task | null {
  if (!tasks.length) return null

  const workableTasks = getWorkableTasks(tasks)
  if (!workableTasks.length) return null

  // Score all tasks
  const scored = workableTasks.map(t => scoreTask(t, userEnergy))

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Return the top task
  return scored[0]?.task || null
}

/**
 * Get top N alternative tasks (for "Pick something else" feature)
 */
export function getAlternativeTasks(
  tasks: Task[],
  currentTaskId: string | null,
  limit: number = 3,
  userEnergy?: EnergyLevel | null
): Task[] {
  if (!tasks.length) return []

  const workableTasks = getWorkableTasks(tasks, currentTaskId)
  if (!workableTasks.length) return []

  // Score all tasks
  const scored = workableTasks.map(t => scoreTask(t, userEnergy))

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Return top N
  return scored.slice(0, limit).map(s => s.task)
}

/**
 * Get the reason why a task was picked (for UI display)
 */
export function getTaskPickReason(task: Task, userEnergy?: EnergyLevel | null): string {
  const { reasons } = scoreTask(task, userEnergy)

  // Return the most important reason
  if (reasons.length === 0) return 'Next up'
  if (reasons.includes('Overdue')) return reasons.find(r => r.includes('Overdue')) || 'Overdue'
  if (reasons.includes('Due today')) return 'Due today'
  if (reasons.includes('Due tomorrow')) return 'Due tomorrow'
  if (reasons.includes('Pinned')) return 'You pinned this'
  if (reasons.includes('Matches your energy')) return 'Matches your energy'
  if (reasons.includes('Quick win')) return 'Quick win'

  return reasons[0] || 'Next up'
}
