import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getStripe, stripe } from '@/lib/stripe'
import Stripe from 'stripe'

// Disable body parsing - we need raw body for signature verification
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Webhook not configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    )
  }

  const supabase = createServerClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Get the subscription
        if (session.subscription && session.customer) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          )
          await upsertSubscription(supabase, subscription)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        await upsertSubscription(supabase, subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        // Update subscription status to canceled
        await supabase
          .from('stripe_subscriptions')
          .update({
            status: 'canceled',
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', subscription.id)
        console.log(`[Stripe Webhook] Subscription ${subscription.id} deleted/canceled`)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        // Update subscription on successful payment
        // Use parent to get the subscription ID
        const subscriptionId = typeof invoice.parent === 'object' && invoice.parent
          ? (invoice.parent as { subscription_details?: { subscription?: string } }).subscription_details?.subscription
          : null
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          await upsertSubscription(supabase, subscription)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        // Log payment failure - subscription status update will come via subscription.updated
        console.warn(`[Stripe Webhook] Payment failed for invoice ${invoice.id}`)
        break
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Stripe Webhook] Error processing event:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

// Helper to upsert subscription
async function upsertSubscription(
  supabase: ReturnType<typeof createServerClient>,
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string

  // Find user by Stripe customer ID
  const { data: customerData } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!customerData) {
    console.error(`[Stripe Webhook] No user found for customer ${customerId}`)
    return
  }

  const firstItem = subscription.items.data[0]
  const priceId = firstItem?.price.id
  const status = subscription.status

  // Get period dates from subscription item (new Stripe API)
  const periodStart = firstItem?.current_period_start
  const periodEnd = firstItem?.current_period_end

  // Upsert subscription record
  await supabase
    .from('stripe_subscriptions')
    .upsert({
      id: subscription.id,
      user_id: customerData.user_id,
      stripe_customer_id: customerId,
      price_id: priceId,
      status: status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : new Date().toISOString(),
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : new Date().toISOString(),
      canceled_at: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000).toISOString()
        : null,
      trial_start: subscription.trial_start
        ? new Date(subscription.trial_start * 1000).toISOString()
        : null,
      trial_end: subscription.trial_end
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'id',
    })

  console.log(`[Stripe Webhook] Updated subscription ${subscription.id} to status ${status}`)
}
