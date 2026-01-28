-- Gather Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  phone TEXT,
  timezone TEXT DEFAULT 'America/Los_Angeles',
  morning_checkin_time TIME DEFAULT '08:00',
  evening_checkin_time TIME DEFAULT '20:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habits (daily trackable items)
CREATE TABLE IF NOT EXISTS public.habits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('morning', 'games', 'optional')),
  link TEXT,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habit completion logs
CREATE TABLE IF NOT EXISTS public.habit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES public.habits(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, habit_id, date)
);

-- Soul activities (non-daily things that matter)
CREATE TABLE IF NOT EXISTS public.soul_activities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  icon_color TEXT DEFAULT 'var(--rose-soft)',
  default_text TEXT,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Soul activity logs
CREATE TABLE IF NOT EXISTS public.soul_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  activity_id UUID REFERENCES public.soul_activities(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks (admin tasks with context)
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('urgent', 'soon', 'waiting', 'completed')),
  badge TEXT,
  due_date DATE,
  context JSONB DEFAULT '{}', -- Stores member IDs, case numbers, etc.
  context_text TEXT, -- v17: Simple context string shown below task title
  actions JSONB DEFAULT '[]', -- Stores action buttons
  subtasks JSONB DEFAULT '[]', -- Array of subtask objects: [{ id, title, completed }]
  steps JSONB DEFAULT '[]', -- v17: Rich step objects: [{ id, text, done, summary, detail, ... }]
  notes TEXT, -- Freeform notes and context
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Space zones (apartment organization)
CREATE TABLE IF NOT EXISTS public.space_zones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Space tasks within zones
CREATE TABLE IF NOT EXISTS public.space_tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  zone_id UUID REFERENCES public.space_zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  sort_order INT DEFAULT 0
);

-- Chat messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  task_context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS check-ins
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('morning', 'evening', 'alert', 'custom')),
  content TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  response TEXT
);

-- Row Level Security Policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soul_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soul_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.space_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can manage own habits" ON public.habits
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own habit logs" ON public.habit_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own soul activities" ON public.soul_activities
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own soul logs" ON public.soul_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own space zones" ON public.space_zones
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own space tasks" ON public.space_tasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.space_zones
      WHERE id = space_tasks.zone_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage own messages" ON public.messages
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own checkins" ON public.checkins
  FOR ALL USING (auth.uid() = user_id);

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Seed default habits for new users
CREATE OR REPLACE FUNCTION public.seed_default_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Default habits
  INSERT INTO public.habits (user_id, name, description, category, link, sort_order) VALUES
    (NEW.id, 'Meditation', '10 minutes of stillness', 'morning', NULL, 1),
    (NEW.id, 'Sunlight', '15 minutes outside', 'morning', NULL, 2),
    (NEW.id, 'Skincare', NULL, 'morning', NULL, 3),
    (NEW.id, 'Connections', NULL, 'games', 'https://www.nytimes.com/games/connections', 1),
    (NEW.id, 'Wordle', NULL, 'games', 'https://www.nytimes.com/games/wordle', 2),
    (NEW.id, 'Move your body', 'Gym, walk, stretch — something', 'optional', NULL, 1),
    (NEW.id, 'Water the plants', NULL, 'optional', NULL, 2);

  -- Default soul activities
  INSERT INTO public.soul_activities (user_id, name, icon, icon_color, default_text, sort_order) VALUES
    (NEW.id, 'Play with the cats', '🐱', 'var(--rose-soft)', 'Tap "Done" when you do', 1),
    (NEW.id, 'Piano practice', '🎹', 'var(--sky-soft)', 'Even 10 minutes counts', 2),
    (NEW.id, 'Go for a walk', '🚶', 'var(--sage-soft)', 'Outside, no destination', 3),
    (NEW.id, 'Cook something real', '🍳', 'var(--rose-soft)', 'You have Costco — use it', 4),
    (NEW.id, 'Call Grandpa', '📞', 'var(--rose-soft)', 'He won''t be here forever', 5),
    (NEW.id, 'Coffee with uncle', '☕', 'var(--sky-soft)', 'Local family matters', 6),
    (NEW.id, 'See a friend', '👋', 'var(--sage-soft)', 'Not many locally — protect them', 7);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to seed data on profile creation
DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.seed_default_data();

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON public.habit_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_soul_logs_user_activity ON public.soul_logs(user_id, activity_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_category ON public.tasks(user_id, category);
CREATE INDEX IF NOT EXISTS idx_messages_user ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user ON public.checkins(user_id);
