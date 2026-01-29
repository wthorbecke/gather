# Gather Architecture Audit & Evolution Roadmap

**Date:** 2026-01-29
**Auditor:** Claude Opus 4.5 (Autonomous Evolution Protocol)

---

## Executive Summary

This codebase has **good bones but critical gaps**. It's using Next.js 14 App Router like it's Create React App - zero server components, no streaming, no caching. The AI integration works but isn't the "executive function layer" promised in the product spec.

### Grades

| Area | Grade | Summary |
|------|-------|---------|
| Architecture | D | Client-side everything. No server components. |
| UX/Interaction | C- | Loading dots instead of skeletons. Generic errors. |
| AI Integration | C+ | Good prompts, but NO streaming. No schema validation. |
| Backend/Data | D+ | Zero rate limiting. Webhook auth was bypassed. |

---

## Changes Implemented (This Session)

### Security (Critical)

1. **Rate limiting utility** - `src/lib/rateLimit.ts`
   - In-memory rate limiting (works per-instance on serverless)
   - Pre-configured limits for different operation types
   - Applied to: `/api/chat`, `/api/suggest-subtasks`, `/api/emails/scan`

2. **Input validation utility** - `src/lib/validation.ts`
   - Max length validation for all input types
   - Structured validation for chat and task inputs
   - Applied to: `/api/chat`, `/api/suggest-subtasks`

3. **Webhook authentication fixed**
   - `src/app/api/gmail/webhook/route.ts` - Now rejects unauthorized requests (was logging and continuing)
   - `src/app/api/calendar/webhook/route.ts` - Same fix

4. **Gmail webhook efficiency**
   - Removed redundant `listUsers()` call that was listing ALL users on every webhook

### Accessibility (Critical)

5. **Touch targets fixed to 44x44px minimum**
   - `src/components/TaskListItem.tsx` - Kebab menu button
   - `src/components/AICard.tsx` - Both dismiss buttons
   - `src/components/StepItem.tsx` - Edit button, "stuck?" button

### UX (Critical)

6. **Skeleton loading UI**
   - `src/components/GatherApp.tsx` - Replaced loading dots with skeleton that matches actual layout structure

---

## Critical Issues NOT Fixed (Next Session)

### 1. No AI Streaming (Highest Priority)

**Problem:** Every AI call is blocking. Users wait 5-10 seconds in silence.

**Files affected:**
- `src/app/api/chat/route.ts`
- `src/app/api/suggest-subtasks/route.ts`

**Solution:** Implement streaming responses using Anthropic's streaming API. Return `ReadableStream` instead of waiting for full response.

```typescript
// Example pattern needed:
return new Response(
  new ReadableStream({
    async start(controller) {
      const stream = await anthropic.messages.stream({...})
      for await (const chunk of stream) {
        controller.enqueue(new TextEncoder().encode(chunk))
      }
      controller.close()
    }
  }),
  { headers: { 'Content-Type': 'text/event-stream' } }
)
```

### 2. GatherApp.tsx God Component

**Problem:** 1,548 lines. 35+ useState/useEffect/useCallback calls. Handles AI, navigation, tasks, steps, context, conversations, duplicates, celebrations.

**File:** `src/components/GatherApp.tsx`

**Solution:** Extract into:
- `useAIConversation.ts` - AI card state, conversation history, question flow
- `useTaskNavigation.ts` - View state, task selection, navigation
- `useCelebration.ts` - Confetti, completion celebrations
- `useContextGathering.ts` - Context questions and answers (partially exists)

### 3. No Zod Validation on AI Responses

**Problem:** AI responses are parsed with regex and hope. If AI returns malformed JSON, app crashes.

**Files affected:**
- `src/app/api/chat/route.ts` (lines 199-212)
- `src/app/api/suggest-subtasks/route.ts` (lines 407-424)

**Solution:**
```typescript
import { z } from 'zod'

const ChatResponseSchema = z.object({
  message: z.string(),
  actions: z.array(z.object({
    type: z.enum(['mark_step_done', 'focus_step', 'create_task', 'show_sources']),
    stepId: z.string().optional(),
    title: z.string().optional(),
    label: z.string().optional(),
  })).optional(),
})

// Then validate:
const result = ChatResponseSchema.safeParse(parsed)
if (!result.success) {
  // Return fallback response
}
```

### 4. Rate Limiting Needs Redis

**Problem:** Current in-memory rate limiting doesn't work across serverless instances.

**File:** `src/lib/rateLimit.ts`

**Solution:** Replace Map with Upstash Redis or Vercel KV:
```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 m'),
})
```

### 5. Plaintext Google Tokens

**Problem:** `google_tokens` table stores access and refresh tokens in plaintext.

**File:** `supabase/schema.sql` (lines 233-240)

**Solution:** Use Supabase Vault or encrypt at application layer before storing.

### 6. No Error Tracking

**Problem:** All errors are silently swallowed. Comments say "Error handled silently" everywhere.

**Solution:** Add Sentry or similar:
```bash
npm install @sentry/nextjs
```

---

## Architecture Issues (Full Audit Findings)

### Next.js Patterns

| Issue | Severity | Location |
|-------|----------|----------|
| Entire app is client-rendered | CRITICAL | `src/app/page.tsx` has 'use client' |
| No server components | CRITICAL | 33 of ~78 files have 'use client' |
| No Suspense boundaries | HIGH | No `<Suspense>` usage anywhere |
| Direct fetch instead of Server Actions | HIGH | `GatherApp.tsx` lines 286-294 |

### Data Fetching

| Issue | Severity | Location |
|-------|----------|----------|
| Waterfall loading | CRITICAL | `GatherApp.tsx` - loads sequentially |
| All data fetching client-side | CRITICAL | `useUserData.ts` lines 358-449 |
| No caching headers on API routes | CRITICAL | All route.ts files |
| Demo mode uses localStorage wrong | HIGH | `useUserData.ts` lines 370-404 |

### AI Integration

| Issue | Severity | Location |
|-------|----------|----------|
| No streaming | CRITICAL | All AI routes |
| No Zod validation | CRITICAL | Response parsing in all AI routes |
| No retry logic | HIGH | All AI routes - one failure = game over |
| Voice defined per-route | MEDIUM | 7+ different prompts with different tones |

### Backend/Data

| Issue | Severity | Location |
|-------|----------|----------|
| Zero rate limiting | CRITICAL | All API routes (FIXED this session) |
| Webhook auth bypass | CRITICAL | Gmail/Calendar webhooks (FIXED this session) |
| Plaintext tokens | CRITICAL | `supabase/schema.sql` |
| Race conditions | HIGH | `gmail/webhook/route.ts` lines 158-164 |
| Service role key misuse | HIGH | 9+ files use it unnecessarily |
| Missing indexes | HIGH | tasks.completed_at, tasks.due_date, etc. |

---

## Product Gap Analysis

### What the Product Spec Promises

> "An executive function layer for the rest of us"

### What Actually Exists

A context-aware task breakdown service with scheduled reminders.

### Missing Capabilities

| Feature | Status | Notes |
|---------|--------|-------|
| Predict what you need | Missing | Only reactive to deadlines |
| Intercept failure patterns | Missing | Analyzes but doesn't apply patterns |
| Automate life admin | Partial | Email scan exists, no auto-action |
| Deep integrations | Partial | Gmail/Calendar read-only |
| Learn and adapt | Missing | Weekly reflection exists but isolated |
| Act on your behalf | Missing | No agent actions |

### Features That Should Exist

**Today (MVP+)**
- [x] Instant task capture
- [x] AI breakdown with web search
- [x] Task detail with sub-steps
- [x] Completion animations
- [x] Push notifications
- [ ] Offline support (no service worker)
- [x] Dark mode
- [x] Keyboard shortcuts (partial)

**Near Future**
- [x] Gmail integration (read-only)
- [x] Calendar integration (read-only)
- [ ] Morning briefing
- [x] Weekly reflection
- [ ] Smart reminders (time + context)
- [ ] Voice input
- [ ] Share target

**12-Month Vision**
- [ ] Predictive task creation
- [ ] Automatic completion detection
- [ ] Ambient awareness
- [ ] Agent actions (book, send, etc.)
- [ ] Multi-modal input
- [ ] Local-first AI

---

## Performance Targets

| Metric | Target | Current (Estimated) |
|--------|--------|---------------------|
| First Contentful Paint | < 1.2s | ~2s (no server components) |
| Time to Interactive | < 2s | ~3s (large client bundle) |
| Cumulative Layout Shift | < 0.1 | ~0.2 (loading state shift) |
| Input latency | < 50ms | ~50ms (optimistic updates work) |
| AI response perceived | < 500ms | 5-10s (no streaming) |

---

## Files to Focus On

### High-Priority Refactors

1. `src/components/GatherApp.tsx` - God component, needs splitting
2. `src/app/api/chat/route.ts` - Add streaming
3. `src/app/api/suggest-subtasks/route.ts` - Add streaming, add Zod
4. `src/lib/rateLimit.ts` - Migrate to Redis

### Missing Files That Should Exist

1. `src/lib/ai/prompts.ts` - Centralized AI prompts
2. `src/lib/ai/schemas.ts` - Zod schemas for AI responses
3. `src/lib/ai/streaming.ts` - Streaming utilities
4. `src/hooks/useAIConversation.ts` - Extract from GatherApp
5. `src/hooks/useTaskNavigation.ts` - Extract from GatherApp

---

## Quick Wins for Next Session

1. **Add streaming to /api/chat** (~30 min)
2. **Add Zod schema for chat response** (~15 min)
3. **Extract useAIConversation hook** (~1 hr)
4. **Add Sentry error tracking** (~15 min)
5. **Add missing DB indexes** (~10 min)

---

## Don'ts (From CLAUDE.md)

- Don't add prescriptive sections (morning, habits, play)
- Don't use brown colors
- Don't over-celebrate (no triple emojis)
- Don't guilt trip users
- Don't make modals close without animation
- Don't use linear easing

---

## Commands

```bash
# Type check
npx tsc --noEmit

# Build
npm run build

# Validate all (types, lint, build, tests)
./scripts/validate.sh
```

---

*This document should be updated after each major refactoring session.*
