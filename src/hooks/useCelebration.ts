'use client'

import { useState, useCallback } from 'react'
import { hapticSuccess } from '@/lib/haptics'
import { Task, Step } from '@/hooks/useUserData'
import type { MemoryEntry } from '@/hooks/useMemory'

export interface CelebrationState {
  showConfetti: boolean
  completedTaskName: string | null
}

export interface CelebrationActions {
  triggerCelebration: (taskName: string) => void
  dismissConfetti: () => void
  dismissCelebration: () => void
  /**
   * Check if completing a step would complete the entire task, and celebrate if so
   * @param task The task being worked on
   * @param stepId The step being toggled
   * @param wasComplete Whether the step was already complete before toggle
   * @param addEntry Callback to record completion in memory
   */
  checkAndCelebrate: (
    task: Task,
    stepId: string | number,
    wasComplete: boolean,
    addEntry: (entry: Omit<MemoryEntry, 'id' | 'timestamp'>) => void
  ) => void
}

/**
 * Hook for managing celebration state - confetti, completion celebrations, rewards
 */
export function useCelebration(): CelebrationState & CelebrationActions {
  const [showConfetti, setShowConfetti] = useState(false)
  const [completedTaskName, setCompletedTaskName] = useState<string | null>(null)

  const triggerCelebration = useCallback((taskName: string) => {
    setShowConfetti(true)
    setCompletedTaskName(taskName)
    hapticSuccess() // Celebrate with haptic feedback on mobile
  }, [])

  const dismissConfetti = useCallback(() => {
    setShowConfetti(false)
  }, [])

  const dismissCelebration = useCallback(() => {
    setCompletedTaskName(null)
  }, [])

  const checkAndCelebrate = useCallback((
    task: Task,
    stepId: string | number,
    wasComplete: boolean,
    addEntry: (entry: Omit<MemoryEntry, 'id' | 'timestamp'>) => void
  ) => {
    // If we're completing (not uncompleting) and this completes the task, celebrate!
    if (!wasComplete && task.steps && task.steps.length > 0) {
      const otherStepsDone = task.steps.filter((s: Step) => s.id !== stepId).every((s: Step) => s.done)
      const allDone = otherStepsDone // The current step is now done too
      if (allDone) {
        triggerCelebration(task.title)
        // Record completion in memory
        addEntry({
          type: 'task_completed',
          taskTitle: task.title,
        })
      }
    }
  }, [triggerCelebration])

  return {
    // State
    showConfetti,
    completedTaskName,

    // Actions
    triggerCelebration,
    dismissConfetti,
    dismissCelebration,
    checkAndCelebrate,
  }
}
