/**
 * Sentry Server Configuration
 *
 * This file configures the initialization of Sentry on the server.
 * The config you add here will be used whenever the server handles a request.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN

// Only initialize if DSN is configured
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // Environment
    environment: process.env.NODE_ENV,

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Filter sensitive data from errors
    beforeSend(event, hint) {
      // Remove any sensitive headers
      if (event.request?.headers) {
        const sensitiveHeaders = [
          'authorization',
          'cookie',
          'x-api-key',
          'x-auth-token',
        ]
        for (const header of sensitiveHeaders) {
          if (event.request.headers[header]) {
            event.request.headers[header] = '[Filtered]'
          }
        }
      }

      // Remove any sensitive data from the event
      if (event.extra) {
        const sensitiveKeys = [
          'access_token',
          'refresh_token',
          'api_key',
          'password',
          'secret',
          'token',
        ]
        for (const key of sensitiveKeys) {
          if (event.extra[key]) {
            event.extra[key] = '[Filtered]'
          }
        }
      }

      return event
    },

    // Don't send PII
    sendDefaultPii: false,

    // Ignore specific errors
    ignoreErrors: [
      // Ignore rate limiting errors (expected behavior)
      'Too many requests',
      // Ignore auth errors (user needs to re-authenticate)
      'Invalid session',
      'Unauthorized',
      // Ignore aborted requests
      'AbortError',
      'The operation was aborted',
    ],

    // Ignore specific transactions
    tracesSampler: (samplingContext) => {
      // Don't trace health checks
      if (samplingContext.name?.includes('/api/health')) {
        return 0
      }

      // Don't trace static assets
      if (samplingContext.name?.includes('/_next/')) {
        return 0
      }

      // Default sampling
      return process.env.NODE_ENV === 'production' ? 0.1 : 1.0
    },
  })
}
