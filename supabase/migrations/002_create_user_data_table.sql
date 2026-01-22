-- Migration: Create user_data table for zone tasks and other user-specific JSON data

CREATE TABLE IF NOT EXISTS public.user_data (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  zone_tasks JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
DROP POLICY IF EXISTS "Users can manage own user_data" ON public.user_data;
CREATE POLICY "Users can manage own user_data" ON public.user_data
  FOR ALL USING (auth.uid() = user_id);
