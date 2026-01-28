import { NextResponse } from 'next/server'
import webpush, { PushSubscription as WebPushSubscription } from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { AI_MODELS } from '@/config/ai'

interface TaskCompletion {
  task_title: string
  task_category: string
  completed_at: string
  was_overdue: boolean
  days_before_deadline: number | null
  completion_day_of_week: number
  completion_hour: number
}

interface ReflectionContent {
  wins: string[]
  patterns: string[]
  suggestions: string[]
  encouragement: string
  stats: {
    tasksCompleted: number
    onTimeCompletions: number
    busiestDay: string
    productiveHours: string
    streakDays: number
  }
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Analyze completion patterns from the week's data
 */
function analyzePatterns(completions: TaskCompletion[]): {
  busiestDay: string
  productiveHours: string
  onTimeRate: number
  dayDistribution: Record<number, number>
  hourDistribution: Record<number, number>
} {
  const dayDistribution: Record<number, number> = {}
  const hourDistribution: Record<number, number> = {}
  let onTime = 0

  for (const c of completions) {
    dayDistribution[c.completion_day_of_week] = (dayDistribution[c.completion_day_of_week] || 0) + 1
    hourDistribution[c.completion_hour] = (hourDistribution[c.completion_hour] || 0) + 1
    if (!c.was_overdue) onTime++
  }

  // Find busiest day
  let busiestDay = 0
  let maxDay = 0
  for (const [day, count] of Object.entries(dayDistribution)) {
    if (count > maxDay) {
      maxDay = count
      busiestDay = parseInt(day)
    }
  }

  // Find productive hours (cluster of 2-3 hours with most completions)
  let productiveStart = 9
  let maxHourCluster = 0
  for (let h = 6; h <= 20; h++) {
    const cluster = (hourDistribution[h] || 0) + (hourDistribution[h + 1] || 0) + (hourDistribution[h + 2] || 0)
    if (cluster > maxHourCluster) {
      maxHourCluster = cluster
      productiveStart = h
    }
  }

  const formatHour = (h: number) => {
    if (h === 0 || h === 12) return h === 0 ? '12am' : '12pm'
    return h > 12 ? `${h - 12}pm` : `${h}am`
  }

  return {
    busiestDay: DAY_NAMES[busiestDay],
    productiveHours: `${formatHour(productiveStart)}-${formatHour(productiveStart + 3)}`,
    onTimeRate: completions.length > 0 ? onTime / completions.length : 0,
    dayDistribution,
    hourDistribution,
  }
}

/**
 * Generate AI-powered reflection content
 */
async function generateReflection(
  apiKey: string,
  completions: TaskCompletion[],
  patterns: ReturnType<typeof analyzePatterns>,
  previousReflection?: ReflectionContent
): Promise<ReflectionContent> {
  const taskTitles = completions.map(c => c.task_title).slice(0, 15) // Limit for prompt
  const tasksCompleted = completions.length

  const prompt = `Generate a warm, ADHD-friendly weekly reflection for someone who completed ${tasksCompleted} tasks this week.

Tasks completed: ${taskTitles.join(', ')}

Patterns observed:
- Busiest day: ${patterns.busiestDay}
- Most productive hours: ${patterns.productiveHours}
- On-time completion rate: ${Math.round(patterns.onTimeRate * 100)}%

${previousReflection ? `Last week's patterns: ${previousReflection.patterns.join(', ')}` : ''}

Generate a reflection with:
1. "wins" - 2-3 specific accomplishments to celebrate (reference actual task titles)
2. "patterns" - 1-2 patterns you notice (productive times, task types, etc)
3. "suggestions" - 1-2 gentle suggestions for next week (based on patterns)
4. "encouragement" - One sentence of genuine encouragement (not corporate wellness speak)

Rules:
- Be specific, reference actual tasks
- If few tasks completed, focus on quality over quantity
- Never guilt trip about what wasn't done
- Notice if they tackled hard tasks or broke patterns
- Keep each item under 50 words

Return JSON: {
  "wins": ["...", "..."],
  "patterns": ["...", "..."],
  "suggestions": ["...", "..."],
  "encouragement": "..."
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: AI_MODELS.conversation,
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || ''
    const match = text.match(/\{[\s\S]*\}/)
    if (match) {
      const parsed = JSON.parse(match[0])
      return {
        wins: parsed.wins || [],
        patterns: parsed.patterns || [],
        suggestions: parsed.suggestions || [],
        encouragement: parsed.encouragement || "You showed up this week. That matters.",
        stats: {
          tasksCompleted,
          onTimeCompletions: Math.round(patterns.onTimeRate * tasksCompleted),
          busiestDay: patterns.busiestDay,
          productiveHours: patterns.productiveHours,
          streakDays: 0, // TODO: Calculate actual streak
        },
      }
    }
  } catch (error) {
    console.error('Error generating reflection:', error)
  }

  // Fallback reflection
  return {
    wins: tasksCompleted > 0
      ? [`You completed ${tasksCompleted} task${tasksCompleted > 1 ? 's' : ''} this week`]
      : ['You made it through another week'],
    patterns: patterns.busiestDay
      ? [`${patterns.busiestDay} seems to be your productive day`]
      : [],
    suggestions: ['Try tackling one small task early in the day'],
    encouragement: "Progress isn't always visible, but you're moving forward.",
    stats: {
      tasksCompleted,
      onTimeCompletions: Math.round(patterns.onTimeRate * tasksCompleted),
      busiestDay: patterns.busiestDay,
      productiveHours: patterns.productiveHours,
      streakDays: 0,
    },
  }
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
    // Calculate week boundaries (Sunday to Saturday)
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay() - 7) // Last Sunday
    weekStart.setHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 7)

    const weekStartStr = weekStart.toISOString()
    const weekEndStr = weekEnd.toISOString()
    const weekStartDate = weekStart.toISOString().split('T')[0]

    // Get all users who want weekly reflections
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id, phone, timezone, notification_preferences')

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    // Get push subscriptions
    const userIds = (users || []).map(u => u.id)
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('user_id, subscription')
      .in('user_id', userIds)

    const subscriptionMap = (subscriptions || []).reduce((acc, sub) => {
      acc[sub.user_id] = sub.subscription
      return acc
    }, {} as Record<string, WebPushSubscription>)

    let reflectionsGenerated = 0
    let notificationsSent = 0

    for (const user of users || []) {
      const prefs = user.notification_preferences || { weekly_reflections: true }

      // Skip if user disabled weekly reflections
      if (!prefs.weekly_reflections) continue

      // Check if reflection already exists for this week
      const { data: existingReflection } = await supabase
        .from('reflections')
        .select('id')
        .eq('user_id', user.id)
        .eq('week_start', weekStartDate)
        .maybeSingle()

      if (existingReflection) continue // Already generated

      // Get this week's completions
      const { data: completions, error: completionsError } = await supabase
        .from('task_completions')
        .select('*')
        .eq('user_id', user.id)
        .gte('completed_at', weekStartStr)
        .lt('completed_at', weekEndStr)

      if (completionsError) {
        console.error('Error fetching completions:', completionsError)
        continue
      }

      // Get previous reflection for context
      const { data: previousReflection } = await supabase
        .from('reflections')
        .select('content')
        .eq('user_id', user.id)
        .order('week_start', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Analyze patterns and generate reflection
      const patterns = analyzePatterns(completions || [])
      const reflection = await generateReflection(
        apiKey,
        completions || [],
        patterns,
        previousReflection?.content as ReflectionContent | undefined
      )

      // Save reflection
      const { error: saveError } = await supabase
        .from('reflections')
        .insert({
          user_id: user.id,
          week_start: weekStartDate,
          content: reflection,
          sent_via: [],
        })

      if (saveError) {
        console.error('Error saving reflection:', saveError)
        continue
      }

      reflectionsGenerated++

      // Send push notification
      const subscription = subscriptionMap[user.id]
      if (subscription) {
        try {
          const summary = reflection.wins[0] || 'Your weekly reflection is ready'
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: 'Your Week in Review',
              body: summary,
              url: '/?view=reflection',
              tag: `reflection-${weekStartDate}`,
            })
          )

          // Update sent_via
          await supabase
            .from('reflections')
            .update({ sent_via: ['push'] })
            .eq('user_id', user.id)
            .eq('week_start', weekStartDate)

          notificationsSent++
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
    }

    return NextResponse.json({
      message: `Generated ${reflectionsGenerated} reflections, sent ${notificationsSent} notifications`,
      reflectionsGenerated,
      notificationsSent,
      weekStart: weekStartDate,
    })
  } catch (err) {
    console.error('Weekly reflection error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
