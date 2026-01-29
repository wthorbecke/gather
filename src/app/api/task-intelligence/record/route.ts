import { NextRequest, NextResponse } from 'next/server'
import { requireAuthWithClient } from '@/lib/api-auth'

// Type for task_insights table (not yet in generated types)
interface TaskInsightRow {
  id: string
  user_id: string
  task_id: string
  insight_type: string
  observation: string
  suggestion: string
  shown_at: string
  outcome: string | null
  outcome_at: string | null
  action_delay_hours: number | null
}

/**
 * Record task insight shown to user and track outcomes
 *
 * POST: Record a new insight was shown
 * PATCH: Update outcome (acted, dismissed)
 */

export async function POST(request: NextRequest) {
  const auth = await requireAuthWithClient(request)
  if (auth instanceof NextResponse) {
    return auth
  }

  const { user, supabase } = auth

  try {
    const body = await request.json()
    const { taskId, insightType, observation, suggestion } = body

    if (!taskId || !insightType || !observation || !suggestion) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if we recently showed an insight for this task (within 7 days)
    // eslint-disable-next-line
    const { data: recentInsight } = await (supabase as any)
      .from('task_insights')
      .select('id')
      .eq('user_id', user.id)
      .eq('task_id', taskId)
      .gte('shown_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle() as { data: Pick<TaskInsightRow, 'id'> | null }

    if (recentInsight) {
      // Don't record duplicate - already shown recently
      return NextResponse.json({ id: (recentInsight as { id: string }).id, duplicate: true })
    }

    // Record the insight
    // eslint-disable-next-line
    const { data: insight, error } = await (supabase as any)
      .from('task_insights')
      .insert({
        user_id: user.id,
        task_id: taskId,
        insight_type: insightType,
        observation,
        suggestion,
      })
      .select('id')
      .single() as { data: Pick<TaskInsightRow, 'id'> | null; error: Error | null }

    if (error || !insight) {
      return NextResponse.json({ error: 'Failed to record insight' }, { status: 500 })
    }

    // Update user's last_insight_at
    await supabase
      .from('profiles')
      .update({ last_insight_at: new Date().toISOString() })
      .eq('id', user.id)

    return NextResponse.json({ id: insight.id })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuthWithClient(request)
  if (auth instanceof NextResponse) {
    return auth
  }

  const { user, supabase } = auth

  try {
    const body = await request.json()
    const { insightId, outcome } = body

    if (!insightId || !outcome) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['acted', 'dismissed', 'ignored'].includes(outcome)) {
      return NextResponse.json({ error: 'Invalid outcome' }, { status: 400 })
    }

    // Get the insight to calculate delay
    // eslint-disable-next-line
    const { data: insight } = await (supabase as any)
      .from('task_insights')
      .select('shown_at')
      .eq('id', insightId)
      .eq('user_id', user.id)
      .single() as { data: Pick<TaskInsightRow, 'shown_at'> | null }

    if (!insight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 })
    }

    const actionDelayHours = Math.floor(
      (Date.now() - new Date(insight.shown_at).getTime()) / (1000 * 60 * 60)
    )

    // eslint-disable-next-line
    const { error } = await (supabase as any)
      .from('task_insights')
      .update({
        outcome,
        outcome_at: new Date().toISOString(),
        action_delay_hours: actionDelayHours,
      })
      .eq('id', insightId)
      .eq('user_id', user.id) as { error: Error | null }

    if (error) {
      return NextResponse.json({ error: 'Failed to update insight' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
