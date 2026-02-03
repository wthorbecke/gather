'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { loadStripe } from '@stripe/stripe-js'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'unpaid'
  | 'paused'

export interface Subscription {
  id: string
  status: SubscriptionStatus
  statusMessage: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  priceId: string
}

interface SubscriptionState {
  isLoading: boolean
  hasActiveSubscription: boolean
  subscription: Subscription | null
  error: string | null
}

// Initialize Stripe client-side
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')

export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>({
    isLoading: true,
    hasActiveSubscription: false,
    subscription: null,
    error: null,
  })

  const fetchSubscription = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        setState({
          isLoading: false,
          hasActiveSubscription: false,
          subscription: null,
          error: null,
        })
        return
      }

      const response = await fetch('/api/stripe/subscription', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch subscription')
      }

      const data = await response.json()
      setState({
        isLoading: false,
        hasActiveSubscription: data.hasActiveSubscription,
        subscription: data.subscription,
        error: null,
      })
    } catch (err) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [])

  useEffect(() => {
    fetchSubscription()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchSubscription()
    })

    return () => subscription.unsubscribe()
  }, [fetchSubscription])

  const startCheckout = useCallback(async (interval: 'monthly' | 'yearly' = 'monthly') => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Must be logged in to subscribe')
      }

      const response = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ interval }),
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { url } = await response.json()

      // Redirect to Stripe Checkout
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      console.error('Checkout error:', err)
      throw err
    }
  }, [])

  const openBillingPortal = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        throw new Error('Must be logged in to manage billing')
      }

      const response = await fetch('/api/stripe/portal-session', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to create portal session')
      }

      const { url } = await response.json()

      // Redirect to Stripe Customer Portal
      if (url) {
        window.location.href = url
      }
    } catch (err) {
      console.error('Portal error:', err)
      throw err
    }
  }, [])

  return {
    ...state,
    refetch: fetchSubscription,
    startCheckout,
    openBillingPortal,
  }
}
