-- Add missing columns to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS snoozed_until DATE;
