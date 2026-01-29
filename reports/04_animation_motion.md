# Animation & Motion Audit Report
**Date:** 2026-01-29
**Scope:** Complete animation inventory and motion analysis for Gather app

---

## Animation Inventory

### Keyframe Animations (CSS)

| Name/Location | Type | Duration | Easing | Properties | GPU? | Verdict |
|---------------|------|----------|--------|------------|------|---------|
| `loginFadeIn` (globals.css:262) | entrance | 0.4-0.5s | ease-out | opacity, transform | ✅ | Good - staggered for visual interest |
| `cursorBlink` (globals.css:282) | loading | 1s | step-end infinite | opacity | ✅ | Good - classic cursor effect |
| `bounce` (globals.css:304) | loading | 1.4s | ease-in-out infinite | transform (translateY) | ✅ | Good - staggered dots |
| `fadeIn` (globals.css:315) | entrance | 120ms | ease-out | opacity, transform | ✅ | Good - snappy |
| `fadeOut` (globals.css:319) | exit | 120ms | ease-in | opacity, transform | ✅ | Good |
| `riseIn` (globals.css:327) | entrance | 120ms | ease-out | opacity, transform | ✅ | Good - used for stagger lists |
| `floaty` (globals.css:336) | ambient | 10-18s | ease-in-out infinite | transform (translate3d) | ✅ | Good - GPU hint with translate3d |
| `checkPulse` (globals.css:356) | success | 120ms | ease-out | transform (scale) | ✅ | Good |
| `checkPop` (globals.css:361) | celebration | 0.4s | spring | transform (scale) | ✅ | **Excellent** - juicy spring bounce |
| `checkBurst` (globals.css:371) | celebration | 0.5s | ease-out | transform, opacity | ✅ | **Excellent** - success burst ring |
| `stepComplete` (globals.css:403) | success | 0.3s | ease-out | transform, background-color | ⚠️ | Okay - bg-color causes repaint |
| `inputBreathe` (globals.css:464) | ambient | 4s | ease-in-out infinite | box-shadow, border-color | ⚠️ | Marginal - paint-heavy |
| `shimmer` (globals.css:519) | loading | 1.2s | ease-in-out infinite | transform (translateX) | ✅ | Good - skeleton loading |
| `confettiFall` (globals.css:527) | celebration | 2-4s | ease-in | transform, opacity | ✅ | **Excellent** - full confetti system |
| `affirmationIn` (globals.css:540) | celebration | implicit | implicit | opacity, transform | ✅ | Good - task completion overlay |
| `emptyStateIn` (globals.css:556) | entrance | implicit | implicit | opacity, transform | ✅ | Good |
| `cardRise` (globals.css:568) | transition | implicit | implicit | transform | ✅ | Good - card promotion effect |
| `cardBreathe` (globals.css:588) | ambient | implicit | implicit | transform | ✅ | Good - subtle idle life |
| `urgentPulse` (globals.css:598) | attention | implicit | implicit | box-shadow | ⚠️ | Okay - paint but subtle |
| `holdProgressFill` (globals.css:618) | progress | 500ms | linear | transform (scaleX) | ✅ | Good - CSS-only, no React state |

### Tailwind Keyframe Animations (tailwind.config.ts)

| Name | Duration | Easing | Properties | GPU? | Verdict |
|------|----------|--------|------------|------|---------|
| `fadeUp` | 200ms | ease-out | opacity, transform | ✅ | Good |
| `modalIn` | 220ms | ease-out | opacity, transform (scale + translate) | ✅ | Good - snappy modal |
| `modalOut` | 200ms | ease-in | opacity, transform | ✅ | Good |
| `backdropIn/Out` | 180ms | ease-out/in | opacity | ✅ | Good |
| `float` | 1.5s | ease-in-out infinite | transform | ✅ | Good |
| `dotPulse` | 900ms | ease-in-out infinite | transform, opacity | ✅ | Good |
| `celebrateIn` | 300ms | ease-out | opacity, transform | ✅ | Good |

### Component-Specific Animations

| Component | Animation | Duration | Easing | Properties | GPU? | Verdict |
|-----------|-----------|----------|--------|------------|------|---------|
| Confetti.tsx | `completionPop` | 400ms | spring (0.34, 1.56, 0.64, 1) | opacity, transform | ✅ | **Excellent** |
| AICard.tsx | `thinkingPulse` | 1.4s | ease-in-out infinite | opacity, transform | ✅ | Good |
| SegmentedProgress.tsx | `segmentPulse` | 600ms | ease-out | opacity, transform (scaleX) | ✅ | Good |

---

## Easing Curves Used

| Alias | Value | Usage | Consistency |
|-------|-------|-------|-------------|
| `--ease-out` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | Default for most transitions | ✅ Consistent |
| `--ease-in-out` | `cubic-bezier(0.45, 0, 0.55, 1)` | Ambient/infinite animations | ✅ Consistent |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exit animations | ✅ Consistent |
| `spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Celebration/juicy moments | ✅ Consistent |
| `linear` | linear | Only holdProgressFill (appropriate) | ✅ Appropriate |
| `step-end` | step-end | Only cursor blink (appropriate) | ✅ Appropriate |

**Assessment:** Only 4 main easing curves (plus 2 specialty). This is **excellent consistency**.

---

## Duration Scale

| Duration | CSS Variable | Common Usage | Count |
|----------|--------------|--------------|-------|
| 80ms | `--duration-fast` | Micro-interactions, hover states | ~15 |
| 120ms | `--duration-base` | Standard transitions | ~10 |
| 150ms | hardcoded | Button/icon transitions | ~12 |
| 180ms | `--duration-slow` | Backdrop fade | 2 |
| 200ms | hardcoded | Checkbox, opacity fades | ~8 |
| 300ms | hardcoded | Progress bars, step complete | ~4 |
| 400ms-500ms | hardcoded | Celebration pop, hold complete | ~5 |
| 700ms | hardcoded | Ambient background transitions | 3 |

**Assessment:**
- ⚠️ **Inconsistency issue:** 80ms vs 150ms vs 200ms are too close and used interchangeably
- Should consolidate to: **80ms (fast), 150ms (base), 300ms (slow), 500ms (dramatic)**
- The 700ms ambient transitions feel right for background mood shifts

---

## Performance Concerns

### Paint-Heavy Animations (Minor Concerns)
| Animation | Property | Impact | Recommendation |
|-----------|----------|--------|----------------|
| `inputBreathe` | box-shadow, border-color | Repaint every frame for 4s | Consider reducing or removing |
| `urgentPulse` | box-shadow | Repaint on urgent cards | Acceptable - only urgent cards |
| `stepComplete` | background-color | Single repaint | Acceptable - one-shot |
| `justFilled` segment glow | box-shadow | 0.6s glow | Acceptable - celebration |

### JS Animation Patterns
| Pattern | Location | Quality |
|---------|----------|---------|
| `requestAnimationFrame` for drag | StackView.tsx:302 | ✅ **Excellent** - proper 60fps |
| `setTimeout` for hold complete | StackView.tsx:385 | ✅ Good - single timeout, no polling |
| `setTimeout` for typewriter | UnifiedInput.tsx:236+ | ⚠️ Okay - could use RAF for smoother |
| `setInterval` for loading messages | AICard.tsx:89 | ✅ Good - 3s interval, low impact |

---

## Missing Animations

| Interaction | Current State | Should Have | Priority |
|-------------|---------------|-------------|----------|
| Button press feedback | CSS scale(0.98) via `.btn-press` | ✅ Already has | - |
| Input focus | Box-shadow glow | ✅ Already has | - |
| Task deletion | None visible | Swipe-out or fade-out | Medium |
| Undo toast | Not implemented | Slide-up + fade | Low |
| List reorder drag | Not implemented | Item lift + shadow | Low |
| Settings toggle | Instant | Smooth toggle slide | Low |

**Assessment:** All critical animations exist. Missing animations are edge cases.

---

## Gratuitous Animations

| Animation | Location | Issue | Recommendation |
|-----------|----------|-------|----------------|
| `inputBreathe` | Main input | 4s infinite might be distracting | Consider subtler or on-demand |
| `floaty` background elements | Login page | 10-18s is very slow - barely perceptible | Keep - subtle ambient life |
| 700ms ambient transition | HomeView/StackView | Noticeable delay on theme changes | Keep - intentional mood shift |

**Assessment:** No truly gratuitous animations. The app errs on the side of subtlety.

---

## Reward Moment Audit

| Moment | Has Animation? | Components | Satisfaction Level (1-5) |
|--------|----------------|------------|--------------------------|
| **Step complete** | ✅ Yes | Checkbox pop, burst ring, step row flash | **4/5** - satisfying |
| **Task complete** | ✅ Yes | Checkbox animation + card swipe-up | **4/5** - good exit |
| **All steps done** | ✅ Yes | Last checkbox + potential confetti | **4/5** - celebration exists |
| **Stack card done** | ✅ Yes | Exit up + affirmation text + bounce | **5/5** - excellent dopamine |
| **All cards cleared** | ✅ Yes | Scale-up + bounce emoji + message | **5/5** - earned moment |
| **Task created** | ✅ Yes | CompletionCelebration with pop + confetti | **5/5** - joyful |
| **Quick add** | ⚠️ Partial | Input clears but no confirmation animation | **3/5** - needs brief flash |
| **Swipe dismiss** | ✅ Yes | Card exits with rotation + spring snap-back | **5/5** - tactile |

**Average Satisfaction: 4.3/5** - Strong reward system

---

## ADHD-Specific Motion Assessment

### Dopamine Hits
| Feature | Provides Dopamine? | Notes |
|---------|-------------------|-------|
| Checkbox completion | ✅ Yes | Pop + burst + color fill |
| Card swipe up | ✅ Yes | Affirmation + satisfying exit |
| Progress segments | ✅ Yes | Sequential fill with glow |
| Confetti | ✅ Yes | Full celebration when appropriate |
| Stack clear | ✅ Yes | Celebration state with message |

### Loading Engagement
| Loading State | Engaging? | Notes |
|---------------|-----------|-------|
| AI thinking | ✅ Yes | Pulsing dots + rotating messages |
| Skeleton shimmer | ✅ Yes | Continuous movement holds attention |
| Cursor blink | ✅ Yes | Familiar, expected |

### Speed for Impatient Users
| Animation | Too Slow? | Notes |
|-----------|-----------|-------|
| Modal open/close | ✅ No - 220ms | Snappy |
| Checkbox | ✅ No - 400ms total | Satisfying but quick |
| Card transitions | ✅ No - 350ms spring | Feels instant but alive |
| Ambient background | ⚠️ Maybe - 700ms | Could feel laggy on rapid changes |

---

## Technical Quality Summary

| Aspect | Status | Details |
|--------|--------|---------|
| GPU-accelerated properties | ✅ **Excellent** | 95%+ use transform/opacity |
| No layout thrashing | ✅ **Excellent** | No width/height/top/left animations |
| Duration consistency | ⚠️ **Needs work** | Too many similar values (80/150/200) |
| Easing consistency | ✅ **Excellent** | Only 4 core curves |
| Reduced motion support | ✅ **Excellent** | Full `prefers-reduced-motion` support |
| Animation interruptibility | ✅ **Good** | Most can be interrupted |
| JS implementation | ✅ **Good** | RAF for drag, minimal setTimeout abuse |

---

## Brutal Assessment

**Does the motion make this app feel alive or like a dead prototype?**

The motion system is **genuinely good**. This is not a dead prototype - it's an app that someone has clearly thought about. The card interactions in StackView feel tactile and satisfying. The checkbox celebration is one of the best I've seen in a todo app. The spring easing creates personality without being annoying.

**What's excellent:**
- Spring easing on completions creates dopamine hits
- Card swipe physics feel natural
- Consistent easing language throughout
- Reduced motion support built in
- No layout-thrashing properties
- Proper RAF usage for drag interactions

**What could be better:**
- Duration scale is messy (consolidate 80/150/200 into clearer tiers)
- The `inputBreathe` animation runs forever and might be distracting
- Quick-add could use a brief success flash

**For an ADHD app specifically:** This motion system **passes**. The reward moments are appropriately dopaminergic without being childish. The animations are fast enough not to frustrate impatient users. The hold-to-complete interaction with visual progress is particularly good for providing feedback during intentional action.

---

## The Feel

Based on code analysis, the motion profile is: **Smooth with personality**

- Not janky (proper RAF, GPU properties)
- Not robotic (spring easings, celebration moments)
- Not over-animated (subtle ambient, quick micro-interactions)
- Occasionally delightful (checkbox burst, stack completion)

The animations serve the interaction rather than showing off. This is mature motion design.

---

## Recommendations

### High Priority
1. **Consolidate duration scale** - Pick 4 values: 80ms, 150ms, 300ms, 500ms
2. **Add quick-add success feedback** - Brief flash when task added

### Medium Priority
3. **Review inputBreathe** - Consider making it trigger only on empty input focus
4. **Document the motion system** - Create a motion style guide

### Low Priority
5. **Add task deletion animation** - Fade out or swipe away
6. **Consider haptic feedback** - On iOS for completions (via navigator.vibrate)
