import { NextRequest, NextResponse } from 'next/server'
import { requireAuthWithClient } from '@/lib/api-auth'
import { AI_MODELS, AI_MAX_TOKENS, AI_TEMPERATURE } from '@/config/ai'
import {
  buildTaskIntelligencePrompt,
  TaskIntelligenceResponseSchema,
  DEFAULT_TASK_INTELLIGENCE,
  parseAIResponse,
  extractJSON,
  calculateAvgCompletionDays,
  analyzeUserPatterns,
  analyzeInsightHistory,
  transformTask,
  type TaskRow,
  type CompletedTaskRow,
  type CompletionRow,
  type InsightRow,
  type TaskIntelligenceResponse,
} from '@/lib/ai'

export async function GET(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  // Authenticate and get client
  const auth = await requireAuthWithClient(request)
  if (auth instanceof NextResponse) {
    return auth
  }

  const { user, supabase } = auth

  try {
    // Fetch open tasks (not completed)
    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, created_at, category, due_date, steps, updated_at, notes')
      .eq('user_id', user.id)
      .neq('category', 'completed')
      .order('created_at', { ascending: true })

    if (tasksError) {
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    // No tasks = no observations
    if (!tasks || tasks.length === 0) {
      return NextResponse.json({ observations: [], message: 'No open tasks' })
    }

    // Fetch data for pattern analysis (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Tables not yet in generated Supabase types - cast as needed
    const [{ data: completions }, { data: completedTasks }, { data: insights }] = await Promise.all([
      // For day/hour patterns (task_completions may not exist yet)
      (supabase as any)
        .from('task_completions')
        .select('completed_at, completion_day_of_week, completion_hour')
        .eq('user_id', user.id)
        .gte('completed_at', thirtyDaysAgo.toISOString()),
      // For average completion time (need created_at from tasks table)
      supabase
        .from('tasks')
        .select('created_at, completed_at')
        .eq('user_id', user.id)
        .eq('category', 'completed')
        .not('completed_at', 'is', null)
        .gte('completed_at', thirtyDaysAgo.toISOString())
        .limit(50),
      // Insight history (task_insights may not exist yet)
      (supabase as any)
        .from('task_insights')
        .select('task_id, outcome, action_delay_hours, shown_at')
        .eq('user_id', user.id)
        .order('shown_at', { ascending: false })
        .limit(50),
    ]) as [
      { data: CompletionRow[] | null },
      { data: CompletedTaskRow[] | null },
      { data: InsightRow[] | null }
    ]

    const avgCompletionDays = calculateAvgCompletionDays((completedTasks || []) as CompletedTaskRow[])
    const patterns = analyzeUserPatterns(completions || [], avgCompletionDays)
    const history = analyzeInsightHistory(insights || [])
    const taskData = (tasks as TaskRow[]).map(transformTask)
    const now = new Date()

    // Build and execute prompt with learning context
    const prompt = buildTaskIntelligencePrompt(taskData, patterns, now, history)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.taskIntelligence,
        max_tokens: AI_MAX_TOKENS.taskIntelligence,
        temperature: AI_TEMPERATURE.taskIntelligence,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ observations: DEFAULT_TASK_INTELLIGENCE })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    // Parse and validate response
    const extracted = extractJSON(text)
    const { success, data: observations } = parseAIResponse<TaskIntelligenceResponse>(
      TaskIntelligenceResponseSchema,
      extracted,
      DEFAULT_TASK_INTELLIGENCE,
      'task-intelligence'
    )

    if (!success) {
      return NextResponse.json({ observations: DEFAULT_TASK_INTELLIGENCE })
    }

    // Sort by priority and return only the top observation
    const sorted = observations
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 1)

    return NextResponse.json({
      observations: sorted,
      analyzed: tasks.length,
      patterns,
    })
  } catch {
    return NextResponse.json({ observations: DEFAULT_TASK_INTELLIGENCE })
  }
}
