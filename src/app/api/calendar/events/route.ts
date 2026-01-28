import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { getValidToken } from '@/lib/google-auth'

interface CalendarEvent {
  id: string
  google_event_id: string
  title: string
  description: string | null
  start_time: string
  end_time: string
  all_day: boolean
  location: string | null
  linked_task_id: string | null
}

/**
 * Get cached calendar events for the user.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = authHeader.slice(7)
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    const refresh = searchParams.get('refresh') === 'true'

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

    // Check if Calendar is enabled
    const { data: settings } = await serverClient
      .from('integration_settings')
      .select('calendar_enabled')
      .eq('user_id', user.id)
      .single()

    if (!settings?.calendar_enabled) {
      return NextResponse.json({
        events: [],
        enabled: false,
        message: 'Calendar not connected',
      })
    }

    // Optionally refresh from Google Calendar API
    if (refresh) {
      await refreshCalendarEvents(user.id, days, serverClient)
    }

    // Get events from cache
    const now = new Date()
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const { data: events, error: eventsError } = await serverClient
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', now.toISOString())
      .lte('start_time', future.toISOString())
      .order('start_time', { ascending: true })

    if (eventsError) {
      console.error('[CalendarEvents] Error fetching events:', eventsError)
      return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
    }

    // Group events by date for easier UI consumption
    const eventsByDate: Record<string, CalendarEvent[]> = {}
    for (const event of events || []) {
      const date = new Date(event.start_time).toISOString().split('T')[0]
      if (!eventsByDate[date]) {
        eventsByDate[date] = []
      }
      eventsByDate[date].push(event)
    }

    return NextResponse.json({
      events: events || [],
      eventsByDate,
      enabled: true,
      count: events?.length || 0,
    })
  } catch (error) {
    console.error('[CalendarEvents] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Refresh calendar events from Google Calendar API.
 */
async function refreshCalendarEvents(
  userId: string,
  days: number,
  supabase: ReturnType<typeof createServerClient>
) {
  const accessToken = await getValidToken(userId)
  if (!accessToken) {
    console.error('[CalendarEvents] Could not get valid token for refresh')
    return
  }

  const now = new Date()
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

  const eventsResponse = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?' +
    new URLSearchParams({
      maxResults: '100',
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
    }),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!eventsResponse.ok) {
    console.error('[CalendarEvents] Refresh failed:', eventsResponse.status)
    return
  }

  const data = await eventsResponse.json()
  const events = data.items || []

  // Clear old events in the time range and re-sync
  await supabase
    .from('calendar_events')
    .delete()
    .eq('user_id', userId)
    .gte('start_time', now.toISOString())
    .lte('start_time', future.toISOString())

  for (const event of events) {
    if (!event.summary) continue

    const allDay = Boolean(event.start?.date)
    const startTime = event.start?.dateTime || event.start?.date
    const endTime = event.end?.dateTime || event.end?.date

    if (!startTime || !endTime) continue

    await supabase
      .from('calendar_events')
      .upsert({
        user_id: userId,
        google_event_id: event.id,
        calendar_id: 'primary',
        title: event.summary,
        description: event.description || null,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        all_day: allDay,
        location: event.location || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,google_event_id',
      })
  }

  console.log('[CalendarEvents] Refreshed', events.length, 'events')
}

/**
 * Enable calendar sync (without push notifications).
 * Does an initial sync of events.
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

    // Check if Google is connected
    const googleToken = await getValidToken(user.id)
    if (!googleToken) {
      return NextResponse.json({
        error: 'Google not connected',
        needsReauth: true,
      }, { status: 401 })
    }

    const serverClient = createServerClient()

    // Enable Calendar in integration settings
    await serverClient
      .from('integration_settings')
      .upsert({
        user_id: user.id,
        calendar_enabled: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    // Do initial sync of events (30 days)
    await refreshCalendarEvents(user.id, 30, serverClient)

    return NextResponse.json({
      success: true,
      message: 'Calendar sync enabled',
    })
  } catch (error) {
    console.error('[CalendarEvents] Error enabling:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Link a calendar event to a task.
 */
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = authHeader.slice(7)
    const body = await request.json()
    const { eventId, taskId } = body

    if (!eventId) {
      return NextResponse.json({ error: 'eventId required' }, { status: 400 })
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

    const { error: updateError } = await serverClient
      .from('calendar_events')
      .update({
        linked_task_id: taskId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('id', eventId)

    if (updateError) {
      console.error('[CalendarEvents] Error linking event:', updateError)
      return NextResponse.json({ error: 'Failed to link event' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CalendarEvents] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
