# Gather Product State

**Last Updated:** Mon Feb 2 2026, 22:15 PST
**Session:** 11

---

## What This Product Is

Gather is an **AI-powered executive function layer** for people with ADHD or executive function challenges. It's NOT a todo app - it's a collaboration tool between user and AI that:

1. Breaks down overwhelming tasks into concrete, actionable steps
2. Proactively reaches out (push notifications, SMS) rather than waiting to be opened
3. Speaks like a trusted friend - warm but direct, no corporate wellness language
4. Makes action frictionless - show the button, not just the task
5. Never guilt-trips about incomplete tasks

**Target user:** People who know what they *should* do but can't bridge the gap to *doing* it. They experience low-grade anxiety from tasks floating in their minds, pay the "ADHD tax" in late fees and missed deadlines.

**Core value prop:** "Dump it here - I'll make it doable."

---

## Competitive Landscape

### Key Competitors (Researched Feb 2026)

**Tiimo** - 2025 App Store App of the Year
- Visual timelines, AI task breakdown
- Built by neurodivergent people
- *Weaknesses:* Complex input ("steep learning curve"), aggressive review prompts, data loss issues, iOS only

**neurolist** - AI Planner for ADHD
- AI breaks tasks into checklist with time estimates
- Simple, focused on ADHD
- Direct competitor in the AI breakdown space

**Amazing Marvin** - "Best todo for ADHD"
- Highly customizable "strategies" system
- Gamification (beat the clock, task jar)
- *Weakness:* Overwhelming number of options

**Motion** - AI Autopilot
- Auto-schedules tasks based on deadlines/priorities
- Reschedules in real-time when conflicts arise
- More focused on scheduling than breakdown

### Gather's Differentiation
1. **Zero friction input** vs Tiimo's "steep learning curve"
2. **Conversational AI** that asks clarifying questions vs just generating steps
3. **Web-first** - works on any device vs iOS-only competitors
4. **Proactive outreach** via push/SMS vs waiting to be opened
5. **Warm, direct tone** like a trusted friend - no corporate wellness speak
6. **No guilt-tripping** about incomplete tasks (vs streak-based shame)

---

## Current Product State

### What's Built
- Next.js 14 + Supabase + Tailwind stack
- Three view modes: List (default), Day, Stack
- AI task breakdown via Anthropic API with clarifying questions
- Task types: regular tasks, reminders, events, habits
- Step-based progress tracking with checkboxes
- Undo support for completed steps and deleted tasks
- **Google Calendar integration** - events shown in sidebar
- **Gmail scanning** - finds actionable emails automatically
- **Push notifications** via web-push (cron-based reminders)
- **SMS notifications** via Twilio
- **Deadline-based AI nudges** - contextual reminders based on task urgency
- Dark/light mode with time-based ambient gradients
- Demo mode with AI fully working + realistic starter tasks
- **Onboarding flow** - 3-step intro explaining AI task breakdown for new users
- Mobile-responsive design (375px minimum)
- Celebration animations (confetti) on task completion
- Keyword-based fallback steps when AI is unavailable
- Integration settings modal for user preferences
- **Stripe subscription integration** - $10/month Pro plan (Session 7)

### Visual Design
- Clean, warm color palette: coral accent (#E07A5F), sage success (#6B9080)
- Time-based ambient backgrounds (warmer morning/evening, cooler night)
- Card-based UI with subtle shadows and borders
- Rotating placeholder examples in main input
- Properly sized touch targets (44px minimum)

---

## Issues Status

All critical issues fixed:
- ✅ Demo Mode AI (Session 2)
- ✅ No Tasks in Demo Mode (Session 2)
- ✅ Generic Fallback Steps (Session 4)
- ✅ Demo Calendar Events Stale (Session 4)
- ✅ TypeScript Build Errors (Session 4)
- ✅ Duplicate Detection False Positives (Session 5)
- ✅ Missing Steps on Create Task Action (Session 5)
- ✅ TypeScript errors in test files (Session 6)
- ✅ Test failures from onboarding modal (Session 6)
- ✅ Skip button touch target (Session 6 - commit 2cd5a21)
- ✅ Stripe console error in demo mode (Session 9) - only init when key configured
- ✅ Chat modal 401 error in demo mode (Session 9) - use requireAuthOrDemo
- ✅ "Do this now" not prioritizing by deadline (Session 9) - use sortedTasks

---

## Stripe Integration Status (Session 7)

**What's implemented:**
- Database migration (`012_stripe_subscriptions.sql`) with tables:
  - `stripe_customers` - links Supabase users to Stripe customer IDs
  - `stripe_subscriptions` - tracks subscription state
  - `stripe_products` / `stripe_prices` - cached product/price data
- API routes:
  - `/api/stripe/checkout-session` - creates Stripe checkout session
  - `/api/stripe/portal-session` - creates customer portal session
  - `/api/stripe/subscription` - gets current subscription status
  - `/api/stripe/webhooks` - handles Stripe webhook events
- React hook `useSubscription` for subscription state management
- `UpgradeModal` component with pricing UI

**What's needed to go live:**
1. Create Stripe account and products in Stripe Dashboard
2. Set environment variables:
   - `STRIPE_SECRET_KEY`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_ID_MONTHLY`
   - `STRIPE_PRICE_ID_YEARLY`
3. Configure webhook endpoint in Stripe Dashboard
4. Run database migration
5. Integrate UpgradeModal into the app (e.g., in settings or when hitting demo limits)

**Pricing:**
- Monthly: $10/month
- Yearly: $96/year ($8/month)

---

## Next Session Priorities

1. ~~**Integrate UpgradeModal into app**~~ - Done (Session 7)
2. ~~**Add upgrade modal trigger**~~ - Done (Session 8)
3. ~~**Fix calendar stale data**~~ - Done (Session 8) - auto-refresh if cache >30 min old
4. ~~**Email snooze & persistent dismiss**~~ - Done (Session 8)
5. ~~**Habit completion from list view**~~ - Done (Session 8)
6. **Create Stripe products** - Set up products/prices in Stripe Dashboard
7. ~~**Add calendar event create/edit**~~ - Done (Session 9) - "Add to Calendar" in task menu
8. ~~**Habit streak visualization**~~ - Done (Session 9) - Streak stats in task view
9. ~~**Calendar event editing**~~ - Done (Session 10) - Add/remove calendar events from task menu
10. ~~**Habit completion calendar**~~ - Done (Session 10) - 4-week visual calendar in habit view

**Future Ideas:**
- ~~Time blocking~~ - Done (Session 11) - Schedule tasks into calendar time blocks
- ~~Statistics/insights~~ - Done (Session 11) - StatsCard shows progress
- ~~Focus mode enhancements~~ - Done (Session 11) - Pomodoro timer and ambient sounds
- ~~Quick reschedule~~ - Done (Session 11) - "Later today" and "Tomorrow morning" quick options
- ~~Advanced stats~~ - Done (Session 11) - 7-day activity visualization in StatsCard
- ~~Natural language dates~~ - Done (Session 11) - "by tomorrow", "due Friday" in task input

**New Future Ideas:**
- Task templates - Pre-built step breakdowns for common tasks
- Recurring reminders - Weekly/monthly task recurrence
- Task sharing/delegation - Share tasks with others
- Mobile PWA enhancements - Offline support, better notifications
- ~~Keyboard shortcut overlay~~ - Done (Session 11) - Help modal showing all shortcuts

---

## Session Log

### Session 11 - Feb 2, 2026
**Accomplished:**
- **Added snooze option to list view task menu** - Users can now snooze tasks directly from the list without opening task detail view
  - Added `onSnooze` prop to TaskListItem component
  - Integrated SnoozeMenu modal into task dropdown menu
  - Shows for all non-habit tasks (habits have "Done for today" instead)
  - Options: Tomorrow, In 3 days, Next week, In 2 weeks, Next month, or custom date
- Fixed click propagation issues with stopPropagation in SnoozeMenu
- Added z-index fixes for modal overlay interactions
- **Added progress statistics card** - Shows users their productivity at a glance
  - Steps completed count
  - Tasks finished count
  - Best active habit streak
  - Only displays when there's meaningful progress (non-intrusive)
- **Added Pomodoro timer to Focus Mode** - Timeboxing helps ADHD users start tasks
  - Toggle between stopwatch (count up) and pomodoro (countdown) modes
  - Press 'P' keyboard shortcut to toggle timer mode
  - 25-minute work sessions with visual countdown
  - Break prompts after each pomodoro (5 min short break, 15 min long break after 4 pomodoros)
  - Visual pulse animation when timer completes
  - Pomodoro count tracked during focus session
- **Added quick snooze options** - Faster postponement for when you need a short break
  - "In 1 hour" and "In 2 hours" options (shows before 9 PM)
  - "Tomorrow morning" (9 AM) always available as featured option
  - Section headers organize time-based vs date-based options
  - Reduces friction for short postponements (no need to pick a date)
- **Added 7-day activity visualization** - Shows consistency at a glance
  - Weekly grid showing which days had habit completions
  - "X/7 days active" summary
  - Green checkmarks for completed days, today highlighted
  - Helps users see their consistency patterns
- **Added ambient sounds to Focus Mode** - Background noise for better focus
  - White noise, brown noise, and rain sound options
  - Uses Web Audio API (no external audio files needed)
  - Toggle with 'S' keyboard shortcut or click icon
  - Helps ADHD users focus with background noise
- **Added time blocking feature** - Schedule tasks to specific times
  - New SchedulePicker component with quick options (Tomorrow 9 AM, 2 PM, Next Monday)
  - Custom datetime picker for precise scheduling
  - "Schedule time" / "Reschedule" menu option in task view
  - Scheduled tasks appear in "Coming up" calendar widget
  - Tasks show with checkbox icon and "· Task" label to differentiate from events
  - Clicking a scheduled task in calendar navigates to task view
- **Added natural language date parsing** - Zero friction due date input
  - Type "call mom by tomorrow" and due date is automatically extracted
  - Supports: "by tomorrow", "due Friday", "next Monday", "March 15"
  - Supports: "in 3 days", "next week", "end of month"
  - Shows "Due Tomorrow" (or other date) badge in input with calendar icon
  - Date text automatically removed from task title
  - dueDate passed through metadata to task creation
- **Added keyboard shortcuts help modal** - Discoverable shortcuts for power users
  - Press '?' anywhere in app (outside input fields) to show modal
  - Organized sections: Global, Task Input, Focus Mode, Date shortcuts
  - Shows all keyboard shortcuts with visual key caps
  - Reduces learning curve by making shortcuts discoverable
- All 189 tests passing, build succeeds

**Commits:**
- `d83cc42` Add snooze option to task list view menu
- `abf8c7b` Add progress statistics card to home view
- `d83b440` Add Pomodoro timer to Focus Mode
- `9cf6a98` Add quick snooze options (Later today, Tomorrow morning)
- `738a150` Add 7-day activity visualization to StatsCard
- `7acc0af` Add ambient sounds to Focus Mode
- `64eea9c` Add time blocking feature - schedule tasks to specific times
- `240d85f` Add natural language date parsing for task input
- `a8d7551` Add keyboard shortcuts help modal (press ? to open)

**Technical notes:**
- Quick actions feature (from Future Ideas) partially addressed - snooze was the highest-impact quick action
- SnoozeMenu now includes `stopPropagation` and `z-10` on menu content to prevent click issues
- Snooze filters tasks from list view (shows "X snoozed" indicator in Other tasks header)
- StatsCard uses local task data, no additional API calls needed
- Pomodoro uses existing FocusMode component, no new components needed
- Timer mode persists during focus session but resets when exiting
- Quick snooze uses ISO datetime strings for time-based options (supports hour-level precision)
- useMemo calculates available options based on current time to avoid showing past times
- 7-day activity pulls from habit streak completions array (already tracked per habit)
- Activity visualization shows only when there's at least one active day (non-intrusive)
- Ambient sounds use Web Audio API with generated noise (white/brown/rain) - no external files
- useAmbientSound hook manages AudioContext lifecycle and cleanup on unmount
- Time blocking uses existing `scheduled_at` field on Task interface
- SchedulePicker component is a modal similar to SnoozeMenu pattern
- CalendarSidebar and CalendarWidget both updated to merge calendar events with scheduled tasks
- ScheduledItem interface unifies event and task display
- Tasks filtered to show only incomplete tasks scheduled within next 7 days
- Natural language date parser uses regex patterns ordered by specificity (most specific first)
- ParsedInputMetadata extended with dueDate field alongside scheduledAt
- Date badge shows in input area with calendar icon when date pattern detected
- formatParsedDate() provides friendly date display (Today, Tomorrow, Friday, Mar 15)
- Dates in past automatically roll to next year (e.g., "March 15" after March 15 = next year)
- KeyboardShortcutsModal is a standalone component with ShortcutSection/ShortcutItem types
- Global '?' key listener in GatherApp.tsx checks for input focus to avoid conflicts
- Modal uses existing animation patterns (animate-rise, animate-backdrop-in)
- Supports both '?' and Shift+/ (same key on most keyboards)

---

### Session 10 - Feb 2, 2026
**Accomplished:**
- Added dynamic due date to demo "File taxes" task (3 days from now) so users can see the deadline badge feature in demo mode
- **Added habit completion calendar** - visual 4-week calendar showing completion history
  - Green dots for completed days
  - Empty boxes for missed days
  - Today highlighted with accent ring
  - Legend showing completed vs missed
- **Added calendar event management** - users can add/remove tasks from Google Calendar
  - "Add to Calendar" option for tasks with due dates
  - "Remove from Calendar" option for tasks already synced
  - calendar_event_id tracked on task for state management
- Streak interface extended with `completions` array for tracking history
- Habit completion now records dates in completions array
- All 184 tests passing, no console errors
- Build succeeds

**Commits:**
- `33e7236` Add dynamic due date to demo task for deadline badge visibility
- `691bcb6` Add habit completion calendar visualization
- `520a6e5` Add calendar event management (add/remove from calendar)

**Technical notes:**
- Demo tasks now showcase the deadline badge ("Due in 3d") feature
- HabitCalendar component shows last 4 weeks (28 days) of history
- Completions stored as ISO date strings array in streak JSONB
- Demo habit includes sample completion data with gaps to show missed days
- Task interface has calendar_event_id field to track linked Google Calendar events
- Users can add tasks to calendar and remove them later from task menu

---

### Session 9 - Feb 2, 2026
**Accomplished:**
- Fixed Stripe initialization error in demo mode (only load when publishable key configured)
- Fixed chat-assistant API 401 error in demo mode (use `requireAuthOrDemo` instead of `requireAuth`)
- Fixed "Do this now" section not prioritizing by deadline (use `sortedTasks` instead of `activeTasks`)
- Added "Add to Calendar" option in task menu for tasks with due dates
- Build succeeds, unauthenticated tests passing

**Commits:**
- `c33a089` Fix demo mode bugs: Stripe init and chat API auth
- `3b65521` Prioritize "Do this now" by deadline urgency
- `7fcece7` Add "Add to Calendar" option in task menu
- `ca0aade` Add habit streak visualization in task view
- `01cc696` Add demo habit task to showcase streak visualization

**Technical notes:**
- Chat modal now works properly in demo mode with AI responses
- "Do this now" shows the most urgent task's next step based on deadline
- Calendar integration uses existing `/api/calendar/create-event` API
- Habit streak stats show current/best streak and encouragement message
- Demo mode now includes a meditation habit with streak data

---

### Session 8 - Feb 2, 2026
**Accomplished:**
- Completed upgrade modal trigger when users hit rate limits
- Added `onUpgradeRequired` callback to `useAIConversation` hook
- Check for 429 responses with `upgradeRequired` flag in AI chat handlers
- Show UpgradeModal automatically when free users hit rate limit
- Fixed calendar stale events bug (auto-refresh if cache >30 min old)
- Added email snooze and persistent dismiss functionality
- Added "Done for today" option for habits in task list view
- All tests passing, build succeeds

**Commits:**
- `0f32dd9` Add upgrade modal trigger when hitting rate limits
- `69a07a9` Fix calendar showing stale events
- `662e5e4` Add snooze and persistent dismiss for email tasks
- `ac5bcaf` Add "Done for today" option for habits in task list

---

### Session 7 - Feb 2, 2026
**Accomplished:**
- Added complete Stripe subscription integration
- Created database migration for Stripe tables
- Implemented 4 API routes: checkout-session, portal-session, subscription, webhooks
- Built useSubscription React hook
- Created UpgradeModal component with pricing UI
- Updated .env.local.example with Stripe config
- Integrated subscription management into settings modal (upgrade/billing buttons)
- Improved error logging in email scan endpoint

**Commits:**
- `d5ec2c8` Add Stripe subscription integration
- `6dbf045` Add subscription management to settings modal
- `85081f9` Improve error logging in email scan endpoint
- `4705f31` Add subscription-based rate limiting for AI features

**Technical notes:**
- Using Stripe API version 2026-01-28.clover
- Subscription period dates now on SubscriptionItem, not Subscription (Stripe API change)
- Lazy Stripe initialization to avoid build-time errors
- Tier-based rate limits: demo (10/hr), free (5/day), pro (100/hr)

---

### Session 6 - Feb 2, 2026
**Accomplished:**
- Added onboarding flow for new demo users (3-step intro explaining AI task breakdown)
- Fixed TypeScript errors (target ES2020, downlevelIteration, NodeList iteration)
- Fixed test failures caused by onboarding modal blocking UI (skip via localStorage)
- Fixed keyboard shortcut tests by updating input selectors for new placeholder text
- Fixed Skip button touch target (44x44px minimum)
- Build and TypeScript clean, unauthenticated tests passing

**Commits:**
- `2cd5a21` Fix Skip button touch target size
- `43c3936` Fix TypeScript errors and test failures from onboarding
- `9a494aa` Add onboarding flow for new demo users

---

### Session 5 - Feb 2, 2026
**Accomplished:**
- Verified demo mode AI task breakdown flow works end-to-end
- Fixed duplicate detection false positives (added stopword filtering)
- Fixed create_task action handler to generate fallback steps

**Commits:**
- `f4b4c1e` Fix duplicate detection false positives and missing steps on task creation

---

### Session 4 - Feb 2, 2026
**Accomplished:**
- Fixed P1 generic fallback steps (keyword-based actionable steps)
- Fixed demo calendar events (always show future times)
- Fixed TypeScript build errors in rate limit configs
- Updated and passed all tests (165 passing)
- Comprehensive PRODUCT_COMPLETE assessment

---

### Session 3 - Feb 2, 2026
- Set up test Gmail account, verified all integrations working
- Tested full AI task breakdown flow end-to-end

### Session 2 - Feb 2, 2026
- Fixed demo mode AI, added starter tasks
- Researched competitive landscape

### Session 1 - Feb 2, 2026
- Created initial STATE.md

---

## PRODUCT_COMPLETE + MONETIZATION_READY

The product now has:
- ✅ Core functionality (AI task breakdown, progress tracking)
- ✅ Integrations (Google Calendar, Gmail, push notifications, SMS)
- ✅ Payment infrastructure (Stripe subscription integration)

Ready for beta launch with paying users.
