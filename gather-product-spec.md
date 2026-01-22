# Gather

## An executive function layer for the rest of us

---

## The Problem

There's a growing population of people — diagnosed ADHD, undiagnosed ADHD, or neurotypical people overwhelmed by modern life — who experience the same cluster of symptoms:

- Important tasks float in the back of their mind, creating constant low-grade anxiety
- Big tasks feel impossible to start; they don't naturally break down into steps
- Todo lists become graveyards — items added, never completed, eventually abandoned
- They pay the "ADHD tax" — late fees, missed refunds, expired opportunities, damaged relationships
- They know what they *should* do but can't bridge the gap to *doing* it
- Guilt compounds: not calling family, not exercising, not dealing with the bills

Current solutions don't work for this population:

| Solution | Why it fails |
|----------|--------------|
| Todo apps | Tasks sit there. Checking boxes feels like homework. No accountability. |
| Habit trackers | Streaks become stress. Missing one day feels like total failure. |
| Budgeting apps | Show you data, don't intervene. You see you overspent *after* the damage. |
| Calendar blocking | Requires executive function to set up and maintain — the thing you lack. |
| Therapy/coaching | Expensive, not available in the moment, weekly at best. |

**What's missing:** Something that *actively participates in your life* — that reaches out, that knows your context, that does the cognitive work, that speaks to you like a trusted friend who won't let you off the hook.

---

## The Product

**Gather** is an AI companion that:

1. **Watches your life** — finances, calendar, relationships, obligations
2. **Handles the cognitive overhead** — research, planning, breaking down tasks
3. **Reaches out at the right moments** — proactive, not reactive
4. **Speaks with compassion and honesty** — not a yes-man, not a drill sergeant
5. **Makes action frictionless** — one tap to call, one click to pay, everything pre-researched
6. **Reflects your patterns back to you** — weekly summaries, honest observations, celebrated wins

It's not a todo app. It's an **executive function layer** — the part of the brain that ADHD impacts, externalized into software.

---

## Core Principles

### 1. Authenticity over politeness

The app speaks like a trusted friend who knows you well. Compassion first, but real.

**Not this:**
> "Consider reaching out to friends! Social connection is important for wellbeing. 🌟"

**This:**
> "It's been 12 days since you've seen anyone. That's a pattern. Want to text Mike and see if he's free Thursday?"

### 2. Zero friction

Don't show the task — show the button that completes it.

**Not this:**
> "Task: Pay speeding ticket by March 13"

**This:**
> "Speeding ticket due in 52 days. Here's the link, your case number is CHPSK33983, total is $301. [Pay now →]"

The AI does the research. The AI finds the phone numbers. The AI writes the email. You just execute.

### 3. Don't make me check boxes

Infer completion when possible:
- See a call to Grandpa in call logs? Mark it done.
- GPS shows you went to the gym? Mark it done.
- Bank transaction shows payment to Sonoma Court? Ticket paid.

When inference isn't possible, ask conversationally:
> "Did you end up going for that walk?"

Not a checkbox. A question from someone who cares.

### 4. Break everything down

Big tasks are invisible to ADHD brains. They don't feel like tasks — they feel like walls.

**Not this:**
> "Dispute medical bills"

**This:**
> "Let's deal with the Vituity bill. I wrote the email. Your Member ID is [X]. Here's what you do:
> 1. Open Gmail
> 2. Paste this (I copied it)
> 3. Hit send
> 
> That's it. The other two can wait until tomorrow."

### 5. Scheduled co-working

The app proposes focus time:
> "Want to knock out the traffic school signup tomorrow at 2pm? I'll have everything ready."

At 2pm:
> "Ready? Here's the link. It takes about 20 minutes. I'll check in when you're done."

After:
> "Done? Nice. That's been hanging over you for weeks. How do you feel?"

### 6. Proactive, not reactive

The app reaches out first. It doesn't wait to be opened.

- Morning: "Here's what's on your radar today. Nothing urgent — but it's been 10 days since you called Grandpa."
- After a purchase: "You just spent $43 at DoorDash. That's the 4th time this week — you're at $180. You budgeted $100 for food delivery this month."
- Evening: "You did the meditation this morning and sent the insurance email. That's a good day. Anything else you want to capture before tomorrow?"

### 7. Prevent the ADHD tax

The app knows about deadlines before you do.

- "Japan flights for next winter are cheapest 10-11 months out. I'll watch prices and tell you when to book."
- "Your car registration expires in 45 days. Here's the DMV link. Want to do it now while you're thinking about it?"
- "The 2021 tax refund deadline is April 15. That's 3 months away. If we don't file by then, that money is gone forever."

### 8. Weekly reflection

Every Sunday (or whenever):

> **This week:**
> - You sent the three medical bill dispute emails (finally)
> - You called Grandpa twice
> - You went to the gym 2x
> - You stayed under budget on food delivery
> 
> **Patterns I noticed:**
> - You tend to avoid tasks on Monday and then cram on Thursday
> - Evening DoorDash is your danger zone
> 
> **This week, maybe:**
> - Traffic school payment is due in 45 days
> - You mentioned wanting to play piano more — you haven't logged any practice
> 
> **You're doing better than you think.**

---

## User Profile: Will

To ground the product, here's the first user:

**Will, 29, software engineer in San Francisco**

- Works from home, unstructured days
- Recently out of a long relationship; apartment feels empty
- Two cats who need attention
- Wants to learn piano, cook more, call his grandpa
- Currently dealing with:
  - ~$9K in medical bills sent to collections (improperly — providers never billed insurance)
  - A speeding ticket due March 13
  - Unfiled 2024 taxes (owed a refund)
  - Submitted $5K therapy reimbursement claim
  - Wants to book Japan trip for next winter
  - Needs to downgrade Costco membership (no longer has car)
- Has tried todo apps; they don't stick
- Bites his nails when stressed
- Knows what he should do; struggles to do it
- Wants to be someone he's proud of

The product should work perfectly for Will. If it does, it'll work for the thousands of people like him.

---

## Features

### Phase 1: MVP (2 weeks)

**Goal:** Something Will actually uses every day that's meaningfully better than what exists.

| Feature | Description |
|---------|-------------|
| **Mobile-first web app** | Warm, minimal UI (already built as "Gather"). Works on phone browser. |
| **SMS check-ins via Twilio** | Morning nudge, evening reflection, ad-hoc alerts. App reaches out first. |
| **AI task breakdown** | "Help me with this" opens a chat. AI searches the web, finds numbers/links, writes scripts, breaks into steps. |
| **One-tap actions** | Call Grandpa = `tel:` link with his number. Pay ticket = direct URL with case number pre-filled. |
| **Soul tracking** | Non-judgmental "time since" for relationships and personal activities. Not streaks — awareness. |
| **Manual confirmations (for now)** | "Did you do this?" asked conversationally, not checkboxes. |
| **Context storage** | App remembers: Member ID, case numbers, family phone numbers, budget, goals. Doesn't ask twice. |

**Tech stack:**
- Frontend: HTML/CSS/JS (current) → migrate to React or Svelte for state management
- Backend: Supabase (auth, database, edge functions) or Railway + Postgres
- SMS: Twilio
- AI: Anthropic API with web search tool
- Hosting: Vercel or Netlify

### Phase 2: Real integrations (1-2 months)

| Feature | Description |
|---------|-------------|
| **Plaid integration** | Connect bank accounts. Real-time transaction alerts. "You just spent $X at Y." |
| **Budget tracking** | Set budgets by category. Proactive warnings, not retrospective reports. |
| **Calendar sync** | Know when you're busy. Suggest focus blocks. "You have 2 hours free Thursday afternoon — want to tackle the taxes then?" |
| **Contact book access** | Pull phone numbers. Show contact card when suggesting you call someone. |
| **Smart reminders** | Not just time-based. "You're near Costco — want to downgrade your membership while you're here?" (location-aware) |
| **Price watching** | "Japan flights are $847 right now. That's $200 less than last week. Book?" |

### Phase 3: Native app + automation (3-6 months)

| Feature | Description |
|---------|-------------|
| **Native iOS/Android app** | Push notifications. Background processing. Proper presence on device. |
| **Automatic completion detection** | Call logs, location, transaction history used to infer task completion. |
| **Weekly reflection emails** | Beautifully formatted. Honest. Celebratory. |
| **Pattern recognition** | "You always overspend on weekends. Want me to check in Saturday morning?" |
| **Onboarding that learns** | First week asks questions, observes behavior, tailors nudges to your patterns. |
| **Shared accountability** | Optional: connect with a friend who gets notified if you're struggling. |

### Future / Maybe

- **Voice interface**: "Hey Gather, did I pay the electric bill?"
- **Therapist/coach integration**: Share summaries with your support system
- **Proactive life admin**: "Your car insurance renews in 60 days. I found 3 cheaper options. Want me to compare?"
- **Community features**: Anonymous sharing of wins, patterns, struggles with others like you

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Web App   │  │  iOS App    │  │ Android App │          │
│  │  (React)    │  │  (React     │  │  (React     │          │
│  │             │  │   Native)   │  │   Native)   │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
└─────────┼────────────────┼────────────────┼─────────────────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                      API LAYER                               │
│                    (Supabase Edge Functions                  │
│                     or Node.js on Railway)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Auth      │  │   Tasks     │  │   Check-ins │          │
│  │   Service   │  │   Service   │  │   Service   │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┬───────────────┐
          ▼               ▼               ▼               ▼
   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
   │  Supabase   │ │  Anthropic  │ │   Twilio    │ │   Plaid     │
   │  (Postgres) │ │  Claude API │ │   (SMS)     │ │ (Banking)   │
   │             │ │  + Search   │ │             │ │             │
   └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

**Data stored:**
- User profile (name, phone, timezone, preferences)
- Tasks (with full context, status, due dates, AI-generated breakdowns)
- Soul activities (last completed timestamps)
- Transactions (from Plaid)
- Budgets and spending rules
- Check-in history
- Contacts (synced from phone or manual)
- Conversation history with AI

**Scheduled jobs:**
- Morning check-in (8am user timezone)
- Evening reflection (8pm user timezone)
- Weekly summary (Sunday 10am)
- Price watchers (daily)
- Deadline warnings (as needed)

---

## Voice & Tone

The app speaks like a **trusted friend who's known you for years**. Not a corporate app. Not an AI assistant. A person.

**Characteristics:**
- Warm but direct
- Notices patterns, says them out loud
- Celebrates wins without being cheesy
- Calls out avoidance without shaming
- Knows when to push and when to give space
- Has a slight sense of humor, but not performative
- Never uses corporate wellness language
- Never uses excessive emoji
- Speaks in lowercase when casual, proper sentences when serious

**Examples:**

*Morning check-in:*
> morning. nothing urgent today, but you've got that traffic school payment due in 7 weeks. might feel good to just knock it out? I have the link ready.
>
> also — 11 days since you called grandpa.

*After completing something hard:*
> you sent the emails. all three. that's been hanging over you for weeks and you just... did it. seriously, that's not nothing.
>
> take a break if you need one. or keep the momentum — want to look at the tax stuff?

*Budget alert:*
> heads up — you just spent $38 at Uber Eats. that's $156 on delivery this week, and it's only Thursday. you budgeted $100.
>
> not judging. just making sure you see it.

*Gentle nudge on avoidance:*
> so... the taxes. you've pushed this three times now. what's the actual blocker? is it finding the documents? is it not knowing where to start?
>
> talk to me. we can figure this out.

---

## Monetization (Future)

**Free tier:**
- Basic task management
- AI breakdowns (limited/month)
- SMS check-ins (limited)

**Pro ($10-15/month):**
- Unlimited AI breakdowns
- Plaid integration (banking alerts)
- Unlimited SMS
- Weekly reflections
- Price watching

**Positioning:**
"The ADHD tax costs people hundreds or thousands of dollars a year in late fees, missed refunds, and forgotten subscriptions. Gather pays for itself."

---

## Success Metrics

**For Will (the individual):**
- Admin tasks don't pile up
- Bills paid on time
- Relationships maintained (calls grandpa weekly)
- Feels proud of who he's becoming
- Nail biting decreases (stress indicator)

**For the product:**
- Daily active usage (app opened or responded to SMS)
- Task completion rate
- User-reported stress/anxiety levels (periodic check-in)
- Retention (still using after 30, 60, 90 days)
- "ADHD tax" avoided (late fees prevented, refunds captured)

---

## What's Next

1. **Finalize Phase 1 scope** — exactly which features ship in 2 weeks
2. **Set up infrastructure** — Supabase project, Twilio account, domain
3. **Build the backend** — user auth, task storage, SMS integration
4. **Upgrade the frontend** — React migration, better state management
5. **Write the check-in logic** — morning/evening messages, tone
6. **Test with Will** — daily usage, feedback, iteration
7. **Expand to beta users** — 5-10 people with similar profiles

---

## Will's Current Task Queue

To be imported into the app:

| Task | Category | Due | Status |
|------|----------|-----|--------|
| Send Vituity dispute email | Admin/Medical | ASAP | Ready to send |
| Send IGT dispute email | Admin/Medical | ASAP | Ready to send |
| Send UCSF verification email | Admin/Medical | ASAP | Ready to send |
| Pay speeding ticket ($301) | Admin/Legal | March 13, 2026 | Link ready |
| Complete traffic school | Admin/Legal | ~60 days after payment | Waiting |
| File 2024 taxes | Admin/Financial | No deadline (refund) | Not started |
| Downgrade Costco membership | Admin/Financial | Whenever | Not started |
| Book Japan flights | Travel | ~Dec 2026, buy 10-11mo out | Watch prices starting Feb |
| Therapy reimbursement | Admin/Medical | Submitted | Waiting for EOB |

**Soul activities:**
- Play with cats
- Piano practice
- Go for a walk
- Cook something real
- Call Grandpa
- Coffee with uncle
- See a friend

---

*This is Gather. Let's build it.*
