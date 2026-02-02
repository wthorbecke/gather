-- Task Completions: Track when and how users complete tasks
-- Used for pattern analysis in Task Intelligence

-- Track individual step/task completions for pattern learning
CREATE TABLE IF NOT EXISTS public.task_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  step_id TEXT, -- NULL if completing entire task
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  -- Pre-computed for faster queries
  completion_day_of_week INT, -- 0=Sunday, 6=Saturday
  completion_hour INT, -- 0-23
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying completions by user and time
CREATE INDEX IF NOT EXISTS idx_task_completions_user_time ON public.task_completions(user_id, completed_at DESC);

-- Index for day/hour pattern analysis
CREATE INDEX IF NOT EXISTS idx_task_completions_patterns ON public.task_completions(user_id, completion_day_of_week, completion_hour);

-- RLS policies
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'task_completions' AND policyname = 'Users can manage own task completions'
  ) THEN
    CREATE POLICY "Users can manage own task completions" ON public.task_completions
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Add source column to tasks if not exists (for tracking email/calendar origins)
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'email', 'gmail', 'calendar'));

-- Add snoozed_until column to tasks if not exists
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS snoozed_until DATE;
