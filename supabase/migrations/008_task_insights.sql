-- Task Intelligence: Learning from observations
-- This migration adds tables to track AI observations and user responses

-- Track task insights shown to users and their outcomes
CREATE TABLE IF NOT EXISTS public.task_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('stuck', 'vague', 'needs_deadline', 'pattern')),
  observation TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  shown_at TIMESTAMPTZ DEFAULT NOW(),
  -- Outcome tracking
  outcome TEXT CHECK (outcome IN ('acted', 'dismissed', 'ignored', 'task_completed')),
  outcome_at TIMESTAMPTZ,
  -- For learning: how long after showing did they act?
  action_delay_hours INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying recent insights per user
CREATE INDEX IF NOT EXISTS idx_task_insights_user_shown ON public.task_insights(user_id, shown_at DESC);

-- Index for finding insights by task (to avoid duplicate observations)
CREATE INDEX IF NOT EXISTS idx_task_insights_task ON public.task_insights(task_id, shown_at DESC);

-- Add insight preferences to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS insight_frequency TEXT DEFAULT 'normal' CHECK (insight_frequency IN ('off', 'minimal', 'normal', 'frequent'));

-- Add last_insight_at to prevent over-notifying
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS last_insight_at TIMESTAMPTZ;

-- RLS policies
ALTER TABLE public.task_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own task insights" ON public.task_insights
  FOR ALL USING (auth.uid() = user_id);

-- Function to record insight outcome when task is completed
CREATE OR REPLACE FUNCTION public.update_insight_on_task_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- When a task is marked completed, update any recent insights about it
  IF NEW.category = 'completed' AND OLD.category != 'completed' THEN
    UPDATE public.task_insights
    SET
      outcome = 'task_completed',
      outcome_at = NOW(),
      action_delay_hours = EXTRACT(EPOCH FROM (NOW() - shown_at)) / 3600
    WHERE task_id = NEW.id
      AND outcome IS NULL
      AND shown_at > NOW() - INTERVAL '7 days';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update insight outcomes
DROP TRIGGER IF EXISTS on_task_complete_update_insights ON public.tasks;
CREATE TRIGGER on_task_complete_update_insights
  AFTER UPDATE ON public.tasks
  FOR EACH ROW
  WHEN (NEW.category = 'completed' AND OLD.category != 'completed')
  EXECUTE FUNCTION public.update_insight_on_task_complete();
