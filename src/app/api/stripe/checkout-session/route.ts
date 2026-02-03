import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { stripe, PRICE_ID_MONTHLY, PRICE_ID_YEARLY } from '@/lib/stripe'
import { requireAuth } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  // Require authentication
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) {
    return auth
  }

  try {
    const body = await request.json()
    const { priceId, interval = 'monthly' } = body

    // Determine price ID
    const selectedPriceId = priceId || (interval === 'yearly' ? PRICE_ID_YEARLY : PRICE_ID_MONTHLY)

    if (!selectedPriceId) {
      return NextResponse.json(
        { error: 'Price ID not configured' },
        { status: 500 }
      )
    }

    // Get or create Stripe customer
    const supabase = createServerClient()

    // Check if user already has a Stripe customer ID
    const { data: existingCustomer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', auth.userId)
      .single()

    let stripeCustomerId = existingCustomer?.stripe_customer_id

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: auth.user.email,
        metadata: {
          supabase_user_id: auth.userId,
        },
      })
      stripeCustomerId = customer.id

      // Save customer ID to database
      await supabase
        .from('stripe_customers')
        .insert({
          user_id: auth.userId,
          stripe_customer_id: stripeCustomerId,
        })
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings?canceled=true`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: {
        user_id: auth.userId,
      },
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (error) {
    console.error('[Stripe] Checkout session error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
