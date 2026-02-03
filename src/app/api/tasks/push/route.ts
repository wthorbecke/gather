import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { createGoogleTask, hasTasksScope } from '@/lib/googleTasks'

/**
 * POST /api/tasks/push
 * Push a Gather task to Google Tasks.
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
    const { taskId, listId } = body

    if (!taskId || !listId) {
      return NextResponse.json(
        { error: 'taskId and listId are required' },
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

    // Get the Gather task
    const { data: task, error: taskError } = await serverClient
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', user.id)
      .single()

    if (taskError || !task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      )
    }

    // Create in Google Tasks
    const googleTask = await createGoogleTask(user.id, listId, {
      title: task.title,
      notes: task.description || undefined,
      due: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] + 'T00:00:00.000Z' : undefined,
    })

    // Update Gather task with Google Task ID
    await serverClient
      .from('tasks')
      .update({ google_task_id: googleTask.id })
      .eq('id', taskId)
      .eq('user_id', user.id)

    // Store in google_tasks cache
    await serverClient.from('google_tasks').upsert({
      user_id: user.id,
      google_task_id: googleTask.id,
      google_list_id: listId,
      title: googleTask.title,
      notes: googleTask.notes,
      status: googleTask.status,
      due: googleTask.due,
      linked_task_id: taskId,
      etag: googleTask.etag,
      updated_at: googleTask.updated,
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'user_id,google_task_id' })

    return NextResponse.json({
      success: true,
      googleTaskId: googleTask.id,
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
      { error: 'Failed to push task to Google' },
      { status: 500 }
    )
  }
}
