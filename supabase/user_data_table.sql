-- User data table for storing JSON data like zone_tasks
CREATE TABLE IF NOT EXISTS public.user_data (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  zone_tasks JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can manage own user_data" ON public.user_data
  FOR ALL USING (auth.uid() = user_id);

-- Also need to update habit_logs to not require a foreign key to habits table
-- since we're using string IDs directly
ALTER TABLE public.habit_logs
  DROP CONSTRAINT IF EXISTS habit_logs_habit_id_fkey;

-- Make habit_id a text field if it's not already
ALTER TABLE public.habit_logs
  ALTER COLUMN habit_id TYPE TEXT;

-- Similarly for soul_logs
ALTER TABLE public.soul_logs
  DROP CONSTRAINT IF EXISTS soul_logs_activity_id_fkey;

ALTER TABLE public.soul_logs
  ALTER COLUMN activity_id TYPE TEXT;
