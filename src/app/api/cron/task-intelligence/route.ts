import { NextResponse } from 'next/server'
import webpush, { PushSubscription as WebPushSubscription } from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { AI_MODEL_FAST, AI_MAX_TOKENS, AI_TEMPERATURE } from '@/config/ai'
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
  user_id: string
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

  const dayCount: Record<number, number> = {}
  const hourCount: Record<number, number> = {}

  for (const c of completions) {
    dayCount[c.completion_day_of_week] = (dayCount[c.completion_day_of_week] || 0) + 1
    hourCount[c.completion_hour] = (hourCount[c.completion_hour] || 0) + 1
  }

  const sortedDays = Object.entries(dayCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([day]) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseInt(day)])

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
    avgCompletionDays: 7,
    preferredDays: sortedDays,
    productiveHours: `${formatHour(peakHour)}-${formatHour(peakHour + 2)}`,
    recentCompletions: completions.length,
  }
}

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

async function runIntelligenceForUser(
  apiKey: string,
  tasks: TaskRow[],
  completions: CompletionRow[],
  insights: InsightRow[]
): Promise<TaskIntelligenceResponse> {
  const patterns = analyzeUserPatterns(completions)
  const history = analyzeInsightHistory(insights)
  const taskData = tasks.map(transformTask)
  const now = new Date()

  const prompt = buildTaskIntelligencePrompt(taskData, patterns, now, history)

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODEL_FAST, // Use Haiku for cost efficiency in batch processing
        max_tokens: AI_MAX_TOKENS.taskIntelligence,
        temperature: AI_TEMPERATURE.taskIntelligence,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      return DEFAULT_TASK_INTELLIGENCE
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    const extracted = extractJSON(text)
    const { data: observations } = parseAIResponse<TaskIntelligenceResponse>(
      TaskIntelligenceResponseSchema,
      extracted,
      DEFAULT_TASK_INTELLIGENCE,
      'task-intelligence-cron'
    )

    return observations
  } catch {
    return DEFAULT_TASK_INTELLIGENCE
  }
}

/**
 * Task Intelligence Cron Job
 *
 * Analyzes open tasks for all users and sends proactive notifications
 * about stuck tasks, vague tasks, or patterns.
 *
 * IMPORTANT: This should be scheduled to run WEEKLY, not daily.
 * Running daily would spam users about the same stuck tasks.
 * Configure in vercel.json or your cron scheduler accordingly.
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 })
  }

  webpush.setVapidDetails(
    'mailto:willthorbecke@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Only analyze tasks that are at least 7 days old
    // Newer tasks shouldn't be flagged as "stuck"
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: tasks, error: tasksError } = await supabase
      .from('tasks')
      .select('id, title, created_at, category, due_date, steps, updated_at, notes, user_id')
      .neq('category', 'completed')
      .lt('created_at', sevenDaysAgo.toISOString())

    if (tasksError || !tasks) {
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    // Group tasks by user
    const tasksByUser = tasks.reduce((acc, task) => {
      if (!acc[task.user_id]) acc[task.user_id] = []
      acc[task.user_id].push(task)
      return acc
    }, {} as Record<string, TaskRow[]>)

    const userIds = Object.keys(tasksByUser)
    if (userIds.length === 0) {
      return NextResponse.json({ message: 'No users with open tasks', analyzed: 0 })
    }

    // Get user preferences and push subscriptions
    const { data: users } = await supabase
      .from('profiles')
      .select('id, timezone, notification_preferences, insight_frequency, last_insight_at')
      .in('id', userIds)

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('user_id, subscription')
      .in('user_id', userIds)

    const subscriptionMap = (subscriptions || []).reduce((acc, sub) => {
      acc[sub.user_id] = sub.subscription
      return acc
    }, {} as Record<string, WebPushSubscription>)

    // Get completions for pattern analysis (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: allCompletions } = await supabase
      .from('task_completions')
      .select('user_id, completed_at, completion_day_of_week, completion_hour')
      .in('user_id', userIds)
      .gte('completed_at', thirtyDaysAgo.toISOString())

    const completionsByUser = (allCompletions || []).reduce((acc, c) => {
      if (!acc[c.user_id]) acc[c.user_id] = []
      acc[c.user_id].push(c)
      return acc
    }, {} as Record<string, CompletionRow[]>)

    // Get insight history for all users
    const { data: allInsights } = await supabase
      .from('task_insights')
      .select('user_id, task_id, outcome, action_delay_hours, shown_at')
      .in('user_id', userIds)
      .order('shown_at', { ascending: false })

    const insightsByUser = (allInsights || []).reduce((acc, i) => {
      if (!acc[i.user_id]) acc[i.user_id] = []
      acc[i.user_id].push(i)
      return acc
    }, {} as Record<string, InsightRow[]>)

    let usersAnalyzed = 0
    let notificationsSent = 0
    let skippedFrequency = 0

    for (const user of users || []) {
      // Check insight frequency preference
      const frequency = (user.insight_frequency || 'normal') as 'minimal' | 'normal' | 'frequent' | 'off'
      if (frequency === 'off') continue

      // Check last insight time based on frequency
      if (user.last_insight_at) {
        const hoursSinceLastInsight = (Date.now() - new Date(user.last_insight_at).getTime()) / (1000 * 60 * 60)
        const minHoursMap: Record<'minimal' | 'normal' | 'frequent', number> = {
          minimal: 168, // 7 days
          normal: 72,   // 3 days
          frequent: 24, // 1 day
        }
        const minHours = minHoursMap[frequency as 'minimal' | 'normal' | 'frequent'] ?? 72

        if (hoursSinceLastInsight < minHours) {
          skippedFrequency++
          continue
        }
      }

      const userTasks = tasksByUser[user.id] || []
      if (userTasks.length === 0) continue

      // Skip if not enough tasks to analyze (need at least 2)
      if (userTasks.length < 2) continue

      const userCompletions = completionsByUser[user.id] || []
      const userInsights = insightsByUser[user.id] || []
      const observations = await runIntelligenceForUser(apiKey, userTasks, userCompletions, userInsights)

      usersAnalyzed++

      // Only notify for priority 1 observations (most urgent)
      const urgent = observations.filter(o => o.priority === 1)
      if (urgent.length === 0) continue

      const subscription = subscriptionMap[user.id]
      if (!subscription) continue

      // Send one notification for the most urgent observation
      const top = urgent[0]
      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: top.type === 'stuck' ? 'Task check-in' : 'Quick thought',
            body: top.observation,
            url: `/?task=${top.taskId}`,
            tag: `intelligence-${top.taskId}`,
          })
        )

        // Record the insight and update last_insight_at
        await Promise.all([
          supabase.from('task_insights').insert({
            user_id: user.id,
            task_id: top.taskId,
            insight_type: top.type,
            observation: top.observation,
            suggestion: top.suggestion,
          }),
          supabase.from('profiles').update({
            last_insight_at: new Date().toISOString(),
          }).eq('id', user.id),
        ])

        notificationsSent++
      } catch (err: unknown) {
        const error = err as { statusCode?: number }
        if (error.statusCode === 410) {
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
        }
      }
    }

    return NextResponse.json({
      message: `Analyzed ${usersAnalyzed} users, sent ${notificationsSent} notifications, skipped ${skippedFrequency} due to frequency`,
      usersAnalyzed,
      notificationsSent,
    })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
