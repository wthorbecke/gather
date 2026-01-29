import { NextRequest, NextResponse } from 'next/server'
import { requireAuthWithClient } from '@/lib/api-auth'
import { AI_MODELS, AI_MAX_TOKENS, AI_TEMPERATURE } from '@/config/ai'
import {
  buildTaskIntelligencePrompt,
  TaskIntelligenceResponseSchema,
  DEFAULT_TASK_INTELLIGENCE,
  parseAIResponse,
  extractJSON,
  type TaskForIntelligence,
  type UserPatterns,
  type TaskIntelligenceResponse,
  type InsightHistory,
} from '@/lib/ai'

interface TaskRow {
  id: string
  title: string
  created_at: string
  category: string
  due_date: string | null
  steps: Array<{ done?: boolean }> | null
  updated_at: string | null
  notes: string | null
}

interface CompletionRow {
  completed_at: string
  completion_day_of_week: number
  completion_hour: number
}

interface InsightRow {
  task_id: string
  outcome: string | null
  action_delay_hours: number | null
  shown_at: string
}

/**
 * Analyze user patterns from completion history
 */
function analyzeUserPatterns(completions: CompletionRow[]): UserPatterns {
  if (completions.length === 0) {
    return {
      avgCompletionDays: 7,
      preferredDays: [],
      productiveHours: 'unknown',
      recentCompletions: 0,
    }
  }

  // Count completions by day of week
  const dayCount: Record<number, number> = {}
  const hourCount: Record<number, number> = {}

  for (const c of completions) {
    dayCount[c.completion_day_of_week] = (dayCount[c.completion_day_of_week] || 0) + 1
    hourCount[c.completion_hour] = (hourCount[c.completion_hour] || 0) + 1
  }

  // Find preferred days (top 2)
  const sortedDays = Object.entries(dayCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([day]) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseInt(day)])

  // Find productive hours (peak cluster)
  let peakHour = 10
  let maxCount = 0
  for (let h = 6; h <= 20; h++) {
    const cluster = (hourCount[h] || 0) + (hourCount[h + 1] || 0)
    if (cluster > maxCount) {
      maxCount = cluster
      peakHour = h
    }
  }

  const formatHour = (h: number) => (h > 12 ? `${h - 12}pm` : h === 12 ? '12pm' : `${h}am`)

  return {
    avgCompletionDays: 7, // TODO: calculate from actual task creation to completion time
    preferredDays: sortedDays,
    productiveHours: `${formatHour(peakHour)}-${formatHour(peakHour + 2)}`,
    recentCompletions: completions.length,
  }
}

/**
 * Analyze insight history for learning
 */
function analyzeInsightHistory(insights: InsightRow[]): InsightHistory {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const recentTaskIds = insights
    .filter(i => new Date(i.shown_at) > sevenDaysAgo)
    .map(i => i.task_id)

  const withOutcome = insights.filter(i => i.outcome)
  const acted = withOutcome.filter(i => i.outcome === 'acted' || i.outcome === 'task_completed').length
  const dismissed = withOutcome.filter(i => i.outcome === 'dismissed').length

  const delayHours = withOutcome
    .filter(i => i.action_delay_hours !== null)
    .map(i => i.action_delay_hours!)

  const avgDelay = delayHours.length > 0
    ? delayHours.reduce((a, b) => a + b, 0) / delayHours.length
    : 0

  return {
    totalShown: insights.length,
    actedOn: acted,
    dismissed,
    avgActionDelayHours: avgDelay,
    recentTaskIds,
  }
}

/**
 * Transform database task to prompt format
 */
function transformTask(task: TaskRow): TaskForIntelligence {
  const steps = task.steps || []
  return {
    id: task.id,
    title: task.title,
    createdAt: task.created_at,
    category: task.category as 'urgent' | 'soon' | 'waiting',
    dueDate: task.due_date,
    stepsTotal: steps.length,
    stepsDone: steps.filter(s => s.done).length,
    lastInteraction: task.updated_at,
    notes: task.notes,
  }
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  // Get auth token and verify
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')

  // Create authenticated client (respects RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

    // Fetch recent completions for pattern analysis (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const [{ data: completions }, { data: insights }] = await Promise.all([
      supabase
        .from('task_completions')
        .select('completed_at, completion_day_of_week, completion_hour')
        .eq('user_id', user.id)
        .gte('completed_at', thirtyDaysAgo.toISOString()),
      supabase
        .from('task_insights')
        .select('task_id, outcome, action_delay_hours, shown_at')
        .eq('user_id', user.id)
        .order('shown_at', { ascending: false })
        .limit(50),
    ])

    const patterns = analyzeUserPatterns(completions || [])
    const history = analyzeInsightHistory(insights || [])
    const taskData = tasks.map(transformTask)
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
