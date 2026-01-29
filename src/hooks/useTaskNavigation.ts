'use client'

import { useState, useCallback } from 'react'
import { Task, Step } from '@/hooks/useUserData'

export interface ContextTag {
  type: 'task' | 'step'
  label: string
  task?: Task
  step?: Step
}

export interface TaskNavigationState {
  contextTags: ContextTag[]
  focusStepId: string | number | null
}

export interface TaskNavigationActions {
  /**
   * Navigate to a specific task
   * Returns the context tags to set (task as initial context)
   */
  goToTask: (taskId: string, tasks: Task[]) => ContextTag[]

  /**
   * Go back to home view
   */
  goHome: () => void

  /**
   * Set or clear step context (only one step at a time)
   */
  setStepContext: (step: Step | null) => void

  /**
   * Remove context tag - removing task tag clears all context
   */
  removeTag: (index: number) => void

  /**
   * Set the step to focus (scroll to)
   */
  setFocusStepId: (stepId: string | number | null) => void

  /**
   * Clear all context tags
   */
  clearContextTags: () => void

  /**
   * Set context tags directly
   */
  setContextTags: React.Dispatch<React.SetStateAction<ContextTag[]>>
}

/**
 * Hook for managing task navigation - task selection, navigation, breadcrumbs/context
 */
export function useTaskNavigation(): TaskNavigationState & TaskNavigationActions {
  const [contextTags, setContextTags] = useState<ContextTag[]>([])
  const [focusStepId, setFocusStepId] = useState<string | number | null>(null)

  const goToTask = useCallback((taskId: string, tasks: Task[]): ContextTag[] => {
    const task = tasks.find(t => t.id === taskId)
    // Set the task as initial context
    if (task) {
      const newTags: ContextTag[] = [{ type: 'task', label: task.title, task }]
      setContextTags(newTags)
      return newTags
    }
    return []
  }, [])

  const goHome = useCallback(() => {
    setContextTags([])
    setFocusStepId(null)
  }, [])

  const setStepContext = useCallback((step: Step | null) => {
    setContextTags(prev => {
      // Remove any existing step tags
      const withoutSteps = prev.filter(t => t.type !== 'step')
      // If step is null, just return without step
      if (!step) return withoutSteps
      // Add the new step context
      return [...withoutSteps, { type: 'step', label: step.text, step }]
    })
  }, [])

  const removeTag = useCallback((index: number) => {
    setContextTags(prev => {
      const tagToRemove = prev[index]
      // If removing the task tag, clear all context
      if (tagToRemove?.type === 'task') {
        return []
      }
      // Otherwise just remove the specific tag
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  const clearContextTags = useCallback(() => {
    setContextTags([])
  }, [])

  return {
    // State
    contextTags,
    focusStepId,

    // Actions
    goToTask,
    goHome,
    setStepContext,
    removeTag,
    setFocusStepId,
    clearContextTags,
    setContextTags,
  }
}
