# Agent Rules for Gather

> **Source of truth:** Edit this file only. `.cursorrules` is auto-synced via pre-commit hook.
> **Review quarterly:** Check if these rules still align with `gather-product-spec.md`.

## Target User

Building for people with ADHD or executive function challenges. Every decision should reduce cognitive load, not add to it.

---

## Core Philosophy

**"Dump it here — I'll make it doable."**

- This is NOT a todo app. It's a collaboration tool between the user and AI.
- No prescriptive life categories (no default "habits", "rituals", "play" sections)
- AI breaks down tasks AND stays available to help when users get stuck
- Every completion is acknowledged, but not excessively
- Never guilt trip users about incomplete tasks

---

## UX Rules (Non-Negotiable)

1. **Zero friction** - Show the action button, not just the task. Pre-fill everything possible.
2. **Break down walls** - Big tasks paralyze. Always offer to decompose into small, concrete steps.
3. **One thing at a time** - Avoid decision paralysis. Limit choices, clear hierarchy, single primary action per view.
4. **Infer over ask** - Auto-detect completion when possible. If you must ask, do it conversationally, not with checkboxes.
5. **Compassion, not corporate** - No wellness buzzwords, no excessive emoji, no "Great job! 🌟". Speak like a trusted friend.
6. **Proactive, not reactive** - The app reaches out first. Don't wait for the user to remember.

---

## Design Tokens

### Colors (Light Mode)
```
canvas: #FAFAFA (page background)
surface: rgba(0,0,0,0.03) (subtle card backgrounds)
elevated: #FFFFFF (modals, prominent cards)
text: #171717 (primary text)
textSoft: #525252 (secondary text)
textMuted: #a3a3a3 (placeholders, hints)
accent: #E07A5F (coral — actions, buttons, focus)
success: #6B9080 (sage — completion only)
danger: #DC6B6B (delete actions)
```

### Colors (Dark Mode)
```
canvas: #0a0a0a
elevated: #141414
accent: #E8A990 (lighter coral)
success: #9ECBB3
```

### Typography
- System font stack: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif
- Input text: 20px medium
- Task titles: 16px semibold
- Body: 14px normal
- Labels/hints: 12-13px

### Border Radius
- Small elements: 6-8px
- Inputs/rows: 10px
- Buttons: 12px
- Cards: 16px
- Modals/main input: 20px

### Motion
- Standard: `transition: all 0.2s ease`
- Spring: `transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)`
- Modal open: spring, 350ms
- Modal close: ease, 250ms
- Button press: scale(0.95-0.98)

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
- Tailwind for styling with CSS variables for colors
- Use the new Checkbox, SegmentedProgress, and Confetti components

---

## Don'ts

- Don't add prescriptive sections (morning, habits, play, etc.)
- Don't use brown colors — we explicitly moved away from that
- Don't over-celebrate (no triple emojis, no "AMAZING!!!")
- Don't guilt trip ("You have 5 overdue tasks!")
- Don't make modals close without animation
- Don't use linear easing — always ease-out or spring

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
- `pivot/GATHER_DESIGN_SYSTEM.md` - Complete design system reference
- `TESTING.md` - Testing guide and helpers
- `supabase/schema.sql` - Database schema
