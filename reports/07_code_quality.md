# Code Quality Audit Report

## Architecture Overview

The codebase is a Next.js 14+ application with a clear but concerning separation: a monolithic `GatherApp.tsx` (1541 lines) orchestrates everything, delegating to view components (`StackView`, `HomeView`, `TaskView`). Business logic lives in a bloated `useUserData` hook (756 lines) and is scattered across API routes. The architecture is **component-centric rather than domain-centric**, leading to massive files that do too much.

## Architecture Diagram

```
src/
├── app/                 <- Next.js routes, API endpoints. CLEAN
│   ├── api/            <- 15+ route handlers, moderate complexity
│   │   ├── auth/       <- Google OAuth flows (fragmented)
│   │   ├── calendar/   <- Calendar integration (5 files)
│   │   ├── gmail/      <- Gmail integration (4 files)
│   │   └── cron/       <- Background jobs (4 files)
│   └── page.tsx        <- Entry point. CLEAN
│
├── components/          <- UI components. PROBLEMATIC
│   ├── GatherApp.tsx   <- 1541 lines. GOD COMPONENT. CRITICAL.
│   ├── StackView.tsx   <- 931 lines. Too much responsibility.
│   ├── UnifiedInput.tsx <- 580 lines. Doing too much.
│   └── [24 others]     <- Mixed quality
│
├── hooks/               <- Custom hooks. MIXED
│   ├── useUserData.ts  <- 756 lines. Does everything. NEEDS SPLIT.
│   ├── useGameification.ts <- 444 lines. Complex but focused.
│   └── [7 others]      <- Reasonably sized
│
├── lib/                 <- Utilities. CLEAN
│   ├── taskHelpers.ts  <- 313 lines. Good extraction.
│   └── [7 others]      <- Small, focused
│
├── config/              <- Configuration. CLEAN
└── types/               <- Type definitions. MINIMAL
```

## File Complexity Ranking

| Rank | File | Lines | Hooks | Functions | Verdict |
|------|------|-------|-------|-----------|---------|
| 1 | GatherApp.tsx | 1541 | 48 | 155 | **CRITICAL**: God component, must be split |
| 2 | StackView.tsx | 931 | 50 | 102 | **SEVERE**: Too many responsibilities |
| 3 | useUserData.ts | 756 | - | 30+ | **SEVERE**: Kitchen-sink data hook |
| 4 | UnifiedInput.tsx | 580 | 21 | 47 | **HIGH**: Input doing too much |
| 5 | suggest-subtasks/route.ts | 494 | - | - | **MODERATE**: Complex but justified |
| 6 | useGameification.ts | 444 | - | - | **MODERATE**: Complex but focused |
| 7 | AICard.tsx | 444 | 8 | 27 | **MODERATE**: Borderline acceptable |
| 8 | gmail/analyze/route.ts | 421 | - | - | **MODERATE**: API complexity |
| 9 | IntegrationSettings.tsx | 427 | 10 | 28 | **MODERATE**: Integration logic bundled |
| 10 | TaskView.tsx | 416 | 11 | 36 | **MODERATE**: Acceptable for view |

Files over 300 lines without justification: **6**
Files with 10+ hooks: **7** (GatherApp, StackView, UnifiedInput, EmailTasksCard, CalendarSidebar, TaskView, IntegrationSettings)

## Code Smell Catalog

### Critical Smells

| Smell | Location | Severity |
|-------|----------|----------|
| God component | GatherApp.tsx (entire file) | CRITICAL |
| 155 functions in one file | GatherApp.tsx | CRITICAL |
| 48 hook usages | GatherApp.tsx | CRITICAL |
| 50 hook usages | StackView.tsx | CRITICAL |
| Kitchen-sink hook | useUserData.ts:1-756 | SEVERE |
| Duplicate task creation logic | GatherApp.tsx:645-730, 883-965, 1036-1129 | SEVERE |

### High Severity

| Smell | Location | Severity |
|-------|----------|----------|
| `any` type usage | GatherApp.tsx:316, 320, 487, 491, 669, 684, 732 | HIGH |
| Magic numbers in timeouts | Throughout (150ms, 300ms, 600ms, 2000ms, 3000ms) | HIGH |
| Prop drilling 3+ levels | onToggleStep, onGoToTask passed through 3-4 components | HIGH |
| Duplicated fetch patterns | GatherApp.tsx has 7 near-identical fetch blocks | HIGH |

### Medium Severity

| Smell | Location | Severity |
|-------|----------|----------|
| Nested ternaries | GatherApp.tsx:318, 489 (3-deep) | MEDIUM |
| Long handler chains | GatherApp.tsx:194-782 (handleSubmit ~600 lines) | MEDIUM |
| Console.log statements | 167 instances across codebase | MEDIUM |
| Implicit any in callbacks | GatherApp.tsx action handlers | MEDIUM |

### Low Severity

| Smell | Location | Severity |
|-------|----------|----------|
| Unused components | EmailModal, GameUI, ReflectionCard, StatsCard (0 imports) | LOW |
| TODO comment | cron/weekly-reflection/route.ts:160 | LOW |
| Hardcoded strings | Various affirmation arrays, UI text | LOW |

## Type Safety Score

- `any` count: **7** explicit uses
- `as` assertion count: **0** (good)
- Untyped parameters in callbacks: **~10**
- `@ts-ignore` / `@ts-expect-error`: **0**
- `eslint-disable`: **0**

**Score: C+**

The `any` usage is concentrated in GatherApp.tsx when parsing AI responses. This is somewhat justified (API responses) but could be typed with interfaces. No other egregious type safety violations.

## Error Handling Gaps

### Where the app can crash

1. **localStorage access without try-catch**
   - StackView.tsx:68-85 - getDismissCounts, incrementDismissCount
   - StatsCard.tsx:25,38 - streak data
   - useMemory.ts:42,61,125
   - If localStorage is unavailable (private browsing, quota exceeded), app crashes

2. **Fetch without proper error boundaries**
   - GatherApp.tsx has 7 fetch calls with inconsistent error handling
   - Some check `response.ok`, others don't
   - Network failures could leave UI in broken state

3. **Missing null checks**
   - GatherApp.tsx:1499 - `currentTask` could be undefined after state change
   - Several places trust array indices without bounds checking

4. **Unhandled promise rejections**
   - useUserData.ts has many async operations without top-level catch
   - Console errors but no user-facing recovery

### What happens when things fail

- **localStorage unavailable**: Runtime crash, no graceful degradation
- **API fetch fails**: Shows console.error, may leave loading spinner forever
- **Supabase errors**: Logged but user sees nothing, data may be stale
- **Google OAuth fails**: Redirects to app without clear error message

**Error boundary implementation**: None visible in component tree.

## Dead Code Found

| Item | Location | Status |
|------|----------|--------|
| EmailModal component | src/components/EmailModal.tsx | 0 imports found |
| GameUI component | src/components/GameUI.tsx | 0 imports found |
| ReflectionCard component | src/components/ReflectionCard.tsx | 0 imports found |
| StatsCard component | src/components/StatsCard.tsx | 0 imports found |
| Empty API directories | src/app/api/habits, src/app/api/soul, src/app/api/tasks | No route.ts files |
| STARTER_TASKS constant | useUserData.ts:25 | Defined but empty array |

Note: The "unused" components may be imported dynamically or in routes not captured. Manual verification recommended.

## Tech Debt Registry

| Item | Location | Severity | Effort |
|------|----------|----------|--------|
| Split GatherApp.tsx | GatherApp.tsx | CRITICAL | 2-3 days |
| Split useUserData.ts | hooks/useUserData.ts | CRITICAL | 1-2 days |
| Extract task creation logic | GatherApp.tsx:645-1200 | HIGH | 1 day |
| Add error boundaries | App-level | HIGH | 0.5 day |
| Wrap localStorage in try-catch | 8+ locations | HIGH | 2 hours |
| Remove console.log statements | 167 locations | MEDIUM | 1 hour |
| Add proper types for AI responses | GatherApp.tsx | MEDIUM | 4 hours |
| Create constants for magic numbers | Throughout | MEDIUM | 2 hours |
| Consolidate duplicate fetch patterns | GatherApp.tsx | MEDIUM | 4 hours |
| Verify/remove dead components | 4 components | LOW | 1 hour |
| Complete streak calculation TODO | cron/weekly-reflection | LOW | 30 min |

## Brutal Assessment

This codebase has the classic "startup velocity" smell. It works, ships features fast, but is accumulating debt at an alarming rate. The GatherApp component is a ticking time bomb - at 1541 lines and 155 functions, any developer who isn't the original author will struggle to make changes confidently.

The architecture shows signs of "component-first" thinking rather than domain modeling. Business logic for tasks, AI interactions, context gathering, and celebrations all live in the same file because they're all "part of the app."

**Would I want to maintain this codebase?** Not in its current state. Changes to task handling require understanding 600+ lines of interdependent callbacks.

**Would I hire the author?** The code shows someone who can ship and iterate quickly, with decent React knowledge. But there's a concerning lack of discipline around complexity management. Good for 0-to-1, questionable for 1-to-100.

The saving grace: consistent styling, good TypeScript adoption (minimal `any`), no eslint suppressions, and reasonable folder structure. The problems are architectural, not foundational.

## If I Had 4 Hours

**Priority order:**

1. **Add error boundaries** (1 hour)
   - Create ErrorBoundary component
   - Wrap main app sections
   - Prevents white-screen crashes

2. **Wrap all localStorage in try-catch** (30 min)
   - Create utility functions: `safeGetItem`, `safeSetItem`
   - Replace direct calls
   - Prevents crashes in private browsing

3. **Remove console.log statements** (30 min)
   - `grep -rn "console\." src/ | wc -l` shows 167 instances
   - These should not ship to production
   - Replace with proper error tracking or remove

4. **Extract task creation into separate module** (2 hours)
   - Move handleSubmit logic to `lib/taskCreation.ts`
   - Create `createTaskFromIntent`, `createTaskFromQuickAdd`, etc.
   - Reduces GatherApp by ~400 lines

## If I Had 4 Days

**Day 1: Core Architecture**
- Split GatherApp.tsx into:
  - `GatherApp.tsx` - orchestration only (~200 lines)
  - `hooks/useAIConversation.ts` - AI state and handlers
  - `hooks/useTaskCreation.ts` - task creation flows
  - `hooks/useContextGathering.ts` (already exists, enhance it)
  - `hooks/useCelebration.ts` - confetti/celebration state

**Day 2: Data Layer**
- Split useUserData.ts into:
  - `hooks/useTasks.ts` - task CRUD
  - `hooks/useHabits.ts` - habit CRUD
  - `hooks/useSoulActivities.ts` - soul activity CRUD
  - `hooks/useLocalDemo.ts` - demo mode data
- Add React Query or SWR for proper caching/revalidation

**Day 3: Error Handling & Type Safety**
- Add global error boundary with recovery UI
- Create typed interfaces for all API responses
- Add runtime validation for AI responses (zod or similar)
- Implement proper error states in all components
- Add toast/notification system for user feedback

**Day 4: Cleanup & Testing**
- Remove dead code (verify unused components)
- Extract magic numbers to constants
- Add integration tests for critical flows
- Remove all console.log statements
- Document architecture decisions

---

*Generated: 2026-01-29*
*Auditor: Code Quality Agent*
