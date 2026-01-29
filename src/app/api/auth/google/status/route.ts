import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase'
import { getValidToken, getGrantedScopes } from '@/lib/google-auth'

/**
 * Check if user has Google connected with proper scopes.
 * Uses token refresh to ensure we have a valid token.
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

    // Get granted scopes - with detailed debugging
    const scopes = await getGrantedScopes(user.id)

    // Debug log removed('[GoogleStatus] User:', user.id, 'Scopes:', scopes)

    if (scopes.length === 0) {
      // Check if we can even query the tokens table
      const { createServerClient } = await import('@/lib/google-auth').then(() => import('@/lib/supabase'))
      const supabase = createServerClient()
      const { data, error } = await supabase
        .from('google_tokens')
        .select('user_id, scopes, updated_at')
        .eq('user_id', user.id)
        .single()

      // Debug log removed('[GoogleStatus] Direct token query:', { data, error: error?.message, code: error?.code })

      return NextResponse.json({
        connected: false,
        reason: 'no_tokens',
        debug: {
          userId: user.id,
          queryError: error?.message,
          queryCode: error?.code,
          hasData: !!data
        }
      })
    }

    // Check if we have the required scopes
    const hasGmail = scopes.some((s: string) => s.includes('gmail'))
    const hasCalendar = scopes.some((s: string) =>
      s.includes('calendar') && !s.includes('readonly')
    )

    if (!hasGmail || !hasCalendar) {
      return NextResponse.json({
        connected: false,
        reason: 'missing_scopes',
        hasGmail,
        hasCalendar,
        scopes,
      })
    }

    // Try to get a valid token (will refresh if needed)
    const validToken = await getValidToken(user.id)

    if (!validToken) {
      return NextResponse.json({ connected: false, reason: 'token_refresh_failed' })
    }

    // Cache for 5 minutes since connection status doesn't change often
    const response = NextResponse.json({ connected: true })
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600')
    return response
  } catch {
    // Error handled silently
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
