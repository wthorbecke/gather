/**
 * Subscription checking utilities for API routes
 */

import { createServerClient } from './supabase'

export type SubscriptionTier = 'demo' | 'free' | 'pro'

export interface SubscriptionCheck {
  tier: SubscriptionTier
  hasActiveSubscription: boolean
  isDemo: boolean
}

/**
 * Check a user's subscription tier
 * @param userId - User ID (or 'demo-user' for demo mode)
 * @param isDemo - Whether this is a demo request
 */
export async function checkSubscriptionTier(
  userId: string,
  isDemo: boolean = false
): Promise<SubscriptionCheck> {
  // Demo users get demo tier
  if (isDemo || userId === 'demo-user') {
    return {
      tier: 'demo',
      hasActiveSubscription: false,
      isDemo: true,
    }
  }

  // Check subscription in database
  const supabase = createServerClient()
  const { data: subscription } = await supabase
    .from('stripe_subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!subscription) {
    return {
      tier: 'free',
      hasActiveSubscription: false,
      isDemo: false,
    }
  }

  const isActive =
    (subscription.status === 'active' || subscription.status === 'trialing') &&
    new Date(subscription.current_period_end) > new Date()

  return {
    tier: isActive ? 'pro' : 'free',
    hasActiveSubscription: isActive,
    isDemo: false,
  }
}

/**
 * Rate limits by subscription tier
 */
export const TIER_LIMITS = {
  demo: {
    aiChat: { limit: 10, windowSeconds: 3600, name: 'demo-ai-chat' }, // 10/hour
    aiBreakdown: { limit: 5, windowSeconds: 3600, name: 'demo-ai-breakdown' }, // 5/hour
  },
  free: {
    aiChat: { limit: 5, windowSeconds: 86400, name: 'free-ai-chat' }, // 5/day
    aiBreakdown: { limit: 3, windowSeconds: 86400, name: 'free-ai-breakdown' }, // 3/day
  },
  pro: {
    aiChat: { limit: 100, windowSeconds: 3600, name: 'pro-ai-chat' }, // 100/hour
    aiBreakdown: { limit: 50, windowSeconds: 3600, name: 'pro-ai-breakdown' }, // 50/hour
  },
} as const

/**
 * Get rate limit config for a specific operation and tier
 */
export function getTierRateLimit(
  tier: SubscriptionTier,
  operation: 'aiChat' | 'aiBreakdown'
) {
  return TIER_LIMITS[tier][operation]
}
