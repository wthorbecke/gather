-- Task Types: Add support for different task types
-- task, reminder, habit, event

-- Add type column to tasks
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'task' CHECK (type IN ('task', 'reminder', 'habit', 'event'));

-- Add scheduled_at for time-specific items (reminders, events)
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- Add recurrence for habits (JSONB: { frequency, days })
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS recurrence JSONB;

-- Add streak tracking for habits (JSONB: { current, best, lastCompleted })
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS streak JSONB;

-- Add external source info for synced items (JSONB: { provider, externalId, readOnly })
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS external_source JSONB;

-- Add duration in minutes
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS duration INT;

-- Index for querying by type
CREATE INDEX IF NOT EXISTS idx_tasks_type ON public.tasks(user_id, type);

-- Index for querying scheduled items by date
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON public.tasks(user_id, scheduled_at)
WHERE scheduled_at IS NOT NULL;

-- Index for habits (for daily habit queries)
CREATE INDEX IF NOT EXISTS idx_tasks_habits ON public.tasks(user_id, type)
WHERE type = 'habit';
