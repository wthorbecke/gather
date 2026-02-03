-- Stripe Subscription Integration
-- Migration 012

-- Stripe customers table - links Supabase users to Stripe customer IDs
CREATE TABLE IF NOT EXISTS public.stripe_customers (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stripe products (cached from Stripe)
CREATE TABLE IF NOT EXISTS public.stripe_products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stripe prices (cached from Stripe)
CREATE TABLE IF NOT EXISTS public.stripe_prices (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES public.stripe_products(id) ON DELETE CASCADE,
  unit_amount INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  interval TEXT CHECK (interval IN ('day', 'week', 'month', 'year')),
  interval_count INT DEFAULT 1,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Stripe subscriptions
CREATE TABLE IF NOT EXISTS public.stripe_subscriptions (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  price_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired',
    'past_due', 'unpaid', 'paused'
  )),
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  canceled_at TIMESTAMPTZ,
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Customers: users can only see their own record
CREATE POLICY "Users can view own stripe customer" ON public.stripe_customers
  FOR SELECT USING (auth.uid() = user_id);

-- Products/Prices: anyone can view (needed for pricing page)
CREATE POLICY "Anyone can view products" ON public.stripe_products
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view prices" ON public.stripe_prices
  FOR SELECT USING (true);

-- Subscriptions: users can only see their own
CREATE POLICY "Users can view own subscriptions" ON public.stripe_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_user ON public.stripe_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_status ON public.stripe_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_stripe_prices_product ON public.stripe_prices(product_id);

-- Function to check if user has active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.stripe_subscriptions
    WHERE user_id = check_user_id
    AND status IN ('trialing', 'active')
    AND current_period_end > NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
