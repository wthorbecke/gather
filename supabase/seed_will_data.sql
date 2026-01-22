-- ============================================
-- STEP 1: Remove the auto-seeding trigger
-- (New users will start with empty data)
-- ============================================

DROP TRIGGER IF EXISTS on_profile_created ON public.profiles;
DROP FUNCTION IF EXISTS public.seed_default_data();

-- ============================================
-- STEP 2: Clear all existing seeded data
-- (This was auto-seeded with Will's personal data)
-- ============================================

DELETE FROM public.habits;
DELETE FROM public.soul_activities;
DELETE FROM public.tasks;

-- ============================================
-- STEP 3: Get Will's user ID and insert his data
-- ============================================

-- Insert Will's habits
INSERT INTO public.habits (user_id, name, description, category, link, sort_order)
SELECT
  au.id,
  h.name,
  h.description,
  h.category,
  h.link,
  h.sort_order
FROM auth.users au
CROSS JOIN (VALUES
  ('Meditation', '10 minutes of stillness', 'morning', NULL, 1),
  ('Sunlight', '15 minutes outside', 'morning', NULL, 2),
  ('Skincare', NULL, 'morning', NULL, 3),
  ('Connections', NULL, 'games', 'https://www.nytimes.com/games/connections', 1),
  ('Wordle', NULL, 'games', 'https://www.nytimes.com/games/wordle', 2),
  ('Move your body', 'Gym, walk, stretch — something', 'optional', NULL, 1),
  ('Water the plants', NULL, 'optional', NULL, 2)
) AS h(name, description, category, link, sort_order)
WHERE au.email = 'willthorbecke@gmail.com';

-- Insert Will's soul activities
INSERT INTO public.soul_activities (user_id, name, icon, icon_color, default_text, sort_order)
SELECT
  au.id,
  s.name,
  s.icon,
  s.icon_color,
  s.default_text,
  s.sort_order
FROM auth.users au
CROSS JOIN (VALUES
  ('Play with the cats', '🐱', 'var(--rose-soft)', 'Tap "Done" when you do', 1),
  ('Piano practice', '🎹', 'var(--sky-soft)', 'Even 10 minutes counts', 2),
  ('Go for a walk', '🚶', 'var(--sage-soft)', 'Outside, no destination', 3),
  ('Cook something real', '🍳', 'var(--rose-soft)', 'You have Costco — use it', 4),
  ('Call Grandpa', '📞', 'var(--rose-soft)', 'He won''t be here forever', 5),
  ('Coffee with uncle', '☕', 'var(--sky-soft)', 'Local family matters', 6),
  ('See a friend', '👋', 'var(--sage-soft)', 'Not many locally — protect them', 7)
) AS s(name, icon, icon_color, default_text, sort_order)
WHERE au.email = 'willthorbecke@gmail.com';

-- Insert Will's tasks
INSERT INTO public.tasks (user_id, title, description, category, badge, actions)
SELECT
  au.id,
  t.title,
  t.description,
  t.category::text,
  t.badge,
  t.actions::jsonb
FROM auth.users au
CROSS JOIN (VALUES
  (
    'Medical bill disputes',
    'BCBS confirmed they never received claims. Providers violated the No Surprises Act by sending you to collections without billing insurance first. Send dispute emails to potentially invalidate the debt.',
    'urgent',
    'In collections',
    '[{"type":"email","label":"✉️ Vituity ($3,801)","email_key":"vituity","primary":true},{"type":"email","label":"✉️ IGT ($66)","email_key":"igt","primary":true},{"type":"email","label":"✉️ UCSF ($5,479)","email_key":"ucsf","primary":true},{"type":"ai_help","label":"Help me understand this","ai_context":"medical"}]'
  ),
  (
    'File 2024 taxes',
    'You''re owed money. No penalty since you''re getting a refund — just free money sitting there.',
    'soon',
    'Get your refund',
    '[{"type":"link","label":"FreeTaxUSA →","url":"https://www.freetaxusa.com","primary":true},{"type":"link","label":"IRS Transcripts","url":"https://www.irs.gov/individuals/get-transcript"},{"type":"ai_help","label":"Help me with this","ai_context":"taxes"}]'
  ),
  (
    'Speeding ticket + traffic school',
    'Pay $301 to the court, then complete online traffic school within 60 days (~$25-40 extra). Keeps the point off your record.',
    'soon',
    'Due March 13',
    '[{"type":"link","label":"Pay online →","url":"https://mycitations.courts.ca.gov","primary":true},{"type":"ai_help","label":"Help me with this","ai_context":"traffic"}]'
  ),
  (
    'Downgrade Costco membership',
    'You don''t have a car anymore. Executive membership probably isn''t worth it — downgrade to Gold Star ($65/yr vs $130/yr).',
    'soon',
    'Save money',
    '[{"type":"ai_help","label":"Help me with this","ai_context":"costco"}]'
  ),
  (
    'Therapy reimbursement',
    '$5,000 claim submitted to BCBS for out-of-network therapy. Watch your portal for the EOB. Potential reimbursement: $1,500-3,000+',
    'waiting',
    'Submitted Jan 20',
    '[]'
  )
) AS t(title, description, category, badge, actions)
WHERE au.email = 'willthorbecke@gmail.com';

-- ============================================
-- Verify the data was inserted
-- ============================================

SELECT 'Habits inserted:' as info, count(*) as count FROM public.habits;
SELECT 'Soul activities inserted:' as info, count(*) as count FROM public.soul_activities;
SELECT 'Tasks inserted:' as info, count(*) as count FROM public.tasks;
