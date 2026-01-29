import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/reflections
 *
 * Fetches the user's most recent weekly reflection
 * Requires Authorization header with access token
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')

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
    // Get recent reflections (last 4 weeks)
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0]

    const { data: reflections, error } = await supabase
      .from('reflections')
      .select('*')
      .eq('user_id', user.id)
      .gte('week_start', fourWeeksAgoStr)
      .order('week_start', { ascending: false })

    if (error) {
      // Error handled silently('Error fetching reflections:', error)
      return NextResponse.json({ error: 'Failed to fetch reflections' }, { status: 500 })
    }

    // Get completion stats for context
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const weekAgoStr = weekAgo.toISOString()

    const { data: completions, error: completionsError } = await supabase
      .from('task_completions')
      .select('task_title, completed_at, was_overdue')
      .eq('user_id', user.id)
      .gte('completed_at', weekAgoStr)

    if (completionsError) {
      // Error handled silently('Error fetching completions:', completionsError)
    }

    // Get ADHD tax events
    const { data: taxEvents, error: taxError } = await supabase
      .from('adhd_tax_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', fourWeeksAgoStr)

    if (taxError) {
      // Error handled silently('Error fetching ADHD tax events:', taxError)
    }

    // Calculate ADHD tax summary
    const prevented = (taxEvents || []).filter(e => e.prevented)
    const notPrevented = (taxEvents || []).filter(e => !e.prevented)
    const savedCents = prevented.reduce((sum, e) => sum + (e.amount_cents || 0), 0)
    const lostCents = notPrevented.reduce((sum, e) => sum + (e.amount_cents || 0), 0)

    return NextResponse.json({
      reflections: reflections || [],
      thisWeek: {
        completions: completions || [],
        tasksCompleted: (completions || []).length,
        onTime: (completions || []).filter(c => !c.was_overdue).length,
      },
      adhdTax: {
        prevented: prevented.length,
        savedCents,
        missed: notPrevented.length,
        lostCents,
      },
    })
  } catch (err) {
    // Error handled silently('Reflections API error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
