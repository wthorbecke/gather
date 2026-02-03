/**
 * Task Intelligence Database Operations
 *
 * Typed wrappers for task_insights and task_completions tables
 * which are not yet in generated Supabase types.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================================================
// Table Row Types (matching schema.sql)
// ============================================================================

/**
 * Row type for task_insights table
 */
export interface TaskInsightRow {
  id: string
  user_id: string
  task_id: string
  insight_type: 'stuck' | 'vague' | 'needs_deadline' | 'pattern'
  observation: string
  suggestion: string
  shown_at: string
  outcome: 'acted' | 'dismissed' | 'ignored' | 'task_completed' | null
  outcome_at: string | null
  action_delay_hours: number | null
  created_at: string
}

/**
 * Row type for task_completions table
 */
export interface TaskCompletionRow {
  id: string
  user_id: string
  task_id: string
  step_id: string | null
  completed_at: string
  completion_day_of_week: number // 0=Sunday, 6=Saturday
  completion_hour: number // 0-23
  created_at: string
}

// ============================================================================
// Insert Types (for creating new rows)
// ============================================================================

export interface TaskInsightInsert {
  user_id: string
  task_id: string
  insight_type: TaskInsightRow['insight_type']
  observation: string
  suggestion: string
}

export interface TaskInsightUpdate {
  outcome: NonNullable<TaskInsightRow['outcome']>
  outcome_at: string
  action_delay_hours: number
}

export interface TaskCompletionInsert {
  user_id: string
  task_id: string
  step_id?: string | null
  completed_at?: string
  completion_day_of_week?: number
  completion_hour?: number
}

// ============================================================================
// Query Types (for selecting specific columns)
// ============================================================================

export type TaskInsightIdOnly = Pick<TaskInsightRow, 'id'>
export type TaskInsightShownAtOnly = Pick<TaskInsightRow, 'shown_at'>

// ============================================================================
// Database Operations
// ============================================================================

/**
 * Task Insights operations
 */
export const taskInsightsDb = {
  /**
   * Find a recent insight for a task (within specified days)
   */
  async findRecentForTask(
    supabase: SupabaseClient,
    userId: string,
    taskId: string,
    withinDays: number = 7
  ): Promise<TaskInsightIdOnly | null> {
    const cutoff = new Date(Date.now() - withinDays * 24 * 60 * 60 * 1000).toISOString()

    const { data } = await supabase
      .from('task_insights')
      .select('id')
      .eq('user_id', userId)
      .eq('task_id', taskId)
      .gte('shown_at', cutoff)
      .maybeSingle()

    return data as TaskInsightIdOnly | null
  },

  /**
   * Insert a new task insight
   */
  async insert(
    supabase: SupabaseClient,
    insight: TaskInsightInsert
  ): Promise<{ id: string } | null> {
    const { data, error } = await supabase
      .from('task_insights')
      .insert(insight)
      .select('id')
      .single()

    if (error) {
      console.error('[task-insights] Insert error:', error)
      return null
    }

    return data as { id: string }
  },

  /**
   * Get insight by ID (for user)
   */
  async getById(
    supabase: SupabaseClient,
    insightId: string,
    userId: string
  ): Promise<TaskInsightShownAtOnly | null> {
    const { data } = await supabase
      .from('task_insights')
      .select('shown_at')
      .eq('id', insightId)
      .eq('user_id', userId)
      .single()

    return data as TaskInsightShownAtOnly | null
  },

  /**
   * Update insight outcome
   */
  async updateOutcome(
    supabase: SupabaseClient,
    insightId: string,
    userId: string,
    update: TaskInsightUpdate
  ): Promise<boolean> {
    const { error } = await supabase
      .from('task_insights')
      .update(update)
      .eq('id', insightId)
      .eq('user_id', userId)

    if (error) {
      console.error('[task-insights] Update error:', error)
      return false
    }

    return true
  },

  /**
   * Get insight history for a user (for pattern analysis)
   */
  async getHistory(
    supabase: SupabaseClient,
    userId: string,
    limit: number = 50
  ): Promise<Array<Pick<TaskInsightRow, 'task_id' | 'outcome' | 'action_delay_hours' | 'shown_at'>>> {
    const { data } = await supabase
      .from('task_insights')
      .select('task_id, outcome, action_delay_hours, shown_at')
      .eq('user_id', userId)
      .order('shown_at', { ascending: false })
      .limit(limit)

    return (data || []) as Array<Pick<TaskInsightRow, 'task_id' | 'outcome' | 'action_delay_hours' | 'shown_at'>>
  },

  /**
   * Get insight history for multiple users (for cron job)
   */
  async getHistoryForUsers(
    supabase: SupabaseClient,
    userIds: string[]
  ): Promise<Array<Pick<TaskInsightRow, 'user_id' | 'task_id' | 'outcome' | 'action_delay_hours' | 'shown_at'>>> {
    const { data } = await supabase
      .from('task_insights')
      .select('user_id, task_id, outcome, action_delay_hours, shown_at')
      .in('user_id', userIds)
      .order('shown_at', { ascending: false })

    return (data || []) as Array<Pick<TaskInsightRow, 'user_id' | 'task_id' | 'outcome' | 'action_delay_hours' | 'shown_at'>>
  },
}

/**
 * Task Completions operations
 */
export const taskCompletionsDb = {
  /**
   * Get completions for pattern analysis (for a user)
   */
  async getForPatterns(
    supabase: SupabaseClient,
    userId: string,
    sinceDate: Date
  ): Promise<Array<Pick<TaskCompletionRow, 'completed_at' | 'completion_day_of_week' | 'completion_hour'>>> {
    const { data } = await supabase
      .from('task_completions')
      .select('completed_at, completion_day_of_week, completion_hour')
      .eq('user_id', userId)
      .gte('completed_at', sinceDate.toISOString())

    return (data || []) as Array<Pick<TaskCompletionRow, 'completed_at' | 'completion_day_of_week' | 'completion_hour'>>
  },

  /**
   * Get completions for multiple users (for cron job)
   */
  async getForPatternsByUsers(
    supabase: SupabaseClient,
    userIds: string[],
    sinceDate: Date
  ): Promise<Array<Pick<TaskCompletionRow, 'user_id' | 'completed_at' | 'completion_day_of_week' | 'completion_hour'>>> {
    const { data } = await supabase
      .from('task_completions')
      .select('user_id, completed_at, completion_day_of_week, completion_hour')
      .in('user_id', userIds)
      .gte('completed_at', sinceDate.toISOString())

    return (data || []) as Array<Pick<TaskCompletionRow, 'user_id' | 'completed_at' | 'completion_day_of_week' | 'completion_hour'>>
  },

  /**
   * Insert a new completion record
   */
  async insert(
    supabase: SupabaseClient,
    completion: TaskCompletionInsert
  ): Promise<boolean> {
    const { error } = await supabase
      .from('task_completions')
      .insert(completion)

    if (error) {
      console.error('[task-completions] Insert error:', error)
      return false
    }

    return true
  },
}
