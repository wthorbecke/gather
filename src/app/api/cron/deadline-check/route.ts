import { NextResponse } from 'next/server'
import webpush, { PushSubscription as WebPushSubscription } from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { AI_MODELS } from '@/config/ai'

interface Task {
  id: string
  title: string
  due_date: string
  deadline_type: 'hard' | 'soft' | 'flexible'
  warn_days_before: number
  last_nudge_at: string | null
  nudge_count: number
  category: string
  steps?: Array<{ done: boolean }>
}

interface UserWithTasks {
  id: string
  phone: string | null
  timezone: string
  notification_preferences: {
    deadline_warnings: boolean
    nudge_frequency: 'minimal' | 'normal' | 'frequent'
    quiet_hours_start: string
    quiet_hours_end: string
  }
  tasks: Task[]
  push_subscription?: WebPushSubscription
}

/**
 * Generate a contextual, ADHD-friendly nudge message
 */
async function generateNudgeMessage(
  apiKey: string,
  task: Task,
  daysUntilDue: number,
  isOverdue: boolean
): Promise<{ title: string; body: string }> {
  const urgency = isOverdue ? 'overdue' : daysUntilDue <= 1 ? 'urgent' : 'upcoming'
  const progress = task.steps
    ? `${task.steps.filter(s => s.done).length}/${task.steps.length} steps done`
    : 'no steps tracked'

  const prompt = `Generate a short, ADHD-friendly notification for a task deadline.

Task: "${task.title}"
Status: ${urgency} (${isOverdue ? `${Math.abs(daysUntilDue)} days overdue` : `due in ${daysUntilDue} days`})
Progress: ${progress}
Deadline type: ${task.deadline_type} (hard = real consequences, soft = preferred, flexible = nice-to-have)
Times nudged before: ${task.nudge_count}

Rules:
- Be warm and supportive, never guilt-tripping
- Keep title under 40 chars, body under 100 chars
- If overdue with hard deadline, be direct but kind
- If they've been nudged many times, acknowledge it gently
- Suggest ONE small action they could take right now
- No excessive emojis or corporate wellness speak

Return JSON: { "title": "...", "body": "..." }`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.intentAnalysis,
        max_tokens: 150,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      return JSON.parse(match[0])
    }
  } catch (error) {
    console.error('Error generating nudge:', error)
  }

  // Fallback messages
  if (isOverdue) {
    return {
      title: `${task.title} is overdue`,
      body: "It's not too late. What's one small step you could take?",
    }
  } else if (daysUntilDue <= 1) {
    return {
      title: `${task.title} is due tomorrow`,
      body: 'You\'ve got this. Start with the first step.',
    }
  } else {
    return {
      title: `${task.title} is coming up`,
      body: `Due in ${daysUntilDue} days. Good time to make progress.`,
    }
  }
}

/**
 * Check if current time is within quiet hours
 */
function isQuietHours(
  timezone: string,
  quietStart: string,
  quietEnd: string
): boolean {
  try {
    const now = new Date().toLocaleString('en-US', { timeZone: timezone })
    const currentTime = new Date(now)
    const hours = currentTime.getHours()
    const minutes = currentTime.getMinutes()
    const currentMinutes = hours * 60 + minutes

    const [startH, startM] = quietStart.split(':').map(Number)
    const [endH, endM] = quietEnd.split(':').map(Number)
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes
    }
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  } catch {
    return false
  }
}

/**
 * Determine if a task should be nudged based on frequency settings
 */
function shouldNudge(
  task: Task,
  daysUntilDue: number,
  frequency: 'minimal' | 'normal' | 'frequent'
): boolean {
  const hoursSinceLastNudge = task.last_nudge_at
    ? (Date.now() - new Date(task.last_nudge_at).getTime()) / (1000 * 60 * 60)
    : Infinity

  // Minimum hours between nudges based on frequency
  const minHours = {
    minimal: 48,
    normal: 24,
    frequent: 12,
  }[frequency]

  if (hoursSinceLastNudge < minHours) return false

  // Always nudge if overdue or due today
  if (daysUntilDue <= 0) return true

  // Nudge based on warning threshold
  if (daysUntilDue <= task.warn_days_before) return true

  // Extra nudge for hard deadlines within a week
  if (task.deadline_type === 'hard' && daysUntilDue <= 7) return true

  return false
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY!

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
    const today = new Date().toISOString().split('T')[0]

    // Get all tasks with due dates that need attention
    const { data: tasksWithDueDates, error: tasksError } = await supabase
      .from('tasks')
      .select(`
        id,
        title,
        due_date,
        deadline_type,
        warn_days_before,
        last_nudge_at,
        nudge_count,
        category,
        steps,
        user_id
      `)
      .not('due_date', 'is', null)
      .neq('category', 'completed')
      .or(`snoozed_until.is.null,snoozed_until.lte.${today}`)

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError)
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }

    if (!tasksWithDueDates || tasksWithDueDates.length === 0) {
      return NextResponse.json({ message: 'No tasks with due dates', sent: 0 })
    }

    // Group tasks by user
    const tasksByUser = tasksWithDueDates.reduce((acc, task) => {
      if (!acc[task.user_id]) acc[task.user_id] = []
      acc[task.user_id].push(task)
      return acc
    }, {} as Record<string, Task[]>)

    // Get user profiles and push subscriptions
    const userIds = Object.keys(tasksByUser)
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, phone, timezone, notification_preferences')
      .in('id', userIds)

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('user_id, subscription')
      .in('user_id', userIds)

    const subscriptionMap = (subscriptions || []).reduce((acc, sub) => {
      acc[sub.user_id] = sub.subscription
      return acc
    }, {} as Record<string, WebPushSubscription>)

    let totalSent = 0
    const notifications: Array<{ userId: string; taskId: string; message: { title: string; body: string } }> = []

    // Process each user's tasks
    for (const user of users || []) {
      const prefs = user.notification_preferences || {
        deadline_warnings: true,
        nudge_frequency: 'normal',
        quiet_hours_start: '22:00',
        quiet_hours_end: '08:00',
      }

      // Skip if user disabled deadline warnings
      if (!prefs.deadline_warnings) continue

      // Skip if in quiet hours
      if (isQuietHours(user.timezone || 'America/Los_Angeles', prefs.quiet_hours_start, prefs.quiet_hours_end)) {
        continue
      }

      const userTasks = tasksByUser[user.id] || []
      const subscription = subscriptionMap[user.id]

      for (const task of userTasks) {
        const dueDate = new Date(task.due_date)
        const todayDate = new Date(today)
        const daysUntilDue = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))
        const isOverdue = daysUntilDue < 0

        if (!shouldNudge(task, daysUntilDue, prefs.nudge_frequency)) continue

        // Generate contextual message
        const message = await generateNudgeMessage(apiKey, task, daysUntilDue, isOverdue)
        notifications.push({ userId: user.id, taskId: task.id, message })

        // Send push notification if subscription exists
        if (subscription) {
          try {
            await webpush.sendNotification(
              subscription,
              JSON.stringify({
                title: message.title,
                body: message.body,
                url: `/?task=${task.id}`,
                tag: `deadline-${task.id}`,
              })
            )
            totalSent++
          } catch (err: unknown) {
            const error = err as { statusCode?: number }
            if (error.statusCode === 410) {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', user.id)
            }
            console.error('Push error:', err)
          }
        }

        // Update task nudge tracking
        await supabase
          .from('tasks')
          .update({
            last_nudge_at: new Date().toISOString(),
            nudge_count: (task.nudge_count || 0) + 1,
          })
          .eq('id', task.id)

        // Log potential ADHD tax event for overdue hard deadlines
        if (isOverdue && task.deadline_type === 'hard') {
          await supabase
            .from('adhd_tax_events')
            .insert({
              user_id: user.id,
              task_id: task.id,
              event_type: 'missed_deadline',
              description: `Deadline passed for: ${task.title}`,
              prevented: false,
            })
        }
      }
    }

    return NextResponse.json({
      message: `Processed ${tasksWithDueDates.length} tasks, sent ${totalSent} notifications`,
      sent: totalSent,
      processed: tasksWithDueDates.length,
      notifications: notifications.map(n => ({ taskId: n.taskId, title: n.message.title })),
    })
  } catch (err) {
    console.error('Deadline check error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
