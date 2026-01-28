-- Migration: Add steps and context_text columns to tasks table (v17)
-- Run this in your Supabase SQL Editor

-- Add steps column (rich step objects for v17)
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]';

-- Add context_text column (simple context string for v17)
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS context_text TEXT;

-- Comment for documentation
COMMENT ON COLUMN public.tasks.steps IS 'v17 rich steps: [{ id, text, done, summary, detail, alternatives, examples, checklist, time, source, action }]';
COMMENT ON COLUMN public.tasks.context_text IS 'v17 simple context string shown below task title';
