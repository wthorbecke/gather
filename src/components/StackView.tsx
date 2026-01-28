'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Task, Step } from '@/hooks/useUserData'
import { useAuth } from './AuthProvider'
import { splitStepText } from '@/lib/stepText'
import { getDeadlineUrgency } from './DeadlineBadge'

// Card types that can appear in the stack
type StackCardType =
  | { type: 'step'; task: Task; step: Step; dismissCount?: number }
  | { type: 'email'; id: string; subject: string; from: string; snippet: string; date: string }
  | { type: 'calendar'; id: string; title: string; time: string; location?: string }
  | { type: 'input' }

interface StackViewProps {
  tasks: Task[]
  onToggleStep: (taskId: string, stepId: string | number) => void
  onGoToTask: (taskId: string) => void
  onAddTask: (title: string) => void
  onDismissEmail?: (emailId: string) => void
  onAddEmailAsTask?: (email: { subject: string; from: string }) => void
}

// Get dismiss counts from localStorage
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
  onDismissEmail,
  onAddEmailAsTask,
}: StackViewProps) {
  const { session } = useAuth()
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [flashComplete, setFlashComplete] = useState(false)
  const [emails, setEmails] = useState<StackCardType[]>([])
  const [calendarEvents, setCalendarEvents] = useState<StackCardType[]>([])
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const isDragging = useRef(false)

  // Build the stack of cards
  const stack = useMemo(() => {
    const cards: StackCardType[] = []
    const dismissCounts = getDismissCounts()

    // Get all incomplete steps from all tasks, sorted by urgency
    const allSteps: StackCardType[] = []
    const sortedTasks = [...tasks].sort((a, b) => {
      const urgencyA = getDeadlineUrgency(a.due_date)
      const urgencyB = getDeadlineUrgency(b.due_date)
      return urgencyA - urgencyB
    })

    for (const task of sortedTasks) {
      if (!task.steps) continue
      for (const step of task.steps) {
        if (step.done) continue
        const stepId = `step-${task.id}-${step.id}`
        if (dismissedIds.has(stepId)) continue
        allSteps.push({
          type: 'step',
          task,
          step,
          dismissCount: dismissCounts[stepId] || 0,
        })
      }
    }

    // Add steps to the stack
    cards.push(...allSteps)

    // Add emails
    cards.push(...emails.filter(e => e.type === 'email' && !dismissedIds.has(e.id)))

    // Add calendar events
    cards.push(...calendarEvents.filter(e => e.type === 'calendar' && !dismissedIds.has(e.id)))

    // Always have input card at the bottom
    cards.push({ type: 'input' })

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
          const emailCards: StackCardType[] = (data.potentialTasks || []).slice(0, 5).map((e: { id: string; subject: string; from: string; snippet: string; date: string }) => ({
            type: 'email' as const,
            id: `email-${e.id}`,
            subject: e.subject,
            from: e.from,
            snippet: e.snippet,
            date: e.date,
          }))
          setEmails(emailCards)
        }
      } catch (err) {
        console.error('Error fetching emails:', err)
      }
    }
    fetchEmails()
  }, [session?.access_token])

  // Fetch calendar events
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
            const eventCards: StackCardType[] = data.events.slice(0, 3).map((e: { id: string; title: string; start_time: string; location?: string }) => ({
              type: 'calendar' as const,
              id: `cal-${e.id}`,
              title: e.title,
              time: formatEventTime(e.start_time),
              location: e.location,
            }))
            setCalendarEvents(eventCards)
          }
        }
      } catch (err) {
        console.error('Error fetching calendar:', err)
      }
    }
    fetchCalendar()
  }, [session?.access_token])

  function formatEventTime(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

    if (date.toDateString() === now.toDateString()) {
      return `Today at ${timeStr}`
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return `Tomorrow at ${timeStr}`
    }
    return date.toLocaleDateString([], { weekday: 'short' }) + ` at ${timeStr}`
  }

  // Handle swipe gestures (touch)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (stack[0]?.type === 'input') return
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    isDragging.current = true
  }, [stack])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return
    const deltaX = e.touches[0].clientX - startX.current
    const deltaY = Math.abs(e.touches[0].clientY - startY.current)

    // Only swipe horizontally
    if (deltaY > Math.abs(deltaX) * 0.5) {
      isDragging.current = false
      setSwipeOffset(0)
      return
    }

    setSwipeOffset(deltaX)
  }, [])

  // Handle mouse drag (desktop)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (stack[0]?.type === 'input') return
    startX.current = e.clientX
    startY.current = e.clientY
    isDragging.current = true
  }, [stack])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    const deltaX = e.clientX - startX.current
    setSwipeOffset(deltaX)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false

    const threshold = 100
    const topCard = stack[0]

    if (Math.abs(swipeOffset) > threshold && topCard && topCard.type !== 'input') {
      // Dismiss the card
      setIsAnimating(true)
      const direction = swipeOffset > 0 ? 1 : -1
      setSwipeOffset(direction * window.innerWidth)

      setTimeout(() => {
        let cardId = ''
        if (topCard.type === 'step') {
          cardId = `step-${topCard.task.id}-${topCard.step.id}`
          incrementDismissCount(cardId)
        } else if (topCard.type === 'email') {
          cardId = topCard.id
          onDismissEmail?.(topCard.id.replace('email-', ''))
        } else if (topCard.type === 'calendar') {
          cardId = topCard.id
        }

        setDismissedIds(prev => new Set(prev).add(cardId))
        setSwipeOffset(0)
        setIsAnimating(false)
      }, 200)
    } else {
      // Snap back
      setSwipeOffset(0)
    }
  }, [swipeOffset, stack, onDismissEmail])

  const handleTouchEnd = handleDragEnd
  const handleMouseUp = handleDragEnd

  // Handle completing a step
  const handleComplete = useCallback((task: Task, step: Step) => {
    const stepId = `step-${task.id}-${step.id}`
    clearDismissCount(stepId)

    // Flash effect
    setFlashComplete(true)
    setTimeout(() => setFlashComplete(false), 300)

    onToggleStep(task.id, step.id)
  }, [onToggleStep])

  // Handle input submit
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim()) {
      onAddTask(inputValue.trim())
      setInputValue('')
    }
  }, [inputValue, onAddTask])

  // Render a card
  const renderCard = (card: StackCardType, index: number) => {
    const isTop = index === 0
    const peekOffset = index * 8
    const scale = 1 - index * 0.03
    const opacity = index === 0 ? 1 : index === 1 ? 0.7 : 0.4

    const style: React.CSSProperties = {
      transform: isTop
        ? `translateX(${swipeOffset}px) rotate(${swipeOffset * 0.03}deg)`
        : `translateY(${peekOffset}px) scale(${scale})`,
      opacity: isTop ? 1 : opacity,
      zIndex: 100 - index,
      transition: isAnimating || !isTop ? 'all 0.2s ease-out' : 'none',
    }

    if (card.type === 'input') {
      return (
        <div
          key="input"
          className="absolute inset-x-4 top-1/2 -translate-y-1/2"
          style={{ ...style, transform: `translateY(${peekOffset}px)` }}
        >
          <form onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="What's on your mind?"
              className="w-full px-6 py-5 text-xl bg-card border border-border rounded-2xl
                         text-text placeholder:text-text-muted
                         focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </form>
        </div>
      )
    }

    if (card.type === 'step') {
      const { title } = splitStepText(card.step.text)
      const wearLevel = Math.min(card.dismissCount || 0, 3)

      return (
        <div
          key={`step-${card.task.id}-${card.step.id}`}
          ref={isTop ? cardRef : undefined}
          className={`
            absolute inset-x-4 top-1/2 -translate-y-1/2
            bg-card rounded-2xl border overflow-hidden
            ${wearLevel === 0 ? 'border-border' : ''}
            ${wearLevel === 1 ? 'border-border bg-gradient-to-br from-card to-surface/50' : ''}
            ${wearLevel === 2 ? 'border-border-strong bg-gradient-to-br from-surface/80 to-surface' : ''}
            ${wearLevel >= 3 ? 'border-accent/30 bg-gradient-to-br from-accent/5 to-surface shadow-inner' : ''}
          `}
          style={style}
          onTouchStart={isTop ? handleTouchStart : undefined}
          onTouchMove={isTop ? handleTouchMove : undefined}
          onTouchEnd={isTop ? handleTouchEnd : undefined}
          onMouseDown={isTop ? handleMouseDown : undefined}
          onMouseMove={isTop ? handleMouseMove : undefined}
          onMouseUp={isTop ? handleMouseUp : undefined}
          onMouseLeave={isTop ? handleMouseUp : undefined}
        >
          {/* Wear indicator */}
          {wearLevel > 0 && (
            <div className="absolute top-3 right-3 flex gap-0.5">
              {Array.from({ length: wearLevel }).map((_, i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent/40" />
              ))}
            </div>
          )}

          <div className="p-6">
            {/* Task context */}
            <div className="text-sm text-text-muted mb-2 truncate">
              {card.task.title}
            </div>

            {/* Step title - THE focus */}
            <div className="text-2xl font-semibold text-text leading-tight mb-6">
              {title}
            </div>

            {/* Single action button */}
            <button
              onClick={() => handleComplete(card.task, card.step)}
              className="w-full py-4 bg-accent text-white rounded-xl text-lg font-medium
                         hover:bg-accent/90 active:scale-[0.98] transition-all"
            >
              Done
            </button>
          </div>

          {/* Swipe hint */}
          {isTop && (
            <div className="absolute bottom-3 left-0 right-0 text-center text-xs text-text-muted">
              swipe to skip
            </div>
          )}
        </div>
      )
    }

    if (card.type === 'email') {
      return (
        <div
          key={card.id}
          ref={isTop ? cardRef : undefined}
          className="absolute inset-x-4 top-1/2 -translate-y-1/2 bg-card rounded-2xl border border-border overflow-hidden"
          style={style}
          onTouchStart={isTop ? handleTouchStart : undefined}
          onTouchMove={isTop ? handleTouchMove : undefined}
          onTouchEnd={isTop ? handleTouchEnd : undefined}
          onMouseDown={isTop ? handleMouseDown : undefined}
          onMouseMove={isTop ? handleMouseMove : undefined}
          onMouseUp={isTop ? handleMouseUp : undefined}
          onMouseLeave={isTop ? handleMouseUp : undefined}
        >
          <div className="p-6">
            <div className="flex items-center gap-2 text-sm text-accent mb-2">
              <svg width={16} height={16} viewBox="0 0 24 24">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" fill="none"/>
                <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" fill="none"/>
              </svg>
              Email from {card.from}
            </div>

            <div className="text-xl font-semibold text-text leading-tight mb-2">
              {card.subject}
            </div>

            <div className="text-sm text-text-muted line-clamp-2 mb-6">
              {card.snippet}
            </div>

            <button
              onClick={() => onAddEmailAsTask?.({ subject: card.subject, from: card.from })}
              className="w-full py-4 bg-accent text-white rounded-xl text-lg font-medium
                         hover:bg-accent/90 active:scale-[0.98] transition-all"
            >
              Add as task
            </button>
          </div>

          {isTop && (
            <div className="absolute bottom-3 left-0 right-0 text-center text-xs text-text-muted">
              swipe to dismiss
            </div>
          )}
        </div>
      )
    }

    if (card.type === 'calendar') {
      return (
        <div
          key={card.id}
          ref={isTop ? cardRef : undefined}
          className="absolute inset-x-4 top-1/2 -translate-y-1/2 bg-card rounded-2xl border border-border overflow-hidden"
          style={style}
          onTouchStart={isTop ? handleTouchStart : undefined}
          onTouchMove={isTop ? handleTouchMove : undefined}
          onTouchEnd={isTop ? handleTouchEnd : undefined}
          onMouseDown={isTop ? handleMouseDown : undefined}
          onMouseMove={isTop ? handleMouseMove : undefined}
          onMouseUp={isTop ? handleMouseUp : undefined}
          onMouseLeave={isTop ? handleMouseUp : undefined}
        >
          <div className="p-6">
            <div className="flex items-center gap-2 text-sm text-accent mb-2">
              <svg width={16} height={16} viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2" />
              </svg>
              {card.time}
            </div>

            <div className="text-xl font-semibold text-text leading-tight mb-2">
              {card.title}
            </div>

            {card.location && (
              <div className="text-sm text-text-muted mb-6">
                {card.location}
              </div>
            )}

            <button
              onClick={() => {
                const cardId = card.id
                setDismissedIds(prev => new Set(prev).add(cardId))
              }}
              className="w-full py-4 bg-surface text-text border border-border rounded-xl text-lg font-medium
                         hover:bg-surface/80 active:scale-[0.98] transition-all"
            >
              Got it
            </button>
          </div>

          {isTop && (
            <div className="absolute bottom-3 left-0 right-0 text-center text-xs text-text-muted">
              swipe to dismiss
            </div>
          )}
        </div>
      )
    }

    return null
  }

  // Empty state
  if (stack.length === 1 && stack[0].type === 'input') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center mb-8">
          <div className="text-2xl font-medium text-text mb-2">You're clear</div>
          <div className="text-text-muted">Nothing needs your attention right now</div>
        </div>
        <form onSubmit={handleSubmit} className="w-full max-w-md">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Add something..."
            className="w-full px-6 py-5 text-xl bg-card border border-border rounded-2xl
                       text-text placeholder:text-text-muted
                       focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-canvas relative overflow-hidden">
      {/* Flash effect on completion */}
      {flashComplete && (
        <div className="absolute inset-0 bg-white/20 z-[200] pointer-events-none animate-flash" />
      )}

      {/* Card counter */}
      <div className="absolute top-6 left-6 z-50">
        <div className="text-sm text-text-muted">
          {stack.filter(c => c.type !== 'input').length} remaining
        </div>
      </div>

      {/* Settings button */}
      <button
        onClick={() => {/* Could open settings */}}
        className="absolute top-6 right-6 z-50 p-2 text-text-muted hover:text-text transition-colors"
      >
        <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
      </button>

      {/* The Stack */}
      <div className="relative h-screen">
        {stack.slice(0, 4).reverse().map((card, reverseIndex) =>
          renderCard(card, stack.slice(0, 4).length - 1 - reverseIndex)
        )}
      </div>
    </div>
  )
}
