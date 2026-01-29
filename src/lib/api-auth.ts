/**
 * Authentication helpers for API routes
 *
 * Provides consistent authentication patterns across all API routes.
 */

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// ============================================================================
// Types
// ============================================================================

export interface AuthResult {
  success: true
  userId: string
  user: {
    id: string
    email?: string
  }
}

export interface AuthError {
  success: false
  error: string
  status: number
}

export type AuthCheck = AuthResult | AuthError

// ============================================================================
// Authentication Functions
// ============================================================================

/**
 * Verify user authentication from Bearer token.
 * Use this in API routes that require authentication.
 *
 * @param request - The incoming request
 * @returns AuthResult on success, AuthError on failure
 */
export async function verifyAuth(request: NextRequest): Promise<AuthCheck> {
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'Missing or invalid authorization header',
      status: 401,
    }
  }

  const token = authHeader.slice(7)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return {
      success: false,
      error: 'Invalid or expired token',
      status: 401,
    }
  }

  return {
    success: true,
    userId: user.id,
    user: {
      id: user.id,
      email: user.email,
    },
  }
}

/**
 * Verify user authentication and return error response if not authenticated.
 * Use this as a quick guard at the start of API routes.
 *
 * @param request - The incoming request
 * @returns User info if authenticated, NextResponse error if not
 */
export async function requireAuth(
  request: NextRequest
): Promise<AuthResult | NextResponse> {
  const auth = await verifyAuth(request)

  if (!auth.success) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  return auth
}

type SupabaseClient = ReturnType<typeof createClient>

export interface AuthWithClient {
  user: {
    id: string
    email?: string
  }
  supabase: SupabaseClient
}

/**
 * Verify authentication and return an authenticated Supabase client.
 * The client respects RLS policies - use this instead of SERVICE_ROLE_KEY.
 *
 * @param request - The incoming request
 * @returns User info + authenticated Supabase client, or NextResponse error
 */
export async function requireAuthWithClient(
  request: NextRequest
): Promise<AuthWithClient | NextResponse> {
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid authorization header' },
      { status: 401 }
    )
  }

  const token = authHeader.slice(7)

  // Create client with user's token for RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    )
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    supabase,
  }
}

/**
 * Check if a request is from an internal cron job.
 * Cron jobs use CRON_SECRET for authentication.
 */
export function verifyCronAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    // If no secret configured, deny all cron requests
    return false
  }

  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Check if a request is from a trusted webhook source.
 */
export function verifyWebhookAuth(
  request: Request,
  secretEnvVar: string
): boolean {
  const secret = process.env[secretEnvVar]
  if (!secret) {
    // If no secret configured, allow (but log warning)
    console.warn(`[WebhookAuth] ${secretEnvVar} not configured`)
    return true
  }

  const authHeader = request.headers.get('authorization')
  return authHeader === `Bearer ${secret}`
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Create an unauthorized response.
 */
export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 })
}

/**
 * Create a forbidden response.
 */
export function forbiddenResponse(message = 'Forbidden'): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 })
}
