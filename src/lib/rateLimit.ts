/**
 * Rate limiting for API routes
 *
 * Supports both in-memory (development) and Redis (production) rate limiting.
 * Use RATE_LIMIT_MODE=redis and UPSTASH_REDIS_REST_URL/TOKEN for production.
 */

import { Redis } from '@upstash/redis'

// ============================================================================
// Types
// ============================================================================

interface RateLimitEntry {
  count: number
  resetTime: number
}

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  limit: number
  /** Time window in seconds */
  windowSeconds: number
  /** Identifier for the limit (e.g., 'ai-chat', 'task-create') */
  name: string
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfter?: number
}

// ============================================================================
// Configuration
// ============================================================================

const RATE_LIMIT_MODE = process.env.RATE_LIMIT_MODE || 'memory'

// Lazy-initialized Redis client
let redisClient: Redis | null = null

function getRedisClient(): Redis | null {
  if (redisClient) return redisClient

  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    console.warn('[RateLimit] Redis credentials not configured, falling back to in-memory')
    return null
  }

  try {
    redisClient = new Redis({ url, token })
    return redisClient
  } catch (error) {
    console.error('[RateLimit] Failed to initialize Redis client:', error)
    return null
  }
}

// ============================================================================
// In-Memory Rate Limiting (Development / Fallback)
// ============================================================================

// In-memory store - one per serverless instance
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries every minute to prevent memory leak
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 60000 // 1 minute

function cleanupOldEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  lastCleanup = now
  const keysToDelete: string[] = []
  rateLimitStore.forEach((entry, key) => {
    if (now > entry.resetTime) {
      keysToDelete.push(key)
    }
  })
  keysToDelete.forEach(key => rateLimitStore.delete(key))
}

function checkRateLimitMemory(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  cleanupOldEntries()

  const key = `${config.name}:${identifier}`
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000

  const entry = rateLimitStore.get(key)

  // No existing entry or window expired - allow and start new window
  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    })
    return {
      allowed: true,
      remaining: config.limit - 1,
      resetAt: now + windowMs,
    }
  }

  // Within window - check limit
  if (entry.count >= config.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    }
  }

  // Allow and increment
  entry.count++
  return {
    allowed: true,
    remaining: config.limit - entry.count,
    resetAt: entry.resetTime,
  }
}

// ============================================================================
// Redis Rate Limiting (Production)
// ============================================================================

async function checkRateLimitRedis(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedisClient()
  if (!redis) {
    // Fallback to memory if Redis unavailable
    return checkRateLimitMemory(identifier, config)
  }

  const key = `ratelimit:${config.name}:${identifier}`
  const now = Date.now()
  const windowMs = config.windowSeconds * 1000

  try {
    // Use Redis MULTI for atomic operations
    const pipeline = redis.pipeline()

    // Get current count
    pipeline.get(key)
    // Get TTL to calculate reset time
    pipeline.pttl(key)

    const results = await pipeline.exec()
    const currentCount = results[0] as number | null
    const ttl = results[1] as number

    if (currentCount === null) {
      // First request in window - set count with expiry
      await redis.setex(key, config.windowSeconds, 1)
      return {
        allowed: true,
        remaining: config.limit - 1,
        resetAt: now + windowMs,
      }
    }

    const count = Number(currentCount)
    const resetAt = ttl > 0 ? now + ttl : now + windowMs

    if (count >= config.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfter: Math.ceil(ttl / 1000),
      }
    }

    // Increment counter
    await redis.incr(key)

    return {
      allowed: true,
      remaining: config.limit - count - 1,
      resetAt,
    }
  } catch (error) {
    console.error('[RateLimit] Redis error, falling back to memory:', error)
    return checkRateLimitMemory(identifier, config)
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if a request should be rate limited
 *
 * @param identifier - Unique identifier for the requester (user ID, IP, etc.)
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed and rate limit info
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  // For sync usage, only use memory-based limiting
  // Use checkRateLimitAsync for Redis support
  return checkRateLimitMemory(identifier, config)
}

/**
 * Check if a request should be rate limited (async version with Redis support)
 *
 * @param identifier - Unique identifier for the requester (user ID, IP, etc.)
 * @param config - Rate limit configuration
 * @returns Whether the request is allowed and rate limit info
 */
export async function checkRateLimitAsync(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  if (RATE_LIMIT_MODE === 'redis') {
    return checkRateLimitRedis(identifier, config)
  }
  return checkRateLimitMemory(identifier, config)
}

// Pre-configured limits for different operations
export const RATE_LIMITS = {
  /** AI chat - conversational queries */
  aiChat: {
    limit: 60,
    windowSeconds: 60, // 60 requests per minute
    name: 'ai-chat',
  },
  /** AI task breakdown - more expensive */
  aiTaskBreakdown: {
    limit: 20,
    windowSeconds: 60, // 20 breakdowns per minute
    name: 'ai-breakdown',
  },
  /** Task creation */
  taskCreate: {
    limit: 30,
    windowSeconds: 60, // 30 tasks per minute
    name: 'task-create',
  },
  /** Email scanning - very expensive */
  emailScan: {
    limit: 5,
    windowSeconds: 300, // 5 scans per 5 minutes
    name: 'email-scan',
  },
  /** Global catch-all for API abuse */
  global: {
    limit: 200,
    windowSeconds: 60, // 200 total requests per minute per user
    name: 'global',
  },
} as const

/**
 * Helper to get user identifier from request
 * Falls back to IP if no user ID available
 */
export function getRequestIdentifier(
  request: Request,
  userId?: string
): string {
  if (userId) return userId

  // Try various headers for IP (Vercel, Cloudflare, etc.)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp

  // Vercel-specific
  const vercelIp = request.headers.get('x-vercel-forwarded-for')
  if (vercelIp) return vercelIp.split(',')[0].trim()

  return 'anonymous'
}

/**
 * Create a rate limit error response
 */
export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: 'Slow down a bit. Try again in a few seconds.',
      retryAfter: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(result.retryAfter || 60),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.resetAt),
      },
    }
  )
}
