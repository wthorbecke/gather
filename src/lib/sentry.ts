/**
 * Sentry Utilities
 *
 * Helper functions for manual error capture and context setting.
 * Use these for cases where automatic error capture doesn't work.
 */

import * as Sentry from '@sentry/nextjs'

// ============================================================================
// Types
// ============================================================================

export interface ErrorContext {
  /** The operation that was being performed */
  operation: string
  /** User ID (no PII) */
  userId?: string
  /** Any additional context */
  extra?: Record<string, unknown>
  /** Tags for filtering in Sentry */
  tags?: Record<string, string>
}

export type SeverityLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

// ============================================================================
// Error Capture
// ============================================================================

/**
 * Capture an error with additional context.
 * Use this for errors that need more context than automatic capture provides.
 */
export function captureError(
  error: Error | string,
  context: ErrorContext
): string | undefined {
  const eventId = Sentry.withScope((scope) => {
    // Set operation as tag for easy filtering
    scope.setTag('operation', context.operation)

    // Add custom tags
    if (context.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        scope.setTag(key, value)
      }
    }

    // Set user context (no PII)
    if (context.userId) {
      scope.setUser({ id: context.userId })
    }

    // Add extra context
    if (context.extra) {
      for (const [key, value] of Object.entries(context.extra)) {
        // Filter out sensitive data
        if (isSensitiveKey(key)) {
          scope.setExtra(key, '[Filtered]')
        } else {
          scope.setExtra(key, value)
        }
      }
    }

    // Capture the error
    if (typeof error === 'string') {
      return Sentry.captureMessage(error, 'error')
    }
    return Sentry.captureException(error)
  })

  return eventId
}

/**
 * Capture a message (non-error event).
 * Use this for important events that aren't errors.
 */
export function captureMessage(
  message: string,
  level: SeverityLevel = 'info',
  context?: Partial<ErrorContext>
): string | undefined {
  return Sentry.withScope((scope) => {
    if (context?.operation) {
      scope.setTag('operation', context.operation)
    }

    if (context?.userId) {
      scope.setUser({ id: context.userId })
    }

    if (context?.tags) {
      for (const [key, value] of Object.entries(context.tags)) {
        scope.setTag(key, value)
      }
    }

    if (context?.extra) {
      for (const [key, value] of Object.entries(context.extra)) {
        if (isSensitiveKey(key)) {
          scope.setExtra(key, '[Filtered]')
        } else {
          scope.setExtra(key, value)
        }
      }
    }

    return Sentry.captureMessage(message, level)
  })
}

// ============================================================================
// Context Management
// ============================================================================

/**
 * Set user context for all subsequent events.
 * Call this after user authentication.
 */
export function setUser(userId: string | null): void {
  if (userId) {
    Sentry.setUser({ id: userId })
  } else {
    Sentry.setUser(null)
  }
}

/**
 * Add a breadcrumb to the trail.
 * Breadcrumbs help understand the events leading up to an error.
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: SeverityLevel = 'info'
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data: data ? filterSensitiveData(data) : undefined,
    level,
  })
}

/**
 * Set a tag that will be applied to all events.
 * Tags are indexed and searchable in Sentry.
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value)
}

/**
 * Set extra context that will be applied to all events.
 * Extra context is not indexed but visible in event details.
 */
export function setExtra(key: string, value: unknown): void {
  if (isSensitiveKey(key)) {
    Sentry.setExtra(key, '[Filtered]')
  } else {
    Sentry.setExtra(key, value)
  }
}

// ============================================================================
// Performance Monitoring
// ============================================================================

/**
 * Start a new transaction for performance monitoring.
 * Use this for custom performance tracking.
 */
export function startTransaction(
  name: string,
  op: string
): ReturnType<typeof Sentry.startInactiveSpan> {
  return Sentry.startInactiveSpan({ name, op })
}

/**
 * Wrap an async function with a transaction.
 * Automatically handles timing and error capture.
 */
export async function withTransaction<T>(
  name: string,
  op: string,
  fn: () => Promise<T>
): Promise<T> {
  return Sentry.startSpan({ name, op }, async () => {
    try {
      return await fn()
    } catch (error) {
      if (error instanceof Error) {
        Sentry.captureException(error)
      }
      throw error
    }
  })
}

// ============================================================================
// API Route Helpers
// ============================================================================

/**
 * Wrap an API route handler with error capture.
 * Automatically captures errors and adds request context.
 */
export function withSentry<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T,
  routeName: string
): T {
  return (async (...args: Parameters<T>) => {
    return Sentry.withScope(async (scope) => {
      scope.setTag('route', routeName)

      try {
        return await handler(...args)
      } catch (error) {
        if (error instanceof Error) {
          Sentry.captureException(error)
        }
        throw error
      }
    })
  }) as T
}

// ============================================================================
// Utility Functions
// ============================================================================

const SENSITIVE_KEYS = new Set([
  'password',
  'secret',
  'token',
  'api_key',
  'apiKey',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'authorization',
  'auth',
  'credential',
  'private_key',
  'privateKey',
])

function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase()
  return (
    SENSITIVE_KEYS.has(lowerKey) ||
    lowerKey.includes('password') ||
    lowerKey.includes('secret') ||
    lowerKey.includes('token') ||
    lowerKey.includes('key')
  )
}

function filterSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const filtered: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(data)) {
    if (isSensitiveKey(key)) {
      filtered[key] = '[Filtered]'
    } else if (typeof value === 'object' && value !== null) {
      filtered[key] = filterSensitiveData(value as Record<string, unknown>)
    } else {
      filtered[key] = value
    }
  }

  return filtered
}

// ============================================================================
// Initialization Check
// ============================================================================

/**
 * Check if Sentry is initialized and working.
 */
export function isSentryInitialized(): boolean {
  return !!process.env.NEXT_PUBLIC_SENTRY_DSN || !!process.env.SENTRY_DSN
}
