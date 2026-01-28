import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getValidToken } from '@/lib/google-auth'

/**
 * Cron job to renew expiring Google Pub/Sub watch subscriptions.
 * Gmail and Calendar watches expire after 7 days.
 * This job runs daily and renews watches expiring within 2 days.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[RenewWatches] Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()

    // Find watches expiring within 2 days
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)

    const { data: expiringWatches, error: queryError } = await supabase
      .from('google_watches')
      .select('*')
      .lt('expiration', twoDaysFromNow.toISOString())

    if (queryError) {
      console.error('[RenewWatches] Error querying watches:', queryError)
      return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }

    if (!expiringWatches || expiringWatches.length === 0) {
      console.log('[RenewWatches] No watches need renewal')
      return NextResponse.json({
        success: true,
        renewed: 0,
        message: 'No watches need renewal',
      })
    }

    console.log(`[RenewWatches] Found ${expiringWatches.length} watches to renew`)

    const results = {
      renewed: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const watch of expiringWatches) {
      try {
        const accessToken = await getValidToken(watch.user_id)
        if (!accessToken) {
          results.failed++
          results.errors.push(`No token for user ${watch.user_id}`)
          continue
        }

        if (watch.resource_type === 'gmail') {
          await renewGmailWatch(watch.user_id, accessToken, supabase)
          results.renewed++
        } else if (watch.resource_type === 'calendar') {
          await renewCalendarWatch(watch.user_id, accessToken, supabase)
          results.renewed++
        }
      } catch (error) {
        results.failed++
        results.errors.push(`Error renewing watch for ${watch.user_id}: ${error}`)
        console.error('[RenewWatches] Error:', error)
      }
    }

    console.log('[RenewWatches] Results:', results)

    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (error) {
    console.error('[RenewWatches] Cron error:', error)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}

/**
 * Renew a Gmail watch subscription.
 */
async function renewGmailWatch(
  userId: string,
  accessToken: string,
  supabase: ReturnType<typeof createServerClient>
) {
  const topicName = process.env.GOOGLE_PUBSUB_TOPIC_GMAIL
  if (!topicName) {
    throw new Error('GOOGLE_PUBSUB_TOPIC_GMAIL not configured')
  }

  // Stop the existing watch first
  await fetch('https://gmail.googleapis.com/gmail/v1/users/me/stop', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  // Create a new watch
  const watchResponse = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/watch',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topicName,
        labelIds: ['INBOX'],
        labelFilterBehavior: 'INCLUDE',
      }),
    }
  )

  if (!watchResponse.ok) {
    const errorText = await watchResponse.text()
    throw new Error(`Gmail watch creation failed: ${watchResponse.status} ${errorText}`)
  }

  const watchData = await watchResponse.json()

  // Update the stored watch
  await supabase
    .from('google_watches')
    .update({
      expiration: new Date(parseInt(watchData.expiration)).toISOString(),
      history_id: watchData.historyId,
    })
    .eq('user_id', userId)
    .eq('resource_type', 'gmail')

  console.log(`[RenewWatches] Renewed Gmail watch for user ${userId}`)
}

/**
 * Renew a Calendar watch subscription.
 */
async function renewCalendarWatch(
  userId: string,
  accessToken: string,
  supabase: ReturnType<typeof createServerClient>
) {
  // Get existing watch details
  const { data: existingWatch } = await supabase
    .from('google_watches')
    .select('*')
    .eq('user_id', userId)
    .eq('resource_type', 'calendar')
    .single()

  // Stop the existing watch
  if (existingWatch) {
    await fetch(
      'https://www.googleapis.com/calendar/v3/channels/stop',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: existingWatch.watch_id,
          resourceId: existingWatch.resource_id,
        }),
      }
    )
  }

  // Get the webhook URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
  if (!baseUrl) {
    throw new Error('Webhook URL not configured')
  }

  const webhookUrl = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/api/calendar/webhook`
  const channelId = `calendar-${userId}`

  // Create a new watch
  const watchResponse = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events/watch',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address: webhookUrl,
        params: {
          ttl: '604800',  // 7 days
        },
      }),
    }
  )

  if (!watchResponse.ok) {
    const errorText = await watchResponse.text()
    throw new Error(`Calendar watch creation failed: ${watchResponse.status} ${errorText}`)
  }

  const watchData = await watchResponse.json()

  // Update the stored watch
  await supabase
    .from('google_watches')
    .update({
      watch_id: watchData.id,
      resource_id: watchData.resourceId,
      expiration: new Date(parseInt(watchData.expiration)).toISOString(),
    })
    .eq('user_id', userId)
    .eq('resource_type', 'calendar')

  console.log(`[RenewWatches] Renewed Calendar watch for user ${userId}`)
}

// Also support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request)
}
