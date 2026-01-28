import { createServerClient } from './supabase'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

interface GoogleTokens {
  access_token: string
  refresh_token: string
  token_expiry: string
  scopes: string[]
}

interface TokenRefreshResponse {
  access_token: string
  expires_in: number
  token_type: string
  scope?: string
}

/**
 * Get a valid access token for a user, refreshing if necessary.
 * Uses service role to access tokens table for background operations.
 */
export async function getValidToken(userId: string): Promise<string | null> {
  const supabase = createServerClient()

  // Fetch stored tokens
  const { data: tokens, error } = await supabase
    .from('google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error || !tokens) {
    console.error('[GoogleAuth] No tokens found for user:', userId, error?.message)
    return null
  }

  // Check if token is still valid (with 5 minute buffer)
  const expiryTime = new Date(tokens.token_expiry).getTime()
  const now = Date.now()
  const bufferMs = 5 * 60 * 1000 // 5 minutes

  if (expiryTime - bufferMs > now) {
    // Token is still valid
    return tokens.access_token
  }

  // Token expired or expiring soon - refresh it
  console.log('[GoogleAuth] Token expired, refreshing for user:', userId)
  const newToken = await refreshToken(userId, tokens.refresh_token)
  return newToken
}

/**
 * Refresh an access token using the refresh token.
 */
export async function refreshToken(
  userId: string,
  refreshTokenValue: string
): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('[GoogleAuth] Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET')
    return null
  }

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshTokenValue,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[GoogleAuth] Token refresh failed:', response.status, errorText)
      return null
    }

    const data: TokenRefreshResponse = await response.json()

    // Calculate new expiry time
    const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString()

    // Update stored tokens
    const supabase = createServerClient()
    const { error: updateError } = await supabase
      .from('google_tokens')
      .update({
        access_token: data.access_token,
        token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (updateError) {
      console.error('[GoogleAuth] Failed to update stored token:', updateError)
      // Still return the token even if we couldn't store it
    }

    return data.access_token
  } catch (error) {
    console.error('[GoogleAuth] Token refresh error:', error)
    return null
  }
}

/**
 * Store OAuth tokens for a user.
 * Called after successful OAuth callback.
 */
export async function storeTokens(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  scopes: string[]
): Promise<boolean> {
  const supabase = createServerClient()

  const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString()

  const { error } = await supabase
    .from('google_tokens')
    .upsert({
      user_id: userId,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expiry: tokenExpiry,
      scopes,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    console.error('[GoogleAuth] Failed to store tokens:', error, { userId, hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken })
    return false
  }

  console.log('[GoogleAuth] Successfully stored tokens for user:', userId)
  return true
}

/**
 * Revoke access and delete stored tokens.
 */
export async function revokeAccess(userId: string): Promise<boolean> {
  const supabase = createServerClient()

  // First get the token to revoke
  const { data: tokens } = await supabase
    .from('google_tokens')
    .select('access_token')
    .eq('user_id', userId)
    .single()

  if (tokens?.access_token) {
    // Revoke with Google
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${tokens.access_token}`, {
        method: 'POST',
      })
    } catch (error) {
      console.error('[GoogleAuth] Token revocation failed:', error)
      // Continue to delete local tokens anyway
    }
  }

  // Delete all integration data
  const { error: deleteTokensError } = await supabase
    .from('google_tokens')
    .delete()
    .eq('user_id', userId)

  const { error: deleteWatchesError } = await supabase
    .from('google_watches')
    .delete()
    .eq('user_id', userId)

  const { error: deleteSettingsError } = await supabase
    .from('integration_settings')
    .update({
      gmail_enabled: false,
      calendar_enabled: false,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (deleteTokensError || deleteWatchesError || deleteSettingsError) {
    console.error('[GoogleAuth] Error cleaning up integration data:', {
      tokens: deleteTokensError,
      watches: deleteWatchesError,
      settings: deleteSettingsError,
    })
    return false
  }

  return true
}

/**
 * Check if a user has valid Google tokens stored.
 */
export async function hasValidTokens(userId: string): Promise<boolean> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('google_tokens')
    .select('token_expiry, refresh_token')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return false
  }

  // Has refresh token means we can always get a valid token
  return Boolean(data.refresh_token)
}

/**
 * Get the scopes granted by the user.
 */
export async function getGrantedScopes(userId: string): Promise<string[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('google_tokens')
    .select('scopes')
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return []
  }

  return data.scopes || []
}
