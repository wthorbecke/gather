# Interaction Design Audit Report

**Date:** 2026-01-29
**Auditor:** Agent 2 - Interaction Design Specialist
**Method:** Playwright MCP automation with timing instrumentation

---

## Interaction Inventory

| Element | Location | Trigger | Feedback | Time | Verdict |
|---------|----------|---------|----------|------|---------|
| Continue with Google | Welcome | Click | Visual press | N/A | Works |
| Try the demo first | Welcome | Click | Visual press, navigates | 5.6ms | ✅ Pass |
| Dark mode toggle | Header | Click | Icon changes, theme shifts | ~15ms | ✅ Pass |
| Light mode toggle | Header | Click | Icon changes, theme shifts | ~15ms | ✅ Pass |
| Integrations button | Header | Click | Opens modal | 11.8ms | ✅ Pass |
| Close modal (×) | Integrations modal | Click | Modal closes | **786.6ms** | 🔴 FAIL |
| List view toggle | Toolbar | Click | View switches | 21.4ms | ✅ Pass |
| Stack view toggle | Toolbar | Click | View switches | 13.3ms | ✅ Pass |
| Exit demo button | Toolbar | Click | Exits to welcome | ~15ms | ✅ Pass |
| Add task button (+) | Toolbar | Click | Opens/closes input | ~13ms | ✅ Pass |
| Main input (empty state) | Home | Click | **BLOCKED** | N/A | 🔴 FAIL |
| Main input (empty state) | Home | Focus/type | Works via keyboard | ~10ms | ✅ Pass |
| Input submit | Home | Enter key | Shows AI processing | ~20ms | ✅ Pass |
| **Done button (Stack view)** | Stack card | **Click** | **NO ACTION** | 12.3ms | 🔴 FAIL |
| Done button (Stack view) | Stack card | Hold 500ms | Completes step | ~75ms | ⚠️ Undiscoverable |
| Swipe to skip | Stack card | Drag | Card dismisses | ~30ms | ✅ Pass |
| Checkbox (List view) | Task item | Click | Toggles, updates count | 9.8ms | ✅ Pass |
| Task item row | List view | Click | Opens task detail | **145.8ms** | 🔴 FAIL |
| Checkbox (Task detail) | Step list | Click | Toggles step | 15.4ms | ✅ Pass |
| Expand arrow | Step item | Click | Expands/collapses | 12.9ms | ✅ Pass |
| Focus button | Expanded step | Click | Opens focus mode | 15.2ms | ✅ Pass |
| I'm stuck button | Expanded step | Click | Opens help context | 13.8ms | ✅ Pass |
| Mark as done (Focus) | Focus mode | Click | Completes, advances | 74.9ms | 🟡 Slow |
| I'm stuck (Focus) | Focus mode | Click | Opens help banner | 13.9ms | ✅ Pass |
| Exit focus | Focus mode | Click | Returns to task | ~15ms | ✅ Pass |
| Previous/Next step | Focus mode | Click | Navigates steps | ~15ms | ✅ Pass |
| Back button | Task detail | Click | Returns to list | 12.6ms | ✅ Pass |
| Menu button (⋮) | Task detail | Click | Opens dropdown | 17.7ms | ✅ Pass |
| Snooze | Menu dropdown | Click | Opens snooze modal | 19.5ms | ✅ Pass |
| Snooze options | Snooze modal | Click | Snoozes task | ~15ms | ✅ Pass |
| Cancel snooze | Snooze modal | Click | Closes modal | 13.3ms | ✅ Pass |
| Dismiss (help banner) | Stuck context | Click | Closes banner | 11.7ms | ✅ Pass |

---

## Dead Interactions

### 1. **Done Button in Stack View - CRITICAL**
- **What it looks like:** A prominent coral button labeled "Done"
- **What users expect:** Click to complete the step
- **What actually happens:** NOTHING on click
- **Root cause:** Button requires 500ms hold to trigger (undocumented hold-to-complete pattern)
- **Why this is terrible:**
  - No visual affordance indicating hold is required
  - Button text says "Done" implying immediate action
  - Small "swipe to skip" text below doesn't explain the hold mechanism
  - ADHD users will click repeatedly thinking it's broken
- **Location:** `src/components/StackView.tsx:886-916`

### 2. **Main Input Click Blocked (Empty State)**
- **What it looks like:** An inviting text input "What's next?"
- **What users expect:** Click to focus and type
- **What actually happens:** Click is intercepted by overlay div
- **Root cause:** `<div class="absolute inset-0 opacity-[0.03]">` texture overlay intercepts pointer events
- **Error message from Playwright:** "element intercepts pointer events"
- **Workaround:** Tab to focus or just start typing (autofocus works)
- **Location:** `src/components/StackView.tsx:519-521`

---

## Missing Interactions

### 1. **No Click Handler on Done Button**
The most important action in the app (completing a step) has NO click handler. Only mouseDown/mouseUp for hold detection.

### 2. **No Visual Hold Progress Indicator**
The hold-to-complete pattern has a progress fill animation but:
- It's inside the button (easy to miss)
- No audio/haptic feedback
- No tooltip explaining the mechanic

### 3. **No Undo Action**
After completing a step, there's no way to undo. The affirmation shows briefly then the card is gone.

### 4. **No Long-Press Context Menu on Mobile**
Task items should have long-press for quick actions (delete, snooze, edit).

### 5. **Keyboard Shortcuts Not Working**
- ⌘K shown in UI but doesn't appear to be wired up
- No keyboard navigation through the stack

---

## Timing Failures

### 🔴 Critical (>100ms - Unacceptable for ADHD users)

| Interaction | Time | Threshold | Excess |
|-------------|------|-----------|--------|
| Modal close (Integrations) | 786.6ms | 50ms | **15.7x over** |
| Task item row click | 145.8ms | 50ms | **2.9x over** |

### 🟡 Warning (50-100ms - Needs improvement)

| Interaction | Time | Threshold | Notes |
|-------------|------|-----------|-------|
| Mark as done (Focus mode) | 74.9ms | 50ms | 1.5x over |

### Timing Analysis
- **Average interaction time:** ~18ms (good)
- **95th percentile:** ~75ms (acceptable)
- **Worst case:** 786.6ms (unacceptable)

The modal close at 786ms suggests either:
1. Heavy re-render on modal close
2. Animation/transition blocking
3. State cascade triggering multiple updates

---

## Brutal Assessment

**The interactions actively fight the user at the most critical moment.**

The entire app is built around one core loop: see task → do task → mark done → feel good → repeat. But the "Done" button in Stack View - the PRIMARY interaction surface - doesn't respond to clicks. Users will tap it, see nothing happen, tap again harder, maybe hold their finger thinking touch isn't registering, eventually give up and wonder if the app is broken.

For ADHD users, this is catastrophic. The moment of completion is when they need instant dopamine feedback. Instead they get silence. They'll abandon the app thinking it's buggy, never discovering the hidden hold-to-complete mechanic.

The checkboxes in List View work perfectly (9.8ms, instant feedback). This makes the Stack View behavior even more jarring - same app, same task, completely different interaction model with no explanation.

The 786ms modal close time is inexcusable. That's almost a full second of UI freeze - users will wonder if they broke something.

**Verdict:** The bones are good. Most interactions are fast and responsive. But the core "mark as done" interaction in the flagship view is fundamentally broken for the target user. This needs to be fixed before anything else.

---

## The Worst Offenders (Ranked)

### 1. 🔴 Done Button Requires Hidden 500ms Hold
**Severity:** CRITICAL
**Impact:** Core user flow is broken
**Fix:** Add click handler that immediately completes, or make hold requirement visually obvious
**File:** `src/components/StackView.tsx:886-916`

### 2. 🔴 Modal Close Takes 786ms
**Severity:** HIGH
**Impact:** App feels sluggish/broken
**Fix:** Investigate re-render cascade, optimize modal unmount
**File:** Likely state management issue in parent component

### 3. 🔴 Task Item Click Takes 145ms
**Severity:** HIGH
**Impact:** Navigation feels laggy
**Fix:** Profile component mount, consider skeleton/optimistic UI
**File:** List view task item click handler

### 4. 🟡 Input Field Click Blocked by Overlay
**Severity:** MEDIUM
**Impact:** Confusing when clicking doesn't focus
**Fix:** Add `pointer-events: none` to texture overlay
**File:** `src/components/StackView.tsx:519-521`

### 5. 🟡 Mark as Done in Focus Mode is 75ms
**Severity:** MEDIUM
**Impact:** Slightly sluggish completion feel
**Fix:** Optimize state update, consider optimistic UI
**File:** Focus mode completion handler

---

## Recommendations

### Immediate (Before Launch)
1. Add click handler to Stack View Done button (not just hold)
2. Fix texture overlay pointer-events
3. Investigate and fix 786ms modal close time

### Short-term
1. Add visual indicator for hold-to-complete (pulsing ring, text change to "Hold to complete")
2. Profile and optimize task item click navigation
3. Add undo capability after completing steps

### Medium-term
1. Implement keyboard shortcuts (⌘K for quick add, arrow keys for stack navigation)
2. Add haptic feedback on mobile for completions
3. Consider replacing hold-to-complete with swipe-up gesture (more discoverable)

---

## Testing Notes

- All testing performed with Playwright MCP browser automation
- Timing measured via custom `interactionMetrics` instrumentation injected into page
- Thresholds based on ADHD-specific requirements (stricter than standard):
  - Click to feedback: <50ms (not 100ms)
  - Action completion: <200ms (not 300ms)
  - AI response first feedback: <200ms (not 500ms)
