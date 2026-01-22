import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

const REMINDER_MESSAGES = [
  { title: 'Hey, you there?', body: 'Gather misses you. Just checking in.' },
  { title: 'Quick check-in', body: 'How are things going? Open Gather when you have a moment.' },
  { title: 'Gentle nudge', body: "Don't forget about the things that matter to you." },
  { title: 'Still here for you', body: 'Whenever you are ready, Gather is here.' },
  { title: 'Time for a break?', body: 'Maybe review your tasks while you rest.' },
]

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Configure web-push (inside function to avoid build-time errors)
  webpush.setVapidDetails(
    'mailto:willthorbecke@gmail.com',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  )

  // Use service role for reading all subscriptions
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // Get all push subscriptions
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('subscription, user_id')

    if (error) {
      console.error('Error fetching subscriptions:', error)
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No subscriptions to notify', sent: 0 })
    }

    // Pick a random message
    const message = REMINDER_MESSAGES[Math.floor(Math.random() * REMINDER_MESSAGES.length)]

    // Send notifications
    const results = await Promise.allSettled(
      subscriptions.map(async ({ subscription, user_id }) => {
        try {
          await webpush.sendNotification(
            subscription,
            JSON.stringify({
              title: message.title,
              body: message.body,
              url: '/',
            })
          )
          return { user_id, success: true }
        } catch (err: unknown) {
          const error = err as { statusCode?: number }
          // If subscription is no longer valid, remove it
          if (error.statusCode === 410) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('user_id', user_id)
          }
          return { user_id, success: false, error: String(err) }
        }
      })
    )

    const sent = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length

    return NextResponse.json({
      message: `Sent ${sent} notifications`,
      sent,
      total: subscriptions.length,
    })
  } catch (err) {
    console.error('Cron error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
