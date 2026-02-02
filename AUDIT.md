# Gather App Audit

Comprehensive audit conducted Feb 2, 2026. Findings organized by severity.

---

## Critical: Broken Features

### 1. Task Intelligence API Returns 500 Errors
**File:** `src/app/api/task-intelligence/route.ts`
**Evidence:** Server logs show repeated `GET /api/task-intelligence 500` errors
**Cause:** The API queries `task_completions` and `task_insights` tables that may not exist or have schema mismatches. The code casts Supabase client `as any` (lines 64, 79) to bypass type checking, masking the real errors.
**Impact:** TaskInsight component in HomeView fails silently, users don't get proactive insights.

### 2. "No additional context provided." Shows on Task Items
**File:** `src/components/TaskListItem.tsx:107-120`
**Evidence:** Visible in demo - "Renew passport" task shows "No additional context provided." as secondary text
**Cause:** The `contextText` variable directly displays `task.context_text` without filtering out placeholder/empty-equivalent values
**Impact:** Looks like debug output, unprofessional

---

## High: Incomplete Features

### 3. Day View Missing Sign Out Button
**File:** `src/components/DayView.tsx`
**Evidence:** List view has footer sign-out, Stack view has header sign-out, Day view has neither
**Impact:** Users can get stuck in Day view without ability to sign out

### 4. Task Menu Only Shows on Hover
**File:** `src/components/TaskListItem.tsx:186-196`
**Code:** `opacity-0 group-hover:opacity-100`
**Impact:** On mobile, users have no way to access the delete action - no touch alternative

### 5. Drag to Schedule Not Implemented
**Evidence:** Not found in any component
**Impact:** Feature mentioned in spec but doesn't exist - potential dead end if referenced elsewhere

### 6. Habit Streak Tracking Incomplete
**File:** `src/components/GatherApp.tsx:283-314` and `src/lib/taskTypes.ts:162-193`
**Evidence:** `handleToggleHabit` exists but habits aren't creatable via UI (no `/h` prefix in demo tasks)
**Impact:** Users can't actually test habit functionality end-to-end

---

## Medium: Inconsistencies

### 7. Inconsistent Header/Footer Structure Across Views
**Files:** `GatherApp.tsx`, `StackView.tsx`, `DayView.tsx`
- List view: Header with ViewToggle, footer with sign-out
- Stack view: Its own toolbar with add/view-toggle/sign-out inline
- Day view: Day navigation header, no sign-out anywhere
**Impact:** Confusing mental model, users may feel lost

### 8. Border Radius Chaos
**Evidence:** CLAUDE.md says use only 2-3 values, but codebase has:
- `rounded-sm` (6px)
- `rounded-md` (8px)
- `rounded-lg` (10px)
- `rounded-xl` (16px)
- `rounded-2xl` (20px)
- `rounded-full`
- `rounded-[24px]`, `rounded-[26px]` in StackView
**Files:** Throughout, especially `StackView.tsx`, `UnifiedInput.tsx`

### 9. Animation Duration Inconsistencies
**Evidence:** Design system in globals.css defines `--duration-fast: 80ms`, `--duration-base: 120ms`, `--duration-slow: 180ms` but components use:
- `duration-150` (common)
- `duration-200`
- `duration-300`
- `duration-500`
- `duration-700`
**Impact:** Subtle but creates unpolished feel

### 10. Chat FAB Position Unconventional
**File:** `src/components/GatherApp.tsx:529-554`
**Code:** `bottom-6 left-6`
**Impact:** Most apps place primary FAB in bottom-right. Left position conflicts with navigation patterns.

---

## Low: Polish Issues

### 11. Empty State Copy Could Be Warmer
**File:** `src/config/content.ts` (needs review)
**Evidence:** Day view empty state uses emoji "📅" which violates "no emoji unless requested"
**File:** `src/components/DayView.tsx:560-564`

### 12. Calendar Widget Shows Past Times
**File:** `src/lib/demo-data.ts`
**Evidence:** Demo calendar events have hardcoded times that become "past" as the day progresses
**Impact:** Demo feels broken in afternoon/evening

### 13. Input Placeholder Animation Complexity
**File:** `src/components/UnifiedInput.tsx:266-363`
**Evidence:** 100+ lines for placeholder typewriter effect, uses refs to avoid re-renders but adds complexity
**Impact:** Maintenance burden, potential edge case bugs

### 14. View Toggle Icons Missing Screen Reader Labels
**File:** `src/components/ViewToggle.tsx`
**Evidence:** Has `title` and `aria-label` on buttons, but icons have no descriptions
**Impact:** Minor accessibility gap

### 15. Mobile Touch Targets
**File:** Various
**Evidence:** Some buttons use `min-w-[44px] min-h-[44px]` correctly, but inconsistently applied
**Files to check:** `ViewToggle.tsx` buttons are `p-2` only (~36px), close buttons vary

---

## Future Work (Out of Scope)

### 16. Database Migration Needed
- `task_completions` table referenced but likely missing
- `task_insights` table referenced but likely missing
- Migration files exist in `supabase/migrations/` but may not be applied

### 17. Google OAuth Integration
- Code exists for `/api/auth/google/*` routes
- IntegrationSettings shows "Connect Google" button
- Not testable without Google credentials

### 18. Push Notifications
- `PushNotifications.tsx` component exists
- Not integrated into main app flow

### 19. SMS/Twilio Integration
- API routes exist at `/api/sms/*`
- No UI integration visible

---

## Quick Wins

1. **Filter context_text "No additional context provided."** - 5 min fix
2. **Add sign-out to Day view** - 5 min fix
3. **Move Chat FAB to bottom-right** - 2 min fix
4. **Fix task menu mobile accessibility** - 10 min fix (add long-press or always-visible option)
5. **Remove emoji from Day view empty state** - 2 min fix
6. **Normalize border-radius to design system values** - 30 min fix
7. **Catch Task Intelligence API errors gracefully** - 10 min fix

---

## Files Reviewed

### Components (32 files)
- GatherApp.tsx - Main app shell
- HomeView.tsx - List view
- DayView.tsx - Day/calendar view
- StackView.tsx - Card stack view
- TaskView.tsx - Task detail view
- UnifiedInput.tsx - Main input component
- TaskListItem.tsx - Task list row
- StepItem.tsx - Step row component
- AICard.tsx - AI response display
- ViewToggle.tsx - View switcher
- CalendarSidebar.tsx - Calendar widget
- ChatModal/* - Chat interface
- And 20+ more supporting components

### Hooks (15 files)
- useUserData.ts - Task CRUD
- useViewState.ts - View management
- And more...

### API Routes (20+ files)
- task-intelligence/* - Proactive insights
- chat/* - AI conversation
- calendar/* - Google Calendar
- emails/* - Gmail scanning
- And more...

### Utilities
- taskTypes.ts - Type helpers
- timeParser.ts - Natural language time
- constants.ts - Type definitions
- globals.css - Design system

---

## Testing Notes

- Dev server running at localhost:3000
- Demo mode functional via "Try the demo" button
- Real Google auth not tested (no credentials)
- All views navigable via ViewToggle
- Core task CRUD works in demo mode
