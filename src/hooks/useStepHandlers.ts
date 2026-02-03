'use client'

import { useCallback } from 'react'
import { Task, Step } from '@/hooks/useUserData'
import type { UndoAction } from '@/hooks/useUndo'
import type { MemoryEntry } from '@/hooks/useMemory'

interface StepHandlersOptions {
  tasks: Task[]
  toggleStep: (taskId: string, stepId: string | number) => Promise<void>
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<{ success: boolean; error?: string } | void>
  checkAndCelebrate: (
    task: Task,
    stepId: string | number,
    wasComplete: boolean,
    addEntry: (entry: Omit<MemoryEntry, 'id' | 'timestamp'>) => void
  ) => void
  pushUndo: (action: Omit<UndoAction, 'id' | 'timestamp'>) => void
  addEntry: (entry: Omit<MemoryEntry, 'id' | 'timestamp'>) => void
}

export interface StepHandlers {
  handleToggleStep: (taskId: string, stepId: string | number, inFocusMode?: boolean) => Promise<void>
  handleEditStep: (taskId: string, stepId: string | number, newText: string) => Promise<void>
  handleDeleteStep: (taskId: string, stepId: string | number) => Promise<void>
  handleAddStep: (taskId: string, text: string) => Promise<void>
  handleMoveStep: (taskId: string, stepId: string | number, direction: 'up' | 'down') => Promise<void>
}

/**
 * Hook that provides all step-related handlers for task management.
 * Consolidates toggle, edit, delete, add, and reorder operations.
 */
export function useStepHandlers({
  tasks,
  toggleStep,
  updateTask,
  checkAndCelebrate,
  pushUndo,
  addEntry,
}: StepHandlersOptions): StepHandlers {
  // Handle step toggle with celebration and undo
  const handleToggleStep = useCallback(async (taskId: string, stepId: string | number, inFocusMode = false) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) {
      await toggleStep(taskId, stepId)
      return
    }

    // Find the step being toggled
    const step = task.steps?.find((s) => s.id === stepId)
    const wasComplete = step?.done

    await toggleStep(taskId, stepId)

    // Check if this completes the task and celebrate if so
    if (wasComplete !== undefined) {
      checkAndCelebrate(task, stepId, wasComplete, addEntry)
    }

    // Offer undo when marking a step complete (not when uncompleting)
    if (step && !wasComplete) {
      const stepText = step.text.length > 30 ? step.text.slice(0, 30) + '...' : step.text
      pushUndo({
        type: 'toggle_step',
        description: `Completed "${stepText}"`,
        data: {
          taskId,
          stepId,
        },
      })
    }
  }, [toggleStep, tasks, addEntry, checkAndCelebrate, pushUndo])

  // Handle step edit
  const handleEditStep = useCallback(async (taskId: string, stepId: string | number, newText: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || !task.steps) return

    const updatedSteps = task.steps.map((s) =>
      s.id === stepId ? { ...s, text: newText } : s
    )

    await updateTask(taskId, { steps: updatedSteps })
  }, [tasks, updateTask])

  // Handle step deletion
  const handleDeleteStep = useCallback(async (taskId: string, stepId: string | number) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || !task.steps) return

    const updatedSteps = task.steps.filter((s) => s.id !== stepId)
    await updateTask(taskId, { steps: updatedSteps })
  }, [tasks, updateTask])

  // Handle adding a new step
  const handleAddStep = useCallback(async (taskId: string, text: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    const newStep: Step = {
      id: `step-${Date.now()}`,
      text,
      done: false,
    }

    const updatedSteps = [...(task.steps || []), newStep]
    await updateTask(taskId, { steps: updatedSteps } as Partial<Task>)
  }, [tasks, updateTask])

  // Handle moving a step up or down
  const handleMoveStep = useCallback(async (taskId: string, stepId: string | number, direction: 'up' | 'down') => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || !task.steps) return

    const index = task.steps.findIndex((s) => s.id === stepId)
    if (index === -1) return

    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= task.steps.length) return

    // Swap steps
    const updatedSteps = [...task.steps]
    const temp = updatedSteps[index]
    updatedSteps[index] = updatedSteps[newIndex]
    updatedSteps[newIndex] = temp

    await updateTask(taskId, { steps: updatedSteps })
  }, [tasks, updateTask])

  return {
    handleToggleStep,
    handleEditStep,
    handleDeleteStep,
    handleAddStep,
    handleMoveStep,
  }
}
