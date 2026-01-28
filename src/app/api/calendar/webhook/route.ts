import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getValidToken } from '@/lib/google-auth'

interface PubSubMessage {
  message: {
    data: string
    messageId: string
    publishTime: string
  }
  subscription: string
}

interface CalendarNotification {
  kind: string
  id: string
  resourceId: string
  resourceUri: string
  channelId: string
  channelExpiration: string
}

/**
 * Calendar Pub/Sub webhook endpoint.
 * Receives push notifications when user's calendar changes.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify the request is from Google
    const webhookSecret = process.env.GOOGLE_WEBHOOK_SECRET
    const authHeader = request.headers.get('authorization')

    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      console.warn('[CalendarWebhook] Invalid authorization header')
    }

    // Check for channel headers (Calendar uses HTTP headers instead of Pub/Sub body)
    const channelId = request.headers.get('x-goog-channel-id')
    const resourceId = request.headers.get('x-goog-resource-id')
    const resourceState = request.headers.get('x-goog-resource-state')

    if (channelId && resourceId) {
      // This is a direct Calendar push notification
      console.log('[CalendarWebhook] Received Calendar notification:', {
        channelId,
        resourceId,
        resourceState,
      })

      // Parse channelId to extract userId (format: calendar-{userId})
      const userIdMatch = channelId.match(/^calendar-(.+)$/)
      if (!userIdMatch) {
        console.warn('[CalendarWebhook] Could not extract userId from channelId:', channelId)
        return NextResponse.json({ status: 'invalid_channel' })
      }

      const userId = userIdMatch[1]

      // Sync changes if this is a change notification (not initial sync)
      if (resourceState === 'exists' || resourceState === 'sync') {
        await syncCalendarChanges(userId)
      }

      return NextResponse.json({ status: 'ok' })
    }

    // Try to parse as Pub/Sub message
    const body: PubSubMessage = await request.json()

    if (!body.message?.data) {
      console.error('[CalendarWebhook] No message data in request')
      return NextResponse.json({ error: 'Invalid message format' }, { status: 400 })
    }

    const decodedData = Buffer.from(body.message.data, 'base64').toString('utf-8')
    const notification: CalendarNotification = JSON.parse(decodedData)

    console.log('[CalendarWebhook] Received Pub/Sub notification:', notification)

    // Extract userId from channel ID
    const userIdMatch = notification.channelId?.match(/^calendar-(.+)$/)
    if (userIdMatch) {
      await syncCalendarChanges(userIdMatch[1])
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('[CalendarWebhook] Error processing webhook:', error)
    return NextResponse.json({ status: 'error' })
  }
}

/**
 * Sync calendar changes for a user.
 */
async function syncCalendarChanges(userId: string) {
  const supabase = createServerClient()

  // Get the user's watch info
  const { data: watch, error: watchError } = await supabase
    .from('google_watches')
    .select('*')
    .eq('user_id', userId)
    .eq('resource_type', 'calendar')
    .single()

  if (watchError || !watch) {
    console.warn('[CalendarWebhook] No watch found for user:', userId)
    return
  }

  // Get a valid access token
  const accessToken = await getValidToken(userId)
  if (!accessToken) {
    console.error('[CalendarWebhook] Could not get valid token for user:', userId)
    return
  }

  // Fetch events using incremental sync if we have a sync token
  const params: Record<string, string> = {
    maxResults: '50',
    singleEvents: 'true',
    orderBy: 'startTime',
  }

  if (watch.sync_token) {
    params.syncToken = watch.sync_token
  } else {
    // Initial sync - get events for next 30 days
    const now = new Date()
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    params.timeMin = now.toISOString()
    params.timeMax = future.toISOString()
  }

  const eventsResponse = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events?' +
    new URLSearchParams(params),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  )

  if (!eventsResponse.ok) {
    // If sync token is invalid, do a full sync
    if (eventsResponse.status === 410) {
      console.log('[CalendarWebhook] Sync token expired, doing full sync')
      delete params.syncToken
      const now = new Date()
      const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      params.timeMin = now.toISOString()
      params.timeMax = future.toISOString()

      const retryResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?' +
        new URLSearchParams(params),
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      )

      if (!retryResponse.ok) {
        console.error('[CalendarWebhook] Failed to fetch events:', retryResponse.status)
        return
      }

      const retryData = await retryResponse.json()
      await processCalendarEvents(userId, retryData, supabase)
      return
    }

    console.error('[CalendarWebhook] Failed to fetch events:', eventsResponse.status)
    return
  }

  const eventsData = await eventsResponse.json()
  await processCalendarEvents(userId, eventsData, supabase)
}

/**
 * Process and store calendar events.
 */
async function processCalendarEvents(
  userId: string,
  data: {
    items?: Array<{
      id: string
      status: string
      summary?: string
      description?: string
      start?: { dateTime?: string; date?: string }
      end?: { dateTime?: string; date?: string }
      location?: string
    }>
    nextSyncToken?: string
  },
  supabase: ReturnType<typeof createServerClient>
) {
  const events = data.items || []

  for (const event of events) {
    // Handle deleted events
    if (event.status === 'cancelled') {
      await supabase
        .from('calendar_events')
        .delete()
        .eq('user_id', userId)
        .eq('google_event_id', event.id)
      continue
    }

    // Skip events without summary
    if (!event.summary) continue

    // Parse start/end times
    const allDay = Boolean(event.start?.date)
    const startTime = event.start?.dateTime || event.start?.date
    const endTime = event.end?.dateTime || event.end?.date

    if (!startTime || !endTime) continue

    // Upsert the event
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

  // Update sync token
  if (data.nextSyncToken) {
    await supabase
      .from('google_watches')
      .update({ sync_token: data.nextSyncToken })
      .eq('user_id', userId)
      .eq('resource_type', 'calendar')
  }

  console.log('[CalendarWebhook] Synced', events.length, 'events for user:', userId)
}

// Verify GET requests
export async function GET() {
  return NextResponse.json({ status: 'Calendar webhook endpoint active' })
}
