# Visual Design Audit - Gather App

**Auditor:** Visual Design Agent
**Date:** 2026-01-29
**Methodology:** Exhaustive extraction of all color, typography, spacing, radius, and shadow values from codebase

---

## Color Audit

### CSS Variable Colors (Canonical - globals.css)

| Color | Light Mode | Dark Mode | Purpose | Verdict |
|-------|-----------|-----------|---------|---------|
| `--canvas` | #FAFAFA | #0c0a09 | Page background | ✅ Consistent |
| `--surface` | rgba(0,0,0,0.03) | rgba(255,245,235,0.03) | Subtle layer | ✅ Consistent |
| `--card` | #FFFFFF | #161412 | Card backgrounds | ✅ Consistent |
| `--elevated` | #FFFFFF | #1a1816 | Modals | ✅ Consistent |
| `--subtle` | #F5F5F5 | #141210 | Tinted backgrounds | ✅ Consistent |
| `--text` | #1a1a1a | #F5F5F5 | Primary text | ✅ Consistent |
| `--text-soft` | #5c5c5c | #a0a0a0 | Secondary text | ✅ Consistent |
| `--text-muted` | #9a9a9a | #666666 | Tertiary text | ✅ Consistent |
| `--accent` | #D97556 | #E8A990 | Coral - primary actions | ✅ Consistent |
| `--success` | #6B9080 | #9ECBB3 | Sage - completion | ✅ Consistent |
| `--danger` | #DC6B6B | #f08d82 | Destructive actions | ✅ Consistent |
| `--link` | #4a8cba | #80b4dc | Link color | ✅ Consistent |

### Hard-Coded Colors Found (Violations)

| Color | File | Line | Context | Verdict |
|-------|------|------|---------|---------|
| `#ea580c` | DeadlineBadge.tsx | 61, 71 | Orange-600 for deadlines | ⚠️ Not in system |
| `#ca8a04` | DeadlineBadge.tsx | 81 | Yellow-600 for deadlines | ⚠️ Not in system |
| `#4285F4` | LoginPage.tsx, IntegrationSettings.tsx | 37, 269 | Google blue | ✅ Brand color |
| `#34A853` | LoginPage.tsx, IntegrationSettings.tsx | 41, 273 | Google green | ✅ Brand color |
| `#FBBC05` | LoginPage.tsx, IntegrationSettings.tsx | 45, 277 | Google yellow | ✅ Brand color |
| `#EA4335` | LoginPage.tsx, IntegrationSettings.tsx | 49, 281 | Google red | ✅ Brand color |
| `#0a0a0a` | Checkbox.tsx | 82 | Dark mode text on check | ⚠️ Should use var |
| `#1c1c1c`, `#161616` | StackView.tsx | 491, 501 | Hard-coded gradients | ⚠️ Should use vars |
| `#ffffff`, `#f8f8f8` | StackView.tsx | 492, 502 | Hard-coded gradients | ⚠️ Should use vars |

### HSL Dynamic Gradients (HomeView.tsx, StackView.tsx)

Multiple dynamic HSL gradients based on completion ratios:
- `hsl(30, 35%, 8-11%)` - Dark warm
- `hsl(15-30, 40%, 9-12%)` - Dark coral
- `hsl(240, 25%, 7-9%)` - Dark blue
- `hsl(45-50, 40-60%, 92-95%)` - Light warm
- `hsl(25, 35-55%, 92-95%)` - Light coral
- `hsl(220, 20-30%, 94-96%)` - Light blue

**Verdict:** Dynamic gradients are sophisticated and intentional. Not violations.

### Confetti Colors (Hard-coded palette)
```javascript
['#E07A5F', '#6B9080', '#F4D35E', '#EE6C4D', '#98C1D9', '#81B29A']
```
**Verdict:** ⚠️ Should reference system colors where possible, but acceptable for celebratory animations.

### Color Count Summary

| Category | Count | Target | Verdict |
|----------|-------|--------|---------|
| Core CSS variables | 12 semantic + soft variants | <15 | ✅ PASS |
| Hard-coded hex outside system | 8 | 0 | ⚠️ MINOR |
| Google brand colors | 4 | N/A | ✅ Acceptable |
| Total unique colors used | ~20 | <25 | ✅ PASS |

**Color System Grade: B+**
- Well-organized CSS variable system
- Proper light/dark mode support
- Minor violations in deadline colors and StackView gradients
- Warm coral identity is consistent throughout

---

## Typography Audit

### Font Families

| Font | Purpose | Usage |
|------|---------|-------|
| `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` | Body | Primary |
| `'Fraunces', Georgia, serif` | Display headings | Secondary |

**Verdict:** ✅ Clean two-font system. Fraunces adds personality to display text.

### Font Sizes Found

| Class/Value | Size | Usage Count | Context | Verdict |
|-------------|------|-------------|---------|---------|
| `text-[10px]` | 10px | 2 | DeadlineBadge firm indicator | ⚠️ Too small |
| `text-[11px]` | 11px | 2 | Keyboard shortcuts | ⚠️ Edge case |
| `text-xs` | 12px | ~45 | Labels, badges, hints | ✅ Appropriate |
| `text-sm` | 14px | ~55 | Secondary text, body | ✅ Primary body |
| `text-base` | 16px | ~12 | Primary text | ✅ Good |
| `text-lg` | 18px | ~15 | Modal titles, steps | ✅ Good |
| `text-xl` | 20px | ~8 | Task titles, headings | ✅ Good |
| `text-2xl` | 24px | ~6 | Major headings | ✅ Good |
| `text-3xl` | 30px | ~3 | App title, level up | ✅ Good |
| `text-4xl` | 36px | ~2 | Level number | ✅ Good |
| `text-5xl` | 48px | 1 | Success checkmark | ✅ Good |
| `text-[0.7rem]` | 11.2px | 1 | Superscript reference | ⚠️ Custom |
| `text-[0.8rem]` | 12.8px | 4 | Email modal labels | ⚠️ Custom |
| `text-[0.85rem]` | 13.6px | 3 | Email modal body | ⚠️ Custom |
| `text-[0.9rem]` | 14.4px | 4 | Email modal inputs | ⚠️ Custom |
| `text-[17px]` | 17px | 1 | Stack button | ⚠️ Custom |
| `text-[28px]` | 28px | 2 | Stack card title | ⚠️ Custom |

### Font Weights Found

| Weight | Usage Count | Context |
|--------|-------------|---------|
| `font-normal` (400) | ~5 | Input text |
| `font-medium` (500) | ~45 | Primary buttons, labels |
| `font-semibold` (600) | ~20 | Headings, emphasis |
| `font-bold` (700) | ~12 | Game UI, level up |

**Verdict:** Weight hierarchy is clear: normal → medium → semibold → bold

### Typography Violations

| Issue | Location | Severity |
|-------|----------|----------|
| Custom `text-[0.8rem]` etc | EmailModal.tsx | ⚠️ Should use system |
| `text-[10px]` too small | DeadlineBadge.tsx | ⚠️ Accessibility concern |
| Inconsistent between `text-[28px]` and `text-2xl` | StackView.tsx | ⚠️ Should standardize |

### Typography Summary

| Metric | Count | Target | Verdict |
|--------|-------|--------|---------|
| Unique font sizes (standard) | 9 | <10 | ✅ PASS |
| Unique font sizes (custom) | 7 | 0 | ⚠️ MINOR |
| Font weights used | 4 | <5 | ✅ PASS |
| Font families | 2 | <3 | ✅ PASS |

**Typography Grade: B**
- Good Tailwind scale usage
- Clear hierarchy
- Custom sizes in EmailModal should be cleaned up
- 10px text is accessibility concern

---

## Spacing Audit

### Spacing Values Found (Tailwind)

| Class | Value | Usage | Verdict |
|-------|-------|-------|---------|
| `gap-1` | 4px | ~15 | ✅ Tight |
| `gap-1.5` | 6px | ~8 | ✅ Small |
| `gap-2` | 8px | ~40 | ✅ Standard |
| `gap-2.5` | 10px | ~5 | ⚠️ Non-standard |
| `gap-3` | 12px | ~20 | ✅ Medium |
| `gap-4` | 16px | ~8 | ✅ Large |
| `p-1` to `p-6` | 4-24px | ~100+ | ✅ Standard |
| `px-2` to `px-6` | 8-24px | ~50+ | ✅ Standard |
| `py-0.5` to `py-4` | 2-16px | ~40+ | ✅ Standard |
| `m-1` to `m-6` | 4-24px | ~30 | ✅ Standard |
| `mb-1` to `mb-6` | 4-24px | ~40+ | ✅ Standard |
| `mt-0.5` to `mt-6` | 2-24px | ~20 | ✅ Standard |
| `space-y-3`, `space-y-4` | 12px, 16px | ~5 | ✅ Standard |

### Spacing Scale Adherence

Using standard Tailwind 4px base scale: `4, 8, 12, 16, 20, 24, 32, 48`

**Verdict:** ✅ Spacing is systematic and consistent with Tailwind defaults.

**Spacing Grade: A**
- Adheres to 4px grid
- Uses standard Tailwind classes
- No magic numbers in spacing

---

## Border Radius Audit

### Radius Values Found

| Class | Value | Usage Count | Context |
|-------|-------|-------------|---------|
| `rounded` | 4px | ~8 | Loading skeletons |
| `rounded-sm` | 2px | ~6 | Small badges, tags |
| `rounded-md` | 6px | ~25 | Buttons, dropdowns |
| `rounded-lg` | 8px | ~20 | Cards, inputs |
| `rounded-xl` | 12px | ~15 | Large cards, game UI |
| `rounded-2xl` | 16px | ~12 | Modals, main input |
| `rounded-full` | 9999px | ~40 | Pills, avatars, dots |
| `rounded-[24px]` | 24px | 3 | Stack card container |
| `rounded-[26px]` | 26px | 1 | Stack success overlay |

### Radius Consistency

| Defined in CSS | Value | Actually Used |
|----------------|-------|---------------|
| `--radius-sm` | 6px | Rarely |
| `--radius-md` | 8px | Rarely |

**Issue:** CSS variables `--radius-sm` and `--radius-md` are defined but components use Tailwind classes directly. The values don't match:
- CSS: 6px, 8px
- Tailwind: sm=2px, md=6px, lg=8px, xl=12px, 2xl=16px

### Radius Violations

| Issue | Location |
|-------|----------|
| `rounded-[24px]` custom | StackView.tsx |
| `rounded-[26px]` custom | StackView.tsx |
| CSS vars not matching Tailwind | globals.css vs usage |

**Radius Grade: B-**
- Too many radius values (9 distinct)
- Target: 4-5 values max
- Custom values in StackView
- CSS variables don't align with Tailwind usage

---

## Shadow Audit

### Shadow Values Found

| Shadow | Usage Count | Context |
|--------|-------------|---------|
| `shadow-sm` | ~8 | Cards, buttons |
| `shadow-md` | ~6 | Dropdowns, hover states |
| `shadow-lg` | ~3 | Notifications, modals |
| `shadow-modal` | ~2 | Modal backdrop |
| `shadow-elevated` | ~2 | Focus mode |
| CSS var `--shadow-xs` to `--shadow-lg` | Defined | Base system |

### Hard-coded Shadows

| Shadow | File | Verdict |
|--------|------|---------|
| `0 4px 20px rgba(0,0,0,0.08)` | StackView.tsx | ⚠️ Should use var |
| `0 2px 12px rgba(0,0,0,0.06)` | StackView.tsx | ⚠️ Should use var |
| `0 2px 4px rgba(0,0,0,0.2)...` | StackView.tsx | ⚠️ Complex inline |
| `0 2px 8px rgba(217,117,86,0.25)` | StackView.tsx | ⚠️ Accent shadow |

**Shadow Grade: B**
- Good CSS variable foundation
- Some inline shadow overrides
- Warm-tinted shadows are a nice touch

---

## Consistency Failures

### Components That Don't Match

1. **StackView.tsx** - Uses inline styles with hard-coded colors, shadows, and radii instead of CSS variables
2. **DeadlineBadge.tsx** - Uses Tailwind colors (`orange-600`, `yellow-600`) outside the design system
3. **EmailModal.tsx** - Uses custom font sizes (`text-[0.8rem]`) instead of standard scale
4. **Checkbox.tsx** - Hard-coded `#0a0a0a` instead of CSS variable

### Pattern Inconsistencies

| Element | Pattern 1 | Pattern 2 |
|---------|-----------|-----------|
| Card radius | `rounded-lg` (8px) | `rounded-xl` (12px) |
| Button radius | `rounded-md` (6px) | `rounded-lg` (8px) |
| Modal radius | `rounded-2xl` (16px) | Consistent ✅ |

---

## Polish Failures

### What Looks Unfinished

1. **EmailModal** - Uses non-standard font sizes, feels like a prototype
2. **DeadlineBadge** - Uses Tailwind utility colors instead of semantic system colors
3. **GameUI** - Heavy use of Tailwind gradients (`from-orange-500 to-red-500`) outside the coral palette

### What Looks Over-Designed

1. **Dynamic HSL gradients** - Complex but intentional for emotional feedback
2. **Multiple breathing animations** - Input breathing, card breathing - could be simplified
3. **Confetti system** - Well-executed, appropriate celebration

---

## ADHD-Specific Visual Concerns

| Concern | Assessment |
|---------|------------|
| Contrast | ✅ Good - text colors have sufficient contrast |
| Interactive distinction | ✅ Good - buttons clearly differentiated from static |
| Information density | ✅ Good - appropriate whitespace, not overwhelming |
| Visual rewards | ✅ Excellent - confetti, checkmark animations, warm success states |
| Focus indicators | ✅ Good - coral accent on focus |
| Calm vs. stimulating | ✅ Good - warm neutrals with controlled accent pops |

**ADHD UX Grade: A**
- Warm, calming palette reduces anxiety
- Clear visual hierarchy aids focus
- Satisfying completion animations provide dopamine hits
- Not overwhelming or cluttered

---

## Brutal Assessment

This looks like a **product, not a hackathon project**. The design system is thoughtfully constructed with:

1. **Real semantic intention** - Colors named by purpose (success, danger, accent), not appearance
2. **Light/dark mode parity** - Both modes are fully considered, not dark mode as afterthought
3. **Warm personality** - The coral accent and warm shadows create emotional warmth
4. **Proper layering** - Canvas → Surface → Card → Elevated creates depth

However, there's **leakage and drift**:
- StackView has grown into its own mini-design-system with inline styles
- DeadlineBadge uses Tailwind colors outside the system
- EmailModal feels like it was built before the design system existed

The foundation is solid (globals.css + tokens.ts), but enforcement is inconsistent.

---

## Visual Identity

### Does This App Have a Distinctive Look?

**Yes.** The visual identity is:

1. **Warm coral accent (#D97556)** - Distinctive, not the typical blue/purple SaaS look
2. **Warm-tinted shadows** - `rgba(120, 80, 60, 0.x)` gives warmth even to depth
3. **Sage green for success** - Calming alternative to harsh green
4. **Fraunces serif for display** - Adds personality and warmth
5. **Notion-inspired minimalism** - Clean, functional, not decorative

**What IS the visual brand?**

> "A warm, calming workspace that feels like a supportive friend, not a corporate tool. The coral accent is energizing but not aggressive. The sage green celebrates without overwhelming. Everything breathes."

**Is it generic?** No. The combination of coral + sage + warm shadows + Fraunces creates a recognizable aesthetic. This wouldn't be confused with Todoist, Things, or Notion.

---

## Summary Scores

| Category | Grade | Notes |
|----------|-------|-------|
| Color System | B+ | Well-organized, minor violations |
| Typography | B | Good scale, some custom sizes to clean up |
| Spacing | A | Consistent 4px grid |
| Border Radius | B- | Too many values, misaligned CSS vars |
| Shadows | B | Good foundation, inline overrides |
| Consistency | B- | StackView and EmailModal need alignment |
| Polish | B+ | Mostly finished, few rough edges |
| ADHD UX | A | Thoughtfully calming |
| Visual Identity | A | Distinctive, warm, memorable |

**Overall Visual Design Grade: B+**

The design system is well-conceived and mostly well-executed. Main improvements needed:
1. Align StackView with CSS variable system
2. Replace hard-coded colors in DeadlineBadge
3. Standardize EmailModal typography
4. Consolidate border radius values to 4-5
