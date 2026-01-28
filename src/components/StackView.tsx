'use client'

import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { Task, Step } from '@/hooks/useUserData'
import { useAuth } from './AuthProvider'
import { splitStepText } from '@/lib/stepText'
import { getDeadlineUrgency } from './DeadlineBadge'

// Card types that can appear in the stack
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
}: StackViewProps) {
  const { session } = useAuth()
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [swipeX, setSwipeX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isAnimatingOut, setIsAnimatingOut] = useState(false)
  const [showFlash, setShowFlash] = useState(false)
  const [emails, setEmails] = useState<EmailCard[]>([])
  const [calendarEvents, setCalendarEvents] = useState<CalendarCard[]>([])
  const [inputValue, setInputValue] = useState('')
  const [showInput, setShowInput] = useState(false)

  const dragStartX = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)

  // Build the card stack
  const stack = useMemo(() => {
    const cards: StackCard[] = []
    const counts = getDismissCounts()

    // Sort tasks by urgency
    const sortedTasks = [...tasks].sort((a, b) =>
      getDeadlineUrgency(a.due_date) - getDeadlineUrgency(b.due_date)
    )

    // Add task steps or tasks without steps
    for (const task of sortedTasks) {
      const hasSteps = task.steps && task.steps.length > 0
      const incompleteSteps = task.steps?.filter(s => !s.done) || []

      if (hasSteps && incompleteSteps.length > 0) {
        // Add the first incomplete step
        const step = incompleteSteps[0]
        const id = `step-${task.id}-${step.id}`
        if (!dismissedIds.has(id)) {
          cards.push({
            type: 'step',
            task,
            step,
            dismissCount: counts[id] || 0,
          })
        }
      } else if (!hasSteps) {
        // Task without steps - show as a card itself
        const id = `task-${task.id}`
        if (!dismissedIds.has(id)) {
          cards.push({
            type: 'task',
            task,
            dismissCount: counts[id] || 0,
          })
        }
      }
    }

    // Add emails (limit to 3)
    for (const email of emails.slice(0, 3)) {
      if (!dismissedIds.has(email.id)) {
        cards.push(email)
      }
    }

    // Add calendar events (limit to 2)
    for (const event of calendarEvents.slice(0, 2)) {
      if (!dismissedIds.has(event.id)) {
        cards.push(event)
      }
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

  // Drag handlers
  const handleDragStart = (clientX: number) => {
    if (stack.length === 0) return
    dragStartX.current = clientX
    setIsDragging(true)
  }

  const handleDragMove = (clientX: number) => {
    if (!isDragging) return
    setSwipeX(clientX - dragStartX.current)
  }

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return
    setIsDragging(false)

    const threshold = 120
    const topCard = stack[0]

    if (Math.abs(swipeX) > threshold && topCard) {
      // Animate out
      setIsAnimatingOut(true)
      setSwipeX(swipeX > 0 ? 500 : -500)

      setTimeout(() => {
        let cardId = ''
        if (topCard.type === 'step') {
          cardId = `step-${topCard.task.id}-${topCard.step.id}`
        } else if (topCard.type === 'task') {
          cardId = `task-${topCard.task.id}`
        } else {
          cardId = topCard.id
        }

        incrementDismissCount(cardId)
        setDismissedIds(prev => new Set(prev).add(cardId))
        setSwipeX(0)
        setIsAnimatingOut(false)
      }, 200)
    } else {
      setSwipeX(0)
    }
  }, [isDragging, swipeX, stack])

  // Complete action
  const handleComplete = useCallback((card: StackCard) => {
    let cardId = ''

    if (card.type === 'step') {
      cardId = `step-${card.task.id}-${card.step.id}`
      clearDismissCount(cardId)
      onToggleStep(card.task.id, card.step.id)
    } else if (card.type === 'task') {
      cardId = `task-${card.task.id}`
      clearDismissCount(cardId)
      // For tasks without steps, just go to the task view
      onGoToTask(card.task.id)
      return
    } else if (card.type === 'email') {
      onAddEmailAsTask?.({ subject: card.subject, from: card.from })
      cardId = card.id
    } else if (card.type === 'calendar') {
      cardId = card.id
    }

    // Flash effect
    setShowFlash(true)
    setTimeout(() => setShowFlash(false), 300)

    // Remove from view
    setDismissedIds(prev => new Set(prev).add(cardId))
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

  // Get wear level (0-3) based on dismiss count
  const getWearLevel = (count: number) => Math.min(count, 3)

  // Render the top card
  const renderTopCard = (card: StackCard) => {
    const wearLevel = 'dismissCount' in card ? getWearLevel(card.dismissCount) : 0

    // Wear styles
    const wearStyles = [
      'border-border',
      'border-border shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]',
      'border-accent/20 shadow-[inset_0_2px_8px_rgba(0,0,0,0.15)]',
      'border-accent/40 shadow-[inset_0_4px_12px_rgba(0,0,0,0.2)]',
    ][wearLevel]

    const rotation = swipeX * 0.05
    const opacity = Math.max(0.5, 1 - Math.abs(swipeX) / 400)

    if (card.type === 'step') {
      const { title } = splitStepText(card.step.text)
      return (
        <div
          ref={cardRef}
          className={`bg-card rounded-3xl border-2 ${wearStyles} overflow-hidden cursor-grab active:cursor-grabbing select-none`}
          style={{
            transform: `translateX(${swipeX}px) rotate(${rotation}deg)`,
            opacity,
            transition: isDragging ? 'none' : 'all 0.3s ease-out',
          }}
          onMouseDown={(e) => handleDragStart(e.clientX)}
          onMouseMove={(e) => handleDragMove(e.clientX)}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
          onTouchEnd={handleDragEnd}
        >
          {/* Wear indicator */}
          {wearLevel > 0 && (
            <div className="absolute top-4 right-4 flex gap-1">
              {Array.from({ length: wearLevel }).map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-accent/50" />
              ))}
            </div>
          )}

          <div className="p-8">
            {/* Context: task name */}
            <div className="text-base text-text-muted mb-3">{card.task.title}</div>

            {/* THE step - big and clear */}
            <h2 className="text-3xl font-semibold text-text leading-tight mb-8">
              {title}
            </h2>

            {/* Single action */}
            <button
              onClick={() => handleComplete(card)}
              className="w-full py-5 bg-accent text-white rounded-2xl text-xl font-semibold
                         hover:bg-accent/90 active:scale-[0.98] transition-all"
            >
              Done
            </button>
          </div>

          <div className="pb-4 text-center text-sm text-text-muted">
            swipe to skip for now
          </div>
        </div>
      )
    }

    if (card.type === 'task') {
      return (
        <div
          ref={cardRef}
          className={`bg-card rounded-3xl border-2 ${wearStyles} overflow-hidden cursor-grab active:cursor-grabbing select-none`}
          style={{
            transform: `translateX(${swipeX}px) rotate(${rotation}deg)`,
            opacity,
            transition: isDragging ? 'none' : 'all 0.3s ease-out',
          }}
          onMouseDown={(e) => handleDragStart(e.clientX)}
          onMouseMove={(e) => handleDragMove(e.clientX)}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
          onTouchEnd={handleDragEnd}
        >
          <div className="p-8">
            <div className="text-base text-text-muted mb-3">Task</div>

            <h2 className="text-3xl font-semibold text-text leading-tight mb-8">
              {card.task.title}
            </h2>

            <button
              onClick={() => handleComplete(card)}
              className="w-full py-5 bg-accent text-white rounded-2xl text-xl font-semibold
                         hover:bg-accent/90 active:scale-[0.98] transition-all"
            >
              Break it down
            </button>
          </div>

          <div className="pb-4 text-center text-sm text-text-muted">
            swipe to skip for now
          </div>
        </div>
      )
    }

    if (card.type === 'email') {
      return (
        <div
          ref={cardRef}
          className="bg-card rounded-3xl border-2 border-border overflow-hidden cursor-grab active:cursor-grabbing select-none"
          style={{
            transform: `translateX(${swipeX}px) rotate(${rotation}deg)`,
            opacity,
            transition: isDragging ? 'none' : 'all 0.3s ease-out',
          }}
          onMouseDown={(e) => handleDragStart(e.clientX)}
          onMouseMove={(e) => handleDragMove(e.clientX)}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
          onTouchEnd={handleDragEnd}
        >
          <div className="p-8">
            <div className="flex items-center gap-2 text-base text-accent mb-3">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 6L12 13L2 6" />
              </svg>
              {card.from}
            </div>

            <h2 className="text-2xl font-semibold text-text leading-tight mb-4">
              {card.subject}
            </h2>

            <p className="text-text-muted line-clamp-2 mb-8">{card.snippet}</p>

            <button
              onClick={() => handleComplete(card)}
              className="w-full py-5 bg-accent text-white rounded-2xl text-xl font-semibold
                         hover:bg-accent/90 active:scale-[0.98] transition-all"
            >
              Add as task
            </button>
          </div>

          <div className="pb-4 text-center text-sm text-text-muted">
            swipe to dismiss
          </div>
        </div>
      )
    }

    if (card.type === 'calendar') {
      return (
        <div
          ref={cardRef}
          className="bg-card rounded-3xl border-2 border-border overflow-hidden cursor-grab active:cursor-grabbing select-none"
          style={{
            transform: `translateX(${swipeX}px) rotate(${rotation}deg)`,
            opacity,
            transition: isDragging ? 'none' : 'all 0.3s ease-out',
          }}
          onMouseDown={(e) => handleDragStart(e.clientX)}
          onMouseMove={(e) => handleDragMove(e.clientX)}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
          onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
          onTouchEnd={handleDragEnd}
        >
          <div className="p-8">
            <div className="flex items-center gap-2 text-base text-accent mb-3">
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
              {card.time}
            </div>

            <h2 className="text-2xl font-semibold text-text leading-tight mb-4">
              {card.title}
            </h2>

            {card.location && (
              <p className="text-text-muted mb-8">{card.location}</p>
            )}

            <button
              onClick={() => handleComplete(card)}
              className="w-full py-5 bg-surface text-text border border-border rounded-2xl text-xl font-semibold
                         hover:bg-surface/80 active:scale-[0.98] transition-all"
            >
              Got it
            </button>
          </div>

          <div className="pb-4 text-center text-sm text-text-muted">
            swipe to dismiss
          </div>
        </div>
      )
    }

    return null
  }

  // Empty state
  if (stack.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold text-text mb-2">You're clear</h1>
            <p className="text-lg text-text-muted">Nothing needs your attention</p>
          </div>

          <form onSubmit={handleSubmit} className="w-full max-w-sm">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="What's on your mind?"
              autoFocus
              className="w-full px-6 py-4 text-lg bg-card border border-border rounded-2xl
                         text-text placeholder:text-text-muted
                         focus:outline-none focus:border-accent"
            />
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      {/* Flash on complete */}
      {showFlash && (
        <div className="fixed inset-0 bg-white/30 pointer-events-none z-50 animate-flash" />
      )}

      {/* Header - minimal */}
      <div className="px-6 pt-6 flex items-center justify-between">
        <span className="text-sm text-text-muted">{stack.length} to go</span>
        <button
          onClick={() => setShowInput(!showInput)}
          className="p-2 text-text-muted hover:text-text transition-colors"
        >
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Quick add input */}
      {showInput && (
        <div className="px-6 pt-4">
          <form onSubmit={handleSubmit}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Quick add..."
              autoFocus
              className="w-full px-5 py-3 text-base bg-card border border-border rounded-xl
                         text-text placeholder:text-text-muted
                         focus:outline-none focus:border-accent"
            />
          </form>
        </div>
      )}

      {/* THE Card - centered and dominant */}
      <div className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="w-full max-w-md">
          {/* Peeking cards behind */}
          {stack.length > 1 && (
            <div
              className="absolute left-6 right-6 max-w-md mx-auto bg-card/50 rounded-3xl border border-border/50 h-32"
              style={{
                transform: 'translateY(16px) scale(0.95)',
                zIndex: 0,
              }}
            />
          )}
          {stack.length > 2 && (
            <div
              className="absolute left-6 right-6 max-w-md mx-auto bg-card/30 rounded-3xl border border-border/30 h-32"
              style={{
                transform: 'translateY(32px) scale(0.9)',
                zIndex: -1,
              }}
            />
          )}

          {/* Top card */}
          <div className="relative z-10">
            {renderTopCard(stack[0])}
          </div>
        </div>
      </div>
    </div>
  )
}
