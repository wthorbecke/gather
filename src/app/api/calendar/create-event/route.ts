import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { getValidToken } from '@/lib/google-auth'

interface CreateEventRequest {
  taskId: string
  title: string
  description?: string
  date: string  // ISO date string
  startTime?: string  // HH:MM format
  endTime?: string  // HH:MM format
  allDay?: boolean
}

/**
 * Create a Google Calendar event from a task deadline.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = authHeader.slice(7)
    const body: CreateEventRequest = await request.json()

    const { taskId, title, description, date, startTime, endTime, allDay = true } = body

    if (!taskId || !title || !date) {
      return NextResponse.json({
        error: 'taskId, title, and date are required',
      }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Get a valid Google token
    const googleToken = await getValidToken(user.id)
    if (!googleToken) {
      return NextResponse.json({
        error: 'Google not connected',
        needsReauth: true,
      }, { status: 401 })
    }

    // Build the event object
    let eventBody: {
      summary: string
      description?: string
      start: { date?: string; dateTime?: string; timeZone?: string }
      end: { date?: string; dateTime?: string; timeZone?: string }
      reminders?: { useDefault: boolean }
    }

    if (allDay || (!startTime && !endTime)) {
      // All-day event
      eventBody = {
        summary: title,
        description: description || `Task deadline from Gather`,
        start: { date },
        end: { date },
        reminders: {
          useDefault: true,
        },
      }
    } else {
      // Timed event
      const startDateTime = `${date}T${startTime || '09:00'}:00`
      const endDateTime = `${date}T${endTime || '10:00'}:00`

      // Get user's timezone (fall back to browser timezone or UTC)
      const serverClient = createServerClient()
      const { data: profile } = await serverClient
        .from('profiles')
        .select('timezone')
        .eq('id', user.id)
        .single()

      const timeZone = profile?.timezone || 'America/Los_Angeles'

      eventBody = {
        summary: title,
        description: description || `Task deadline from Gather`,
        start: { dateTime: startDateTime, timeZone },
        end: { dateTime: endDateTime, timeZone },
        reminders: {
          useDefault: true,
        },
      }
    }

    // Create the event in Google Calendar
    const createResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    )

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      console.error('[CalendarCreate] Failed to create event:', createResponse.status, errorText)
      return NextResponse.json({
        error: 'Failed to create calendar event',
        details: errorText,
      }, { status: 500 })
    }

    const event = await createResponse.json()

    // Cache the event locally
    const serverClient = createServerClient()

    const startTime_parsed = event.start?.dateTime || event.start?.date
    const endTime_parsed = event.end?.dateTime || event.end?.date

    const { error: cacheError } = await serverClient
      .from('calendar_events')
      .upsert({
        user_id: user.id,
        google_event_id: event.id,
        calendar_id: 'primary',
        title: event.summary,
        description: event.description || null,
        start_time: new Date(startTime_parsed).toISOString(),
        end_time: new Date(endTime_parsed).toISOString(),
        all_day: Boolean(event.start?.date),
        location: event.location || null,
        linked_task_id: taskId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,google_event_id',
      })

    if (cacheError) {
      console.error('[CalendarCreate] Failed to cache event:', cacheError)
      // Don't fail the request, the event was created in Google
    }

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        htmlLink: event.htmlLink,
        title: event.summary,
        start: event.start,
        end: event.end,
      },
    })
  } catch (error) {
    console.error('[CalendarCreate] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Delete a calendar event linked to a task.
 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = authHeader.slice(7)
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const googleEventId = searchParams.get('googleEventId')

    if (!eventId && !googleEventId) {
      return NextResponse.json({
        error: 'eventId or googleEventId required',
      }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    const serverClient = createServerClient()

    // Get the cached event
    let query = serverClient
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)

    if (eventId) {
      query = query.eq('id', eventId)
    } else if (googleEventId) {
      query = query.eq('google_event_id', googleEventId)
    }

    const { data: cachedEvent } = await query.single()

    if (cachedEvent) {
      // Delete from Google Calendar
      const googleToken = await getValidToken(user.id)
      if (googleToken) {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events/${cachedEvent.google_event_id}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${googleToken}`,
            },
          }
        )
      }

      // Delete from cache
      await serverClient
        .from('calendar_events')
        .delete()
        .eq('id', cachedEvent.id)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CalendarCreate] Delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
