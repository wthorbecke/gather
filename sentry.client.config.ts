/**
 * Sentry Client Configuration
 *
 * This file configures the initialization of Sentry on the client.
 * The config you add here will be used whenever a user loads a page in their browser.
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */

import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

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

    // Replay configuration for session replay
    replaysOnErrorSampleRate: 1.0, // Capture 100% of sessions with errors
    replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0, // Sample 10% of sessions in prod

    // Integrations
    integrations: [
      Sentry.replayIntegration({
        // Mask all text in replays
        maskAllText: true,
        // Block all media
        blockAllMedia: true,
      }),
      Sentry.browserTracingIntegration(),
    ],

    // Filter out known non-issues
    beforeSend(event, hint) {
      // Filter out common browser extension errors
      const error = hint.originalException
      if (error && typeof error === 'object' && 'message' in error) {
        const message = String(error.message)

        // Ignore browser extension errors
        if (
          message.includes('chrome-extension://') ||
          message.includes('moz-extension://') ||
          message.includes('safari-extension://')
        ) {
          return null
        }

        // Ignore ResizeObserver errors (browser quirk, not actual issues)
        if (message.includes('ResizeObserver loop')) {
          return null
        }

        // Ignore network errors that are likely user connectivity issues
        if (
          message.includes('NetworkError') ||
          message.includes('Failed to fetch') ||
          message.includes('Load failed')
        ) {
          return null
        }
      }

      return event
    },

    // Don't send PII
    sendDefaultPii: false,

    // Add user context if available (without PII)
    beforeSendTransaction(event) {
      // Remove any accidentally included PII
      if (event.user) {
        delete event.user.email
        delete event.user.ip_address
      }
      return event
    },
  })
}
