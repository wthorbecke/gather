'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
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

const STARTER_TASKS = [
  { title: 'Review my habits', description: 'Customize the habits above to fit your routine', category: 'soon', badge: 'Quick', subtasks: [], notes: null },
]

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
  context: Record<string, unknown>
  actions: TaskAction[]
  subtasks: Subtask[]
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

  useEffect(() => {
    if (!user) {
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
      } else {
        setTasks(data)
      }
      setLoading(false)
    }

    loadTasks()
  }, [user])

  const completeTask = useCallback(async (taskId: string) => {
    if (!user) return

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
    taskCategory?: string
  ) => {
    if (!user) return

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title,
        description: description || null,
        category,
        badge: badge || null,
        actions: [],
        subtasks: [],
        notes: null,
        clarifying_answers: clarifyingAnswers || [],
        task_category: taskCategory || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding task:', error)
    } else if (data) {
      setTasks((prev) => [...prev, data])
    }
    
    return data
  }, [user])

  const updateTask = useCallback(async (
    taskId: string,
    updates: Partial<Pick<Task, 'title' | 'description' | 'subtasks' | 'notes' | 'category' | 'badge'>>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Not authenticated' }

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
      // Revert optimistic update on failure
      setTasks(previousTasks)

      // Check for schema errors
      if (error.code === 'PGRST204') {
        return {
          success: false,
          error: `Database schema error: ${error.message}. Please run migrations.`
        }
      }

      return { success: false, error: error.message }
    }

    return { success: true }
  }, [user, tasks])

  return { tasks, completeTask, addTask, updateTask, loading }
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
