import { createServerClient } from './supabase'
import { encryptToken, decryptToken, isEncryptionConfigured } from './encryption'

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
    return null
  }

  // Decrypt stored access token
  const accessToken = decryptToken(tokens.access_token)

  // Check if token is still valid (with 5 minute buffer)
  const expiryTime = new Date(tokens.token_expiry).getTime()
  const now = Date.now()
  const bufferMs = 5 * 60 * 1000 // 5 minutes

  if (expiryTime - bufferMs > now) {
    // Token is still valid
    return accessToken
  }

  // Token expired or expiring soon - refresh it
  const refreshToken = decryptToken(tokens.refresh_token)
  const newToken = await refreshToken_internal(userId, refreshToken)
  return newToken
}

/**
 * Refresh an access token using the refresh token.
 * Internal function - handles the actual refresh logic.
 */
async function refreshToken_internal(
  userId: string,
  refreshTokenValue: string
): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
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
      return null
    }

    const data: TokenRefreshResponse = await response.json()

    // Calculate new expiry time
    const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString()

    // Encrypt the new access token before storing
    const encryptedAccessToken = encryptToken(data.access_token)

    // Update stored tokens
    const supabase = createServerClient()
    const { error: updateError } = await supabase
      .from('google_tokens')
      .update({
        access_token: encryptedAccessToken,
        token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    if (updateError) {
      // Still return the token even if we couldn't store it
    }

    return data.access_token
  } catch (error) {
    return null
  }
}

/**
 * Refresh an access token using the refresh token.
 * Public API - fetches the refresh token from storage.
 */
export async function refreshToken(
  userId: string,
  refreshTokenValue: string
): Promise<string | null> {
  return refreshToken_internal(userId, refreshTokenValue)
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

  // Encrypt tokens before storing
  const encryptedAccessToken = encryptToken(accessToken)
  const encryptedRefreshToken = encryptToken(refreshToken)

  const { error } = await supabase
    .from('google_tokens')
    .upsert({
      user_id: userId,
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      token_expiry: tokenExpiry,
      scopes,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    return false
  }

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
    // Decrypt token before revoking
    const accessToken = decryptToken(tokens.access_token)

    // Revoke with Google
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?token=${accessToken}`, {
        method: 'POST',
      })
    } catch (error) {
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

/**
 * Check if token encryption is enabled
 */
export function isTokenEncryptionEnabled(): boolean {
  return isEncryptionConfigured()
}
