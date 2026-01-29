# AI Integration Audit - Gather

**Auditor:** AI Integration Specialist
**Date:** 2026-01-29
**Verdict:** AI is genuinely useful but has latency issues that could cause ADHD attention drift

---

## AI Feature Inventory

| Feature | What AI Does | Trigger | Model Used | Value (1-5) |
|---------|--------------|---------|------------|-------------|
| Intent Analysis | Classifies task type, asks clarifying questions, extracts deadlines | User enters task in input | claude-3-haiku (fast) | 5 |
| Task Breakdown | Generates 3-6 actionable steps with time estimates, sources, action links | After clarifying questions OR directly for simple tasks | claude-sonnet-4 (standard) | 5 |
| Conversational Help | Answers questions about tasks, provides "I'm stuck" support | User asks question in task view | claude-sonnet-4 + web search | 4 |
| Email Analysis | Identifies actionable emails (bills, deadlines, requests) | Gmail integration scans inbox | claude-3-haiku (fast) | 3 |
| Web Search | Finds official URLs, phone numbers, fees for bureaucratic tasks | Embedded in task breakdown | Tavily API + Claude web_search | 4 |

---

## Latency Analysis

| Feature | First Feedback | First Content | Complete | Verdict |
|---------|----------------|---------------|----------|---------|
| Intent Analysis | ~50ms (thinking state) | ~800-1500ms | ~1500ms | **PASS** - Haiku is fast |
| Task Breakdown | ~50ms (thinking state) | ~2000-4000ms | ~3000-5000ms | **BORDERLINE** - Web search adds latency |
| Chat/Help | ~50ms (thinking state) | ~1500-3000ms | ~2000-4000ms | **BORDERLINE** - Agentic loop can extend |
| Email Analysis | N/A (background) | ~1000ms | ~1500ms | **PASS** - Haiku + truncated body |

### Critical Concern: ADHD Attention Window

The 2-second threshold is critical for ADHD users. Beyond this, attention drifts.

- **Intent Analysis:** Usually under 2s - **SAFE**
- **Task Breakdown:** Often 3-5s with web search - **DANGEROUS** for attention
- **Chat with web search:** Can hit 4s+ in agentic loops - **DANGEROUS**

---

## Loading State Audit

| Feature | Loading Indicator | Engaging? | ADHD-Safe |
|---------|-------------------|-----------|-----------|
| Intent Analysis | 3-dot pulse animation + rotating messages | **YES** - Messages rotate every 3s | PARTIAL |
| Task Breakdown | Same animation + "Researching specific steps..." | **YES** | PARTIAL |
| Chat | Same animation | **YES** | PARTIAL |
| Email Batch | No visible indicator (background) | N/A | N/A |

### Loading Messages (Good Pattern)
```javascript
const loadingMessages = [
  'let me look into this...',
  'checking a few things...',
  'finding what you need...',
  'one sec...',
  'pulling together the details...',
  'making this doable...',
]
```

**Assessment:** The rotating messages are good but rotate every 3 seconds - too slow. By the time message #2 appears, attention may be lost. Recommend 1.5-2s rotation or progressive disclosure of what AI is doing.

---

## Error Handling Audit

| Error Type | Handled? | User Message | Recovery Path |
|------------|----------|--------------|---------------|
| Network fail | **YES** | "I couldn't analyze that right now" | "Try again" / "Add task without steps" |
| API timeout | **PARTIAL** | Generic error | Retry option |
| AI overloaded (529) | **YES** | "The AI is a bit overloaded right now" | "Try again" / "Add task without steps" |
| Bad AI output (JSON parse fail) | **YES** | Falls back to fallback steps | Silent recovery |
| Rate limit | **NO** | Would show generic error | No specific handling |
| Missing API key | **YES** | "AI service not configured" | N/A (config issue) |

### Strengths
1. Graceful degradation - fallback steps when AI fails
2. User-friendly options for recovery
3. AI overload specifically handled with nice message

### Weaknesses
1. No specific rate limit handling
2. Timeout not adjustable by user
3. No offline detection/handling

---

## Value Assessment

| Feature | Essential | Nice-to-have | Gimmick | Should Remove |
|---------|-----------|--------------|---------|---------------|
| Intent Analysis + Questions | **X** | | | |
| Task Breakdown with Steps | **X** | | | |
| Web Search for Official Info | **X** | | | |
| Conversational "I'm stuck" help | | **X** | | |
| Email Analysis | | **X** | | |
| Task Type Detection | **X** | | | |
| Deadline Detection | | **X** | | |
| Source Citations | | **X** | | |

### What Makes This Good AI Integration

1. **AI solves a real problem:** People with ADHD struggle to break down tasks. AI does this well.
2. **Context-aware questioning:** Only asks questions that change the output (state for DMV, not color preference for forms).
3. **Produces actionable output:** Steps include specific URLs, phone numbers, scripts to say.
4. **Reduces decisions:** AI makes reasonable defaults instead of asking everything.

---

## UX Around AI

### Clarity of AI State
| Question | Answer |
|----------|--------|
| Is it clear when AI is working? | **YES** - Pulsing dots + message |
| Is it clear when AI is done? | **YES** - Card transforms to show result |
| What happens while waiting? | Rotating messages (but too slow) |
| Can users see what AI did vs their input? | **PARTIAL** - Input shown in card header |
| Can users edit/override AI suggestions? | **NO** - Must delete task and retry |
| Can users undo AI actions? | **PARTIAL** - Can delete task |

### Critical Missing Features
1. **No step editing** - Can't modify AI-generated steps
2. **No regenerate** - Can't ask AI to try again with different approach
3. **No feedback loop** - No way to tell AI "these steps weren't helpful"

---

## ADHD-Specific AI Concerns

| Concern | Status | Notes |
|---------|--------|-------|
| Does AI reduce decisions? | **YES** | Smart defaults, limited options (3-4 not 10+) |
| Does waiting cause attention drift? | **RISK** | Task breakdown can exceed 2s threshold |
| Is AI proactive? | **YES** | Asks questions before user gets stuck |
| Does AI help with task INITIATION? | **YES** | First step is always small and doable |
| Attention during AI processing? | **PARTIAL** | Loading messages help but rotate too slowly |

### ADHD-Optimized Design (Good)
```javascript
// From analyze-intent prompt:
"First step should be tiny and immediately doable"
"Prefer 'pick one' over 'consider options'"
"Make decisions for the user when reasonable"
"Time estimates on every step"
```

This is excellent ADHD-aware AI design.

---

## Prompt Engineering Assessment

### Intent Analysis Prompt (analyze-intent/route.ts)
**Quality: EXCELLENT**

Strengths:
- Task type detection with specific handling for each type
- Clear rules for when to ask questions vs proceed
- Explicit "bad step" examples to avoid
- ADHD adaptations built into the prompt
- Deadline detection with hard/soft/flexible classification

Concerns:
- Prompt is ~190 lines - could cause inconsistency
- No injection protection visible

### Task Breakdown Prompt (suggest-subtasks/route.ts)
**Quality: VERY GOOD**

Strengths:
- Detailed examples of good vs bad steps
- Task-type-specific instructions
- Web search integration for real data
- Step count guidance (3-10 depending on task)

Concerns:
- No protection against hallucinated URLs (relies on search)
- Prompt says "NEVER fabricate URLs" but no verification

### Chat Prompt (chat/route.ts)
**Quality: GOOD**

Strengths:
- JSON response format enforced
- "I'm stuck" pattern recognition
- Action buttons suggested based on context
- Source preference (.gov/.edu over forums)

Concerns:
- Fixed max_tokens=512 might truncate responses
- No handling for very long conversations

---

## Missing AI Opportunities

1. **Proactive reminders based on patterns**
   - AI could notice "you always snooze this type of task" and suggest different approach

2. **Step completion prediction**
   - AI could learn which steps user struggles with and offer pre-emptive help

3. **Task similarity detection**
   - "You did something similar last month - want to use those steps?"

4. **Time-of-day optimization**
   - "You usually complete phone calls in the morning - want me to remind you then?"

5. **Celebration calibration**
   - AI could learn what level of celebration resonates (some users hate confetti)

---

## AI Feature Bloat

**None identified.** Every AI feature serves a clear purpose for ADHD users.

The email analysis could be considered nice-to-have, but it's not intrusive (background processing) and genuinely helps identify actionable items.

---

## Brutal Assessment

This is **genuinely good AI integration**, not AI for AI's sake. The AI solves real problems:

1. **Task breakdown** - The core value prop. ADHD users can't break down tasks. AI does this with specific, actionable steps including real URLs and phone numbers.

2. **Smart questioning** - Only asks what matters. Won't ask 10 questions when 2 will do. Remembers preferences (state) for next time.

3. **"I'm stuck" support** - Meets users where they are. Doesn't shame, gives one specific next action.

**However, the latency is a real problem.** Task breakdown regularly exceeds the 2-second ADHD attention threshold. Users might:
- Switch tabs while waiting
- Forget what they were doing
- Lose the motivation that made them open the app

The loading experience is good but not good enough for the wait times involved.

---

## The Real Question

Would users:
- [x] **Pay more for the AI features** - Yes, the task breakdown alone is worth it
- [ ] Use the app the same without AI - No, it would just be another todo app
- [ ] Actually prefer it without AI - No
- [ ] Not notice if AI was removed - Definitely not

**Verdict: AI is the product.** Without AI task breakdown, Gather is just another todo app. The AI differentiation is real and valuable.

---

## Recommendations

### High Priority

1. **Reduce task breakdown latency**
   - Pre-cache common task patterns
   - Stream steps as they're generated (show first step immediately)
   - Consider parallel search queries
   - Target: First step visible in <1.5s

2. **Faster loading message rotation**
   - Change from 3000ms to 1500ms
   - Add progress indicator ("Finding official requirements..." → "Checking state-specific rules...")

3. **Add step editing**
   - Let users modify AI-generated steps
   - Critical for when AI gets something wrong

### Medium Priority

4. **Add "regenerate steps" option**
   - Sometimes AI approach doesn't fit user's situation
   - Let them ask for different breakdown

5. **Streaming responses for chat**
   - Show answer as it streams
   - Keeps attention during wait

6. **Better offline handling**
   - Detect offline state
   - Queue tasks for AI processing when back online
   - Show "Will break down when connected"

### Low Priority

7. **Rate limit handling**
   - Show friendly message with retry timer
   - Offer "add without AI" immediately

8. **Feedback mechanism**
   - "Were these steps helpful?" after completion
   - Use to improve prompts

---

## Model Configuration Review

Current config (`src/config/ai.ts`):
```javascript
AI_MODEL_FAST = 'claude-3-haiku-20240307'      // Intent, email
AI_MODEL_STANDARD = 'claude-sonnet-4-20250514' // Tasks, chat
```

**Assessment:** Good choices. Haiku for fast classification, Sonnet for quality reasoning.

**Suggestion:** Consider Claude 3.5 Haiku for the fast model when available - it may offer better quality at similar speed.

---

## Conclusion

Gather's AI integration is **substantive and valuable**, not decoration. The task breakdown feature alone justifies the AI usage. The ADHD-specific prompt engineering shows thoughtful product design.

**Primary concern:** Latency during task breakdown can exceed ADHD attention thresholds. This is the biggest risk to user retention.

**Score: 4/5** - Genuinely useful AI that could be excellent with latency improvements.
