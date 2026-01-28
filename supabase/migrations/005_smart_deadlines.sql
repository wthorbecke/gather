-- Smart Deadlines Migration
-- Adds deadline tracking, warning preferences, and reflection history

-- Add deadline-related columns to tasks
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS deadline_type TEXT CHECK (deadline_type IN ('hard', 'soft', 'flexible')) DEFAULT 'soft',
ADD COLUMN IF NOT EXISTS warn_days_before INT DEFAULT 3,
ADD COLUMN IF NOT EXISTS last_nudge_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS nudge_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_minutes INT,
ADD COLUMN IF NOT EXISTS snoozed_until DATE;

-- Add user preferences for notifications
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "deadline_warnings": true,
  "weekly_reflections": true,
  "nudge_frequency": "normal",
  "quiet_hours_start": "22:00",
  "quiet_hours_end": "08:00"
}'::jsonb,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Weekly reflections history
CREATE TABLE IF NOT EXISTS public.reflections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  content JSONB NOT NULL, -- { wins: [], patterns: [], suggestions: [], stats: {} }
  sent_via TEXT[], -- ['push', 'sms', 'email']
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- Task completion history for pattern analysis
CREATE TABLE IF NOT EXISTS public.task_completions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  task_title TEXT NOT NULL,
  task_category TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  was_overdue BOOLEAN DEFAULT FALSE,
  days_before_deadline INT, -- negative if overdue
  completion_day_of_week INT, -- 0=Sunday, 6=Saturday
  completion_hour INT -- 0-23
);

-- ADHD tax tracking (late fees, missed refunds, etc)
CREATE TABLE IF NOT EXISTS public.adhd_tax_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('late_fee', 'missed_deadline', 'renewal_lapsed', 'refund_expired', 'prevented')),
  description TEXT,
  amount_cents INT, -- financial impact in cents
  prevented BOOLEAN DEFAULT FALSE, -- true if Gather helped avoid it
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adhd_tax_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage own reflections" ON public.reflections
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own task completions" ON public.task_completions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own adhd tax events" ON public.adhd_tax_events
  FOR ALL USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(user_id, due_date) WHERE due_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_snoozed ON public.tasks(user_id, snoozed_until) WHERE snoozed_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_completions_user_date ON public.task_completions(user_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_reflections_user_week ON public.reflections(user_id, week_start);

-- Function to log task completion with analytics
CREATE OR REPLACE FUNCTION public.log_task_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when category changes to 'completed'
  IF NEW.category = 'completed' AND (OLD.category IS NULL OR OLD.category != 'completed') THEN
    INSERT INTO public.task_completions (
      user_id,
      task_id,
      task_title,
      task_category,
      completed_at,
      was_overdue,
      days_before_deadline,
      completion_day_of_week,
      completion_hour
    ) VALUES (
      NEW.user_id,
      NEW.id,
      NEW.title,
      OLD.category,
      NOW(),
      CASE WHEN NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN TRUE ELSE FALSE END,
      CASE WHEN NEW.due_date IS NOT NULL THEN NEW.due_date - CURRENT_DATE ELSE NULL END,
      EXTRACT(DOW FROM NOW()),
      EXTRACT(HOUR FROM NOW())
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for automatic completion logging
DROP TRIGGER IF EXISTS on_task_completed ON public.tasks;
CREATE TRIGGER on_task_completed
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_completion();
