'use client'

import { useState, useMemo } from 'react'
import { Task } from '@/hooks/useUserData'
import { TaskType } from '@/lib/constants'
import {
  getTimePeriod,
  formatScheduledTime,
  isHabitDueToday,
  isHabitCompletedToday,
  isCompletable,
} from '@/lib/taskTypes'
import { UnifiedInput, ParsedInputMetadata } from './UnifiedInput'
import { AICard, AICardState } from './AICard'
import { Checkbox } from './Checkbox'
import { splitStepText } from '@/lib/stepText'
import { getNextStep } from '@/hooks/useTaskSearch'
import { HourTimeline } from './HourTimeline'

interface DayViewProps {
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
  onSignOut?: () => void
  isDemoUser?: boolean
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
  onToggle,
}: {
  task: Task
  time: string | null
  onClick: () => void
  onToggle?: () => void
}) {
  const type = task.type || TaskType.TASK
  const canComplete = isCompletable(task)
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
        {canComplete && !isEvent && !isReminder && (
          <div
            onClick={(e) => {
              e.stopPropagation()
              onToggle?.()
            }}
            className="w-5 h-5 rounded border border-border flex items-center justify-center hover:border-accent transition-colors"
          />
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
          <span>🔥</span>
          <span>{streak}</span>
        </div>
      )}
    </div>
  )
}

export function DayView({
  tasks,
  aiCard,
  pendingInput,
  selectedDate,
  onDateChange,
  onSubmit,
  onQuickAdd,
  onQuickReply,
  onDismissAI,
  onGoToTask,
  onToggleStep,
  onToggleHabit,
  onAICardAction,
  onSignOut,
  isDemoUser = false,
}: DayViewProps) {
  const [showAllUnscheduled, setShowAllUnscheduled] = useState(false)
  const [showHabits, setShowHabits] = useState(true)
  const [showUnscheduled, setShowUnscheduled] = useState(true)
  const [showTimeline, setShowTimeline] = useState(true)

  const isQuestionFlow = Boolean(aiCard?.question)
  const getDerivedStepTitle = (text: string) => splitStepText(text).title

  // Filter tasks for the selected date
  const { scheduledTasks, habits, unscheduledTasks, nextStep } = useMemo(() => {
    const today = new Date()
    const isToday = selectedDate.toDateString() === today.toDateString()

    // Get next step for "Do this now" (only on today)
    const activeTasks = tasks.filter(t => {
      if (!t.snoozed_until) return true
      return t.snoozed_until <= today.toISOString().split('T')[0]
    })
    const nextStepResult = isToday ? getNextStep(activeTasks) : null

    // Scheduled items (events, reminders with time)
    const scheduled = tasks.filter(task =>
      isScheduledForDate(task, selectedDate) &&
      (task.type === TaskType.EVENT || task.type === TaskType.REMINDER)
    ).sort((a, b) => {
      const timeA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
      const timeB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
      return timeA - timeB
    })

    // Habits (show on today only)
    const habitTasks = isToday
      ? tasks.filter(task =>
          task.type === TaskType.HABIT && isHabitDueToday(task)
        )
      : []

    // Unscheduled tasks (due today or overdue, no scheduled_at)
    const unscheduled = tasks.filter(task => {
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

    return {
      scheduledTasks: scheduled,
      habits: habitTasks,
      unscheduledTasks: unscheduled,
      nextStep: nextStepResult,
    }
  }, [tasks, selectedDate])

  // Group scheduled tasks by time period
  const { morning, afternoon, evening } = useMemo(() => {
    const groups = { morning: [] as Task[], afternoon: [] as Task[], evening: [] as Task[] }

    for (const task of scheduledTasks) {
      if (!task.scheduled_at) continue
      const period = getTimePeriod(new Date(task.scheduled_at))
      groups[period].push(task)
    }

    return groups
  }, [scheduledTasks])

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

  const isToday = selectedDate.toDateString() === new Date().toDateString()

  // Limit unscheduled display
  const visibleUnscheduled = showAllUnscheduled
    ? unscheduledTasks
    : unscheduledTasks.slice(0, 5)
  const hiddenUnscheduledCount = unscheduledTasks.length - 5

  return (
    <div className="min-h-screen px-5 pt-4 pb-8 bg-canvas">
      <div className="max-w-[540px] mx-auto">
        {/* Day Navigation Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={goToPreviousDay}
            className="p-2 -ml-2 rounded-lg text-text-muted hover:text-text hover:bg-subtle transition-colors"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="flex items-center gap-3">
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
            className="p-2 -mr-2 rounded-lg text-text-muted hover:text-text hover:bg-subtle transition-colors"
          >
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

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
            onGoToTask={onGoToTask}
          />
        )}

        {/* AI Card */}
        {aiCard && (
          <AICard
            card={aiCard}
            pendingInput={pendingInput}
            onDismiss={onDismissAI}
            onQuickReply={onQuickReply}
            onGoToTask={onGoToTask}
            onAction={onAICardAction}
            attachInput={isQuestionFlow}
          />
        )}

        {/* Input */}
        <UnifiedInput
          tasks={tasks}
          onSubmit={onSubmit}
          onQuickAdd={onQuickAdd}
          allowDropdown={!isQuestionFlow}
        />

        {/* "Do This Now" Hero Card - only on today */}
        {isToday && nextStep && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-sm font-semibold text-accent uppercase tracking-wide">Do this now</span>
            </div>

            <div
              onClick={() => onGoToTask(nextStep.task.id)}
              className="
                bg-card rounded-xl cursor-pointer overflow-hidden
                border-2 border-accent/30
                shadow-lg shadow-accent/5
                hover:border-accent/50 hover:shadow-accent/10
                transition-all duration-200
                p-4
              "
            >
              <div className="flex gap-3">
                <div className="flex-shrink-0 pt-0.5">
                  <Checkbox
                    checked={nextStep.step.done}
                    onToggle={() => onToggleStep(nextStep.task.id, nextStep.step.id)}
                    size={22}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold text-text mb-1">
                    {getDerivedStepTitle(nextStep.step.text)}
                  </div>
                  {nextStep.step.summary && (
                    <div className="text-sm text-text-soft line-clamp-2">{nextStep.step.summary}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Sections */}
        {(morning.length > 0 || afternoon.length > 0 || evening.length > 0) && (
          <div className="mb-6 space-y-4">
            {morning.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Morning</h3>
                <div className="space-y-1">
                  {morning.map(task => (
                    <TimelineItem
                      key={task.id}
                      task={task}
                      time={formatScheduledTime(task.scheduled_at)}
                      onClick={() => onGoToTask(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {afternoon.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Afternoon</h3>
                <div className="space-y-1">
                  {afternoon.map(task => (
                    <TimelineItem
                      key={task.id}
                      task={task}
                      time={formatScheduledTime(task.scheduled_at)}
                      onClick={() => onGoToTask(task.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {evening.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Evening</h3>
                <div className="space-y-1">
                  {evening.map(task => (
                    <TimelineItem
                      key={task.id}
                      task={task}
                      time={formatScheduledTime(task.scheduled_at)}
                      onClick={() => onGoToTask(task.id)}
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
                    onClick={() => onGoToTask(habit.id)}
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
                    onClick={() => onGoToTask(task.id)}
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
        {scheduledTasks.length === 0 && habits.length === 0 && unscheduledTasks.length === 0 && !nextStep && (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-subtle flex items-center justify-center mx-auto mb-4">
              <svg width={24} height={24} viewBox="0 0 24 24" className="text-text-muted">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
                <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
              </svg>
            </div>
            <div className="text-base font-medium text-text mb-1">Nothing scheduled</div>
            <div className="text-sm text-text-muted">Add tasks or connect your calendar</div>
          </div>
        )}

        {/* Footer with sign out */}
        {onSignOut && (
          <div className="pt-8 text-center">
            <button
              onClick={onSignOut}
              className="text-xs text-text-muted hover:text-text-soft transition-colors"
            >
              {isDemoUser ? 'Exit demo' : 'Sign out'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
