import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { fetchAllTasks, hasTasksScope } from '@/lib/googleTasks'

/**
 * POST /api/tasks/sync
 * Sync tasks from Google Tasks to local cache.
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { listId, fullSync } = body

    if (!listId) {
      return NextResponse.json(
        { error: 'listId is required' },
        { status: 400 }
      )
    }

    // Check if user has Tasks scope
    const hasScope = await hasTasksScope(user.id)
    if (!hasScope) {
      return NextResponse.json(
        { error: 'Tasks scope not granted', needsReauth: true },
        { status: 403 }
      )
    }

    const serverClient = createServerClient()

    // Get last sync time for incremental sync
    let updatedMin: string | undefined
    if (!fullSync) {
      const { data: lastSync } = await serverClient
        .from('google_tasks')
        .select('last_synced_at')
        .eq('user_id', user.id)
        .eq('google_list_id', listId)
        .order('last_synced_at', { ascending: false })
        .limit(1)
        .single()

      if (lastSync?.last_synced_at) {
        updatedMin = lastSync.last_synced_at
      }
    }

    // Fetch tasks from Google (handles pagination internally)
    const tasks = await fetchAllTasks(user.id, listId, {
      showCompleted: true,
      updatedMin,
    })

    const now = new Date().toISOString()

    // Upsert tasks to database
    for (const task of tasks) {
      await serverClient.from('google_tasks').upsert({
        user_id: user.id,
        google_task_id: task.id,
        google_list_id: listId,
        title: task.title,
        notes: task.notes,
        status: task.status,
        due: task.due,
        completed_at: task.completed ? new Date(task.completed).toISOString() : null,
        etag: task.etag,
        updated_at: task.updated,
        last_synced_at: now,
      }, { onConflict: 'user_id,google_task_id' })

      // Sync completion status to linked Gather tasks
      if (task.status === 'completed') {
        const { data: linkedTask } = await serverClient
          .from('google_tasks')
          .select('linked_task_id')
          .eq('google_task_id', task.id)
          .eq('user_id', user.id)
          .single()

        if (linkedTask?.linked_task_id) {
          await serverClient
            .from('tasks')
            .update({
              category: 'completed',
              completed_at: task.completed || now,
            })
            .eq('id', linkedTask.linked_task_id)
            .eq('user_id', user.id)
        }
      }
    }

    return NextResponse.json({
      synced: tasks.length,
      lastSync: now,
    })
  } catch (error) {
    // Handle specific Google Tasks errors
    if (error instanceof Error && error.message.includes('NO_TOKEN')) {
      return NextResponse.json(
        { error: 'Google not connected', needsReauth: true },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to sync tasks' },
      { status: 500 }
    )
  }
}
