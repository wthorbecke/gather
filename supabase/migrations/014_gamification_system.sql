-- Migration: 014_gamification_system.sql
-- Gentle Gamification System for ADHD-friendly rewards

-- User rewards and progress tracking
CREATE TABLE IF NOT EXISTS public.user_rewards (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  momentum_points INT DEFAULT 0,
  lifetime_points INT DEFAULT 0,
  current_level INT DEFAULT 1,
  garden_stage INT DEFAULT 1, -- 1-10 growth stages
  unlocked_themes TEXT[] DEFAULT '{}',
  active_theme TEXT DEFAULT 'default',
  active_accent TEXT DEFAULT NULL,
  last_activity_date DATE,
  momentum_days INT DEFAULT 0, -- Days of continuous activity
  pause_streak_until DATE, -- For "vacation mode" - pauses without penalty
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Point transaction log (for debugging and transparency)
CREATE TABLE IF NOT EXISTS public.point_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  points INT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'step_complete',
    'task_complete',
    'habit_complete',
    'first_task_today',
    'momentum_bonus',
    'level_up_bonus',
    'weekly_reflection_bonus'
  )),
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unlockable rewards catalog
CREATE TABLE IF NOT EXISTS public.rewards_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('theme', 'accent_color', 'celebration', 'feature')),
  points_required INT NOT NULL,
  preview_data JSONB, -- CSS variables, animation names, etc.
  sort_order INT DEFAULT 0
);

-- RLS Policies
ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards_catalog ENABLE ROW LEVEL SECURITY;

-- User rewards policies
CREATE POLICY "Users can view own rewards" ON public.user_rewards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rewards" ON public.user_rewards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rewards" ON public.user_rewards
  FOR UPDATE USING (auth.uid() = user_id);

-- Point transactions policies
CREATE POLICY "Users can view own transactions" ON public.point_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON public.point_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Rewards catalog - read-only for all
CREATE POLICY "Anyone can view rewards catalog" ON public.rewards_catalog
  FOR SELECT USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_date
  ON public.point_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_rewards_level
  ON public.user_rewards(current_level);
CREATE INDEX IF NOT EXISTS idx_point_transactions_action_type
  ON public.point_transactions(action_type);

-- Seed unlockable rewards catalog
INSERT INTO public.rewards_catalog (id, name, description, type, points_required, preview_data, sort_order) VALUES
-- Accent Colors (unlock additional accent colors)
('accent-sage', 'Sage Accent', 'A calming green accent color', 'accent_color', 100, '{"accent": "#6B9080", "accentSoft": "rgba(107,144,128,0.1)"}', 1),
('accent-lavender', 'Lavender Accent', 'A gentle purple accent', 'accent_color', 200, '{"accent": "#9B8BB4", "accentSoft": "rgba(155,139,180,0.1)"}', 2),
('accent-ocean', 'Ocean Accent', 'A deep blue accent', 'accent_color', 300, '{"accent": "#5B8FAF", "accentSoft": "rgba(91,143,175,0.1)"}', 3),
('accent-gold', 'Gold Accent', 'A warm golden accent', 'accent_color', 400, '{"accent": "#D4A84B", "accentSoft": "rgba(212,168,75,0.1)"}', 4),

-- Themes (complete visual overhauls)
('theme-forest', 'Forest Theme', 'Deep greens and natural browns', 'theme', 500, '{"canvas": "#1a1f1a", "elevated": "#232823", "accent": "#7CB37C", "success": "#9ECBB3"}', 10),
('theme-midnight', 'Midnight Theme', 'Deep blues with starlight accents', 'theme', 750, '{"canvas": "#0a0d14", "elevated": "#141820", "accent": "#8BB4E8", "success": "#9ECBB3"}', 11),
('theme-sunrise', 'Sunrise Theme', 'Warm oranges and soft yellows', 'theme', 1000, '{"canvas": "#1a1512", "elevated": "#241c18", "accent": "#E8A990", "success": "#D4B483"}', 12),

-- Celebration Styles
('celebration-confetti', 'Classic Confetti', 'The default colorful celebration', 'celebration', 0, '{"type": "confetti"}', 20),
('celebration-sparkle', 'Sparkle Burst', 'Elegant sparkle animation', 'celebration', 250, '{"type": "sparkle"}', 21),
('celebration-fireworks', 'Mini Fireworks', 'Tiny firework bursts', 'celebration', 500, '{"type": "fireworks"}', 22),
('celebration-garden', 'Garden Bloom', 'Flowers bloom around completed items', 'celebration', 750, '{"type": "garden_bloom"}', 23),

-- Features
('feature-sounds', 'Completion Sounds', 'Optional soft sounds on task completion', 'feature', 150, '{"feature": "completion_sounds"}', 30),
('feature-quotes', 'Daily Quotes', 'Inspiring quotes in the home view', 'feature', 300, '{"feature": "daily_quotes"}', 31)
ON CONFLICT (id) DO NOTHING;

-- Function to auto-create user_rewards on profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user_rewards()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_rewards (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create rewards record when profile is created
DROP TRIGGER IF EXISTS on_profile_created_rewards ON public.profiles;
CREATE TRIGGER on_profile_created_rewards
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_rewards();
