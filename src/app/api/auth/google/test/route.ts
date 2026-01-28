import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getValidToken } from '@/lib/google-auth'

/**
 * Quick test endpoint to verify Google connection works.
 * Fetches a few calendar events and gmail messages.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // Get a valid Google token
    const googleToken = await getValidToken(user.id)
    if (!googleToken) {
      return NextResponse.json({
        success: false,
        error: 'No Google token found',
      })
    }

    const results: Record<string, unknown> = {
      userId: user.id,
      hasToken: true,
    }

    // Test Calendar API
    try {
      const calRes = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?' +
        new URLSearchParams({
          maxResults: '3',
          singleEvents: 'true',
          orderBy: 'startTime',
          timeMin: new Date().toISOString(),
        }),
        {
          headers: { Authorization: `Bearer ${googleToken}` },
        }
      )

      if (calRes.ok) {
        const calData = await calRes.json()
        results.calendar = {
          success: true,
          eventCount: calData.items?.length || 0,
          events: calData.items?.slice(0, 3).map((e: { summary: string; start: { dateTime?: string; date?: string } }) => ({
            title: e.summary,
            start: e.start?.dateTime || e.start?.date,
          })),
        }
      } else {
        const errText = await calRes.text()
        results.calendar = {
          success: false,
          status: calRes.status,
          error: errText,
        }
      }
    } catch (err) {
      results.calendar = { success: false, error: String(err) }
    }

    // Test Gmail API
    try {
      const gmailRes = await fetch(
        'https://www.googleapis.com/gmail/v1/users/me/messages?' +
        new URLSearchParams({
          maxResults: '3',
        }),
        {
          headers: { Authorization: `Bearer ${googleToken}` },
        }
      )

      if (gmailRes.ok) {
        const gmailData = await gmailRes.json()
        results.gmail = {
          success: true,
          messageCount: gmailData.messages?.length || 0,
          resultSizeEstimate: gmailData.resultSizeEstimate,
        }
      } else {
        const errText = await gmailRes.text()
        results.gmail = {
          success: false,
          status: gmailRes.status,
          error: errText,
        }
      }
    } catch (err) {
      results.gmail = { success: false, error: String(err) }
    }

    return NextResponse.json(results)
  } catch (err) {
    console.error('[GoogleTest] Error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
