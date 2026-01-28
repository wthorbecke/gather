-- Google Calendar & Gmail Integration Tables
-- Migration: 006_google_integrations.sql

-- Store OAuth tokens for background webhook operations
CREATE TABLE IF NOT EXISTS public.google_tokens (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track Pub/Sub watch subscriptions (expire every 7 days)
CREATE TABLE IF NOT EXISTS public.google_watches (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('gmail', 'calendar')),
  watch_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  expiration TIMESTAMPTZ NOT NULL,
  history_id TEXT,  -- Gmail incremental sync
  sync_token TEXT,  -- Calendar incremental sync
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, resource_type)
);

-- Deduplication for processed emails
CREATE TABLE IF NOT EXISTS public.processed_emails (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  action_taken TEXT CHECK (action_taken IN ('created_task', 'completed_task', 'ignored', 'dismissed')),
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, gmail_message_id)
);

-- Cached calendar events
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  google_event_id TEXT NOT NULL,
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN DEFAULT FALSE,
  location TEXT,
  linked_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, google_event_id)
);

-- User preferences for integrations
CREATE TABLE IF NOT EXISTS public.integration_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  gmail_enabled BOOLEAN DEFAULT FALSE,
  gmail_auto_create BOOLEAN DEFAULT FALSE,  -- auto-create tasks vs suggest
  gmail_ignored_senders TEXT[] DEFAULT '{}',  -- senders to never suggest
  calendar_enabled BOOLEAN DEFAULT FALSE,
  calendar_lookahead_days INT DEFAULT 7,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add source tracking to tasks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN source TEXT DEFAULT 'manual';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'source_id'
  ) THEN
    ALTER TABLE public.tasks ADD COLUMN source_id TEXT;
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processed_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for google_tokens
CREATE POLICY "Users can view own tokens" ON public.google_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tokens" ON public.google_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens" ON public.google_tokens
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens" ON public.google_tokens
  FOR DELETE USING (auth.uid() = user_id);

-- Service role needs full access for background operations
CREATE POLICY "Service role full access to tokens" ON public.google_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for google_watches
CREATE POLICY "Users can view own watches" ON public.google_watches
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own watches" ON public.google_watches
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own watches" ON public.google_watches
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own watches" ON public.google_watches
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to watches" ON public.google_watches
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for processed_emails
CREATE POLICY "Users can view own processed emails" ON public.processed_emails
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own processed emails" ON public.processed_emails
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own processed emails" ON public.processed_emails
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own processed emails" ON public.processed_emails
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to processed emails" ON public.processed_emails
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for calendar_events
CREATE POLICY "Users can view own calendar events" ON public.calendar_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar events" ON public.calendar_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar events" ON public.calendar_events
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar events" ON public.calendar_events
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to calendar events" ON public.calendar_events
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for integration_settings
CREATE POLICY "Users can view own integration settings" ON public.integration_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integration settings" ON public.integration_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integration settings" ON public.integration_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integration settings" ON public.integration_settings
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to integration settings" ON public.integration_settings
  FOR ALL USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_google_watches_expiration ON public.google_watches(expiration);
CREATE INDEX IF NOT EXISTS idx_google_watches_user_type ON public.google_watches(user_id, resource_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_time ON public.calendar_events(user_id, start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_linked_task ON public.calendar_events(linked_task_id);
CREATE INDEX IF NOT EXISTS idx_processed_emails_user ON public.processed_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_source ON public.tasks(source) WHERE source IS NOT NULL AND source != 'manual';

-- Function to initialize integration settings for new users
CREATE OR REPLACE FUNCTION public.init_integration_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.integration_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create integration settings on profile creation
DROP TRIGGER IF EXISTS on_profile_created_init_integrations ON public.profiles;
CREATE TRIGGER on_profile_created_init_integrations
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.init_integration_settings();
