# Agent Rules for Gather

> **Source of truth:** Edit this file only. `.cursorrules` is auto-synced via pre-commit hook.
> **Review quarterly:** Check if these rules still align with `gather-product-spec.md`.

## Target User

Building for people with ADHD or executive function challenges. Every decision should reduce cognitive load, not add to it.

---

## UX Rules (Non-Negotiable)

1. **Zero friction** - Show the action button, not just the task. Pre-fill everything possible.
2. **Break down walls** - Big tasks paralyze. Always offer to decompose into small, concrete steps.
3. **One thing at a time** - Avoid decision paralysis. Limit choices, clear hierarchy, single primary action per view.
4. **Infer over ask** - Auto-detect completion when possible. If you must ask, do it conversationally, not with checkboxes.
5. **Compassion, not corporate** - No wellness buzzwords, no excessive emoji, no "Great job! 🌟". Speak like a trusted friend.
6. **Proactive, not reactive** - The app reaches out first. Don't wait for the user to remember.

---

## Development Rules

1. **Always add Playwright tests** - Every new feature needs e2e tests. See `TESTING.md` for patterns and helpers.
2. **Mobile-first** - Test at 375px minimum. This is primarily a phone app.
3. **Loading states** - Every async action needs visible feedback.
4. **Error states** - Every failure needs a clear recovery path, not just an error message.
5. **No dead ends** - Every screen should have a clear next action or way out.

---

## Code Patterns

- Use existing components in `src/components/` before creating new ones
- Follow the modal pattern in `Modal.tsx` for overlays
- Use `useUserData` hook for data access
- Tailwind for styling, match existing color palette and spacing

---

## Voice & Tone (for AI-generated text)

- Warm but direct
- Lowercase for casual, proper sentences for serious
- Notice patterns, say them out loud
- Never shame, but don't enable avoidance either
- Brief. No walls of text.

---

## Before Submitting Changes

```bash
./scripts/validate.sh
```

This runs type checking, linting, build, and all e2e tests.

---

## Key Documentation

- `gather-product-spec.md` - Full product vision, user profile, feature roadmap
- `TESTING.md` - Testing guide and helpers
- `supabase/schema.sql` - Database schema
