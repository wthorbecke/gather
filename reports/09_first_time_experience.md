# First-Time User Experience Audit

**Auditor Persona**: ADHD user with 6 tabs open, phone buzzing, giving this app 30 seconds to prove itself.

**Date**: 2026-01-29

---

## First Impressions Screenshots

### 0 Seconds - Landing Page
![Landing page](.playwright-mcp/ftue-0s-landing.png)

**What I see**: Clean, uncluttered. "Gather" title, compelling tagline "Dump it here — I'll make it doable". Two clear buttons.

**What I think**: This might actually help me. The tagline speaks directly to how I feel.

**Abandonment risk**: 1/5 - Low. Clear value prop, no overwhelming choices.

### 5 Seconds - Demo Entry
![Demo entry](.playwright-mcp/ftue-5s-demo-entry.png)

**What I see**: Empty state with "clear" and "nothing waiting". Single input field asking "What's next?"

**What I think**: No tutorial? No walkthrough? Just...start? I love this.

**Abandonment risk**: 1/5 - Immediate action available.

### 15 Seconds - AI Processing
![AI processing](.playwright-mcp/ftue-15s-ai-processing.png)

**What I see**: Loading state "Researching the best steps for you..."

**What I think**: It's actually doing something with my vague task!

**Abandonment risk**: 2/5 - Depends on how long this takes.

### 20 Seconds - First Task Created
![First task](.playwright-mcp/ftue-20s-first-task.png)

**What I see**: My overwhelming "clean entire apartment" became a focused card: "Set 15-minute timer and do a speed declutter" - Step 1 of 5.

**What I think**: 🤯 THIS IS THE "AHA" MOMENT. The app actually understood and broke it down!

**Abandonment risk**: 1/5 - First value delivered!

### 40 Seconds - List View
![List view](.playwright-mcp/ftue-40s-list-view.png)

**What I see**: Alternative view with checkbox, progress indicator showing "0/5".

**Abandonment risk**: 2/5 - Options are good, but this is another thing to learn.

### 45 Seconds - Step Completed
![Step completed](.playwright-mcp/ftue-45s-step-completed.png)

**What I see**: Progress updated to "1/5", next step shown.

**Abandonment risk**: 1/5 - Clear progress feedback.

---

## Timeline

| Time | What Happened | What I Thought | Abandonment Risk (1-5) |
|------|---------------|----------------|------------------------|
| 0s | Landed on page | "Clean design, what is this?" | 2 |
| 2s | Read tagline | "This gets me!" | 1 |
| 3s | Saw demo button | "I don't have to commit" | 1 |
| 5s | Clicked demo | "No signup? Yes!" | 1 |
| 6s | Saw empty state | "Clear, not scary" | 1 |
| 8s | Typed overwhelming task | "Let's see what happens" | 2 |
| 10s | Pressed enter | "Processing..." | 2 |
| 15s | Saw loading state | "Still processing..." | 3 |
| 20s | First step appeared | "WOW! It actually broke it down!" | 1 |
| 25s | Tried to click Done | "Why isn't it working?" | 4 |
| 30s | Still clicking Done | "Button seems broken" | 5 |
| 35s | Switched to list view | "Let me try something else" | 3 |
| 40s | Clicked checkbox | "That worked!" | 2 |
| 45s | Step completed | "Progress!" | 1 |

---

## Critical Measurements

| Metric | Time | Assessment |
|--------|------|------------|
| First meaningful click | 3s | Excellent - "Try demo" is immediately available |
| First task created | ~18s | Good - AI processing is the bottleneck |
| First value received | ~20s | Good - Task breakdown is the value |
| First "aha" moment | ~20s | Excellent - When the overwhelming task became 5 simple steps |
| Total onboarding time | 0s | Perfect - No onboarding, just start using |

---

## The Confusion Points

| Moment | What's Confusing | Why It's Confusing | Severity |
|--------|------------------|-------------------|----------|
| Stack view Done button | Button appears clickable but doesn't advance to next step | Multiple clicks, no feedback, no state change | **CRITICAL** |
| "swipe to skip" text | What does swiping do vs clicking Done? | No visual affordance for swipe action | Medium |
| List view placeholder text | Shows "renew my passport..." pre-filled | Is this my data? Demo data? Confusing | Low |
| Progress indicator | "1 of 5" vs "0/5" in different views | Inconsistent notation | Low |

---

## Abandonment Cliff Analysis

```
Risk Level
    5 |                    ████████
    4 |                    ████████
    3 |          ██████████
    2 |  ████████
    1 |██                          ████████████
      |________________________________
       0s   5s   10s  15s  20s  25s  30s  35s  40s  45s
```

**The most dangerous moment is: 25-30 seconds**

**Because**: The "Done" button in Stack View doesn't respond to clicks. Users who try the primary action multiple times and get no feedback will assume the app is broken and leave.

---

## Onboarding Assessment

| Aspect | Value | Notes |
|--------|-------|-------|
| Length | 0 seconds | No onboarding flow |
| Skippable | N/A | Nothing to skip |
| Value delivered during | N/A | Jump straight to value |
| Better than tutorial | Yes | Learning by doing is perfect for ADHD |

**Verdict**: The "no onboarding" approach is **perfect** for ADHD users. Don't add one.

---

## What's Missing

### Critical
1. **Working Done button in Stack View** - The primary action doesn't work
2. **Feedback when button is clicked** - Even a visual press state would help

### Important
3. **Demo state persistence** - If user refreshes/returns, progress is lost
4. **Welcome back experience** - No recognition of returning demo users

### Nice to Have
5. **Swipe gesture hint** - "swipe to skip" has no visual affordance
6. **Quick tour tooltip** - Optional "show me around" for those who want it

---

## What's Over-Explained

Honestly? **Nothing**. The app is refreshingly minimal. Keep it this way.

---

## Return Experience

| Aspect | Result |
|--------|--------|
| State preserved | **No** - Demo resets completely |
| Reorientation provided | **No** - Same landing page |
| Could continue seamlessly | **No** - Start from scratch |

**For demo mode**: This is probably acceptable. Users expect demos to be temporary.

**For signed-in users**: Would need testing, but presumably data persists.

---

## Brutal Assessment

**Would a real ADHD user with 6 open tabs get through this?**

**Mostly yes, with one critical exception.**

The first 20 seconds are *perfect*:
- No signup wall
- No tutorial
- Immediate input field
- Fast AI response
- Genuinely helpful task breakdown

The experience breaks at 25-30 seconds when the user tries to complete their first step in Stack View and **the Done button doesn't work**. An ADHD user would:
1. Click Done
2. Click again harder
3. Wonder if they did something wrong
4. Try clicking somewhere else
5. Get frustrated
6. Close the tab

The fact that List View works is irrelevant - most users won't discover it before leaving.

---

## The 10-Second Test

**If someone has 10 seconds to decide — do they stay?**

**Answer: Yes**

**Because**:
- Landing page immediately communicates value ("AI breaks down overwhelming tasks")
- Demo button removes commitment anxiety
- Empty state is inviting, not overwhelming
- Input field is the obvious next action

The 10-second test is passed. The 30-second test fails due to the Done button bug.

---

## Fixes That Would Save Users

### Priority 1: CRITICAL
1. **Fix Done button in Stack View** - This is blocking the core experience. The button clicks but nothing happens. This single bug could cause 50%+ abandonment.

### Priority 2: HIGH
2. **Add visual feedback to Done button** - Press state, loading indicator, checkmark animation
3. **Persist demo state in localStorage** - So returning users see their progress

### Priority 3: MEDIUM
4. **Add swipe affordance** - Hint arrows or subtle animation for "swipe to skip"
5. **Consistent progress notation** - Pick "1 of 5" or "1/5" and use it everywhere

### Priority 4: LOW
6. **Demo task examples** - Pre-populated example tasks might help users understand faster
7. **Return user recognition** - "Welcome back! Pick up where you left off?"

---

## Summary Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| First Glance (0-5s) | 9/10 | Excellent value prop, clean design |
| First Decision (5-15s) | 10/10 | Demo button is genius, no friction |
| First Action (15-30s) | 4/10 | AI works great, but Done button is broken |
| First Value (30-60s) | 7/10 | Task breakdown is valuable, completion flow fails |
| Return Experience | 5/10 | Demo resets completely (acceptable for demo) |

**Overall FTUE Score: 7/10**

Would be 9/10 if the Done button worked.

---

## Final Verdict

Gather has nailed the hardest part: **getting an ADHD user past the first 10 seconds**. The "no onboarding, just start" approach is exactly right. The AI task breakdown delivers genuine value within 20 seconds.

But there's a critical bug that breaks the experience right when users try to experience the core value: completing a step. Fix the Done button in Stack View, and this becomes an exceptional FTUE.

**The app understands ADHD users. It just needs to let them actually use it.**
