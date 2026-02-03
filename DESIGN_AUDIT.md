# Gather Design Audit for Award-Level Cohesion

## Executive Summary

Gather has a strong foundation: warm design tokens, thoughtful micro-interactions, and a clear visual language around coral accents and sage success states. However, the HomeView has become a "feature showcase" rather than a focused experience. Users with ADHD need fewer decisions, not more widgets competing for attention. The path to award-worthy design requires ruthless progressive disclosure and unifying 15+ disparate features into a single coherent interaction model.

**Current State**: 7/10 individual component quality, 5/10 holistic cohesion.
**Target State**: 9/10 "inevitable" design where every feature feels native.

---

## Critical Issues (Must Fix)

### 1. HomeView Information Overload

**Current State**: HomeView displays up to 9 distinct UI elements simultaneously:
- Mood picker (conditional)
- AI Card (conditional)
- Task Insight (conditional)
- Calendar Widget
- Email Tasks Card
- Stats Card
- Gamification Card
- Pattern Insights
- "Do this now" focus card + Energy Suggestions + Task list

**Problem**: This directly violates the UX rule "One thing at a time - Avoid decision paralysis." Users with ADHD face a cognitive wall of competing elements. Each widget asks for attention, creating the exact overwhelm the app promises to eliminate.

**Solution**: Implement a layered information architecture:
```
Layer 1 (Always): Input + "Do this now" card only
Layer 2 (Scroll): Task list with progressive reveal
Layer 3 (On demand): Stats/Insights in a collapsible "Your week" section
Layer 4 (Settings): Gamification, integrations
```

**Priority**: Critical

---

### 2. Gamification Visual Disconnect

**Current State**: GamificationCard uses a garden metaphor with "ProgressGarden" component and "momentum points" - a completely different conceptual model from the rest of the app.

**Problem**: The garden/growth metaphor feels bolted-on. The coral/sage color language doesn't extend to "garden stages." The points system introduces gaming terminology ("Level 5", "momentum points") that clashes with the warm, conversational tone ("dump it here").

**Solution**:
1. Replace "garden" with subtle progress that lives IN the existing UI, not beside it
2. Show points as a simple counter in the header, not a dedicated card
3. Replace "Level Up!" celebration with the existing Confetti component
4. Make rewards discoverable through Settings, not HomeView

**Priority**: Critical

---

### 3. Inconsistent Card Patterns

**Current State**: Multiple card designs exist:
- `TaskListItem`: `bg-card rounded-md border border-border`
- `StatsCard`: `bg-card rounded-lg border border-border`
- `GamificationCard`: `rounded-xl bg-card border border-border-subtle`
- `CalendarWidget`: `bg-card rounded-lg border border-border`
- `TaskInsight`: `bg-card border border-border rounded-xl`
- `PatternInsights`: `bg-surface rounded-xl` (no border!)

**Problem**: Three different border-radius values (md/lg/xl), inconsistent border opacity (border vs border-subtle), mixed backgrounds (card vs surface). This creates visual noise that professional designers call "design debt."

**Solution**: Establish ONE card pattern:
```css
/* Primary Card (interactive) */
.card-primary {
  @apply bg-card rounded-xl border border-border-subtle;
}

/* Surface Card (informational, de-emphasized) */
.card-surface {
  @apply bg-surface rounded-xl;  /* no border */
}
```
Apply consistently across ALL components.

**Priority**: Critical

---

### 4. Too Many "Insight" Components Competing

**Current State**: HomeView has FOUR insight-type components:
- `TaskInsight` - AI observations about stuck tasks
- `PatternInsights` - Productivity patterns
- `StatsCard` - Weekly stats with insights
- `EnergySuggestions` - Energy-based alternatives

**Problem**: Users don't need four different sources of "smart observations." This feels like feature creep where each insight system was added independently without consolidation.

**Solution**: Consolidate into ONE unified "Coach" system:
1. Merge all insights into a single `CoachCard` component
2. Show ONE contextual insight at a time (rotate daily)
3. Use consistent visual language (the AI card warm background)
4. Make additional insights accessible via "See more" or in a dedicated Coach view

**Priority**: Critical

---

## High Priority Improvements

### 5. Modal Inconsistency

**Current State**: At least 12 different modal/overlay patterns:
- `Modal.tsx` (base component)
- `SnoozeMenu` (fixed inset-0, custom overlay)
- `EnergyPicker` (inline modal in TaskView)
- `RecurrencePickerModal` (uses Modal.tsx)
- `SchedulePicker` (sheet-style from bottom)
- `BrainDumpModal`, `TaskTemplateModal`, `UpgradeModal`, etc.

**Problem**: Some modals slide up, some fade in. Some have close buttons in different positions. Border radius varies (2xl vs rounded-t-2xl). This inconsistency makes the app feel assembled from parts.

**Solution**:
1. Create `Sheet.tsx` component for bottom sheets (mobile-optimized)
2. Ensure ALL overlays use either Modal or Sheet
3. Standardize close button position (top-right, using CloseButton component)
4. Unify animation: fade-in for modals, slide-up for sheets

**Priority**: High

---

### 6. Feature Discovery is Invisible

**Current State**: Features like `/t` (templates), `/dump` (brain dump), `/e` (event), `/r` (reminder), `/h` (habit) are completely hidden unless users know to type them.

**Problem**: Power features exist but are undiscoverable. The empty state shows suggestion chips, but these are example tasks, not feature hints.

**Solution**:
1. Add subtle hint below input: "Type /t for templates, /dump to brain dump"
2. Show command palette on `?` key (like most pro apps)
3. Replace arbitrary suggestions with action-oriented ones: "Plan my week", "Quick reminder", "Start a habit"

**Priority**: High

---

### 7. Energy System Not Integrated Into Core Flow

**Current State**: Energy levels exist on tasks but feel optional. The EnergySuggestions component only appears when there's already a "Do this now" task.

**Problem**: Energy-based task matching is a killer feature for ADHD users but requires manual setup per task. It should be the PRIMARY organizing principle, not a sidebar feature.

**Solution**:
1. Ask energy level during onboarding or via MoodPicker
2. Use energy to FILTER the "Do this now" selection automatically
3. If user's energy is low, prioritize low-energy tasks without showing alternatives
4. Move EnergySuggestions logic INTO the main task selection algorithm

**Priority**: High

---

### 8. View Toggle Creates Cognitive Split

**Current State**: Three views (Home/List, Day, Stack) with a ViewToggle in header.

**Problem**: Three mental models for the same data. Users must choose a "mode" before interacting. The views have different visual languages and capabilities.

**Solution**:
1. Make Home view the ONLY view for task management
2. Day view becomes a planning overlay/modal (not a replacement view)
3. Stack view becomes "Focus Mode" - accessed via button, not view toggle
4. Remove the ViewToggle component entirely

**Priority**: High

---

## Feature Integration Recommendations

### Gamification: From "Bolted On" to "Native"

**Current Feel**: Separate system with its own language (garden, levels, momentum)

**Integration Strategy**:
1. Points become invisible - they just accumulate
2. Progress shows as a subtle glow/fill on the "Gather" logo
3. Level ups trigger existing Confetti, not a separate celebration
4. Rewards unlock automatically (no modal shopping experience)
5. The only visible indicator: a small "streak" number next to header

---

### Energy Suggestions: From "Alternative" to "Primary Filter"

**Current Feel**: "Not feeling it?" secondary option below main task

**Integration Strategy**:
1. Remove EnergySuggestions as a separate component
2. Add energy level to MoodPicker (combine into one prompt)
3. Main "Do this now" task is ALREADY filtered by energy
4. If all high-energy tasks remain, show gentle nudge: "Your low-energy tasks are done - nice!"

---

### Calendar/Email Integration: From "Widget" to "Contextual"

**Current Feel**: Dedicated cards taking up home screen real estate

**Integration Strategy**:
1. Calendar events appear AS tasks in the main list (with visual distinction)
2. Email tasks appear in an inbox-style notification badge, not a card
3. "Coming up" info moves to the Day planning overlay
4. Zero widgets on the main home view

---

### Pattern Insights: From "Card" to "Coach Whisper"

**Current Feel**: Dedicated card with fire/sun/trending icons

**Integration Strategy**:
1. Insights appear as subtle text below the input when relevant
2. Example: After completing morning task: "You're most productive in the morning - keep going"
3. No dedicated card - insights are woven into the experience
4. Limit to 1 insight per session maximum

---

### Task Intelligence: From "Separate API" to "Inline Nudge"

**Current Feel**: TaskInsight card that fetches from /api/task-intelligence

**Integration Strategy**:
1. Intelligence observations appear ON the relevant task card
2. Small badge/indicator: "Stuck 3 days" or "Needs clarity"
3. Clicking shows AI help inline, not in a separate card
4. Remove the standalone TaskInsight component

---

## Recommended Removals/Simplifications

### Remove Entirely
1. **ViewToggle** - Consolidate to single view with optional overlays
2. **PatternInsights card** - Merge into coach whispers
3. **GamificationCard** - Points become invisible, progress in header
4. **CalendarWidget on HomeView** - Move to Day planning overlay
5. **EmailTasksCard** - Become notification badge or inline tasks

### Simplify/Merge
1. **StatsCard + PatternInsights + TaskInsight** -> Single CoachCard
2. **EnergySuggestions** -> Built into task picker algorithm
3. **MoodPicker + Energy question** -> Single prompt
4. **FocusLauncher + JustOneThing + FocusMode** -> Single "Focus" experience

### Hide Until Needed
1. **Templates** - Accessible via /t command, not dedicated button
2. **Brain Dump** - Accessible via /dump or long-press on input
3. **Rewards catalog** - In Settings, not on HomeView
4. **Integration settings** - Only shown when integrations are relevant

---

## Quick Wins (< 1 hour each)

### 1. Unify Card Border Radius (15 min)
Change all cards to `rounded-xl` and remove `rounded-md`, `rounded-lg` variations.
```css
/* In globals.css */
--radius-card: 12px;
```

### 2. Remove PatternInsights from HomeView (5 min)
Comment out the `<PatternInsights>` render in HomeView.tsx. Data collection continues, display moves elsewhere later.

### 3. Collapse GamificationCard by Default (10 min)
Change `GamificationCard` to show only a minimal inline indicator (level + points) without the full card expansion.

### 4. Add Input Hint for Commands (20 min)
Add subtle text below UnifiedInput: `<span className="text-xs text-text-muted mt-1">/t templates  /dump brain dump  ? shortcuts</span>`

### 5. Standardize Section Headers (15 min)
Create shared style for "Do this now", "Other tasks", "Coming up" headers:
```tsx
<div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
```

### 6. Remove Floating Chat FAB (10 min)
The ChatModal FAB (line 991-1017 in GatherApp.tsx) is visually jarring and redundant with inline AI. Remove it.

### 7. Consolidate Loading States (20 min)
Replace per-component skeleton patterns with the shared `GatherAppSkeleton` approach.

### 8. Remove StatsCard When No Data (5 min)
StatsCard already conditionally renders, but it shows with even 1 completed step. Raise threshold to 5+ completions.

---

## Design Language Inconsistencies

### Colors
| Issue | Current | Should Be |
|-------|---------|-----------|
| Success soft | `bg-success-soft/30`, `bg-success-soft/50` | Single `bg-success-soft` |
| Accent soft | `bg-accent/5`, `bg-accent/10`, `bg-accent-soft` | Single `bg-accent-soft` |
| Border subtle | `border-border-subtle`, `border-border/50` | Single `border-border-subtle` |

### Typography
| Issue | Current | Should Be |
|-------|---------|-----------|
| Section headers | Varying font-medium/font-semibold | Always `font-medium` |
| Uppercase tracking | `tracking-wide`, `tracking-wider` | Single `tracking-wide` |
| Text sizes | 10px, 11px, xs, sm mixing | Stick to text-xs (12px), text-sm (14px) |

### Spacing
| Issue | Current | Should Be |
|-------|---------|-----------|
| Card padding | p-3, p-4, p-5 variations | Standardize to p-4 |
| Section margins | mb-3, mb-4, mb-5, mb-6 | Standardize to mb-4 (default), mb-6 (section breaks) |

### Animation
| Issue | Current | Should Be |
|-------|---------|-----------|
| Rise animation | `animate-rise` with varying delays | Keep, but audit usage |
| Fade in | `animate-fade-in` vs `animate-rise` | Use rise for lists, fade-in for overlays |

---

## The Path to Award-Worthy

### Phase 1: Simplify (Week 1)
1. Remove GamificationCard, PatternInsights, EmailTasksCard from HomeView
2. Remove ViewToggle, make Home the default
3. Remove ChatModal FAB
4. Consolidate card border-radius to xl everywhere
5. Result: HomeView shows only Input + Focus card + Task list

### Phase 2: Unify (Week 2)
1. Create single CoachCard to replace TaskInsight + stats insights
2. Merge energy into MoodPicker, remove EnergySuggestions component
3. Calendar events become special task items, not a widget
4. Create shared Card component with two variants
5. Result: All "insight" features in one place, consistent cards

### Phase 3: Polish (Week 3)
1. Add command palette for power features
2. Implement progressive disclosure for task list (5 visible, "show more")
3. Add subtle input hints for discoverability
4. Audit and fix all spacing/typography inconsistencies
5. Result: Clean, focused, discoverable

### Phase 4: Delight (Week 4)
1. Make gamification invisible (progress in logo, auto-rewards)
2. Add coach whispers (inline text insights, not cards)
3. Implement Day planning as modal overlay
4. Add gesture-based interactions for mobile
5. Result: Features feel inevitable, not added

---

## Success Metrics

An award-worthy Gather would:
1. **First Load**: Show only input + one task + task list (3 elements max)
2. **Time to Action**: User can complete a step within 3 seconds of app load
3. **Feature Discovery**: Users find /t templates within first week organically
4. **Visual Consistency**: Screenshot any 3 screens, they look like same app
5. **ADHD Test**: User with ADHD can use app without feeling overwhelmed

---

## Closing Note

The core vision of Gather - "Dump it here, I'll make it doable" - is excellent. The individual components are well-crafted. The issue is accumulation without consolidation. Each feature was added thoughtfully, but the whole has become more than the sum of parts.

Award-winning apps have the courage to hide features. They trust that good defaults beat visible options. They know that what you DON'T show is as important as what you show.

The path forward is clear: fewer visible features, same powerful capabilities, one unified experience.
