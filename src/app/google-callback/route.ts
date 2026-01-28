import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Handles OAuth callback from Google for Gmail/Calendar permissions.
 * Exchanges the code for tokens and stores them.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state') // User ID
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://gather-lilac.vercel.app'

  if (error) {
    console.error('[GoogleCallback] OAuth error:', error)
    return NextResponse.redirect(`${baseUrl}?integration_error=${error}`)
  }

  if (!code || !state) {
    console.error('[GoogleCallback] Missing code or state')
    return NextResponse.redirect(`${baseUrl}?integration_error=missing_params`)
  }

  try {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('[GoogleCallback] Missing Google credentials')
      return NextResponse.redirect(`${baseUrl}?integration_error=config_error`)
    }

    const redirectUri = `${baseUrl}/google-callback`

    // Exchange code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('[GoogleCallback] Token exchange failed:', errorText)
      return NextResponse.redirect(`${baseUrl}?integration_error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()

    console.log('[GoogleCallback] Got tokens:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
    })

    // Store tokens in database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    const scopes = tokens.scope?.split(' ') || []

    const { error: upsertError } = await supabase
      .from('google_tokens')
      .upsert({
        user_id: state,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || '',
        token_expiry: tokenExpiry,
        scopes,
        updated_at: new Date().toISOString(),
      })

    if (upsertError) {
      console.error('[GoogleCallback] Failed to store tokens:', upsertError)
      return NextResponse.redirect(`${baseUrl}?integration_error=storage_failed`)
    }

    // Initialize integration settings
    await supabase
      .from('integration_settings')
      .upsert({
        user_id: state,
        gmail_enabled: false,
        calendar_enabled: false,
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: true,
      })

    console.log('[GoogleCallback] Successfully stored tokens for user:', state)

    // Redirect back to app with success
    return NextResponse.redirect(`${baseUrl}?integration_connected=true`)
  } catch (err) {
    console.error('[GoogleCallback] Error:', err)
    return NextResponse.redirect(`${baseUrl}?integration_error=unknown`)
  }
}
