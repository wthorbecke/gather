'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Task, Step } from '@/hooks/useUserData'
import { useAuth } from './AuthProvider'
import { splitStepText } from '@/lib/stepText'
import { getDeadlineUrgency } from './DeadlineBadge'
import { AICard, AICardState } from './AICard'

// Card types
type EmailCard = { type: 'email'; id: string; subject: string; from: string; snippet: string }
type CalendarCard = { type: 'calendar'; id: string; title: string; time: string; location?: string }

type StackCard =
  | { type: 'step'; task: Task; step: Step; stepIndex: number; totalSteps: number; dismissCount: number }
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
  // AI Card props
  aiCard?: AICardState | null
  pendingInput?: string | null
  onDismissAI?: () => void
  onQuickReply?: (reply: string) => void
  onAICardAction?: (action: { type: string; stepId?: string | number; title?: string; context?: string }) => void
}

// Affirmations - brief, unexpected
const AFFIRMATIONS = ['done', 'nice', 'gone', '✓', 'cleared', 'onwards']

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

export function StackView({
  tasks,
  onToggleStep,
  onGoToTask,
  onAddTask,
  onAddEmailAsTask,
  aiCard,
  pendingInput,
  onDismissAI,
  onQuickReply,
  onAICardAction,
}: StackViewProps) {
  const { session } = useAuth()
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [swipeX, setSwipeX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isTouching, setIsTouching] = useState(false)
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | 'up' | null>(null)
  const [affirmation, setAffirmation] = useState<string | null>(null)
  const [emails, setEmails] = useState<EmailCard[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarCard[]>([])
  const [inputValue, setInputValue] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [holdProgress, setHoldProgress] = useState(0)
  const [isHolding, setIsHolding] = useState(false)
  const [celebrateEmpty, setCelebrateEmpty] = useState(false)
  const [isDark, setIsDark] = useState(false)

  const dragStartX = useRef(0)
  const holdTimer = useRef<NodeJS.Timeout | null>(null)
  const holdStartTime = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)

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
      const totalSteps = task.steps?.length || 0
      const completedSteps = totalSteps - incompleteSteps.length

      if (hasSteps && incompleteSteps.length > 0) {
        const step = incompleteSteps[0]
        const id = `step-${task.id}-${step.id}`
        if (!dismissedIds.has(id)) {
          cards.push({
            type: 'step',
            task,
            step,
            stepIndex: completedSteps + 1,
            totalSteps,
            dismissCount: counts[id] || 0,
          })
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

  // Drag handlers
  const handleDragStart = (clientX: number) => {
    if (stack.length === 0 || exitDirection) return
    dragStartX.current = clientX
    setIsDragging(true)
    setIsTouching(true)
  }

  const handleDragMove = (clientX: number) => {
    if (!isDragging) return
    setSwipeX(clientX - dragStartX.current)
  }

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)
    setIsTouching(false)

    const threshold = 100
    const topCard = stack[0]

    if (Math.abs(swipeX) > threshold && topCard) {
      const direction = swipeX > 0 ? 'right' : 'left'
      setExitDirection(direction)

      setTimeout(() => {
        const cardId = getCardId(topCard)
        incrementDismissCount(cardId)
        setDismissedIds(prev => new Set(prev).add(cardId))
        setSwipeX(0)
        setExitDirection(null)
      }, 300)
    } else {
      setSwipeX(0)
    }
  }, [isDragging, swipeX, stack])

  // Hold to complete
  const startHold = useCallback(() => {
    if (stack.length === 0 || exitDirection) return

    setIsHolding(true)
    holdStartTime.current = Date.now()

    const animate = () => {
      const elapsed = Date.now() - holdStartTime.current
      const progress = Math.min(elapsed / 500, 1) // 500ms to complete
      setHoldProgress(progress)

      if (progress < 1) {
        holdTimer.current = setTimeout(animate, 16)
      } else {
        handleComplete(stack[0])
      }
    }
    animate()
  }, [stack, exitDirection])

  const endHold = useCallback(() => {
    setIsHolding(false)
    if (holdTimer.current) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    if (holdProgress < 1) {
      setHoldProgress(0)
    }
  }, [holdProgress])

  // Complete action
  const handleComplete = useCallback((card: StackCard) => {
    const cardId = getCardId(card)
    setHoldProgress(0)
    setIsHolding(false)

    // Show affirmation
    setAffirmation(AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)])
    setExitDirection('up')

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

    // Animate out then remove
    setTimeout(() => {
      setDismissedIds(prev => new Set(prev).add(cardId))
      setExitDirection(null)
      setAffirmation(null)

      // Check if stack will be empty
      if (stack.length === 1) {
        setCelebrateEmpty(true)
        setTimeout(() => setCelebrateEmpty(false), 2000)
      }
    }, 400)
  }, [onToggleStep, onGoToTask, onAddEmailAsTask, stack])

  // Submit new task
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      onAddTask(inputValue.trim())
      setInputValue('')
      setShowInput(false)
    }
  }

  // Time-based ambient color
  const getAmbientStyle = () => {
    const hour = new Date().getHours()
    const stackRatio = Math.max(0, 1 - stack.length / 8)

    if (isDark) {
      // Dark mode - subtle color shifts
      if (hour >= 5 && hour < 9) {
        return { background: `linear-gradient(180deg, hsl(25, 20%, ${6 + stackRatio * 2}%) 0%, hsl(220, 15%, 4%) 100%)` }
      } else if (hour >= 17 && hour < 21) {
        return { background: `linear-gradient(180deg, hsl(${20 + stackRatio * 10}, 25%, ${7 + stackRatio * 2}%) 0%, hsl(250, 15%, 4%) 100%)` }
      }
      return { background: `linear-gradient(180deg, hsl(220, 10%, ${6 + stackRatio * 2}%) 0%, hsl(220, 10%, 4%) 100%)` }
    } else {
      // Light mode
      if (hour >= 5 && hour < 9) {
        return { background: `linear-gradient(180deg, hsl(40, ${25 + stackRatio * 15}%, ${96 - stackRatio * 2}%) 0%, hsl(45, 15%, 98%) 100%)` }
      } else if (hour >= 17 && hour < 21) {
        return { background: `linear-gradient(180deg, hsl(25, ${20 + stackRatio * 15}%, ${96 - stackRatio * 2}%) 0%, hsl(30, 15%, 98%) 100%)` }
      }
      return { background: `linear-gradient(180deg, hsl(45, ${10 + stackRatio * 10}%, ${97 - stackRatio}%) 0%, hsl(45, 10%, 99%) 100%)` }
    }
  }

  // Empty state (but show AI card if processing)
  if (stack.length === 0) {
    return (
      <div className="min-h-screen flex flex-col transition-all duration-700" style={getAmbientStyle()}>
        {/* Subtle texture */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }} />

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Show AI card when processing, otherwise show empty state */}
          {aiCard && onDismissAI ? (
            <div className="w-full max-w-sm">
              <AICard
                card={aiCard}
                pendingInput={pendingInput}
                onDismiss={onDismissAI}
                onQuickReply={onQuickReply}
                onGoToTask={onGoToTask}
                onAction={onAICardAction}
              />
            </div>
          ) : (
            <div className={`text-center transition-all duration-700 ${celebrateEmpty ? 'scale-110' : ''}`}>
              <div
                className={`text-6xl mb-4 transition-all duration-500 ${celebrateEmpty ? 'animate-bounce' : ''}`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {celebrateEmpty ? '✨' : '○'}
              </div>
              <h1
                className="text-3xl font-medium text-[var(--text)] mb-2"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {celebrateEmpty ? 'All clear' : 'Clear'}
              </h1>
              <p className="text-[var(--text-muted)]">
                {celebrateEmpty ? 'You did it.' : 'Nothing waiting'}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full max-w-xs mt-12">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="What's next?"
              autoFocus
              className="w-full px-5 py-4 text-lg bg-[var(--card)] rounded-2xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-shadow"
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
            />
          </form>
        </div>
      </div>
    )
  }

  const topCard = stack[0]
  const cardId = getCardId(topCard)

  // Card transforms
  const baseRotation = 2.5 // Resting tilt
  const touchRotation = isTouching ? 0 : baseRotation // Straighten on touch
  const swipeRotation = swipeX * 0.06
  const exitTransform = exitDirection === 'left' ? 'translateX(-150%) rotate(-20deg)'
    : exitDirection === 'right' ? 'translateX(150%) rotate(20deg)'
    : exitDirection === 'up' ? 'translateY(-120%) scale(0.8)'
    : `translateX(${swipeX}px) rotate(${touchRotation + swipeRotation}deg)`

  // Card content
  let parentLabel = ''
  let mainText = ''
  let buttonText = 'Done'
  let progress: { current: number; total: number } | null = null
  let isSecondary = false
  let phoneNumber: string | null = null

  if (topCard.type === 'step') {
    const { title } = splitStepText(topCard.step.text)
    parentLabel = topCard.task.title
    mainText = title
    progress = { current: topCard.stepIndex, total: topCard.totalSteps }
    // Extract phone numbers
    const phoneMatch = title.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/)
    if (phoneMatch) phoneNumber = phoneMatch[1]
  } else if (topCard.type === 'task') {
    parentLabel = 'Task'
    mainText = topCard.task.title
    buttonText = 'Break it down'
  } else if (topCard.type === 'email') {
    parentLabel = `From ${topCard.from}`
    mainText = topCard.subject
    buttonText = 'Add as task'
  } else if (topCard.type === 'calendar') {
    parentLabel = topCard.time
    mainText = topCard.title
    buttonText = 'Noted'
    isSecondary = true
  }

  return (
    <div className="min-h-screen flex flex-col transition-all duration-500" style={getAmbientStyle()}>
      {/* Subtle paper texture */}
      <div className="absolute inset-0 opacity-[0.025] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      {/* Header */}
      <div className="relative z-20 px-5 pt-5 flex items-center justify-between">
        <button
          onClick={() => setShowInput(!showInput)}
          className="p-2 -ml-2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          <svg className="w-[22px] h-[22px] md:w-[26px] md:h-[26px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>

        {/* Stack depth indicator */}
        <div className="flex items-center gap-2">
          {stack.slice(0, 5).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === 0 ? 8 : 6,
                height: i === 0 ? 8 : 6,
                backgroundColor: i === 0
                  ? 'var(--accent)'
                  : `color-mix(in srgb, var(--text-muted) ${100 - i * 20}%, transparent)`,
              }}
            />
          ))}
          {stack.length > 5 && (
            <span className="text-xs text-[var(--text-muted)] ml-1">+{stack.length - 5}</span>
          )}
        </div>
      </div>

      {/* Quick add */}
      {showInput && (
        <div className="relative z-20 px-5 pt-3 pb-2">
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Add something..."
              autoFocus
              className="w-full px-4 py-3 text-base bg-[var(--card)] rounded-xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
              style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
            />
          </form>
        </div>
      )}

      {/* AI Card - shows while processing */}
      {aiCard && onDismissAI && (
        <div className="relative z-20 px-5 pb-4">
          <div className="max-w-sm mx-auto">
            <AICard
              card={aiCard}
              pendingInput={pendingInput}
              onDismiss={onDismissAI}
              onQuickReply={onQuickReply}
              onGoToTask={onGoToTask}
              onAction={onAICardAction}
            />
          </div>
        </div>
      )}

      {/* Stack area */}
      <div className="flex-1 flex items-center justify-center px-5 py-6">
        {/* Responsive: taller cards on desktop */}
        <div className="relative w-full max-w-sm h-[420px] sm:h-[480px] md:h-[520px]">

          {/* Swipe hints */}
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 md:-translate-x-4 text-[var(--text-muted)] transition-opacity duration-200"
            style={{ opacity: isDragging ? 0.6 : 0.15 }}
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </div>
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 md:translate-x-4 text-[var(--text-muted)] transition-opacity duration-200"
            style={{ opacity: isDragging ? 0.6 : 0.15 }}
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>

          {/* Stacked cards behind (visual depth) */}
          {stack.length > 2 && (
            <div
              className="absolute inset-x-3 top-3 bottom-0 rounded-[22px] transition-transform duration-300"
              style={{
                background: isDark ? 'rgba(30,30,30,0.5)' : 'rgba(255,255,255,0.5)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                transform: `translateY(16px) rotate(${baseRotation + 1.5}deg) scale(0.94)`,
              }}
            />
          )}
          {stack.length > 1 && (
            <div
              className="absolute inset-x-1.5 top-1.5 bottom-0 rounded-[24px] transition-transform duration-300"
              style={{
                background: isDark ? 'rgba(35,35,35,0.7)' : 'rgba(255,255,255,0.7)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                transform: `translateY(8px) rotate(${baseRotation + 0.8}deg) scale(0.97)`,
              }}
            />
          )}

          {/* Main card */}
          <div
            ref={cardRef}
            className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
            style={{
              transform: exitTransform,
              opacity: exitDirection ? (exitDirection === 'up' ? 0 : 1) : 1,
              transition: isDragging ? 'none' : 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onMouseDown={(e) => handleDragStart(e.clientX)}
            onMouseMove={(e) => handleDragMove(e.clientX)}
            onMouseUp={handleDragEnd}
            onMouseLeave={() => { setIsTouching(false); handleDragEnd(); }}
            onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
            onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
            onTouchEnd={handleDragEnd}
          >
            {/* Card surface */}
            <div
              className="relative h-full rounded-[26px] overflow-hidden"
              style={{
                background: isDark
                  ? 'linear-gradient(180deg, #1a1a1a 0%, #141414 100%)'
                  : 'linear-gradient(180deg, #ffffff 0%, #fafafa 100%)',
                boxShadow: isDark
                  ? '0 2px 4px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)'
                  : '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06), 0 12px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
                border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.04)',
              }}
            >
              {/* Affirmation overlay */}
              {affirmation && exitDirection === 'up' && (
                <div className="absolute inset-0 flex items-center justify-center z-20 bg-[var(--success)]/20 rounded-[26px] animate-pulse">
                  <span
                    className="text-5xl font-semibold text-[var(--success)] animate-bounce"
                    style={{ fontFamily: 'var(--font-display)', animationDuration: '0.4s' }}
                  >
                    {affirmation}
                  </span>
                </div>
              )}

              {/* Card content */}
              <div className="relative h-full flex flex-col p-6">
                {/* Parent task label - the whisper */}
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium uppercase tracking-widest text-[var(--text-muted)]">
                    {parentLabel}
                  </span>

                  {/* Progress indicator */}
                  {progress && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[var(--accent)]">
                        {progress.current}/{progress.total}
                      </span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: progress.total }).map((_, i) => (
                          <div
                            key={i}
                            className="w-1.5 h-1.5 rounded-full transition-colors"
                            style={{
                              backgroundColor: i < progress.current
                                ? 'var(--success)'
                                : 'var(--border)',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Main action - THE thing */}
                <h2
                  className="text-[26px] leading-tight font-semibold text-[var(--text)] mt-2 mb-auto"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {phoneNumber ? (
                    <>
                      {mainText.split(phoneNumber)[0]}
                      <a
                        href={`tel:${phoneNumber.replace(/\D/g, '')}`}
                        className="text-[var(--accent)] underline decoration-[var(--accent)]/30 underline-offset-2 hover:decoration-[var(--accent)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {phoneNumber}
                      </a>
                      {mainText.split(phoneNumber)[1] || ''}
                    </>
                  ) : (
                    mainText
                  )}
                </h2>

                {/* Skip hint */}
                <div className="text-center text-[13px] text-[var(--text-muted)] mb-4 opacity-60">
                  ← swipe to skip →
                </div>

                {/* Action button */}
                <button
                  onMouseDown={startHold}
                  onMouseUp={endHold}
                  onMouseLeave={endHold}
                  onTouchStart={(e) => { e.stopPropagation(); startHold(); }}
                  onTouchEnd={(e) => { e.stopPropagation(); endHold(); }}
                  className={`
                    relative w-full py-4 rounded-2xl text-[17px] font-semibold overflow-hidden
                    transition-all duration-150
                    ${isSecondary
                      ? 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]'
                      : 'text-white'
                    }
                    ${isHolding ? 'scale-[0.97]' : 'active:scale-[0.98]'}
                  `}
                  style={isSecondary ? {} : {
                    background: 'linear-gradient(180deg, #e07a5f 0%, #d56a4f 100%)',
                    boxShadow: '0 2px 8px rgba(224, 122, 95, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
                  }}
                >
                  {/* Hold progress fill */}
                  {!isSecondary && (
                    <div
                      className="absolute inset-0 bg-white/25 origin-left transition-transform"
                      style={{
                        transform: `scaleX(${holdProgress})`,
                        transition: isHolding ? 'none' : 'transform 0.2s ease-out',
                      }}
                    />
                  )}
                  <span className="relative z-10">
                    {isHolding && holdProgress > 0.5 ? '...' : buttonText}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
