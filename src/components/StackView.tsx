'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Task, Step } from '@/hooks/useUserData'
import { useAuth } from './AuthProvider'
import { splitStepText } from '@/lib/stepText'
import { getDeadlineUrgency } from './DeadlineBadge'

// Card types
type EmailCard = { type: 'email'; id: string; subject: string; from: string; snippet: string }
type CalendarCard = { type: 'calendar'; id: string; title: string; time: string; location?: string }

type StackCard =
  | { type: 'step'; task: Task; step: Step; dismissCount: number }
  | { type: 'task'; task: Task; dismissCount: number }
  | EmailCard
  | CalendarCard

interface StackViewProps {
  tasks: Task[]
  onToggleStep: (taskId: string, stepId: string | number) => void
  onGoToTask: (taskId: string) => void
  onAddTask: (title: string) => void
  onDismissEmail?: (emailId: string) => void
  onAddEmailAsTask?: (email: { subject: string; from: string }) => void
}

// Affirmations - brief, unexpected, not cheesy
const AFFIRMATIONS = [
  'done.',
  'gone.',
  'cleared.',
  'handled.',
  'check.',
  'nice.',
  'onwards.',
  'one less.',
  '✓',
]

// Persist dismiss counts
function getDismissCounts(): Record<string, number> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem('gather-dismiss-counts') || '{}')
  } catch {
    return {}
  }
}

function incrementDismissCount(id: string): number {
  const counts = getDismissCounts()
  counts[id] = (counts[id] || 0) + 1
  localStorage.setItem('gather-dismiss-counts', JSON.stringify(counts))
  return counts[id]
}

function clearDismissCount(id: string): void {
  const counts = getDismissCounts()
  delete counts[id]
  localStorage.setItem('gather-dismiss-counts', JSON.stringify(counts))
}

// Get time-of-day ambient color
function getAmbientGradient(stackSize: number, isDark: boolean): string {
  const hour = new Date().getHours()

  // Base warmth increases as stack shrinks
  const progressWarmth = Math.max(0, 1 - stackSize / 10) // 0 to 1

  if (isDark) {
    // Dark mode: deep blues to warmer dark tones
    if (hour >= 5 && hour < 8) {
      // Early morning - deep blue with hints of dawn
      return `radial-gradient(ellipse at 50% 120%,
        hsl(${220 + progressWarmth * 15}, 30%, ${8 + progressWarmth * 4}%) 0%,
        hsl(230, 25%, 6%) 100%)`
    } else if (hour >= 8 && hour < 17) {
      // Day - neutral dark with subtle warmth
      return `radial-gradient(ellipse at 50% 120%,
        hsl(${240 - progressWarmth * 30}, 15%, ${10 + progressWarmth * 3}%) 0%,
        hsl(240, 10%, 5%) 100%)`
    } else if (hour >= 17 && hour < 21) {
      // Evening - warm amber undertones
      return `radial-gradient(ellipse at 50% 120%,
        hsl(${30 + progressWarmth * 10}, ${25 + progressWarmth * 15}%, ${10 + progressWarmth * 4}%) 0%,
        hsl(20, 15%, 5%) 100%)`
    } else {
      // Night - deep blue-black
      return `radial-gradient(ellipse at 50% 120%,
        hsl(${230 - progressWarmth * 20}, 30%, ${7 + progressWarmth * 3}%) 0%,
        hsl(235, 25%, 4%) 100%)`
    }
  } else {
    // Light mode
    if (hour >= 5 && hour < 8) {
      // Morning - soft golden
      return `radial-gradient(ellipse at 50% 0%,
        hsl(${45 - progressWarmth * 10}, ${30 + progressWarmth * 20}%, ${97 - progressWarmth * 3}%) 0%,
        hsl(40, 20%, 98%) 100%)`
    } else if (hour >= 8 && hour < 17) {
      // Day - clean, slight warmth with progress
      return `radial-gradient(ellipse at 50% 0%,
        hsl(${50 - progressWarmth * 20}, ${10 + progressWarmth * 20}%, ${98 - progressWarmth * 2}%) 0%,
        hsl(50, 10%, 98%) 100%)`
    } else if (hour >= 17 && hour < 21) {
      // Evening - warm peachy
      return `radial-gradient(ellipse at 50% 0%,
        hsl(${25 + progressWarmth * 10}, ${35 + progressWarmth * 20}%, ${96 - progressWarmth * 4}%) 0%,
        hsl(30, 25%, 97%) 100%)`
    } else {
      // Night - cooler, muted
      return `radial-gradient(ellipse at 50% 0%,
        hsl(${230 + progressWarmth * 20}, ${15 + progressWarmth * 10}%, ${96 + progressWarmth * 2}%) 0%,
        hsl(225, 15%, 97%) 100%)`
    }
  }
}

export function StackView({
  tasks,
  onToggleStep,
  onGoToTask,
  onAddTask,
  onAddEmailAsTask,
}: StackViewProps) {
  const { session } = useAuth()
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [swipeX, setSwipeX] = useState(0)
  const [swipeVelocity, setSwipeVelocity] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [completingCard, setCompletingCard] = useState<string | null>(null)
  const [affirmation, setAffirmation] = useState<string | null>(null)
  const [emails, setEmails] = useState<EmailCard[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarCard[]>([])
  const [inputValue, setInputValue] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [isDark, setIsDark] = useState(false)

  const dragStartX = useRef(0)
  const lastDragX = useRef(0)
  const lastDragTime = useRef(0)
  const holdTimer = useRef<NodeJS.Timeout | null>(null)
  const holdStartTime = useRef(0)

  // Detect dark mode
  useEffect(() => {
    const checkDark = () => setIsDark(document.documentElement.classList.contains('dark'))
    checkDark()
    const observer = new MutationObserver(checkDark)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Build the card stack
  const stack = useMemo(() => {
    const cards: StackCard[] = []
    const counts = getDismissCounts()

    const sortedTasks = [...tasks].sort((a, b) =>
      getDeadlineUrgency(a.due_date) - getDeadlineUrgency(b.due_date)
    )

    for (const task of sortedTasks) {
      const hasSteps = task.steps && task.steps.length > 0
      const incompleteSteps = task.steps?.filter(s => !s.done) || []

      if (hasSteps && incompleteSteps.length > 0) {
        const step = incompleteSteps[0]
        const id = `step-${task.id}-${step.id}`
        if (!dismissedIds.has(id)) {
          cards.push({ type: 'step', task, step, dismissCount: counts[id] || 0 })
        }
      } else if (!hasSteps) {
        const id = `task-${task.id}`
        if (!dismissedIds.has(id)) {
          cards.push({ type: 'task', task, dismissCount: counts[id] || 0 })
        }
      }
    }

    for (const email of emails.slice(0, 3)) {
      if (!dismissedIds.has(email.id)) cards.push(email)
    }

    for (const event of calendarEvents.slice(0, 2)) {
      if (!dismissedIds.has(event.id)) cards.push(event)
    }

    return cards
  }, [tasks, emails, calendarEvents, dismissedIds])

  // Fetch emails
  useEffect(() => {
    async function fetchEmails() {
      if (!session?.access_token) return
      try {
        const res = await fetch('/api/emails/scan', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setEmails((data.potentialTasks || []).slice(0, 5).map((e: { id: string; subject: string; from: string; snippet: string }) => ({
            type: 'email' as const,
            id: `email-${e.id}`,
            subject: e.subject,
            from: e.from,
            snippet: e.snippet,
          })))
        }
      } catch (err) {
        console.error('Error fetching emails:', err)
      }
    }
    fetchEmails()
  }, [session?.access_token])

  // Fetch calendar
  useEffect(() => {
    async function fetchCalendar() {
      if (!session?.access_token) return
      try {
        const res = await fetch('/api/calendar/events?days=2', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (res.ok) {
          const data = await res.json()
          if (data.enabled && data.events) {
            setCalendarEvents(data.events.slice(0, 3).map((e: { id: string; title: string; start_time: string; location?: string }) => ({
              type: 'calendar' as const,
              id: `cal-${e.id}`,
              title: e.title,
              time: formatTime(e.start_time),
              location: e.location,
            })))
          }
        }
      } catch (err) {
        console.error('Error fetching calendar:', err)
      }
    }
    fetchCalendar()
  }, [session?.access_token])

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

    if (date.toDateString() === now.toDateString()) return `Today ${time}`
    if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow ${time}`
    return `${date.toLocaleDateString([], { weekday: 'short' })} ${time}`
  }

  // Get card ID
  const getCardId = (card: StackCard): string => {
    if (card.type === 'step') return `step-${card.task.id}-${card.step.id}`
    if (card.type === 'task') return `task-${card.task.id}`
    return card.id
  }

  // Drag handlers with velocity tracking
  const handleDragStart = (clientX: number) => {
    if (stack.length === 0 || completingCard) return
    dragStartX.current = clientX
    lastDragX.current = clientX
    lastDragTime.current = Date.now()
    setIsDragging(true)
    setSwipeVelocity(0)
  }

  const handleDragMove = (clientX: number) => {
    if (!isDragging) return

    const now = Date.now()
    const dt = now - lastDragTime.current
    if (dt > 0) {
      const velocity = (clientX - lastDragX.current) / dt
      setSwipeVelocity(velocity)
    }

    lastDragX.current = clientX
    lastDragTime.current = now
    setSwipeX(clientX - dragStartX.current)
  }

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    const threshold = 100
    const velocityThreshold = 0.5
    const topCard = stack[0]

    // Use either position or velocity to trigger dismiss
    const shouldDismiss = Math.abs(swipeX) > threshold || Math.abs(swipeVelocity) > velocityThreshold

    if (shouldDismiss && topCard) {
      const direction = swipeX > 0 || swipeVelocity > 0 ? 1 : -1
      // Animate out with momentum
      setSwipeX(direction * 600)

      setTimeout(() => {
        const cardId = getCardId(topCard)
        incrementDismissCount(cardId)
        setDismissedIds(prev => new Set(prev).add(cardId))
        setSwipeX(0)
        setSwipeVelocity(0)
      }, 250)
    } else {
      // Spring back
      setSwipeX(0)
      setSwipeVelocity(0)
    }
  }, [isDragging, swipeX, swipeVelocity, stack])

  // Hold to complete
  const startHold = useCallback(() => {
    if (stack.length === 0 || completingCard) return

    setIsHolding(true)
    holdStartTime.current = Date.now()

    const animate = () => {
      const elapsed = Date.now() - holdStartTime.current
      const progress = Math.min(elapsed / 400, 1) // 400ms to complete
      setHoldProgress(progress)

      if (progress < 1) {
        holdTimer.current = setTimeout(animate, 16)
      } else {
        // Complete!
        handleComplete(stack[0])
      }
    }
    animate()
  }, [stack, completingCard])

  const endHold = useCallback(() => {
    setIsHolding(false)
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    // Ease back if not completed
    if (holdProgress < 1) {
      setHoldProgress(0)
    }
  }, [holdProgress])

  // Complete action
  const handleComplete = useCallback((card: StackCard) => {
    const cardId = getCardId(card)
    setCompletingCard(cardId)
    setHoldProgress(0)
    setIsHolding(false)

    // Show random affirmation
    setAffirmation(AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)])

    // Execute the action
    if (card.type === 'step') {
      clearDismissCount(cardId)
      onToggleStep(card.task.id, card.step.id)
    } else if (card.type === 'task') {
      clearDismissCount(cardId)
      onGoToTask(card.task.id)
      return
    } else if (card.type === 'email') {
      onAddEmailAsTask?.({ subject: card.subject, from: card.from })
    }

    // Animate out, then remove
    setTimeout(() => {
      setDismissedIds(prev => new Set(prev).add(cardId))
      setCompletingCard(null)
      setAffirmation(null)
    }, 600)
  }, [onToggleStep, onGoToTask, onAddEmailAsTask])

  // Submit new task
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      onAddTask(inputValue.trim())
      setInputValue('')
      setShowInput(false)
    }
  }

  // Get wear level
  const getWearLevel = (count: number) => Math.min(count, 3)

  // Render a card
  const renderCard = (card: StackCard, index: number) => {
    const isTop = index === 0
    const cardId = getCardId(card)
    const isCompleting = completingCard === cardId
    const wearLevel = 'dismissCount' in card ? getWearLevel(card.dismissCount) : 0

    // Transform calculations
    const baseOffset = index * 12
    const baseScale = 1 - index * 0.04
    const baseRotation = index * 1.5 - 1.5

    // Top card follows swipe
    const swipeRotation = isTop ? swipeX * 0.04 : 0
    const swipeOffset = isTop ? swipeX : 0
    const opacity = isTop ? Math.max(0.3, 1 - Math.abs(swipeX) / 500) : 1 - index * 0.15

    // Completing animation
    const completingScale = isCompleting ? 0.95 : 1
    const completingOpacity = isCompleting ? 0 : opacity
    const completingY = isCompleting ? -40 : 0

    // Wear indicator dots
    const wearDots = wearLevel > 0 && (
      <div className="absolute top-5 right-5 flex gap-1.5 z-10">
        {Array.from({ length: wearLevel }).map((_, i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              background: `hsl(${20 + i * 10}, ${60 + i * 10}%, ${60 - i * 5}%)`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            }}
          />
        ))}
      </div>
    )

    // Card content based on type
    let contextLabel = ''
    let mainText = ''
    let buttonText = 'Done'
    let isSecondary = false

    if (card.type === 'step') {
      const { title } = splitStepText(card.step.text)
      contextLabel = title.toLowerCase() === card.task.title.toLowerCase()
        ? 'next step'
        : card.task.title
      mainText = title
    } else if (card.type === 'task') {
      contextLabel = 'task'
      mainText = card.task.title
      buttonText = 'Break it down'
    } else if (card.type === 'email') {
      contextLabel = card.from
      mainText = card.subject
      buttonText = 'Add as task'
    } else if (card.type === 'calendar') {
      contextLabel = card.time
      mainText = card.title
      buttonText = 'Got it'
      isSecondary = true
    }

    return (
      <div
        key={cardId}
        className="stack-card absolute inset-0"
        style={{
          transform: `
            translateX(${swipeOffset}px)
            translateY(${baseOffset + completingY}px)
            scale(${baseScale * completingScale})
            rotate(${baseRotation + swipeRotation}deg)
          `,
          opacity: completingOpacity,
          zIndex: 10 - index,
          transition: isDragging && isTop
            ? 'none'
            : isCompleting
              ? 'all 0.5s cubic-bezier(0.32, 0.72, 0, 1)'
              : 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
          pointerEvents: isTop && !completingCard ? 'auto' : 'none',
        }}
        onMouseDown={isTop ? (e) => handleDragStart(e.clientX) : undefined}
        onMouseMove={isTop ? (e) => handleDragMove(e.clientX) : undefined}
        onMouseUp={isTop ? handleDragEnd : undefined}
        onMouseLeave={isTop ? handleDragEnd : undefined}
        onTouchStart={isTop ? (e) => handleDragStart(e.touches[0].clientX) : undefined}
        onTouchMove={isTop ? (e) => handleDragMove(e.touches[0].clientX) : undefined}
        onTouchEnd={isTop ? handleDragEnd : undefined}
      >
        {/* Card body */}
        <div
          className={`
            relative h-full
            bg-gradient-to-b from-[var(--card)] to-[color-mix(in_srgb,var(--card)_97%,var(--text))]
            rounded-[28px] overflow-hidden
            cursor-grab active:cursor-grabbing select-none
          `}
          style={{
            boxShadow: isTop
              ? `
                0 1px 1px rgba(0,0,0,0.02),
                0 2px 4px rgba(0,0,0,0.03),
                0 4px 8px rgba(0,0,0,0.04),
                0 8px 16px rgba(0,0,0,0.05),
                0 16px 32px rgba(0,0,0,0.06),
                inset 0 1px 0 rgba(255,255,255,${isDark ? 0.05 : 0.8}),
                inset 0 -1px 0 rgba(0,0,0,0.05)
              `
              : `
                0 2px 8px rgba(0,0,0,0.08),
                inset 0 1px 0 rgba(255,255,255,${isDark ? 0.03 : 0.5})
              `,
          }}
        >
          {/* Subtle grain texture */}
          <div
            className="absolute inset-0 opacity-[0.015] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Top edge highlight */}
          <div
            className="absolute top-0 left-4 right-4 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, rgba(255,255,255,${isDark ? 0.1 : 0.6}), transparent)`,
            }}
          />

          {wearDots}

          {/* Content */}
          <div className="relative h-full flex flex-col p-7 pt-8">
            {/* Context - whisper */}
            <div className="text-[11px] font-medium uppercase tracking-[0.15em] text-[var(--text-muted)] mb-2">
              {contextLabel}
            </div>

            {/* Main text - unmissable */}
            <h2
              className="text-[32px] leading-[1.15] font-semibold text-[var(--text)] mb-auto"
              style={{ fontFamily: 'var(--font-display), var(--font-sans)' }}
            >
              {mainText}
            </h2>

            {/* Affirmation overlay */}
            {isCompleting && affirmation && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  animation: 'affirmationIn 0.4s ease-out forwards',
                }}
              >
                <span
                  className="text-4xl font-medium text-[var(--success)]"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {affirmation}
                </span>
              </div>
            )}

            {/* Action button */}
            {isTop && !isCompleting && (
              <div className="mt-6">
                <button
                  onMouseDown={startHold}
                  onMouseUp={endHold}
                  onMouseLeave={endHold}
                  onTouchStart={startHold}
                  onTouchEnd={endHold}
                  className={`
                    relative w-full py-5 rounded-2xl text-lg font-semibold
                    transition-all duration-150
                    ${isSecondary
                      ? 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]'
                      : 'bg-[var(--accent)] text-white'
                    }
                    ${isHolding ? 'scale-[0.97]' : 'active:scale-[0.98]'}
                  `}
                  style={{
                    boxShadow: isSecondary
                      ? 'none'
                      : `
                        0 2px 4px rgba(217, 117, 86, 0.3),
                        0 4px 8px rgba(217, 117, 86, 0.2),
                        inset 0 1px 0 rgba(255,255,255,0.2),
                        inset 0 -1px 0 rgba(0,0,0,0.1)
                      `,
                  }}
                >
                  {/* Hold progress fill */}
                  {!isSecondary && (
                    <div
                      className="absolute inset-0 rounded-2xl bg-white/20 origin-left"
                      style={{
                        transform: `scaleX(${holdProgress})`,
                        transition: isHolding ? 'none' : 'transform 0.15s ease-out',
                      }}
                    />
                  )}
                  <span className="relative z-10">{buttonText}</span>
                </button>

                {/* Skip hint */}
                <div className="mt-4 text-center text-[13px] text-[var(--text-muted)]">
                  swipe to skip for now
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Empty state - genuinely peaceful
  if (stack.length === 0) {
    return (
      <div
        className="min-h-screen flex flex-col transition-all duration-1000"
        style={{ background: getAmbientGradient(0, isDark) }}
      >
        {/* Soft glow in center */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: isDark
              ? 'radial-gradient(circle at 50% 40%, rgba(232, 169, 144, 0.04) 0%, transparent 60%)'
              : 'radial-gradient(circle at 50% 40%, rgba(217, 117, 86, 0.03) 0%, transparent 60%)',
          }}
        />

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div
            className="text-center mb-10"
            style={{ animation: 'emptyStateIn 0.8s ease-out forwards' }}
          >
            <h1
              className="text-4xl font-semibold text-[var(--text)] mb-3"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Clear.
            </h1>
            <p className="text-lg text-[var(--text-muted)]">
              You have this moment
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full max-w-sm"
            style={{ animation: 'emptyStateIn 0.8s ease-out 0.2s forwards', opacity: 0 }}
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="What's next?"
              autoFocus
              className="
                w-full px-6 py-4 text-lg
                bg-[var(--card)] rounded-2xl
                text-[var(--text)] placeholder:text-[var(--text-muted)]
                focus:outline-none
                transition-shadow duration-200
              "
              style={{
                boxShadow: `
                  0 2px 8px rgba(0,0,0,0.06),
                  0 8px 24px rgba(0,0,0,0.08),
                  inset 0 1px 0 rgba(255,255,255,${isDark ? 0.05 : 0.8})
                `,
              }}
            />
          </form>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col transition-all duration-700"
      style={{ background: getAmbientGradient(stack.length, isDark) }}
    >
      {/* Subtle environment glow based on urgency */}
      {stack[0] && 'task' in stack[0] && getDeadlineUrgency(stack[0].task.due_date) <= 1 && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-1000"
          style={{
            background: 'radial-gradient(ellipse at 50% 20%, rgba(220, 107, 107, 0.05) 0%, transparent 50%)',
          }}
        />
      )}

      {/* Header */}
      <div className="relative z-20 px-6 pt-6 flex items-center justify-between">
        <span className="text-sm text-[var(--text-muted)] tabular-nums">
          {stack.length} {stack.length === 1 ? 'thing' : 'things'}
        </span>
        <button
          onClick={() => setShowInput(!showInput)}
          className="p-2 -mr-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Quick add */}
      {showInput && (
        <div className="relative z-20 px-6 pt-4">
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Quick add..."
              autoFocus
              className="
                w-full px-5 py-3 text-base
                bg-[var(--card)] rounded-xl
                text-[var(--text)] placeholder:text-[var(--text-muted)]
                focus:outline-none
              "
              style={{
                boxShadow: `
                  0 2px 8px rgba(0,0,0,0.06),
                  inset 0 1px 0 rgba(255,255,255,${isDark ? 0.05 : 0.6})
                `,
              }}
            />
          </form>
        </div>
      )}

      {/* Stack container */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="relative w-full max-w-sm" style={{ height: '380px' }}>
          {/* Render cards in reverse order so top card is last (on top) */}
          {stack.slice(0, 4).reverse().map((card, reverseIndex) => {
            const index = Math.min(3, stack.length - 1) - reverseIndex
            return renderCard(card, index)
          })}
        </div>
      </div>
    </div>
  )
}
