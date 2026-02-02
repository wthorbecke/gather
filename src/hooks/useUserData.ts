'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { content } from '@/config/content'
import { User } from '@supabase/supabase-js'
import { safeGetJSON, safeSetJSON, safeRemoveItem } from '@/lib/storage'
import { TaskCategory, TaskSource, TaskType, RecurrenceFrequency, IntegrationProvider, type ActiveTaskCategory } from '@/lib/constants'

// Demo starter tasks with pre-generated AI steps
// These showcase the app's value without requiring API calls
const DEMO_STARTER_TASKS: Array<{
  title: string
  description: string | null
  category: typeof TaskCategory.SOON
  badge: string | null
  steps: Step[]
}> = [
  {
    title: 'File taxes',
    description: 'California state + federal',
    category: TaskCategory.SOON,
    badge: null,
    steps: [
      {
        id: 'step-1',
        text: 'Gather your tax documents',
        done: true, // Show one completed to demonstrate progress
        summary: 'W-2s, 1099s, and deduction receipts',
        time: '20 min',
      },
      {
        id: 'step-2',
        text: 'Go to ftb.ca.gov and click "File Online" to access CalFile',
        done: false,
        summary: 'Start the official CA filing system',
        source: { name: 'California FTB', url: 'https://ftb.ca.gov' },
      },
      {
        id: 'step-3',
        text: 'Complete your federal return first using the same tax software',
        done: false,
        summary: 'Federal must be done before state',
        source: { name: 'IRS Free File', url: 'https://www.irs.gov/filing/free-file-do-your-federal-taxes-for-free' },
      },
      {
        id: 'step-4',
        text: 'Enter your federal AGI and wage information into CalFile',
        done: false,
        summary: 'Transfer federal data to CA return',
      },
      {
        id: 'step-5',
        text: 'Review both returns, e-file them, and save confirmation numbers',
        done: false,
        summary: 'Double-check and submit everything',
      },
    ],
  },
  {
    title: 'Renew passport',
    description: null,
    category: TaskCategory.SOON,
    badge: null,
    steps: [
      {
        id: 'step-1',
        text: 'Go to travel.state.gov and download Form DS-82',
        done: false,
        summary: 'Renewal by mail form for adults',
        source: { name: 'US State Dept', url: 'https://travel.state.gov/content/travel/en/passports/have-passport/renew.html' },
        time: '5 min',
      },
      {
        id: 'step-2',
        text: 'Get a new passport photo at CVS, Walgreens, or USPS',
        done: false,
        summary: '2x2 inch photo, white background, taken within 6 months',
        time: '15 min',
      },
      {
        id: 'step-3',
        text: 'Write a check for $130 to "U.S. Department of State"',
        done: false,
        summary: 'Standard renewal fee (add $60 for expedited)',
      },
      {
        id: 'step-4',
        text: 'Mail form, old passport, photo, and check via USPS Priority',
        done: false,
        summary: 'Use tracking for peace of mind',
        action: { text: 'Schedule USPS pickup', url: 'https://tools.usps.com/schedule-pickup-steps.htm' },
      },
    ],
  },
  {
    title: 'Get Healthier',
    description: 'Improve energy levels',
    category: TaskCategory.SOON,
    badge: null,
    steps: [
      {
        id: 'step-1',
        text: 'Track your sleep for 3 nights',
        done: false,
        summary: 'Identify sleep patterns affecting energy',
        time: '2 min daily',
      },
      {
        id: 'step-2',
        text: 'Drink 16oz of water first thing each morning',
        done: false,
        summary: 'Rehydrate after 8 hours without water',
      },
      {
        id: 'step-3',
        text: 'Take a 10-minute walk between 11am and 2pm',
        done: false,
        summary: 'Natural light + movement boosts afternoon energy',
      },
      {
        id: 'step-4',
        text: 'Set a "wind down" alarm for 9pm',
        done: false,
        summary: 'Screens off, dim lights, prep for sleep',
      },
      {
        id: 'step-5',
        text: 'Review how you feel after 1 week',
        done: false,
        summary: 'Check in with yourself on energy levels',
      },
    ],
  },
]

// Starter content for authenticated users (empty - they start fresh)
const STARTER_TASKS: Array<{ title: string; description: string; category: typeof TaskCategory.SOON; badge: string; subtasks: []; notes: null }> = []

// Types
export interface Subtask {
  id: string
  title: string
  completed: boolean
}

// v17 Step interface - richer than Subtask
export interface Step {
  id: string | number
  text: string
  done: boolean
  summary?: string           // Brief summary when collapsed
  detail?: string            // Extended explanation when expanded
  alternatives?: string[]    // "Also accepted" options
  examples?: string[]
  checklist?: string[]       // Mini checklist within step
  time?: string              // Time estimate
  source?: { name: string; url: string }
  action?: { text: string; url: string }  // CTA button
}

export interface ClarifyingAnswer {
  question: string
  answer: string
}

// Recurrence pattern for habits
export interface Recurrence {
  frequency: RecurrenceFrequency
  days?: number[]  // 0-6 for weekly (Sun-Sat), 1-31 for monthly
}

// Streak tracking for habits
export interface Streak {
  current: number
  best: number
  lastCompleted?: string  // ISO date string
}

// External source info for synced items
export interface ExternalSource {
  provider: IntegrationProvider
  externalId?: string
  readOnly: boolean
}

export interface Task {
  id: string
  title: string
  description: string | null
  category: TaskCategory
  badge: string | null
  due_date: string | null
  snoozed_until?: string | null  // Task hidden until this date
  context: Record<string, unknown>
  context_text?: string | null  // v17 simple context string
  actions: TaskAction[]
  subtasks: Subtask[]
  steps?: Step[]  // v17 rich steps (replaces subtasks)
  notes: string | null
  clarifying_answers?: ClarifyingAnswer[]
  task_category?: string
  source?: TaskSource
  source_id?: string  // ID in source system (e.g., Gmail message ID)
  // Task type fields (v18)
  type?: TaskType                 // task, reminder, habit, event
  scheduled_at?: string | null    // ISO datetime for when it should happen
  recurrence?: Recurrence | null  // For habits
  streak?: Streak | null          // For habits
  external_source?: ExternalSource | null  // For synced external items
  duration?: number | null        // Duration in minutes
}

export interface TaskAction {
  type: 'link' | 'email' | 'ai_help'
  label: string
  url?: string
  email_key?: string
  ai_context?: string
  primary?: boolean
}

// ============ TASKS ============

export function useTasks(user: User | null) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const isDemoUser = Boolean(user?.id?.startsWith('demo-') || user?.email?.endsWith('@gather.local'))
  const demoStorageKey = content.demo.tasksStorageKey

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    if (isDemoUser) {
      const stored = safeGetJSON<Task[]>(demoStorageKey, [])
      if (stored.length > 0) {
        const hasStaleContext = stored.some((task) =>
          typeof task?.context_text === 'string' &&
          task.context_text.toLowerCase().includes('other (i will specify)')
        )
        if (!hasStaleContext) {
          setTasks(stored)
          setLoading(false)
          return
        }
        safeRemoveItem(demoStorageKey)
      }

      // Use demo starter tasks with pre-generated steps
      const seeded: Task[] = DEMO_STARTER_TASKS.map((t, i) => ({
        id: `demo-task-${i + 1}`,
        title: t.title,
        description: t.description,
        category: t.category,
        badge: t.badge,
        due_date: null,
        context: {},
        context_text: null,
        actions: [],
        subtasks: [],
        steps: t.steps,
        notes: null,
        clarifying_answers: [],
        task_category: undefined,
      }))
      setTasks(seeded)
      safeSetJSON(demoStorageKey, seeded)
      setLoading(false)
      return
    }

    const loadTasks = async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .neq('category', 'completed')
        .order('category')

      if (error) {
        // Error handled silently('Error loading tasks:', error)
        setLoading(false)
        return
      }

      // Seed starter task for new users
      if (!data || data.length === 0) {
        if (STARTER_TASKS.length === 0) {
          setTasks([])
          setLoading(false)
          return
        }

        const starterWithUser = STARTER_TASKS.map(t => ({ ...t, user_id: user.id, actions: [], subtasks: [], notes: null }))
        const { data: seededData, error: seedError } = await supabase
          .from('tasks')
          .insert(starterWithUser)
          .select()

        if (seedError) {
          // Error handled silently('Error seeding tasks:', seedError)
        } else {
          setTasks(seededData || [])
        }
        setLoading(false)
        return
      } else {
        setTasks(data)
      }
      setLoading(false)
    }

    loadTasks()
  }, [user])

  const completeTask = useCallback(async (taskId: string) => {
    if (!user) return

    if (isDemoUser) {
      setTasks((prev) => {
        const next = prev.filter((t) => t.id !== taskId)
        safeSetJSON(demoStorageKey, next)
        return next
      })
      return
    }

    setTasks((prev) => prev.filter((t) => t.id !== taskId))

    const { error } = await supabase
      .from('tasks')
      .update({
        category: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .eq('user_id', user.id)

    if (error) {
      // Error handled silently('Error completing task:', error)
    }
  }, [user, isDemoUser, demoStorageKey])

  const addTask = useCallback(async (
    title: string,
    category: ActiveTaskCategory,
    description?: string,
    badge?: string,
    clarifyingAnswers?: ClarifyingAnswer[],
    taskCategory?: string,
    dueDate?: string | null,
    taskType?: TaskType,
    scheduledAt?: string | null
  ) => {
    if (!user) return

    if (isDemoUser) {
      const newTask: Task = {
        id: `demo-task-${Date.now()}`,
        title,
        description: description || null,
        category,
        badge: badge || null,
        due_date: dueDate || null,
        context: {},
        context_text: null,
        actions: [],
        subtasks: [],
        steps: [],
        notes: null,
        clarifying_answers: clarifyingAnswers || [],
        task_category: taskCategory || undefined,
        type: taskType || 'task',
        scheduled_at: scheduledAt || null,
      }
      setTasks((prev) => {
        const next = [newTask, ...prev]
        safeSetJSON(demoStorageKey, next)
        return next
      })
      return newTask
    }

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title,
        description: description || null,
        category,
        badge: badge || null,
        due_date: dueDate || null,
        actions: [],
        subtasks: [],
        notes: null,
        clarifying_answers: clarifyingAnswers || [],
        task_category: taskCategory || undefined,
        type: taskType || 'task',
        scheduled_at: scheduledAt || null,
      })
      .select()
      .single()

    if (error) {
      // Error handled silently('Error adding task:', error)
    } else if (data) {
      // Prepend new tasks so they appear at the top
      setTasks((prev) => [data, ...prev])
    }

    return data
  }, [user])

  const updateTask = useCallback(async (
    taskId: string,
    updates: Partial<Pick<Task, 'title' | 'description' | 'subtasks' | 'steps' | 'notes' | 'category' | 'badge' | 'context_text' | 'due_date' | 'snoozed_until' | 'type' | 'scheduled_at' | 'streak' | 'recurrence' | 'duration' | 'external_source'>>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' }

    if (isDemoUser) {
      setTasks((prev) => {
        const next = prev.map((t) => t.id === taskId ? { ...t, ...updates } : t)
        safeSetJSON(demoStorageKey, next)
        return next
      })
      return { success: true }
    }

    // Store previous state for rollback
    const previousTasks = tasks

    // Optimistic update
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, ...updates } : t))

    const { error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .eq('user_id', user.id)

    if (error) {
      // Error handled silently('Error updating task:', error)

      // Check for schema errors - don't revert UI, just warn
      if (error.code === 'PGRST204') {
        // Warning handled silently('Schema mismatch - some columns may not exist. Run migration 004_add_steps_column.sql')
        // Keep optimistic update for UI, but return error
        return {
          success: false,
          error: `Database schema error: ${error.message}. Please run migrations.`
        }
      }

      // Revert optimistic update on other failures
      setTasks(previousTasks)
      return { success: false, error: error.message }
    }

    return { success: true }
  }, [user, tasks])

  const toggleStep = useCallback(async (taskId: string, stepId: string | number) => {
    if (!user) return

    if (isDemoUser) {
      setTasks((prev) => {
        const next = prev.map((t) => {
          if (t.id !== taskId || !t.steps) return t
          const updatedSteps = t.steps.map((s) =>
            s.id === stepId ? { ...s, done: !s.done } : s
          )
          return { ...t, steps: updatedSteps }
        })
        safeSetJSON(demoStorageKey, next)
        return next
      })
      return
    }

    // Find the task and step
    const task = tasks.find(t => t.id === taskId)
    if (!task || !task.steps) return

    const stepIndex = task.steps.findIndex(s => s.id === stepId)
    if (stepIndex === -1) return

    // Optimistic update
    const newSteps = task.steps.map(s =>
      s.id === stepId ? { ...s, done: !s.done } : s
    )
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, steps: newSteps } : t
    ))

    // Sync to database
    const { error } = await supabase
      .from('tasks')
      .update({ steps: newSteps })
      .eq('id', taskId)
      .eq('user_id', user.id)

    if (error) {
      // Error handled silently('Error toggling step:', error)
      // Revert on error
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, steps: task.steps } : t
      ))
    }
  }, [user, tasks])

  const deleteTask = useCallback(async (taskId: string): Promise<Task | null> => {
    if (!user) return null

    // Find the task before deleting (for undo)
    const deletedTask = tasks.find(t => t.id === taskId) || null

    if (isDemoUser) {
      setTasks((prev) => {
        const next = prev.filter((t) => t.id !== taskId)
        safeSetJSON(demoStorageKey, next)
        return next
      })
      return deletedTask
    }

    // Store previous state for rollback
    const previousTasks = tasks

    // Optimistic update - remove from list immediately
    setTasks(prev => prev.filter(t => t.id !== taskId))

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', user.id)

    if (error) {
      // Error handled silently('Error deleting task:', error)
      // Revert on error
      setTasks(previousTasks)
      return null
    }

    return deletedTask
  }, [user, tasks, isDemoUser, demoStorageKey])

  // Restore a previously deleted task (for undo)
  const restoreTask = useCallback(async (task: Task): Promise<boolean> => {
    if (!user) return false

    if (isDemoUser) {
      setTasks((prev) => {
        const next = [task, ...prev]
        safeSetJSON(demoStorageKey, next)
        return next
      })
      return true
    }

    // Optimistic update
    setTasks(prev => [task, ...prev])

    const { error } = await supabase
      .from('tasks')
      .insert({
        id: task.id,
        user_id: user.id,
        title: task.title,
        description: task.description,
        category: task.category,
        badge: task.badge,
        due_date: task.due_date,
        context: task.context,
        context_text: task.context_text,
        actions: task.actions,
        subtasks: task.subtasks,
        steps: task.steps,
        notes: task.notes,
        clarifying_answers: task.clarifying_answers,
        task_category: task.task_category,
        source: task.source,
        source_id: task.source_id,
      })

    if (error) {
      // Error handled silently('Error restoring task:', error)
      // Revert on error
      setTasks(prev => prev.filter(t => t.id !== task.id))
      return false
    }

    return true
  }, [user, isDemoUser, demoStorageKey])

  return { tasks, completeTask, addTask, updateTask, toggleStep, deleteTask, restoreTask, loading }
}
