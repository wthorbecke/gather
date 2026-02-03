import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireAuth } from '@/lib/api-auth'
import { isActiveSubscription, getSubscriptionStatusMessage, type SubscriptionStatus } from '@/lib/stripe'

export interface SubscriptionResponse {
  hasActiveSubscription: boolean
  subscription: {
    id: string
    status: SubscriptionStatus
    statusMessage: string
    currentPeriodEnd: string
    cancelAtPeriodEnd: boolean
    priceId: string
  } | null
}

export async function GET(request: NextRequest) {
  // Require authentication
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) {
    return auth
  }

  try {
    const supabase = createServerClient()

    // Get user's subscription
    const { data: subscription } = await supabase
      .from('stripe_subscriptions')
      .select('*')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!subscription) {
      return NextResponse.json({
        hasActiveSubscription: false,
        subscription: null,
      } as SubscriptionResponse)
    }

    const status = subscription.status as SubscriptionStatus
    const isActive = isActiveSubscription(status) &&
      new Date(subscription.current_period_end) > new Date()

    return NextResponse.json({
      hasActiveSubscription: isActive,
      subscription: {
        id: subscription.id,
        status,
        statusMessage: getSubscriptionStatusMessage(status),
        currentPeriodEnd: subscription.current_period_end,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        priceId: subscription.price_id,
      },
    } as SubscriptionResponse)
  } catch (error) {
    console.error('[Stripe] Get subscription error:', error)
    return NextResponse.json(
      { error: 'Failed to get subscription status' },
      { status: 500 }
    )
  }
}
