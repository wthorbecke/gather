-- Performance indexes for common query patterns
-- Migration: 007_performance_indexes.sql

-- Task query optimizations
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON public.tasks(completed_at);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON public.tasks(created_at);

-- Composite index for common query: tasks by user ordered by due date
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON public.tasks(user_id, due_date)
  WHERE category != 'completed';

-- Calendar events optimization
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time ON public.calendar_events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_end ON public.calendar_events(user_id, end_time);

-- Google watches optimization for renewal checks
CREATE INDEX IF NOT EXISTS idx_google_watches_expiration ON public.google_watches(expiration);

-- Processed emails optimization for deduplication lookups
CREATE INDEX IF NOT EXISTS idx_processed_emails_message_id ON public.processed_emails(gmail_message_id);

-- Messages optimization for chat history
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON public.messages(user_id, created_at DESC);
