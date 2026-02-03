import Stripe from 'stripe'

// Lazy-loaded Stripe instance (only initialized when needed in API routes)
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    _stripe = new Stripe(secretKey, {
      apiVersion: '2026-01-28.clover',
      typescript: true,
    })
  }
  return _stripe
}

// For backwards compatibility, also export as stripe
// Note: This will throw at build time if accessed during SSG
export const stripe = {
  get customers() { return getStripe().customers },
  get subscriptions() { return getStripe().subscriptions },
  get checkout() { return getStripe().checkout },
  get billingPortal() { return getStripe().billingPortal },
  get webhooks() { return getStripe().webhooks },
}

// Price IDs - these will be created in Stripe Dashboard
export const PRICE_ID_MONTHLY = process.env.STRIPE_PRICE_ID_MONTHLY || ''
export const PRICE_ID_YEARLY = process.env.STRIPE_PRICE_ID_YEARLY || ''

// Product configuration
export const PRODUCT_NAME = 'Gather Pro'
export const PRICE_MONTHLY = 10 // $10/month
export const PRICE_YEARLY = 96 // $8/month billed yearly

// Subscription status helpers
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'unpaid'
  | 'paused'

export function isActiveSubscription(status: SubscriptionStatus): boolean {
  return status === 'trialing' || status === 'active'
}

export function getSubscriptionStatusMessage(status: SubscriptionStatus): string {
  switch (status) {
    case 'trialing':
      return 'Trial period'
    case 'active':
      return 'Active subscription'
    case 'canceled':
      return 'Subscription canceled'
    case 'past_due':
      return 'Payment past due'
    case 'unpaid':
      return 'Payment failed'
    case 'paused':
      return 'Subscription paused'
    default:
      return 'No active subscription'
  }
}

// Webhook event types we care about
export const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
] as const

export type WebhookEventType = typeof WEBHOOK_EVENTS[number]
