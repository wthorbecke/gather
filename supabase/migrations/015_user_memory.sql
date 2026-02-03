-- Migration: 015_user_memory.sql
-- User memory persistence for AI context and patterns

CREATE TABLE IF NOT EXISTS public.user_memory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  entry_type TEXT NOT NULL, -- 'task_completed', 'pattern', 'preference', 'step_completed', etc.
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own memory" ON public.user_memory
  FOR ALL USING (auth.uid() = user_id);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_memory_user_type ON public.user_memory(user_id, entry_type);
CREATE INDEX IF NOT EXISTS idx_user_memory_created ON public.user_memory(user_id, created_at DESC);
