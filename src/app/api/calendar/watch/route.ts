import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { getValidToken } from '@/lib/google-auth'

interface CalendarWatchResponse {
  kind: string
  id: string
  resourceId: string
  resourceUri: string
  expiration: string  // Unix timestamp in milliseconds as string
}

/**
 * Create or renew a Calendar watch subscription.
 * POST: Create new watch
 * DELETE: Stop watching
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

    // Get a valid Google token
    const googleToken = await getValidToken(user.id)
    if (!googleToken) {
      return NextResponse.json({
        error: 'Google not connected',
        needsReauth: true,
      }, { status: 401 })
    }

    // Generate a unique channel ID
    const channelId = `calendar-${user.id}`

    // Get the webhook URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
    if (!baseUrl) {
      return NextResponse.json({
        error: 'Webhook URL not configured',
      }, { status: 500 })
    }

    const webhookUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/calendar/webhook`

    // Create Calendar watch
    const watchResponse = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: channelId,
          type: 'web_hook',
          address: webhookUrl,
          params: {
            ttl: '604800',  // 7 days in seconds
          },
        }),
      }
    )

    if (!watchResponse.ok) {
      const errorText = await watchResponse.text()
      console.error('[CalendarWatch] Failed to create watch:', watchResponse.status, errorText)
      return NextResponse.json({
        error: 'Failed to set up Calendar notifications',
        details: errorText,
      }, { status: 500 })
    }

    const watchData: CalendarWatchResponse = await watchResponse.json()

    // Store watch details
    const serverClient = createServerClient()
    const { error: upsertError } = await serverClient
      .from('google_watches')
      .upsert({
        user_id: user.id,
        resource_type: 'calendar',
        watch_id: watchData.id,
        resource_id: watchData.resourceId,
        expiration: new Date(parseInt(watchData.expiration)).toISOString(),
      }, {
        onConflict: 'user_id,resource_type',
      })

    if (upsertError) {
      console.error('[CalendarWatch] Failed to store watch:', upsertError)
      return NextResponse.json({
        error: 'Failed to store watch configuration',
      }, { status: 500 })
    }

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

    // Do initial sync of events
    await initialCalendarSync(user.id, googleToken, serverClient)

    const expirationDate = new Date(parseInt(watchData.expiration))

    return NextResponse.json({
      success: true,
      expiration: expirationDate.toISOString(),
      channelId: watchData.id,
    })
  } catch (error) {
    console.error('[CalendarWatch] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Initial sync of calendar events.
 */
async function initialCalendarSync(
  userId: string,
  accessToken: string,
  supabase: ReturnType<typeof createServerClient>
) {
  // Get events for next 30 days
  const now = new Date()
  const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

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
    console.error('[CalendarWatch] Initial sync failed:', eventsResponse.status)
    return
  }

  const data = await eventsResponse.json()
  const events = data.items || []

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

  // Store sync token for incremental updates
  if (data.nextSyncToken) {
    await supabase
      .from('google_watches')
      .update({ sync_token: data.nextSyncToken })
      .eq('user_id', userId)
      .eq('resource_type', 'calendar')
  }

  console.log('[CalendarWatch] Initial sync complete:', events.length, 'events')
}

/**
 * Stop Calendar watch subscription.
 */
export async function DELETE(request: NextRequest) {
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

    const serverClient = createServerClient()

    // Get existing watch to stop it
    const { data: watch } = await serverClient
      .from('google_watches')
      .select('*')
      .eq('user_id', user.id)
      .eq('resource_type', 'calendar')
      .single()

    if (watch) {
      const googleToken = await getValidToken(user.id)
      if (googleToken) {
        // Stop the Calendar watch
        await fetch(
          'https://www.googleapis.com/calendar/v3/channels/stop',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${googleToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              id: watch.watch_id,
              resourceId: watch.resource_id,
            }),
          }
        )
      }
    }

    // Delete watch from database
    await serverClient
      .from('google_watches')
      .delete()
      .eq('user_id', user.id)
      .eq('resource_type', 'calendar')

    // Clear cached events
    await serverClient
      .from('calendar_events')
      .delete()
      .eq('user_id', user.id)

    // Disable Calendar in integration settings
    await serverClient
      .from('integration_settings')
      .update({
        calendar_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CalendarWatch] Error stopping watch:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Get current watch status.
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

    const serverClient = createServerClient()
    const { data: watch } = await serverClient
      .from('google_watches')
      .select('*')
      .eq('user_id', user.id)
      .eq('resource_type', 'calendar')
      .single()

    if (!watch) {
      return NextResponse.json({ active: false })
    }

    const isExpired = new Date(watch.expiration) < new Date()

    return NextResponse.json({
      active: !isExpired,
      expiration: watch.expiration,
    })
  } catch (error) {
    console.error('[CalendarWatch] Error getting status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
