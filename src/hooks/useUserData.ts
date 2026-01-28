'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { content } from '@/config/content'
import { User } from '@supabase/supabase-js'

// Get today's date as YYYY-MM-DD
const getToday = () => new Date().toISOString().split('T')[0]

// Starter content for new users
const STARTER_HABITS = [
  { name: 'Make bed', category: 'morning', sort_order: 1 },
  { name: 'Drink water', category: 'morning', sort_order: 2 },
  { name: 'Wordle', category: 'games', link: 'https://www.nytimes.com/games/wordle', sort_order: 1 },
  { name: 'Read for 10 min', category: 'optional', sort_order: 1 },
]

const STARTER_SOUL_ACTIVITIES = [
  { name: 'Call someone you love', icon: '📞', icon_color: 'var(--rose-soft)', sort_order: 1 },
  { name: 'Go outside', icon: '🚶', icon_color: 'var(--sage-soft)', sort_order: 2 },
  { name: 'Make something', icon: '🎨', icon_color: 'var(--sky-soft)', sort_order: 3 },
]

const STARTER_TASKS: Array<{ title: string; description: string; category: 'soon'; badge: string; subtasks: []; notes: null }> = []

// Types
export interface Habit {
  id: string
  name: string
  description: string | null
  category: 'morning' | 'games' | 'optional'
  link: string | null
  sort_order: number
}

export interface SoulActivity {
  id: string
  name: string
  icon: string
  icon_color: string
  default_text: string | null
  sort_order: number
}

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

export interface Task {
  id: string
  title: string
  description: string | null
  category: 'urgent' | 'soon' | 'waiting' | 'completed'
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
}

export interface TaskAction {
  type: 'link' | 'email' | 'ai_help'
  label: string
  url?: string
  email_key?: string
  ai_context?: string
  primary?: boolean
}

// ============ HABITS ============

export function useHabits(user: User | null) {
  const [habits, setHabits] = useState<Habit[]>([])
  const [completedHabits, setCompletedHabits] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  // Load habits and today's completions
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      // Load user's habits
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('sort_order')

      if (habitsError) {
        console.error('Error loading habits:', habitsError)
        setLoading(false)
        return
      }

      // Seed starter habits for new users
      if (!habitsData || habitsData.length === 0) {
        const starterWithUser = STARTER_HABITS.map(h => ({ ...h, user_id: user.id }))
        const { data: seededData, error: seedError } = await supabase
          .from('habits')
          .insert(starterWithUser)
          .select()

        if (seedError) {
          console.error('Error seeding habits:', seedError)
        } else {
          setHabits(seededData || [])
        }
      } else {
        setHabits(habitsData)
      }

      // Load today's completions
      const today = getToday()
      const { data: logsData, error: logsError } = await supabase
        .from('habit_logs')
        .select('habit_id')
        .eq('user_id', user.id)
        .eq('date', today)

      if (logsError) {
        console.error('Error loading habit logs:', logsError)
      } else {
        const completedMap: Record<string, boolean> = {}
        logsData?.forEach((log) => {
          completedMap[log.habit_id] = true
        })
        setCompletedHabits(completedMap)
      }

      setLoading(false)
    }

    loadData()
  }, [user])

  const toggleHabit = useCallback(async (habitId: string) => {
    if (!user) return

    const today = getToday()
    const isCompleted = completedHabits[habitId]

    // Optimistic update
    setCompletedHabits((prev) => ({ ...prev, [habitId]: !isCompleted }))

    if (isCompleted) {
      const { error } = await supabase
        .from('habit_logs')
        .delete()
        .eq('user_id', user.id)
        .eq('habit_id', habitId)
        .eq('date', today)

      if (error) {
        console.error('Error removing habit log:', error)
        setCompletedHabits((prev) => ({ ...prev, [habitId]: true }))
      }
    } else {
      const { error } = await supabase
        .from('habit_logs')
        .insert({
          user_id: user.id,
          habit_id: habitId,
          date: today,
        })

      if (error) {
        console.error('Error adding habit log:', error)
        setCompletedHabits((prev) => ({ ...prev, [habitId]: false }))
      }
    }
  }, [user, completedHabits])

  const addHabit = useCallback(async (name: string, category: 'morning' | 'games' | 'optional', description?: string, link?: string) => {
    if (!user) return

    const sortOrder = habits.filter(h => h.category === category).length + 1

    const { data, error } = await supabase
      .from('habits')
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        category,
        link: link || null,
        sort_order: sortOrder,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding habit:', error)
    } else if (data) {
      setHabits((prev) => [...prev, data])
    }
  }, [user, habits])

  return { habits, completedHabits, toggleHabit, addHabit, loading }
}

// ============ SOUL ACTIVITIES ============

export function useSoulActivities(user: User | null) {
  const [activities, setActivities] = useState<SoulActivity[]>([])
  const [lastCompleted, setLastCompleted] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const loadData = async () => {
      // Load user's soul activities
      const { data: activitiesData, error: activitiesError } = await supabase
        .from('soul_activities')
        .select('*')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('sort_order')

      if (activitiesError) {
        console.error('Error loading soul activities:', activitiesError)
        setLoading(false)
        return
      }

      // Seed starter activities for new users
      if (!activitiesData || activitiesData.length === 0) {
        const starterWithUser = STARTER_SOUL_ACTIVITIES.map(a => ({ ...a, user_id: user.id }))
        const { data: seededData, error: seedError } = await supabase
          .from('soul_activities')
          .insert(starterWithUser)
          .select()

        if (seedError) {
          console.error('Error seeding soul activities:', seedError)
        } else {
          setActivities(seededData || [])
        }
      } else {
        setActivities(activitiesData)
      }

      // Load most recent completion for each activity
      const { data: logsData, error: logsError } = await supabase
        .from('soul_logs')
        .select('activity_id, completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })

      if (logsError) {
        console.error('Error loading soul logs:', logsError)
      } else {
        const lastMap: Record<string, number> = {}
        logsData?.forEach((log) => {
          if (!lastMap[log.activity_id]) {
            lastMap[log.activity_id] = new Date(log.completed_at).getTime()
          }
        })
        setLastCompleted(lastMap)
      }

      setLoading(false)
    }

    loadData()
  }, [user])

  const logActivity = useCallback(async (activityId: string) => {
    if (!user) return

    const now = Date.now()
    setLastCompleted((prev) => ({ ...prev, [activityId]: now }))

    const { error } = await supabase
      .from('soul_logs')
      .insert({
        user_id: user.id,
        activity_id: activityId,
        completed_at: new Date(now).toISOString(),
      })

    if (error) {
      console.error('Error logging soul activity:', error)
    }
  }, [user])

  const addActivity = useCallback(async (name: string, icon: string, defaultText?: string) => {
    if (!user) return

    const sortOrder = activities.length + 1
    const iconColors = ['var(--rose-soft)', 'var(--sky-soft)', 'var(--sage-soft)']
    const iconColor = iconColors[sortOrder % iconColors.length]

    const { data, error } = await supabase
      .from('soul_activities')
      .insert({
        user_id: user.id,
        name,
        icon,
        icon_color: iconColor,
        default_text: defaultText || null,
        sort_order: sortOrder,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding soul activity:', error)
    } else if (data) {
      setActivities((prev) => [...prev, data])
    }
  }, [user, activities])

  return { activities, lastCompleted, logActivity, addActivity, loading }
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
      try {
        const stored = localStorage.getItem(demoStorageKey)
        if (stored) {
          const parsed = JSON.parse(stored)
          const hasStaleContext = Array.isArray(parsed) && parsed.some((task) =>
            typeof task?.context_text === 'string' &&
            task.context_text.toLowerCase().includes('other (i will specify)')
          )
          if (!hasStaleContext) {
            setTasks(parsed || [])
            setLoading(false)
            return
          }
          localStorage.removeItem(demoStorageKey)
        }
      } catch (e) {
        console.warn('Failed to load demo tasks:', e)
      }

      const seeded = STARTER_TASKS.map((t, i) => ({
        id: `demo-task-${i + 1}`,
        title: t.title,
        description: t.description || null,
        category: t.category,
        badge: t.badge || null,
        due_date: null,
        context: {},
        context_text: null,
        actions: [],
        subtasks: [],
        steps: [],
        notes: null,
        clarifying_answers: [],
        task_category: undefined,
      }))
      setTasks(seeded)
      try {
        localStorage.setItem(demoStorageKey, JSON.stringify(seeded))
      } catch (e) {
        console.warn('Failed to save demo tasks:', e)
      }
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
        console.error('Error loading tasks:', error)
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
          console.error('Error seeding tasks:', seedError)
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
        try {
          localStorage.setItem(demoStorageKey, JSON.stringify(next))
        } catch (e) {
          console.warn('Failed to save demo tasks:', e)
        }
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
      console.error('Error completing task:', error)
    }
  }, [user])

  const addTask = useCallback(async (
    title: string,
    category: 'urgent' | 'soon' | 'waiting',
    description?: string,
    badge?: string,
    clarifyingAnswers?: ClarifyingAnswer[],
    taskCategory?: string,
    dueDate?: string | null
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
      }
      setTasks((prev) => {
        const next = [newTask, ...prev]
        try {
          localStorage.setItem(demoStorageKey, JSON.stringify(next))
        } catch (e) {
          console.warn('Failed to save demo tasks:', e)
        }
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
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding task:', error)
    } else if (data) {
      // Prepend new tasks so they appear at the top
      setTasks((prev) => [data, ...prev])
    }

    return data
  }, [user])

  const updateTask = useCallback(async (
    taskId: string,
    updates: Partial<Pick<Task, 'title' | 'description' | 'subtasks' | 'steps' | 'notes' | 'category' | 'badge' | 'context_text' | 'due_date' | 'snoozed_until'>>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' }

    if (isDemoUser) {
      setTasks((prev) => {
        const next = prev.map((t) => t.id === taskId ? { ...t, ...updates } : t)
        try {
          localStorage.setItem(demoStorageKey, JSON.stringify(next))
        } catch (e) {
          console.warn('Failed to save demo tasks:', e)
        }
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
      console.error('Error updating task:', error)

      // Check for schema errors - don't revert UI, just warn
      if (error.code === 'PGRST204') {
        console.warn('Schema mismatch - some columns may not exist. Run migration 004_add_steps_column.sql')
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
        try {
          localStorage.setItem(demoStorageKey, JSON.stringify(next))
        } catch (e) {
          console.warn('Failed to save demo tasks:', e)
        }
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
      console.error('Error toggling step:', error)
      // Revert on error
      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, steps: task.steps } : t
      ))
    }
  }, [user, tasks])

  const deleteTask = useCallback(async (taskId: string) => {
    if (!user) return

    if (isDemoUser) {
      setTasks((prev) => {
        const next = prev.filter((t) => t.id !== taskId)
        try {
          localStorage.setItem(demoStorageKey, JSON.stringify(next))
        } catch (e) {
          console.warn('Failed to save demo tasks:', e)
        }
        return next
      })
      return
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
      console.error('Error deleting task:', error)
      // Revert on error
      setTasks(previousTasks)
    }
  }, [user, tasks, isDemoUser])

  return { tasks, completeTask, addTask, updateTask, toggleStep, deleteTask, loading }
}

// ============ ZONE TASKS ============

export function useZoneTasks(user: User | null) {
  const [zoneTasks, setZoneTasks] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const loadZoneTasks = async () => {
      // Use maybeSingle() to avoid PGRST116 error when no row exists
      const { data, error } = await supabase
        .from('user_data')
        .select('zone_tasks')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Error loading zone tasks:', error)
      } else if (data?.zone_tasks) {
        setZoneTasks(data.zone_tasks)
      }
      setLoading(false)
    }

    loadZoneTasks()
  }, [user])

  const toggleZoneTask = useCallback(async (taskId: string) => {
    if (!user) return

    const newTasks = { ...zoneTasks, [taskId]: !zoneTasks[taskId] }
    setZoneTasks(newTasks)

    const { error } = await supabase
      .from('user_data')
      .upsert({
        user_id: user.id,
        zone_tasks: newTasks,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    if (error) {
      console.error('Error saving zone tasks:', error)
      setZoneTasks(zoneTasks)
    }
  }, [user, zoneTasks])

  return { zoneTasks, toggleZoneTask, loading }
}
