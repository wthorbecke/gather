# Gather Design System

## Philosophy

**"Dump it here — I'll make it doable."**

Gather is not a task manager. It's not a life philosophy app. It's a tool that bridges the gap between "I should do X" and actually doing X.

The core value: You have something in your head that feels overwhelming or vague or stuck. Gather turns it into concrete steps you can actually take — with real links, real context, and ongoing collaboration when you get stuck.

### What Gather believes:
- Writing it down ≠ doing it. The app must help *after* the list exists.
- AI should explain its reasoning, not demand blind trust.
- Every completion deserves acknowledgment. Small wins matter.
- No prescriptive categories. No "you should meditate." Your priorities, not ours.

### What Gather does NOT do:
- Tell you how to live your life
- Add default habits/rituals
- Guilt trip you for incomplete tasks
- Celebrate so much it gets annoying

---

## Color System

### Light Mode
```
canvas:      #FAFAFA     — page background, clean and neutral
surface:     rgba(0,0,0,0.03)  — subtle card backgrounds
elevated:    #FFFFFF     — modal backgrounds, prominent cards
text:        #171717     — primary text, high contrast
textSoft:    #525252     — secondary text, descriptions
textMuted:   #a3a3a3     — placeholders, timestamps, hints
accent:      #E07A5F     — coral, primary action color (buttons, links, focus rings)
accentSoft:  rgba(224,122,95,0.1)  — accent backgrounds
success:     #6B9080     — sage green, completion/checkmarks
successSoft: rgba(107,144,128,0.1)  — success backgrounds
border:      rgba(0,0,0,0.06)  — subtle dividers
danger:      #DC6B6B     — delete actions
dangerSoft:  rgba(220,107,107,0.1)
```

### Dark Mode
```
canvas:      #0a0a0a
surface:     rgba(255,255,255,0.05)
elevated:    #141414
text:        #f5f5f5
textSoft:    #a0a0a0
textMuted:   #555555
accent:      #E8A990     — lighter coral for dark backgrounds
accentSoft:  rgba(232,169,144,0.12)
success:     #9ECBB3
successSoft: rgba(158,203,179,0.12)
border:      rgba(255,255,255,0.1)
danger:      #E87A7A
dangerSoft:  rgba(232,122,122,0.12)
```

### Color Rules
- One accent color (coral). That's it.
- Success (sage) only for completion states — checkmarks, progress bars when filled
- Never use accent for completion. Accent = action, Success = done.
- Dark mode should feel warm, not cold gray

---

## Typography

**Font:** System stack
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

### Scale
```
text-xs:    12px  — labels, hints, metadata
text-sm:    13px  — secondary text, subtitles
text-base:  14px  — body text, subtask items
text-lg:    16px  — task titles
text-xl:    18px  — modal headers
text-2xl:   20px  — input placeholder, page title
```

### Weights
```
normal:     400   — body text
medium:     500   — input text, task titles
semibold:   600   — headers, buttons, emphasis
```

---

## Spacing

Base unit: 4px

```
4px   — tight gaps (between dots, small elements)
6px   — subtask list gap
8px   — small padding
10px  — button padding vertical
12px  — card internal padding small
14px  — button padding horizontal
16px  — standard padding
20px  — card padding, modal section padding
24px  — page horizontal padding, modal padding
48px  — section gaps, large spacing
```

---

## Border Radius

```
6px   — small buttons, inline elements
8px   — icon buttons
10px  — input fields, subtask rows, small cards
12px  — buttons, medium elements
16px  — task cards
20px  — main input, modals
```

Principle: Larger elements get larger radius. Stay consistent.

---

## Shadows

Shadows should be subtle and warm.

```css
/* Resting card */
box-shadow: 0 2px 12px -4px rgba(0,0,0,0.08);

/* Elevated/focused */
box-shadow: 0 0 0 3px rgba(224,122,95,0.1), 0 20px 40px -15px rgba(0,0,0,0.12);

/* Hover lift */
box-shadow: 0 8px 24px -8px rgba(0,0,0,0.12);

/* Modal */
box-shadow: 0 20px 60px -15px rgba(0,0,0,0.3);
```

Dark mode: Increase opacity (0.3-0.4 instead of 0.08-0.12)

---

## Motion

All motion uses spring physics or ease-out curves. Nothing linear.

### Timing
```
150ms  — micro interactions (button press)
200ms  — hover states
250ms  — modal close
300ms  — most transitions
350ms  — modal open
500ms  — staggered list items
```

### Curves
```css
/* Standard */
transition: all 0.2s ease;

/* Spring (for modals, completion, interactive feedback) */
transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
```

### Key Animations

**Modal open:** Scale from 0.96 + translateY(10px), spring curve
**Modal close:** Same but reversed, slightly faster (250ms)
**Checkbox complete:** Check mark draws via stroke-dashoffset
**Task card hover:** Scale(1.01) + translateY(-2px) + shadow increase
**Button press:** Scale(0.95-0.98)
**Confetti:** Fall from top with rotation, varied timing per piece
**Completion celebration:** Scale bounce (0.8 → 1.05 → 1)

---

## Components

### Main Input (Hero)
- Prominent, top of page
- 20px font, medium weight
- Rounded-20, elevated background
- Focus: accent border, outer glow, slight scale(1.01)
- Helper text below: "Dump it here — I'll make it doable"
- Submit button appears when text is entered

### Task Card
- Rounded-16, elevated background, subtle border
- Title (16px semibold) + context (13px muted)
- Segmented progress bar below
- Hover: lift + shadow
- Press: scale down slightly
- Click opens detail modal

### Task Detail Modal
- Rounded-20, max-width 480px
- Header: title, context, progress bar, step count
- Delete button (with confirmation)
- Subtask list (draggable)
- Chat input at bottom for ongoing collaboration
- Matches open/close physics

### Subtask Row
- Checkbox + text + actions
- Draggable for reorder
- Click text to edit inline
- Hover reveals drag handle (⋮⋮) and delete (×)
- Completed: faded, strikethrough

### Checkbox
- 22-24px circle
- Empty: transparent with border
- Checked: sage fill, white checkmark that draws in
- Press: scale(0.85)

### Progress Bar (Segmented)
- One segment per subtask
- 4px height, rounded
- Empty: border color
- Filled: success color
- Animate fill left-to-right on change

### Chat Input (in task detail)
- Bottom of modal
- Shows conversation history above
- Typing indicator (3 pulsing dots) when AI responds
- Send button appears when text entered

### Confetti
- 50 pieces, random colors from palette
- Fall from top with rotation
- Varied sizes (6-16px)
- Mix of circles and squares
- Triggered on completing ALL subtasks in a task

### Completion Celebration
- Centered modal overlay
- 🎉 emoji, "You finished [task name]", "Nice work!"
- Spring animation in
- Auto-dismiss after 3s

---

## Interaction Patterns

### Adding a Task
1. Type in main input
2. Press enter or click "Break it down"
3. Modal opens with AI insight
4. Clarifying question(s) if needed
5. AI thinking state (floating brain, pulsing glow)
6. Results: expandable steps with links, context
7. "Add this" commits to task list

### Working a Task
1. Click task card → modal opens
2. Check off subtasks (satisfying animation)
3. Drag to reorder as priorities shift
4. Click text to edit inline
5. Use chat to ask questions or request changes
6. Complete all → confetti + celebration

### Ongoing Collaboration
The chat input in task detail allows:
- "I can't find my birth certificate" → AI suggests alternatives
- "Add a step for..." → AI adds it
- "How long does this take?" → AI answers
- "What's blocking this?" → AI helps troubleshoot

---

## Voice & Tone

Calm, helpful, never pushy.

| Don't say | Do say |
|-----------|--------|
| "You have 5 overdue tasks!" | "A few things are waiting" |
| "Great job!!! 🎉🎉🎉" | "Nice work" |
| "Don't forget to..." | "When you're ready:" |
| "Task failed" | "Didn't happen — no worries" |

Acknowledgment should feel earned, not excessive.

---

## Future Considerations (Not MVP)

- **Check-ins:** "You added this 4 days ago — want to tackle step 1?"
- **Pattern learning:** Knows when you're productive, what you avoid
- **Contextual timing:** Reminds you before appointments
- **Stuck detection:** Notices stalled tasks, offers to break down further

---

## Implementation Notes

### Recommended Stack
- **Animation:** Framer Motion for springs (or CSS cubic-bezier for simpler cases)
- **Drag & drop:** Native HTML5 drag events (keep it simple)
- **State:** React useState is fine for UI state; server state via your existing Supabase setup

### Tailwind Extensions
```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        canvas: '#FAFAFA',
        surface: 'rgba(0,0,0,0.03)',
        elevated: '#FFFFFF',
        accent: {
          DEFAULT: '#E07A5F',
          soft: 'rgba(224,122,95,0.1)',
        },
        success: {
          DEFAULT: '#6B9080',
          soft: 'rgba(107,144,128,0.1)',
        },
        danger: {
          DEFAULT: '#DC6B6B',
          soft: 'rgba(220,107,107,0.1)',
        },
      },
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
}
```

---

## Summary

Gather should feel like a capable friend who's good at planning. You tell them what's on your mind, they help you figure out the steps, and they stick around to help when you get stuck. Every interaction should feel responsive, every completion should feel earned, and the app should never make you feel bad about what you haven't done yet.
