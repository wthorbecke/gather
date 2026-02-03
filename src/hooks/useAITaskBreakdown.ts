'use client'

import { useCallback } from 'react'
import { Task, Step } from '@/hooks/useUserData'
import { AICardState } from '@/components/AICard'
import { authFetch } from '@/lib/supabase'
import { createFallbackSteps, mapAIStepsToSteps } from '@/lib/taskHelpers'
import { splitStepText } from '@/lib/stepText'
import type { SubtaskItem, AnalyzeIntentStep } from '@/lib/api-types'
import type { ActiveTaskCategory } from '@/lib/constants'
import type { MemoryEntry } from '@/hooks/useMemory'

export interface TaskBreakdownDeps {
  addTask: (
    title: string,
    category: ActiveTaskCategory,
    description?: string,
    badge?: string,
    clarifyingAnswers?: Array<{ question: string; answer: string }>,
    taskCategory?: string,
    dueDate?: string | null
  ) => Promise<Task | undefined>
  updateTask: (
    taskId: string,
    updates: Partial<Task>
  ) => Promise<{ success: boolean; error?: string }>
  addEntry: (entry: Omit<MemoryEntry, 'id' | 'timestamp'>) => void
  setAiCard: React.Dispatch<React.SetStateAction<AICardState | null>>
}

export interface GenerateStepsOptions {
  taskTitle: string
  description?: string
  notes?: string
  existingSubtasks?: string[]
  clarifyingAnswers?: Array<{ question: string; answer: string }>
  context?: Record<string, unknown>
}

export interface CreateTaskWithStepsOptions {
  taskName: string
  contextSummary?: string
  detectedDeadline?: string | null
  steps?: Step[]
  clarifyingAnswers?: Record<string, string>
}

/**
 * Hook for task breakdown and step generation.
 *
 * Provides utilities for:
 * - Generating steps for a task via AI
 * - Creating tasks with AI-generated steps
 * - Adding steps to existing tasks
 */
export function useAITaskBreakdown(deps: TaskBreakdownDeps) {
  const { addTask, updateTask, addEntry, setAiCard } = deps

  /**
   * Generate steps for a task using the AI suggest-subtasks endpoint.
   * Returns the generated steps or fallback steps on failure.
   */
  const generateSteps = useCallback(async (options: GenerateStepsOptions): Promise<{
    steps: Step[]
    sources: Array<{ title: string; url: string }>
  }> => {
    const { taskTitle, description, notes, existingSubtasks, clarifyingAnswers, context } = options

    try {
      const response = await authFetch('/api/suggest-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          description,
          notes,
          existingSubtasks,
          clarifyingAnswers,
          context,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const sources = data.sources || []
        const steps = (data.subtasks || []).map((item: SubtaskItem | string, index: number) => {
          if (typeof item === 'string') {
            return { id: `step-${Date.now()}-${index}`, text: item, done: false }
          }
          const parsed = splitStepText(item.text || '')
          return {
            id: `step-${Date.now()}-${index}`,
            text: item.text || '',
            done: false,
            summary: item.summary || parsed.remainder,
            detail: item.detail,
            time: item.time,
            source: item.source,
            action: item.action,
          }
        })
        return { steps, sources }
      }
    } catch {
      // Fall through to fallback
    }

    // Fallback steps
    return {
      steps: createFallbackSteps(taskTitle, description || ''),
      sources: [],
    }
  }, [])

  /**
   * Add more steps to an existing task based on user notes.
   */
  const addStepsToTask = useCallback(async (
    task: Task,
    notes: string
  ): Promise<{ success: boolean; stepsAdded: number }> => {
    setAiCard({ thinking: true })

    try {
      const existingStepTexts = (task.steps || []).map(s => s.text)

      const response = await authFetch('/api/suggest-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          description: task.description,
          notes,
          existingSubtasks: existingStepTexts,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const newSteps = mapAIStepsToSteps(data.subtasks || [])

        await updateTask(task.id, {
          steps: [...(task.steps || []), ...newSteps],
        } as Partial<Task>)

        setAiCard({
          message: `Added ${newSteps.length} more steps.`,
        })

        return { success: true, stepsAdded: newSteps.length }
      }

      setAiCard({
        message: "Couldn't generate steps. Try being more specific.",
      })
      return { success: false, stepsAdded: 0 }
    } catch {
      setAiCard({
        message: "Something went wrong. Please try again.",
      })
      return { success: false, stepsAdded: 0 }
    }
  }, [setAiCard, updateTask])

  /**
   * Create a new task with AI-generated steps.
   */
  const createTaskWithSteps = useCallback(async (options: CreateTaskWithStepsOptions): Promise<Task | null> => {
    const { taskName, contextSummary, detectedDeadline, steps, clarifyingAnswers } = options

    const newTask = await addTask(
      taskName,
      'soon',
      undefined,
      undefined,
      undefined,
      undefined,
      detectedDeadline
    )

    if (!newTask) {
      return null
    }

    // Use provided steps or generate fallback
    const taskSteps = steps || createFallbackSteps(taskName, contextSummary || '')

    // Build context text from clarifying answers
    const contextText = clarifyingAnswers
      ? Object.entries(clarifyingAnswers)
          .map(([, value]) => value)
          .filter((value) => value && !value.toLowerCase().includes('other (i will specify)'))
          .join(' . ')
      : contextSummary

    try {
      await updateTask(newTask.id, {
        steps: taskSteps,
        context_text: contextText,
        due_date: detectedDeadline,
      } as Partial<Task>)
    } catch {
      // Steps column may need migration
    }

    // Add to memory
    addEntry({
      type: 'task_created',
      taskTitle: taskName,
      context: clarifyingAnswers || {},
    })

    return {
      ...newTask,
      steps: taskSteps,
      context_text: contextText || null,
    }
  }, [addTask, updateTask, addEntry])

  /**
   * Process AI analyze-intent response and create task with steps.
   * Handles the case when AI returns ifComplete steps.
   */
  const createTaskFromIntent = useCallback(async (
    taskName: string,
    intentData: {
      ifComplete?: {
        steps?: AnalyzeIntentStep[]
        contextSummary?: string
      }
      deadline?: { date?: string }
      extractedContext?: Record<string, unknown>
    }
  ): Promise<Task | null> => {
    const contextSummary = intentData.ifComplete?.contextSummary || ''
    const detectedDeadline = intentData.deadline?.date || null

    setAiCard({ thinking: true, message: "Researching the best steps for you..." })

    try {
      // Try to get better steps with web research
      const { steps, sources } = await generateSteps({
        taskTitle: taskName,
        description: contextSummary,
        context: intentData.extractedContext || {},
      })

      const createdTask = await createTaskWithSteps({
        taskName,
        contextSummary,
        detectedDeadline,
        steps,
      })

      if (createdTask) {
        setAiCard({
          message: "Here's your plan.",
          taskCreated: createdTask,
          sources,
        })
      }

      return createdTask
    } catch {
      // Fallback to original ifComplete steps
      const fallbackSteps: Step[] = (intentData.ifComplete?.steps || []).map((s, i) => ({
        id: `step-${Date.now()}-${i}`,
        text: s.text,
        done: false,
        summary: s.summary,
        detail: s.detail,
        time: s.time,
      }))

      const createdTask = await createTaskWithSteps({
        taskName,
        contextSummary,
        detectedDeadline,
        steps: fallbackSteps,
      })

      if (createdTask) {
        setAiCard({
          message: "Here's your plan.",
          taskCreated: createdTask,
        })
      }

      return createdTask
    }
  }, [setAiCard, generateSteps, createTaskWithSteps])

  /**
   * Create a simple task with auto-generated steps.
   * Used when AI doesn't need clarifying questions.
   */
  const createSimpleTask = useCallback(async (
    taskName: string,
    detectedDeadline?: string | null
  ): Promise<Task | null> => {
    setAiCard({ thinking: true, message: "Breaking this down for you..." })

    try {
      const { steps } = await generateSteps({ taskTitle: taskName, description: '' })

      const finalSteps = steps.length > 0 ? steps : createFallbackSteps(taskName, '')

      const createdTask = await createTaskWithSteps({
        taskName,
        detectedDeadline,
        steps: finalSteps,
      })

      if (createdTask) {
        setAiCard({
          message: "Here's your plan.",
          taskCreated: createdTask,
        })
      }

      return createdTask
    } catch {
      // Fallback - still create task with generic steps
      const fallbackSteps = createFallbackSteps(taskName, '')

      const createdTask = await createTaskWithSteps({
        taskName,
        detectedDeadline,
        steps: fallbackSteps,
      })

      if (createdTask) {
        setAiCard({
          message: "Here's your plan.",
          taskCreated: createdTask,
        })
      }

      return createdTask
    }
  }, [setAiCard, generateSteps, createTaskWithSteps])

  return {
    generateSteps,
    addStepsToTask,
    createTaskWithSteps,
    createTaskFromIntent,
    createSimpleTask,
  }
}
