import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { fetchTaskLists, hasTasksScope } from '@/lib/googleTasks'

/**
 * GET /api/tasks/lists
 * Fetch user's Google Task lists.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = authHeader.slice(7)

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Check if user has Tasks scope
    const hasScope = await hasTasksScope(user.id)
    if (!hasScope) {
      return NextResponse.json(
        { error: 'Tasks scope not granted', needsReauth: true },
        { status: 403 }
      )
    }

    const lists = await fetchTaskLists(user.id)

    // Cache lists in database using server client
    const serverClient = createServerClient()
    for (const list of lists) {
      await serverClient.from('google_task_lists').upsert({
        user_id: user.id,
        google_list_id: list.id,
        name: list.title,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,google_list_id' })
    }

    return NextResponse.json({ lists })
  } catch (error) {
    // Handle specific Google Tasks errors
    if (error instanceof Error && error.message.includes('NO_TOKEN')) {
      return NextResponse.json(
        { error: 'Google not connected', needsReauth: true },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to fetch task lists' },
      { status: 500 }
    )
  }
}
