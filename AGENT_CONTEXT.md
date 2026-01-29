# Agent Context for Gather

> **Purpose:** This file provides complete context for AI agents to autonomously iterate on Gather.
> Read this before making any changes. Update this file when you learn something new.

## Quick Start for Agents

```bash
# 1. Run quality scorecard to understand current state
npx playwright test quality-scorecard.spec.ts

# 2. Check what needs improvement
cat e2e-screenshots/scorecard/report.md

# 3. Run full UX audit before/after changes
npx playwright test ux-audit.spec.ts

# 4. Validate all changes
./scripts/validate.sh
```

## App Overview

**Gather** is a task management app designed for people with ADHD or executive function challenges.

**Core Philosophy:** "Dump it here — I'll make it doable."
- NOT a todo app - it's a collaboration tool between user and AI
- AI breaks down tasks AND stays available when users get stuck
- Zero friction, one thing at a time, compassion not corporate

**Target User:** People who:
- Get overwhelmed by traditional todo apps
- Need tasks broken into tiny, concrete steps
- Benefit from gentle nudges, not guilt trips
- Struggle with decision paralysis

## Architecture

```
src/
├── app/                    # Next.js app router
│   ├── page.tsx           # Login/landing
│   └── globals.css        # CSS variables, base styles
├── components/
│   ├── GatherApp.tsx      # Main app shell, view routing
│   ├── StackView.tsx      # Card stack UI (primary view)
│   ├── HomeView.tsx       # List view (secondary)
│   ├── TaskView.tsx       # Task detail view
│   ├── AICard.tsx         # AI response/conversation card
│   ├── ThemeProvider.tsx  # Dark mode handling
│   └── ...
├── lib/
│   ├── supabase.ts        # Database client
│   └── types.ts           # TypeScript types
└── hooks/
    └── useUserData.ts     # Data fetching hook
```

## Key Files to Know

| File | What it does | When to modify |
|------|--------------|----------------|
| `CLAUDE.md` | Design system, UX rules | When changing design tokens or UX patterns |
| `StackView.tsx` | Main card UI | Most visual changes |
| `AICard.tsx` | AI conversation UI | AI response formatting |
| `globals.css` | CSS variables | Color/spacing changes |
| `supabase/schema.sql` | Database schema | Data model changes |

## Design System

### Colors (CSS Variables)
```css
/* Light mode */
--canvas: #FAFAFA;      /* Page background */
--surface: rgba(0,0,0,0.03);
--card: #FFFFFF;
--text: #1a1a1a;
--text-soft: #5c5c5c;   /* Secondary text - use for subtitles */
--text-muted: #9a9a9a;  /* Hints only - low contrast */
--accent: #D97556;      /* Coral - CTAs */
--success: #6B9080;     /* Completion only */
```

### Touch Targets
All buttons must be minimum 44x44px:
```tsx
className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center"
```

### Animations
- Standard: `transition-all duration-150`
- Spring: `transition-all duration-300 cubic-bezier(0.34, 1.56, 0.64, 1)`
- Button press: add `btn-press` class

## Testing Strategy

### 1. UX Audit (Hypercritical)
```bash
npx playwright test ux-audit.spec.ts
```
- Hard failures when CLAUDE.md requirements aren't met
- Checks: touch targets, contrast, tone, truncation, a11y, performance

### 2. Quality Scorecard
```bash
npx playwright test quality-scorecard.spec.ts
```
- Generates improvement priorities
- Outputs: `e2e-screenshots/scorecard/report.md`

### 3. Full Validation
```bash
./scripts/validate.sh
```
- TypeScript, ESLint, build, all e2e tests

## Common Tasks

### Adding a New Feature
1. Read `gather-product-spec.md` for product context
2. Run quality scorecard to understand current state
3. Implement feature
4. Add e2e test in appropriate file
5. Run full validation
6. Update this file if you learned something

### Fixing a UX Issue
1. Run `npx playwright test ux-audit.spec.ts` - see what fails
2. Read the error message - it tells you exactly what to fix
3. Make the fix
4. Re-run the specific test
5. Run full suite to ensure no regressions

### Improving Performance
1. Run quality scorecard - check Performance section
2. Use browser DevTools Lighthouse
3. Common fixes:
   - Image optimization
   - Code splitting
   - Reducing bundle size
   - Caching

## Anti-Patterns (Don't Do These)

| Don't | Do Instead |
|-------|------------|
| `text-[var(--text-muted)]` for readable text | `text-[var(--text-soft)]` - better contrast |
| `p-2` on buttons | `p-3 min-w-[44px] min-h-[44px]` |
| Guilt-tripping ("overdue", "you haven't") | Neutral or supportive language |
| Over-celebration ("AMAZING!!!") | Brief, warm acknowledgment |
| Dead-end errors ("Something went wrong") | Error + recovery action |
| `waitForTimeout(5000)` in tests | `waitForSelector` or `waitForLoadState` |

## Improvement Areas (Auto-Updated)

Check `e2e-screenshots/scorecard/report.md` for current priorities.

Common areas that need ongoing attention:
1. **Accessibility** - Focus indicators, ARIA labels, contrast
2. **Mobile polish** - Touch targets, gesture support
3. **Loading states** - Every async action needs feedback
4. **Error handling** - Every error needs recovery path
5. **Animation timing** - Match CLAUDE.md specs

## How to Contribute

1. **Before coding:** Run quality scorecard, understand current state
2. **While coding:** Follow patterns in CLAUDE.md strictly
3. **After coding:** Run UX audit, all tests must pass
4. **Commit message:** Describe what changed and why

## Known Limitations

- Demo mode only - no real authentication in tests
- AI responses are from actual API - may vary
- Screenshots may differ slightly between runs (time-based content)

## Resources

- `CLAUDE.md` - Complete design system and UX rules
- `gather-product-spec.md` - Product vision and roadmap
- `TESTING.md` - Testing patterns and helpers
- `pivot/GATHER_DESIGN_SYSTEM.md` - Extended design reference
