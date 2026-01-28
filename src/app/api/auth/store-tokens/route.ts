import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    // Get the user from the auth header
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.slice(7)

    // Create client with anon key to verify the user's token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error('[StoreTokens] Invalid user token:', userError)
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Get the body
    const body = await request.json()
    const { provider_token, provider_refresh_token } = body

    if (!provider_token) {
      return NextResponse.json({ error: 'No provider token' }, { status: 400 })
    }

    console.log('[StoreTokens] Storing tokens for user:', user.id, {
      hasProviderToken: !!provider_token,
      hasRefreshToken: !!provider_refresh_token,
    })

    // Use service role to store tokens
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar',
    ]

    // Token expires in ~1 hour, but we'll set a reasonable default
    const tokenExpiry = new Date(Date.now() + 3600 * 1000).toISOString()

    const { error: upsertError } = await supabaseAdmin
      .from('google_tokens')
      .upsert({
        user_id: user.id,
        access_token: provider_token,
        refresh_token: provider_refresh_token || '',
        token_expiry: tokenExpiry,
        scopes,
        updated_at: new Date().toISOString(),
      })

    if (upsertError) {
      console.error('[StoreTokens] Failed to store tokens:', upsertError)
      return NextResponse.json({ error: 'Failed to store tokens' }, { status: 500 })
    }

    // Also initialize integration settings
    await supabaseAdmin
      .from('integration_settings')
      .upsert({
        user_id: user.id,
        gmail_enabled: false,
        calendar_enabled: false,
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: true,
      })

    console.log('[StoreTokens] Successfully stored tokens for user:', user.id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[StoreTokens] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
