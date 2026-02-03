-- Migration: 016_google_tasks.sql
-- Google Tasks Integration - sync tasks bidirectionally with Google Tasks

-- ================================================
-- Google Task Lists Mapping
-- ================================================
-- Maps Google Task Lists to Gather for selective sync
CREATE TABLE IF NOT EXISTS public.google_task_lists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  google_list_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  sync_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_list_id)
);

-- ================================================
-- Cached Google Tasks
-- ================================================
-- Local cache of Google Tasks for display and sync status
CREATE TABLE IF NOT EXISTS public.google_tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  google_task_id TEXT NOT NULL,
  google_list_id TEXT NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT CHECK (status IN ('needsAction', 'completed')),
  due TEXT,  -- RFC 3339 date string from Google
  completed_at TIMESTAMPTZ,
  linked_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  etag TEXT,  -- Google's version tag for conflict detection
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_task_id)
);

-- ================================================
-- Add google_task_id to tasks table
-- ================================================
-- Links Gather tasks to their Google Tasks counterparts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'google_task_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN google_task_id TEXT;
  END IF;
END $$;

-- ================================================
-- Add Google Tasks settings to integration_settings
-- ================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'integration_settings' AND column_name = 'tasks_enabled'
  ) THEN
    ALTER TABLE public.integration_settings ADD COLUMN tasks_enabled BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'integration_settings' AND column_name = 'tasks_default_list_id'
  ) THEN
    ALTER TABLE public.integration_settings ADD COLUMN tasks_default_list_id TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'integration_settings' AND column_name = 'tasks_sync_direction'
  ) THEN
    -- 'bidirectional', 'to_gather', 'to_google'
    ALTER TABLE public.integration_settings ADD COLUMN tasks_sync_direction TEXT DEFAULT 'bidirectional';
  END IF;
END $$;

-- ================================================
-- Enable Row Level Security
-- ================================================
ALTER TABLE public.google_task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_tasks ENABLE ROW LEVEL SECURITY;

-- ================================================
-- RLS Policies for google_task_lists
-- ================================================
CREATE POLICY "Users can view own task lists" ON public.google_task_lists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own task lists" ON public.google_task_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own task lists" ON public.google_task_lists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own task lists" ON public.google_task_lists
  FOR DELETE USING (auth.uid() = user_id);

-- Service role needs full access for background sync operations
CREATE POLICY "Service role full access to task lists" ON public.google_task_lists
  FOR ALL USING (auth.role() = 'service_role');

-- ================================================
-- RLS Policies for google_tasks
-- ================================================
CREATE POLICY "Users can view own google tasks" ON public.google_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own google tasks" ON public.google_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own google tasks" ON public.google_tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own google tasks" ON public.google_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- Service role needs full access for background sync operations
CREATE POLICY "Service role full access to google tasks" ON public.google_tasks
  FOR ALL USING (auth.role() = 'service_role');

-- ================================================
-- Performance Indexes
-- ================================================
CREATE INDEX IF NOT EXISTS idx_google_task_lists_user ON public.google_task_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_google_task_lists_sync ON public.google_task_lists(user_id, sync_enabled) WHERE sync_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_google_tasks_user_status ON public.google_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_google_tasks_user_list ON public.google_tasks(user_id, google_list_id);
CREATE INDEX IF NOT EXISTS idx_google_tasks_linked_task ON public.google_tasks(linked_task_id) WHERE linked_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_google_tasks_last_synced ON public.google_tasks(user_id, last_synced_at);
CREATE INDEX IF NOT EXISTS idx_tasks_google_task_id ON public.tasks(google_task_id) WHERE google_task_id IS NOT NULL;
