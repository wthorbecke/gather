'use client'

import { useMemo } from 'react'
import { Task, Step } from './useUserData'

export interface SearchResult {
  type: 'task' | 'step'
  task: Task
  step?: Step
}

export function useTaskSearch(tasks: Task[], query: string): SearchResult[] {
  return useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return []

    const results: SearchResult[] = []

    for (const task of tasks) {
      // Search task title
      if (task.title.toLowerCase().includes(q)) {
        results.push({ type: 'task', task })
      }

      // Search steps
      const steps = task.steps || []
      for (const step of steps) {
        if (step.text.toLowerCase().includes(q)) {
          results.push({ type: 'step', task, step })
        }
      }
    }

    return results.slice(0, 6)
  }, [tasks, query])
}

export function getNextStep(tasks: Task[]): { task: Task; step: Step } | null {
  for (const task of tasks) {
    const steps = task.steps || []
    const nextStep = steps.find((s) => !s.done)
    if (nextStep) {
      return { task, step: nextStep }
    }
  }
  return null
}
