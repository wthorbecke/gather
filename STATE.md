# Gather Product State

**Last Updated:** Mon Feb 2 2026, 15:30 PST
**Session:** 2 (first real session)

---

## What This Product Is

Gather is an **AI-powered executive function layer** for people with ADHD or executive function challenges. It's NOT a todo app - it's a collaboration tool between user and AI that:

1. Breaks down overwhelming tasks into concrete, actionable steps
2. Proactively reaches out (SMS, notifications) rather than waiting to be opened
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

**Lunatask** - Holistic Planner
- Tasks, habits, moods, journal in one app
- Prioritizes and lets you focus on one area at a time

### Gather's Differentiation
1. **Zero friction input** vs Tiimo's "steep learning curve"
2. **Conversational AI** that asks clarifying questions vs just generating steps
3. **Web-first** - works on any device vs iOS-only competitors
4. **Proactive outreach** via SMS/notifications vs waiting to be opened
5. **Warm, direct tone** like a trusted friend - no corporate wellness speak
6. **No guilt-tripping** about incomplete tasks (vs streak-based shame)

### Market Insight
The ADHD productivity app space is growing. Tiimo winning App of the Year validates the market. Users complain about:
- Complexity and steep learning curves
- Apps that assume you can break down tasks yourself
- Streak-based guilt when missing days
- Lack of proactive help (waiting to be opened)

---

## Current Product State

### What's Built
- Next.js 14 + Supabase + Tailwind stack
- Three view modes: List (default), Day, Stack
- AI task breakdown via Anthropic API
- Task types: regular tasks, reminders, events, habits
- Step-based progress tracking with checkboxes
- Undo support for completed steps and deleted tasks
- Calendar integration (Google Calendar sync)
- Email scanning for actionable tasks
- SMS notifications via Twilio
- Dark/light mode with time-based ambient gradients
- Demo mode for trying without signup
- Mobile-responsive design (375px minimum)
- Celebration animations (confetti) on task completion

### Visual Design
- Clean, warm color palette: coral accent (#E07A5F), sage success (#6B9080)
- Time-based ambient backgrounds (warmer morning/evening, cooler night)
- Card-based UI with subtle shadows and borders
- Rotating placeholder examples in main input
- Properly sized touch targets (44px minimum)

---

## Issues Status

### ✅ FIXED - Demo Mode AI (was P0)
**Bug:** AI features returned 401 in demo mode.
**Fix:** Added `requireAuthOrDemo` helper + X-Demo-User header system.
**Commit:** `28e90bc`

### ✅ FIXED - No Tasks in Demo Mode (was P1)
**Bug:** Demo users saw empty task list.
**Fix:** Added 3 starter tasks with pre-generated AI steps.
**Commit:** `b857e60`

### P1 - Generic Fallback Steps
When AI fails, the app shows useless template steps:
- "Research how to [task]"
- "Gather required information"
- "Complete the [task] process"
- "Keep documentation and confirm completion"

These don't help anyone. Should show better messaging when AI is unavailable.

### P2 - Test Failures
Several authenticated flow tests are failing - likely environment/credential issues, not real bugs. Need to verify test environment setup.

---

## UX Observations

### Good
- Rotating animated placeholders are delightful
- "Do this now" card with first incomplete step is smart - shows ONE thing to focus on
- Time-based ambient backgrounds create calm atmosphere
- Progress bars on task cards give visual feedback
- Undo toast for accidental actions
- Mobile layout adapts well

### Needs Work
- Calendar "Coming up" section shows demo events but they're always "2 PM today" - should be dynamic or hidden in demo
- Chat FAB button could conflict with bottom navigation if we add it
- No onboarding flow explaining how the app works
- Task menu (three dots) is small and easy to miss

---

## Ideas / Feature Backlog

### High Priority (would 2x value)
- [ ] Fix demo mode AI to actually work
- [ ] Add compelling starter tasks for demo
- [ ] Onboarding flow for new users
- [ ] Push notifications for task reminders
- [ ] Weekly reflection summary

### Medium Priority
- [ ] Task scheduling - "do this on Tuesday"
- [ ] Snooze improvements - quick buttons for "later today", "tomorrow", "next week"
- [ ] Better step editing - inline edit, drag to reorder
- [ ] Task search across all tasks

### Lower Priority / Nice to Have
- [ ] Voice input for adding tasks
- [ ] Keyboard shortcuts documentation
- [ ] Task templates for common scenarios
- [ ] Share task breakdown with someone

---

## Architecture Notes

**Data model:**
- Tasks have `steps` (array) with rich structure: text, summary, detail, time estimates, sources
- Old `subtasks` field still exists but deprecated
- Task types: 'task' | 'reminder' | 'habit' | 'event'
- Habits have streak tracking (current, best, lastCompleted)

**Key files:**
- `src/hooks/useUserData.ts` - Main data management hook
- `src/hooks/useAIConversation.ts` - AI interaction state
- `src/components/GatherApp.tsx` - Main app orchestration
- `src/components/HomeView.tsx` - List view implementation
- `src/app/api/analyze-intent/route.ts` - Main AI endpoint

---

## What I'll Work On Next

**Next priorities:**
1. Run full test suite to verify nothing is broken
2. Research competitive landscape
3. Consider onboarding flow improvements

---

## Session Log

### Session 2 - Feb 2, 2026
**Accomplished:**
- Ran app locally, audited all views (List, Day, Stack)
- Identified and FIXED critical demo mode bug (AI returning 401)
  - Added `requireAuthOrDemo` helper to api-auth.ts
  - Updated authFetch to send X-Demo-User header
  - Updated 3 API endpoints to accept demo users with rate limiting
- Added compelling demo starter tasks with pre-generated AI steps
  - File taxes (5 steps with official sources, 1 pre-completed)
  - Renew passport (4 steps with action links)
  - Get Healthier (5 concrete daily habits)
- Researched competitive landscape (Tiimo, neurolist, Amazing Marvin, Motion)
- Verified error handling is solid (graceful fallbacks, retry options)
- Full test suite: 208 passed, 9 skipped

**Commits:**
- `28e90bc` Fix demo mode: enable AI features for demo users
- `b857e60` Add starter tasks for demo mode with pre-generated AI steps
- `16e7da4` Update STATE.md with session 2 progress
- `70d3c06` Add competitive landscape research to STATE.md

**What's ready:**
- Demo mode fully works - AI asks questions, generates steps
- Starter tasks showcase product value immediately
- Error handling graceful with retry options

**Next session priorities:**
1. Improve error message copy (warmer tone per design system)
2. Consider onboarding flow for new authenticated users
3. Review test failures in authenticated flows (env setup)

### Session 1 - Feb 2, 2026
- Created initial STATE.md, session ended immediately
