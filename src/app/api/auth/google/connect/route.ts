import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Initiates Google OAuth flow for Gmail/Calendar permissions.
 * This is separate from Supabase auth - used to get additional scopes.
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is logged in
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

    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return NextResponse.json({ error: 'Google client ID not configured' }, { status: 500 })
    }

    // Build the OAuth URL - using the already-registered callback path
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://gather-lilac.vercel.app').replace(/\/$/, '')
    const redirectUri = `${baseUrl}/api/auth/google/callback`

    // Debug log removed('[GoogleConnect] Using redirect URI:', redirectUri)

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar',
    ]

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: user.id, // Pass user ID to link tokens later
    })

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return NextResponse.json({ url: authUrl })
  } catch {
    // Error handled silently
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
