-- Migration: Add clarifying_answers and task_category columns to tasks table
-- These columns support the AI-powered task analysis feature

-- Add clarifying_answers column (JSONB array of Q&A objects)
-- Structure: [{ "question": "string", "answer": "string" }]
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS clarifying_answers JSONB DEFAULT '[]';

-- Add task_category column for categorization
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS task_category TEXT;

-- Add comments explaining the structure
COMMENT ON COLUMN public.tasks.clarifying_answers IS 'Array of clarifying Q&A: [{ question: string, answer: string }]';
COMMENT ON COLUMN public.tasks.task_category IS 'AI-detected task category: government, medical, financial, travel, home, work, errand, personal, other';
