import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { getValidToken } from '@/lib/google-auth'

interface GmailWatchResponse {
  historyId: string
  expiration: string  // Unix timestamp in milliseconds as string
}

/**
 * Create or renew a Gmail watch subscription.
 * POST: Create new watch
 * DELETE: Stop watching
 */
export async function POST(request: NextRequest) {
  try {
    // Get auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const accessToken = authHeader.slice(7)

    // Create Supabase client to verify session
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

    const topicName = process.env.GOOGLE_PUBSUB_TOPIC_GMAIL
    if (!topicName) {
      return NextResponse.json({
        error: 'Pub/Sub topic not configured',
      }, { status: 500 })
    }

    // Create Gmail watch
    const watchResponse = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/watch',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${googleToken}`,
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
      console.error('[GmailWatch] Failed to create watch:', watchResponse.status, errorText)
      return NextResponse.json({
        error: 'Failed to set up Gmail notifications',
        details: errorText,
      }, { status: 500 })
    }

    const watchData: GmailWatchResponse = await watchResponse.json()

    // Store watch details
    const serverClient = createServerClient()
    const { error: upsertError } = await serverClient
      .from('google_watches')
      .upsert({
        user_id: user.id,
        resource_type: 'gmail',
        watch_id: `gmail-${user.id}`,
        resource_id: 'me',
        expiration: new Date(parseInt(watchData.expiration)).toISOString(),
        history_id: watchData.historyId,
      }, {
        onConflict: 'user_id,resource_type',
      })

    if (upsertError) {
      console.error('[GmailWatch] Failed to store watch:', upsertError)
      return NextResponse.json({
        error: 'Failed to store watch configuration',
      }, { status: 500 })
    }

    // Enable Gmail in integration settings
    await serverClient
      .from('integration_settings')
      .upsert({
        user_id: user.id,
        gmail_enabled: true,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })

    const expirationDate = new Date(parseInt(watchData.expiration))

    return NextResponse.json({
      success: true,
      expiration: expirationDate.toISOString(),
      historyId: watchData.historyId,
    })
  } catch (error) {
    console.error('[GmailWatch] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Stop Gmail watch subscription.
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

    // Get a valid Google token
    const googleToken = await getValidToken(user.id)
    if (googleToken) {
      // Stop the Gmail watch
      await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/stop',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${googleToken}`,
          },
        }
      )
    }

    // Delete watch from database
    const serverClient = createServerClient()
    await serverClient
      .from('google_watches')
      .delete()
      .eq('user_id', user.id)
      .eq('resource_type', 'gmail')

    // Disable Gmail in integration settings
    await serverClient
      .from('integration_settings')
      .update({
        gmail_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[GmailWatch] Error stopping watch:', error)
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
      .eq('resource_type', 'gmail')
      .single()

    if (!watch) {
      return NextResponse.json({ active: false })
    }

    const isExpired = new Date(watch.expiration) < new Date()

    return NextResponse.json({
      active: !isExpired,
      expiration: watch.expiration,
      historyId: watch.history_id,
    })
  } catch (error) {
    console.error('[GmailWatch] Error getting status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
