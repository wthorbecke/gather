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
  // View switching props
  onSwitchView?: () => void
  onSignOut?: () => void
  isDemoUser?: boolean
}

// Affirmations - brief, unexpected
const AFFIRMATIONS = ['done', 'nice', 'gone', '✓', 'cleared', 'onwards']

// Time-based empty state messages - personality that fits the moment
function getEmptyStateMessage(celebrating: boolean): { symbol: string; title: string; subtitle: string } {
  const hour = new Date().getHours()

  if (celebrating) {
    // Just cleared everything - brief acknowledgment
    if (hour >= 5 && hour < 12) return { symbol: '✨', title: 'cleared', subtitle: 'good start to the day' }
    if (hour >= 12 && hour < 17) return { symbol: '✨', title: 'all done', subtitle: 'nice momentum' }
    if (hour >= 17 && hour < 21) return { symbol: '✨', title: 'cleared', subtitle: 'you earned this evening' }
    return { symbol: '✨', title: 'done', subtitle: 'rest well' }
  }

  // Default empty state - inviting, time-appropriate
  if (hour >= 5 && hour < 9) return { symbol: '○', title: 'ready', subtitle: 'what\'s on your mind?' }
  if (hour >= 9 && hour < 12) return { symbol: '○', title: 'clear', subtitle: 'nothing waiting' }
  if (hour >= 12 && hour < 17) return { symbol: '○', title: 'open', subtitle: 'add something whenever' }
  if (hour >= 17 && hour < 21) return { symbol: '○', title: 'quiet', subtitle: 'nothing pressing' }
  return { symbol: '○', title: 'still', subtitle: 'here when you need' }
}

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
  onSwitchView,
  onSignOut,
  isDemoUser,
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

  // Time-based ambient color - more pronounced for atmosphere
  const getAmbientStyle = () => {
    const hour = new Date().getHours()
    const stackRatio = Math.max(0, 1 - stack.length / 6) // Fewer items = calmer gradient

    if (isDark) {
      // Dark mode - richer color shifts
      if (hour >= 5 && hour < 9) {
        // Morning - warm amber glow
        return { background: `linear-gradient(170deg, hsl(30, 35%, ${8 + stackRatio * 3}%) 0%, hsl(220, 20%, 4%) 100%)` }
      } else if (hour >= 17 && hour < 21) {
        // Evening - warm sunset tones
        return { background: `linear-gradient(170deg, hsl(${15 + stackRatio * 15}, 40%, ${9 + stackRatio * 3}%) 0%, hsl(260, 20%, 5%) 100%)` }
      } else if (hour >= 21 || hour < 5) {
        // Night - deep blue
        return { background: `linear-gradient(170deg, hsl(240, 25%, ${7 + stackRatio * 2}%) 0%, hsl(240, 20%, 3%) 100%)` }
      }
      // Day - neutral with slight warmth
      return { background: `linear-gradient(170deg, hsl(220, 15%, ${7 + stackRatio * 2}%) 0%, hsl(220, 12%, 4%) 100%)` }
    } else {
      // Light mode - warmer, more inviting
      if (hour >= 5 && hour < 9) {
        // Morning - golden warmth
        return { background: `linear-gradient(170deg, hsl(45, ${40 + stackRatio * 20}%, ${95 - stackRatio * 3}%) 0%, hsl(50, 20%, 98%) 100%)` }
      } else if (hour >= 17 && hour < 21) {
        // Evening - peachy warmth
        return { background: `linear-gradient(170deg, hsl(25, ${35 + stackRatio * 20}%, ${95 - stackRatio * 3}%) 0%, hsl(35, 20%, 98%) 100%)` }
      } else if (hour >= 21 || hour < 5) {
        // Night - cool blue tint
        return { background: `linear-gradient(170deg, hsl(220, ${20 + stackRatio * 10}%, ${96 - stackRatio * 2}%) 0%, hsl(220, 15%, 98%) 100%)` }
      }
      // Day - clean with subtle warmth
      return { background: `linear-gradient(170deg, hsl(50, ${15 + stackRatio * 15}%, ${97 - stackRatio * 2}%) 0%, hsl(50, 10%, 99%) 100%)` }
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

        {/* Toolbar - same as main view for consistency */}
        <div className="sticky top-0 z-20 px-4 py-3 flex items-center justify-end">
          <div className="flex items-center gap-1">
            {onSwitchView && (
              <button
                onClick={onSwitchView}
                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-all duration-150"
                title="Switch to list view"
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--text-muted)]/50 hover:text-[var(--text-muted)] hover:bg-[var(--surface)] transition-all duration-150"
                title={isDemoUser ? 'Exit demo' : 'Sign out'}
                aria-label={isDemoUser ? 'Exit demo' : 'Sign out'}
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>

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
            (() => {
              const emptyState = getEmptyStateMessage(celebrateEmpty)
              return (
                <div className={`text-center transition-all duration-700 ${celebrateEmpty ? 'scale-105' : ''}`}>
                  <div
                    className={`text-5xl mb-4 transition-all duration-500 ${celebrateEmpty ? 'animate-bounce' : 'opacity-40'}`}
                    style={{ fontFamily: 'var(--font-display)', animationDuration: celebrateEmpty ? '0.6s' : undefined }}
                  >
                    {emptyState.symbol}
                  </div>
                  <h1
                    className="text-2xl font-medium text-[var(--text)] mb-1"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {emptyState.title}
                  </h1>
                  <p className="text-sm text-[var(--text-soft)]">
                    {emptyState.subtitle}
                  </p>
                </div>
              )
            })()
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
  let contextLabel = '' // Small context above the main text
  let mainText = ''
  let buttonText = 'Done'
  let progress: { current: number; total: number } | null = null
  let isSecondary = false
  let phoneNumber: string | null = null

  if (topCard.type === 'step') {
    const { title } = splitStepText(topCard.step.text)
    mainText = title
    progress = { current: topCard.stepIndex, total: topCard.totalSteps }
    // Only show task title as context if it's different from the step text
    const stepMatchesTask = title.toLowerCase().trim() === topCard.task.title.toLowerCase().trim()
    contextLabel = stepMatchesTask ? 'next step' : topCard.task.title
    // Extract phone numbers
    const phoneMatch = title.match(/(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/)
    if (phoneMatch) phoneNumber = phoneMatch[1]
  } else if (topCard.type === 'task') {
    // For tasks without steps, don't show redundant "Task" label
    contextLabel = ''
    mainText = topCard.task.title
    buttonText = 'Break it down'
  } else if (topCard.type === 'email') {
    contextLabel = topCard.from
    mainText = topCard.subject
    buttonText = 'Add as task'
  } else if (topCard.type === 'calendar') {
    contextLabel = topCard.time
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

      {/* Minimal toolbar - clean, unobtrusive */}
      <div className="sticky top-0 z-20 px-4 py-3 flex items-center justify-between">
        {/* Left: Card count (subtle, only when there are cards) */}
        <div className="text-xs text-[var(--text-muted)]/60 tabular-nums min-w-[20px]">
          {stack.length > 0 && stack.length}
        </div>

        {/* Right: Essential actions */}
        <div className="flex items-center gap-1">
          {/* Add button - primary action, prominent when active */}
          <button
            onClick={() => setShowInput(!showInput)}
            className={`
              p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-all duration-150
              ${showInput
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]'
              }
            `}
            title="Add task"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d={showInput ? "M18 6L6 18M6 6l12 12" : "M12 5v14M5 12h14"} />
            </svg>
          </button>

          {/* View toggle */}
          {onSwitchView && (
            <button
              onClick={onSwitchView}
              className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-all duration-150"
              title="Switch to list view"
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}

          {/* Sign out - subtle, secondary */}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--text-muted)]/50 hover:text-[var(--text-muted)] hover:bg-[var(--surface)] transition-all duration-150"
              title={isDemoUser ? 'Exit demo' : 'Sign out'}
              aria-label={isDemoUser ? 'Exit demo' : 'Sign out'}
            >
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
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

          {/* Cards behind - visible stack effect */}
          {stack.slice(1, 3).reverse().map((card, reverseIndex) => {
            const depth = 2 - reverseIndex // 2, 1 (deeper card renders first)
            let cardText = ''

            if (card.type === 'step') {
              const { title } = splitStepText(card.step.text)
              cardText = title
            } else if (card.type === 'task') {
              cardText = card.task.title
            } else if (card.type === 'email') {
              cardText = card.subject
            } else if (card.type === 'calendar') {
              cardText = card.title
            }

            // Stack offset - cards peek out from behind
            const yOffset = depth * 24
            const xOffset = depth * 4
            const rotation = depth * 1.5
            const scale = 1 - depth * 0.03
            const swipeInfluence = Math.min(Math.abs(swipeX) / 80, 1)

            return (
              <div
                key={getCardId(card)}
                className="absolute inset-0 rounded-[24px] overflow-hidden pointer-events-none"
                style={{
                  background: isDark
                    ? 'linear-gradient(180deg, #1c1c1c 0%, #161616 100%)'
                    : 'linear-gradient(180deg, #ffffff 0%, #f8f8f8 100%)',
                  boxShadow: isDark
                    ? '0 4px 20px rgba(0,0,0,0.5)'
                    : '0 4px 20px rgba(0,0,0,0.1)',
                  border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
                  transform: `
                    translateY(${yOffset - swipeInfluence * yOffset * 0.7}px)
                    translateX(${xOffset}px)
                    rotate(${rotation}deg)
                    scale(${scale + swipeInfluence * 0.02})
                  `,
                  transformOrigin: 'center top',
                  transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              >
                {/* Card content preview - same layout as main card */}
                <div className="h-full flex flex-col p-6 overflow-hidden">
                  <h2
                    className="text-[28px] leading-tight font-semibold text-[var(--text)] line-clamp-4"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {cardText}
                  </h2>
                </div>
              </div>
            )
          })}

          {/* Main card */}
          <div
            ref={cardRef}
            className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
            style={{
              zIndex: 10,
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
              className="relative h-full rounded-[24px] overflow-hidden"
              style={{
                background: isDark
                  ? 'linear-gradient(180deg, #1c1c1c 0%, #161616 100%)'
                  : 'linear-gradient(180deg, #ffffff 0%, #f8f8f8 100%)',
                boxShadow: isDark
                  ? '0 2px 4px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.4)'
                  : '0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.1)',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)',
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
                {/* Context label - subtle, top */}
                {contextLabel && (
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    {contextLabel}
                  </span>
                )}

                {/* Main action - THE thing */}
                <h2
                  className="text-[28px] leading-tight font-semibold text-[var(--text)] flex-1 overflow-hidden line-clamp-5"
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

                {/* Bottom section */}
                <div className="mt-auto space-y-3">
                  {/* Progress bar - only for multi-step tasks */}
                  {progress && progress.total > 1 && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1 bg-[var(--border)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                          style={{ width: `${((progress.current - 1) / progress.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">
                        {progress.current} of {progress.total}
                      </span>
                    </div>
                  )}

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
                      background: 'var(--accent)',
                      boxShadow: '0 2px 8px rgba(217, 117, 86, 0.25), 0 1px 2px rgba(217, 117, 86, 0.15)',
                    }}
                  >
                    {/* Hold progress fill */}
                    {!isSecondary && (
                      <div
                        className="absolute inset-0 bg-white/25 origin-left"
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

                  {/* Skip hint */}
                  <div className="text-center text-xs text-[var(--text-muted)]">
                    swipe to skip
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
