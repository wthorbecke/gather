import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { requireAuth } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  // Require authentication
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) {
    return auth
  }

  try {
    const supabase = createServerClient()

    // Get user's Stripe customer ID
    const { data: customer } = await supabase
      .from('stripe_customers')
      .select('stripe_customer_id')
      .eq('user_id', auth.userId)
      .single()

    if (!customer?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found' },
        { status: 404 }
      )
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[Stripe] Portal session error:', error)
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    )
  }
}
