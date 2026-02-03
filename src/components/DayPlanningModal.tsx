'use client'

import { useState, useEffect, useCallback } from 'react'
import { Task } from '@/hooks/useUserData'
import { AICardState } from './AICard'
import { ParsedInputMetadata } from './UnifiedInput'
import { HourTimeline } from './HourTimeline'
import {
  getTimePeriod,
  formatScheduledTime,
  isHabitDueToday,
  isHabitCompletedToday,
} from '@/lib/taskTypes'
import { TaskType } from '@/lib/constants'
import { Checkbox } from './Checkbox'

interface DayPlanningModalProps {
  isOpen: boolean
  onClose: () => void
  tasks: Task[]
  aiCard: AICardState | null
  pendingInput: string | null
  selectedDate: Date
  onDateChange: (date: Date) => void
  onSubmit: (value: string, metadata?: ParsedInputMetadata) => void
  onQuickAdd: (value: string, metadata?: ParsedInputMetadata) => void
  onQuickReply: (reply: string) => void
  onDismissAI: () => void
  onGoToTask: (taskId: string) => void
  onToggleStep: (taskId: string, stepId: string | number) => void
  onToggleHabit: (taskId: string) => void
  onAICardAction?: (action: { type: string; stepId?: string | number; title?: string; context?: string }) => void
}

// Format date for display
function formatDateHeader(date: Date): string {
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const isToday = date.toDateString() === today.toDateString()
  const isTomorrow = date.toDateString() === tomorrow.toDateString()
  const isYesterday = date.toDateString() === yesterday.toDateString()

  if (isToday) return 'Today'
  if (isTomorrow) return 'Tomorrow'
  if (isYesterday) return 'Yesterday'

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// Check if task is scheduled for a specific date
function isScheduledForDate(task: Task, date: Date): boolean {
  if (!task.scheduled_at) return false
  const scheduled = new Date(task.scheduled_at)
  return (
    scheduled.getFullYear() === date.getFullYear() &&
    scheduled.getMonth() === date.getMonth() &&
    scheduled.getDate() === date.getDate()
  )
}

// Check if task is due on a specific date
function isDueOnDate(task: Task, date: Date): boolean {
  if (!task.due_date) return false
  const due = new Date(task.due_date)
  return (
    due.getFullYear() === date.getFullYear() &&
    due.getMonth() === date.getMonth() &&
    due.getDate() === date.getDate()
  )
}

// Timeline item component
function TimelineItem({
  task,
  time,
  onClick,
}: {
  task: Task
  time: string | null
  onClick: () => void
}) {
  const type = task.type || TaskType.TASK
  const isEvent = type === TaskType.EVENT
  const isReminder = type === TaskType.REMINDER

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-md hover:bg-subtle/50 cursor-pointer transition-colors"
    >
      {/* Time column */}
      <div className="w-14 text-xs text-text-muted tabular-nums flex-shrink-0">
        {time || ''}
      </div>

      {/* Vertical line */}
      <div className="w-px h-6 bg-border-subtle flex-shrink-0" />

      {/* Content */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span className="text-sm text-text truncate">{task.title}</span>
      </div>

      {/* Type indicator */}
      <div className="flex-shrink-0">
        {isEvent && (
          <svg width={14} height={14} viewBox="0 0 24 24" className="text-text-muted">
            <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
            <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
          </svg>
        )}
        {isReminder && (
          <svg width={14} height={14} viewBox="0 0 24 24" className="text-accent">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        )}
      </div>
    </div>
  )
}

// Habit item component
function HabitItem({
  task,
  onToggle,
  onClick,
}: {
  task: Task
  onToggle: () => void
  onClick: () => void
}) {
  const isCompleted = isHabitCompletedToday(task)
  const streak = task.streak?.current || 0

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-md hover:bg-subtle/50 cursor-pointer transition-colors"
    >
      {/* Checkbox */}
      <div
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
      >
        <Checkbox checked={isCompleted} onToggle={onToggle} size={18} />
      </div>

      {/* Title */}
      <span className={`flex-1 text-sm ${isCompleted ? 'text-text-muted line-through' : 'text-text'}`}>
        {task.title}
      </span>

      {/* Streak */}
      {streak > 0 && (
        <div className="flex items-center gap-0.5 text-xs font-medium text-success">
          <svg width={12} height={12} viewBox="0 0 24 24" className="text-success" fill="currentColor">
            <path d="M12 23a7.5 7.5 0 0 1-5.138-12.963C8.204 8.774 11.5 6.5 11 1.5c6 4 9 8 3 14 1 0 2.5 0 5-2.47.27.773.5 1.604.5 2.47A7.5 7.5 0 0 1 12 23z"/>
          </svg>
          <span>{streak}</span>
        </div>
      )}
    </div>
  )
}

export function DayPlanningModal({
  isOpen,
  onClose,
  tasks,
  selectedDate,
  onDateChange,
  onGoToTask,
  onToggleStep,
  onToggleHabit,
}: DayPlanningModalProps) {
  const [isClosing, setIsClosing] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [showTimeline, setShowTimeline] = useState(true)
  const [showHabits, setShowHabits] = useState(true)
  const [showUnscheduled, setShowUnscheduled] = useState(true)
  const [showAllUnscheduled, setShowAllUnscheduled] = useState(false)

  // Detect mobile viewport
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      requestAnimationFrame(() => setIsVisible(true))
    } else {
      document.body.style.overflow = 'unset'
      setIsVisible(false)
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  // Handle close with animation
  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 250)
  }, [onClose])

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose])

  // Filter tasks for the selected date
  const today = new Date()
  const isToday = selectedDate.toDateString() === today.toDateString()

  // Scheduled items (events, reminders with time)
  const scheduledTasks = tasks.filter(task =>
    isScheduledForDate(task, selectedDate) &&
    (task.type === TaskType.EVENT || task.type === TaskType.REMINDER)
  ).sort((a, b) => {
    const timeA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
    const timeB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
    return timeA - timeB
  })

  // Habits (show on today only)
  const habits = isToday
    ? tasks.filter(task =>
        task.type === TaskType.HABIT && isHabitDueToday(task)
      )
    : []

  // Unscheduled tasks
  const unscheduledTasks = tasks.filter(task => {
    if (task.type === TaskType.HABIT || task.type === TaskType.EVENT) return false
    if (task.scheduled_at) return false

    // Due today
    if (isDueOnDate(task, selectedDate)) return true

    // Overdue (only show on today)
    if (isToday && task.due_date) {
      const due = new Date(task.due_date)
      due.setHours(23, 59, 59)
      if (due < today) return true
    }

    // No due date, show on today
    if (isToday && !task.due_date && task.type === TaskType.TASK) return true

    return false
  })

  // Group scheduled tasks by time period
  const morning: Task[] = []
  const afternoon: Task[] = []
  const evening: Task[] = []

  for (const task of scheduledTasks) {
    if (!task.scheduled_at) continue
    const period = getTimePeriod(new Date(task.scheduled_at))
    if (period === 'morning') morning.push(task)
    else if (period === 'afternoon') afternoon.push(task)
    else evening.push(task)
  }

  // Habits progress
  const habitsCompleted = habits.filter(h => isHabitCompletedToday(h)).length
  const habitsTotal = habits.length

  // Navigation handlers
  const goToPreviousDay = () => {
    const prev = new Date(selectedDate)
    prev.setDate(prev.getDate() - 1)
    onDateChange(prev)
  }

  const goToNextDay = () => {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + 1)
    onDateChange(next)
  }

  const goToToday = () => {
    onDateChange(new Date())
  }

  // Limit unscheduled display
  const visibleUnscheduled = showAllUnscheduled
    ? unscheduledTasks
    : unscheduledTasks.slice(0, 5)
  const hiddenUnscheduledCount = unscheduledTasks.length - 5

  // Handle clicking on a task - close modal and navigate
  const handleGoToTask = (taskId: string) => {
    handleClose()
    // Small delay to let animation complete
    setTimeout(() => {
      onGoToTask(taskId)
    }, 260)
  }

  if (!isOpen && !isClosing) return null

  const hasContent = scheduledTasks.length > 0 || habits.length > 0 || unscheduledTasks.length > 0

  return (
    <div
      className={`fixed inset-0 z-50 flex ${isMobile ? 'items-end' : 'items-center'} justify-center`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm ${
          isClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'
        }`}
      />

      {/* Modal/Sheet */}
      <div
        className={`
          relative z-10
          bg-elevated border border-border
          ${isMobile
            ? 'rounded-t-2xl w-full max-h-[90vh]'
            : 'rounded-2xl w-full max-w-xl mx-4 max-h-[85vh]'
          }
          shadow-modal
          flex flex-col
          ${isClosing
            ? 'animate-modal-out'
            : isVisible
              ? 'animate-modal-in'
              : 'opacity-0'
          }
        `}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={goToPreviousDay}
              className="p-2 -ml-2 rounded-lg text-text-muted hover:text-text hover:bg-subtle transition-colors"
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text">
                {formatDateHeader(selectedDate)}
              </h2>
              {!isToday && (
                <button
                  onClick={goToToday}
                  className="px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft rounded transition-colors"
                >
                  Today
                </button>
              )}
            </div>

            <button
              onClick={goToNextDay}
              className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-subtle transition-colors"
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          <button
            onClick={handleClose}
            className="p-2 -mr-2 rounded-lg text-text-muted hover:text-text hover:bg-subtle transition-colors"
            aria-label="Done planning"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Timeline toggle */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowTimeline(!showTimeline)}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
                transition-all duration-150
                ${showTimeline
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'bg-surface text-text-muted border border-transparent hover:text-text hover:bg-subtle'
                }
              `}
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="9" y1="4" x2="9" y2="10" />
                <line x1="15" y1="4" x2="15" y2="10" />
              </svg>
              Timeline
            </button>
          </div>

          {/* Hour Timeline */}
          {showTimeline && (
            <HourTimeline
              tasks={tasks}
              selectedDate={selectedDate}
              onGoToTask={handleGoToTask}
            />
          )}

          {/* Timeline Sections */}
          {(morning.length > 0 || afternoon.length > 0 || evening.length > 0) && (
            <div className="mb-6 space-y-4">
              {morning.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Morning</h3>
                  <div className="space-y-1">
                    {morning.map(task => (
                      <TimelineItem
                        key={task.id}
                        task={task}
                        time={formatScheduledTime(task.scheduled_at)}
                        onClick={() => handleGoToTask(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {afternoon.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Afternoon</h3>
                  <div className="space-y-1">
                    {afternoon.map(task => (
                      <TimelineItem
                        key={task.id}
                        task={task}
                        time={formatScheduledTime(task.scheduled_at)}
                        onClick={() => handleGoToTask(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {evening.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">Evening</h3>
                  <div className="space-y-1">
                    {evening.map(task => (
                      <TimelineItem
                        key={task.id}
                        task={task}
                        time={formatScheduledTime(task.scheduled_at)}
                        onClick={() => handleGoToTask(task.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Habits Section - only on today */}
          {isToday && habits.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setShowHabits(!showHabits)}
                className="w-full flex items-center justify-between py-2 text-left"
              >
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide">Habits today</h3>
                  <span className="text-xs text-text-muted">{habitsCompleted}/{habitsTotal}</span>
                  {/* Progress bar */}
                  <div className="w-12 h-1 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-success rounded-full transition-all duration-300"
                      style={{ width: `${habitsTotal > 0 ? (habitsCompleted / habitsTotal) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 16 16"
                  className={`text-text-muted transition-transform ${showHabits ? 'rotate-180' : ''}`}
                >
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                </svg>
              </button>

              {showHabits && (
                <div className="mt-2 space-y-1">
                  {habits.map(habit => (
                    <HabitItem
                      key={habit.id}
                      task={habit}
                      onToggle={() => onToggleHabit(habit.id)}
                      onClick={() => handleGoToTask(habit.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Unscheduled Section */}
          {unscheduledTasks.length > 0 && (
            <div>
              <button
                onClick={() => setShowUnscheduled(!showUnscheduled)}
                className="w-full flex items-center justify-between py-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide">Unscheduled</h3>
                  <span className="text-xs text-text-muted">({unscheduledTasks.length})</span>
                </div>
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 16 16"
                  className={`text-text-muted transition-transform ${showUnscheduled ? 'rotate-180' : ''}`}
                >
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                </svg>
              </button>

              {showUnscheduled && (
                <div className="mt-2 space-y-1">
                  {visibleUnscheduled.map(task => (
                    <div
                      key={task.id}
                      onClick={() => handleGoToTask(task.id)}
                      className="flex items-center gap-3 py-2 px-3 -mx-3 rounded-md hover:bg-subtle/50 cursor-pointer transition-colors"
                    >
                      <div className="w-14 flex-shrink-0" /> {/* Spacer for alignment */}
                      <div className="w-px h-6 bg-border-subtle flex-shrink-0" />
                      <span className="flex-1 text-sm text-text truncate">{task.title}</span>
                      <svg width={14} height={14} viewBox="0 0 16 16" className="text-text-muted flex-shrink-0">
                        <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                      </svg>
                    </div>
                  ))}

                  {!showAllUnscheduled && hiddenUnscheduledCount > 0 && (
                    <button
                      onClick={() => setShowAllUnscheduled(true)}
                      className="w-full py-2 text-sm text-text-muted hover:text-text transition-colors"
                    >
                      Show {hiddenUnscheduledCount} more
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!hasContent && (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-full bg-subtle flex items-center justify-center mx-auto mb-4">
                <svg width={24} height={24} viewBox="0 0 24 24" className="text-text-muted">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                  <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
                </svg>
              </div>
              <div className="text-base font-medium text-text mb-1">
                {isToday ? 'Nothing planned today' : 'Nothing planned'}
              </div>
              <div className="text-sm text-text-muted">
                {isToday ? 'Add tasks from the home view' : 'Check another day or add some tasks'}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={handleClose}
            className="w-full py-3 px-4 bg-accent text-white rounded-xl font-medium hover:bg-accent/90 transition-colors"
          >
            Done planning
          </button>
        </div>
      </div>
    </div>
  )
}
