import { NextRequest, NextResponse } from 'next/server'
import { requireAuthWithClient } from '@/lib/api-auth'

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
    const { data: recentInsight } = await supabase
      .from('task_insights')
      .select('id')
      .eq('user_id', user.id)
      .eq('task_id', taskId)
      .gte('shown_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle()

    if (recentInsight) {
      // Don't record duplicate - already shown recently
      return NextResponse.json({ id: (recentInsight as { id: string }).id, duplicate: true })
    }

    // Record the insight
    const { data: insight, error } = await supabase
      .from('task_insights')
      .insert({
        user_id: user.id,
        task_id: taskId,
        insight_type: insightType,
        observation,
        suggestion,
      })
      .select('id')
      .single()

    if (error) {
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
    const { data: insight } = await supabase
      .from('task_insights')
      .select('shown_at')
      .eq('id', insightId)
      .eq('user_id', user.id)
      .single()

    if (!insight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 })
    }

    const actionDelayHours = Math.floor(
      (Date.now() - new Date(insight.shown_at).getTime()) / (1000 * 60 * 60)
    )

    const { error } = await supabase
      .from('task_insights')
      .update({
        outcome,
        outcome_at: new Date().toISOString(),
        action_delay_hours: actionDelayHours,
      })
      .eq('id', insightId)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to update insight' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}
