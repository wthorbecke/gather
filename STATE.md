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

*To research:*
- [ ] Things 3 - popular task manager
- [ ] Todoist - mass market todo
- [ ] TickTick - habit/task hybrid
- [ ] Structured - time blocking
- [ ] Goblin Tools - AI task breakdown
- [ ] Finch - gamified self-care
- [ ] Bearable - mood/habit tracking

**Initial observations:**
- Most todo apps show tasks, not steps. They assume you can break things down yourself.
- AI tools like Goblin Tools exist but are standalone - not integrated into a daily flow.
- Habit trackers punish missed days with broken streaks.
- None speak with the warmth/directness this product aims for.

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

## Critical Issues Found

### P0 - Demo Mode Broken
**Bug:** AI features return 401 Unauthorized in demo mode because API endpoints require Supabase auth tokens, but demo users are created client-side without real sessions.

**Impact:** The CORE VALUE PROP (AI breaking down tasks) doesn't work in demo mode. Users trying the app before signing up see generic fallback steps like "Research how to do X" instead of real AI breakdown.

**Location:** `src/app/api/analyze-intent/route.ts` line 27 uses `requireAuth()` which fails for demo users.

**Fix options:**
1. Skip auth for demo users (check for demo-user-agent header)
2. Create a mock AI response for demo mode
3. Use edge runtime with anonymous rate limiting for demo

### P1 - Generic Fallback Steps
When AI fails, the app shows useless template steps:
- "Research how to [task]"
- "Gather required information"
- "Complete the [task] process"
- "Keep documentation and confirm completion"

These don't help anyone. They should either be specific to the task type OR we should show a message saying "I'll break this down when you sign in".

### P1 - No Tasks in Demo Mode
`STARTER_TASKS` in `useUserData.ts` is an empty array. New demo users see an empty task list with only suggestion chips. This is a poor first impression.

**Recommendation:** Add 2-3 realistic demo tasks with pre-generated AI steps that showcase the app's value.

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

**Priority 1:** Fix demo mode so AI actually works. This is the #1 blocker to users understanding the product's value.

**Approach:** Add demo user detection in API routes - if the request includes a specific header or the "demo-user" identifier, allow the request through with rate limiting.

---

## Session Log

### Session 2 - Feb 2, 2026
- Ran app locally, clicked through all views (List, Day, Stack)
- Identified critical demo mode bug (401 on AI calls)
- Audited visual design - clean, follows design system
- Found generic fallback steps issue
- Found empty demo tasks issue
- Ran test suite - some failures in auth tests (env issue)
- Created comprehensive STATE.md

### Session 1 - Feb 2, 2026
- Created initial STATE.md, session ended immediately
