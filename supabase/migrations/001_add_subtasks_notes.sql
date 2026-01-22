-- Migration: Add subtasks and notes columns to tasks table
-- These columns support the task breakdown and notes features

-- Add subtasks column (JSONB array of subtask objects)
-- Structure: [{ "id": "uuid", "title": "string", "completed": boolean }]
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS subtasks JSONB DEFAULT '[]';

-- Add notes column for freeform task notes
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment explaining the structure
COMMENT ON COLUMN public.tasks.subtasks IS 'Array of subtask objects: [{ id: string, title: string, completed: boolean }]';
COMMENT ON COLUMN public.tasks.notes IS 'Freeform notes and context for the task';
