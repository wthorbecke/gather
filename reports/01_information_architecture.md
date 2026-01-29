# Information Architecture Audit

## Data Model Map

```
User (profiles)
│
├── Task
│   ├── title (string)
│   ├── description (string)
│   ├── category (urgent|soon|waiting|completed)
│   ├── due_date (date)
│   ├── context (JSONB) ← structured data, rarely used
│   ├── context_text (string) ← AI-generated summary shown in UI
│   ├── notes (string)
│   ├── actions (JSONB array) ← action buttons, largely unused
│   ├── subtasks (JSONB array) ← LEGACY, deprecated
│   └── steps (JSONB array) ← current hierarchy
│       ├── id (string|number)
│       ├── text (string) ← parsed into title + remainder
│       ├── done (boolean)
│       ├── summary (string)
│       ├── detail (string)
│       ├── alternatives (string[])
│       ├── examples (string[])
│       ├── checklist (string[])
│       ├── time (string)
│       ├── source (object)
│       └── action (object)
│
├── Habit (separate tracking system)
│   └── HabitLog (daily completion)
│
├── Soul Activity (separate tracking system)
│   └── SoulLog (completion)
│
├── Space Zone (apartment organization)
│   └── Space Task
│
├── Message (chat history)
├── Check-in (SMS interactions)
└── [Google integrations]
```

**Hierarchy depth:** 3 levels max (User → Task → Step)
**Step "checklist" adds a pseudo-4th level** but is not interactively toggleable.

---

## UI Presentation Map

### HomeView (List Mode)
```
┌─────────────────────────────────────┐
│ Input: "What do you need to get done?"
├─────────────────────────────────────┤
│ AI Card (when active)               │
├─────────────────────────────────────┤
│ "Up next" section                   │
│ ┌─────────────────────────────────┐ │
│ │ ☐ [Step title]                  │ │
│ │   [Step summary]                │ │
│ │   ─────────────────────────     │ │
│ │   [Task title]          3/5    │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ "Other tasks" / "All tasks"         │
│ ┌─────────────────────────────────┐ │
│ │ [Task title] [deadline badge]   │ │
│ │ [context] · 2/5 steps          │→│
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### TaskView (Detail Mode)
```
┌─────────────────────────────────────┐
│ ← [Task Title]              [menu] │
├─────────────────────────────────────┤
│ Input (with step context tag)       │
├─────────────────────────────────────┤
│ 3/5 ═══════════░░░░░░░░░░░░        │
├─────────────────────────────────────┤
│ ☐ Step 1 title                    ▼ │
│   Step 1 summary                    │
├─────────────────────────────────────┤
│ ☐ Step 2 title (expanded)         ▲ │
│   [detail text]                     │
│   ┌───────────────────────────────┐ │
│   │ Also accepted: X, Y, Z        │ │
│   └───────────────────────────────┘ │
│   ┌───────────────────────────────┐ │
│   │ Checklist                     │ │
│   │ ○ Item A                      │ │
│   │ ○ Item B                      │ │
│   └───────────────────────────────┘ │
│   [Action Link] Est. 30m  via source│
│   ┌──────────┐ ┌────────────────┐  │
│   │  Focus   │ │   I'm stuck    │  │
│   └──────────┘ └────────────────┘  │
├─────────────────────────────────────┤
│ ☑ Step 3 title (completed)          │
└─────────────────────────────────────┘
```

### StackView (Card Mode)
```
┌─────────────────────────────────────┐
│                        [+] [≡] [→] │
├─────────────────────────────────────┤
│         ┌─────────────────┐         │
│        ┌┤                 │         │
│       ┌┤│  NEXT STEP      │         │
│       ││├─────────────────┤         │
│       │││                 │         │
│       │││  Step title     │         │
│       │││                 │         │
│       │││  ═══════░░░░    │         │
│       │││  2 of 5         │         │
│       │││                 │         │
│       │││ ┌─────────────┐ │         │
│       │││ │    Done     │ │         │
│       │││ └─────────────┘ │         │
│       │││  swipe to skip  │         │
│       ││└─────────────────┘         │
│       │└──────────────────┘         │
│       └───────────────────┘         │
│    ←                          →     │
└─────────────────────────────────────┘
```

---

## Mismatches

### 1. **"Step" vs "Task" vs "Subtask" confusion**

| Location | Term Used | What It Means |
|----------|-----------|---------------|
| Database schema | `subtasks` | Legacy array, deprecated |
| Database schema | `steps` | Current array of work items |
| HomeView | "steps" | Shown as "2/5 steps" |
| StackView | "next step" | Context label |
| TaskListItem | "Tap to add steps" | Empty state prompt |
| Product spec | "steps" | Never uses "subtask" |

**Problem:** The schema still has `subtasks` field. Both terms exist in code. User never sees "subtask" but a developer might add one accidentally.

### 2. **Checklist is not interactive**

Steps can have a `checklist` array, rendered as:
```
○ Item A
○ Item B
```

But these are **not toggleable**. They're just bullet points. The visual suggests interaction but there is none.

**User expectation:** "I should be able to check these off"
**Reality:** They're informational only

### 3. **Step "title" vs "text" parsing is invisible**

The code in `splitStepText()` parses `step.text` into:
- `title` (first sentence or colon-prefixed heading)
- `remainder` (everything else)

But:
- `step.summary` is a separate field that sometimes duplicates the remainder
- The parsing rules are complex and inconsistent
- The user has no control over how their text gets split

**Example confusion:**
```
step.text = "Call the DMV: You need to verify your identity before proceeding"
→ title: "Call the DMV"
→ summary: "You need to verify your identity before proceeding"
```
But if the user typed:
```
step.text = "You need to call the DMV to verify your identity"
→ title: "You need to call the DMV to verify your identity"
→ summary: undefined
```

The display varies wildly based on punctuation the user never chose.

### 4. **"Context" has three meanings**

1. `task.context` (JSONB) — structured data like `{ memberId: "123" }`. Rarely populated.
2. `task.context_text` (string) — AI-generated summary shown as pills/badges
3. Input `contextTags` — runtime tags showing which step you're asking about

The UI shows `context_text` but the code references `context` in multiple ways. It's unclear what gets stored where.

### 5. **Task categories exist but aren't surfaced**

Schema: `category TEXT NOT NULL CHECK (category IN ('urgent', 'soon', 'waiting', 'completed'))`

But:
- HomeView doesn't group by category
- StackView doesn't filter by category
- The only categorization visible is deadline urgency via `DeadlineBadge`

**The data model promises categorization. The UI delivers chronological sorting only.**

### 6. **Two view modes with different mental models**

| Aspect | HomeView (List) | StackView (Cards) |
|--------|-----------------|-------------------|
| Unit of work | Step (in "Up Next"), Task (in list) | Step only |
| Navigation | Tap task → see all steps | Complete step → next card |
| Multi-step visibility | Progress shown as "3/5" | Progress bar shown |
| Task without steps | Shown with "Tap to add" | Shown as "Break it down" card |
| Skip action | Not possible | Swipe left/right |

**This creates a split brain:** List mode treats Tasks as the primary unit. Card mode treats Steps as the primary unit. A user switching between them must mentally reframe their work.

### 7. **Habits and Soul Activities are separate systems**

The database has:
- `habits` + `habit_logs` (daily tracking)
- `soul_activities` + `soul_logs` (non-daily)

But the main UI (HomeView, StackView, TaskView) only shows `tasks`. Where do habits/soul activities appear? They're orphaned in the schema.

**The code has data for habit tracking. The UI ignores it entirely.**

---

## Cognitive Load Violations

### 1. **The "Up Next" highlight creates false urgency**

HomeView shows ONE step prominently as "Up next". But:
- There's no indication why THIS step is "next"
- Steps are just shown in order — the first incomplete step
- User can't reorder or prioritize

**For ADHD users:** Being told "this is next" without agency creates anxiety. "Did I choose this? Why is the app deciding for me?"

### 2. **Progress indicators are inconsistent**

| View | Progress Display |
|------|------------------|
| HomeView task list | "3/5 steps" (text) |
| HomeView "Up Next" | "3/5" in footer |
| TaskView | Segmented progress bar |
| StackView | Horizontal progress bar with "2 of 5" |

Four different visual treatments for the same information. Each requires mental translation.

### 3. **Step expansion hides critical information**

In TaskView, steps collapse to:
```
☐ Step title
  Step summary
```

To see:
- The action link
- Time estimate
- Checklist
- "I'm stuck" button

...you must expand. **The most important affordances are hidden behind a tap.**

For ADHD users: out of sight = doesn't exist. Hidden actions won't be used.

### 4. **"I'm stuck" is buried**

The primary escape hatch for task paralysis is a small button visible only when:
1. You're in TaskView (not HomeView or StackView)
2. You've expanded a specific step
3. You scroll down past the detail/alternatives/checklist/action

**This is the MOST important feature for the target audience and it's 3 interactions deep.**

### 5. **"Focus" mode adds another layer**

TaskView → expand step → click "Focus" → FocusMode modal

Now you're in:
- A fullscreen overlay
- With prev/next navigation
- Different buttons ("Exit", not "Back")

**Every new mode is cognitive overhead.** The user must learn: "When am I in normal view? When am I in Focus? How do I get out?"

### 6. **Input purpose changes by context**

The UnifiedInput component changes meaning:

| Context | Placeholder | What happens on submit |
|---------|-------------|------------------------|
| HomeView, no AI | "What do you need to get done?" | Creates task via AI |
| HomeView, question flow | "Type your answer..." | Answers AI question |
| TaskView, no step selected | "Ask anything about this..." | Follow-up question |
| TaskView, step selected | "Ask a question or add context..." | Question about step |

**Same input, four different behaviors.** The user must track which mode they're in.

### 7. **Snooze is modal, not inline**

To snooze a task:
1. Go to TaskView
2. Open the kebab menu
3. Click "Snooze"
4. A modal opens
5. Pick a date
6. You're sent back to HomeView

**Seven interactions to defer a task.** For ADHD users, this friction means tasks won't be snoozed — they'll just be ignored.

---

## Brutal Assessment

**This architecture fights ADHD users at every turn.**

The app claims to be about "zero friction" and "one thing at a time," but the information architecture contradicts this:

1. **Three-level hierarchy (Task → Step → Checklist) is too deep.** ADHD brains need flat structures. Every nesting level is a place to get lost.

2. **Two view modes (List vs Cards) split the user's mental model.** Pick one and commit. The duality creates confusion about what the "real" interface is.

3. **Critical actions are hidden.** "I'm stuck" and action links require expansion. Phone numbers are buried in text. The *one tap* to call Grandpa is actually *tap task → scroll to step → expand → find phone → tap*.

4. **The input is a shape-shifter.** It asks for tasks, answers questions, provides context — same box, different meanings. Users will type the wrong thing in the wrong mode.

5. **Habits and Soul Activities are ghosts in the schema.** They exist in the database but not the UI. This is either dead code or missing features — both are confusing.

6. **Progress display is noisy.** Four different visualizations for "3 of 5 done." This isn't design — it's indecision.

The product spec promises "Dump it here — I'll make it doable." The architecture says "Figure out if you're in HomeView or StackView, expand the step, find the button, track which mode the input is in, and don't forget about the checklist items that look clickable but aren't."

---

## Specific Failures

| File:Line | Issue |
|-----------|-------|
| `supabase/schema.sql:74` | `subtasks JSONB` still exists alongside `steps`. Remove dead field. |
| `src/components/StepItem.tsx:145-157` | Checklist renders as `○` bullets but is not interactive. Either make them toggleable or change visual treatment. |
| `src/lib/stepText.ts` (entire file) | Text parsing logic creates unpredictable title/summary splits. User has no control. |
| `src/components/HomeView.tsx:228-278` | "Up next" section shows one step with no explanation of ordering. Add "why this is next" or let user choose. |
| `src/components/StepItem.tsx:218-261` | "Focus" and "I'm stuck" buttons are inside expanded content. Move outside or make always visible. |
| `src/components/TaskView.tsx:322-337` | Input placeholder changes based on context but there's no visual indicator of current mode. |
| `src/components/StackView.tsx` (entire file) | Different mental model than HomeView. Creates cognitive overhead switching between views. |
| `supabase/schema.sql:18-29`, `42-60` | Habits and Soul Activities tables exist but have no UI. Dead code or missing feature. |
| `src/config/content.ts:86-91` | Empty state messages assume one interaction model. Doesn't help user understand what to do. |

---

## What Must Change

### Immediate (High Impact, Low Effort)

1. **Move "I'm stuck" to always-visible position in StepItem.** Don't require expansion. This is the #1 ADHD escape hatch.

2. **Make checklist items either interactive or visually distinct from checkboxes.** Current `○` bullets look like unfilled checkboxes. Use `•` or `—` instead if they're not toggleable.

3. **Remove `subtasks` field from schema.** It's deprecated and confusing.

4. **Add mode indicator to UnifiedInput.** Show a subtle label: "Adding task" / "Answering question" / "About: [step name]"

### Medium-term (Requires Design)

5. **Pick one view mode.** Either commit to List (HomeView) or Cards (StackView). Having both creates a split brain. If both must exist, make them feel like the same system with different display densities, not two different apps.

6. **Flatten the Step → Checklist hierarchy.** If a step has a checklist, expand the checklist items into sibling steps. Don't nest.

7. **Simplify progress indicators.** Pick ONE visual treatment and use it everywhere: either "3/5" text or segmented bar, not both.

8. **Make snooze a swipe gesture.** In StackView, swipe down to snooze. In HomeView, long-press to snooze. Remove the modal.

### Long-term (Architectural)

9. **Unify or remove Habits/Soul Activities.** Either integrate them into the main task flow or remove them from the schema. Ghost features confuse developers and rot over time.

10. **Redesign step text to be explicit, not parsed.** Instead of parsing `text` into `title` + `remainder`, require AI to provide structured fields: `{ title, description }`. No ambiguous splitting.

11. **Add explicit task ordering/prioritization.** "Up next" should reflect user intent, not arbitrary position. Let users drag to reorder or mark a step as "do this first."
