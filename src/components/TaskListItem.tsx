'use client'

import { useState, memo, useMemo } from 'react'
import { Task } from '@/hooks/useUserData'
import { TaskType } from '@/lib/constants'
import { getTaskTypeColor, isCompletable, formatScheduledTime, isOverdue } from '@/lib/taskTypes'
import { DeadlineBadge } from './DeadlineBadge'
import { SnoozeMenu } from './SnoozeMenu'
import { EnergyBadge } from './EnergyBadge'
import { useSwipeGesture, isTouchSupported } from '@/hooks/useSwipeGesture'

interface TaskListItemProps {
  task: Task
  onClick: () => void
  onDelete?: () => void
  onHabitComplete?: () => void  // For habits: mark today as complete
  onSnooze?: (date: string) => void  // Snooze task to a later date
  onTogglePin?: () => void     // Pin/unpin task
  onQuickComplete?: () => void  // Quick complete the next step (swipe right)
  onOpenContextMenu?: () => void  // Open context menu (long press)
}

// Type icons (14px, muted color)
const TypeIcon = memo(function TypeIcon({ type, className = '' }: { type: TaskType | undefined; className?: string }) {
  const colorClass = getTaskTypeColor(type)

  // Task type has no icon (or subtle checkbox would go here)
  if (!type || type === TaskType.TASK) {
    return null
  }

  // Reminder - bell icon
  if (type === TaskType.REMINDER) {
    return (
      <svg width={14} height={14} viewBox="0 0 24 24" className={`${colorClass} ${className}`} aria-label="Reminder">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    )
  }

  // Habit - refresh/cycle icon
  if (type === TaskType.HABIT) {
    return (
      <svg width={14} height={14} viewBox="0 0 24 24" className={`${colorClass} ${className}`} aria-label="Habit">
        <path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    )
  }

  // Event - calendar icon
  if (type === TaskType.EVENT) {
    return (
      <svg width={14} height={14} viewBox="0 0 24 24" className={`${colorClass} ${className}`} aria-label="Event">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
      </svg>
    )
  }

  return null
})

// Recurrence indicator icon (small, shows task repeats)
const RecurrenceIcon = memo(function RecurrenceIcon({ className = '' }: { className?: string }) {
  return (
    <span title="This task repeats" className={`inline-flex ${className}`}>
      <svg
        width={12}
        height={12}
        viewBox="0 0 24 24"
        className="text-text-muted flex-shrink-0"
        aria-label="Repeats"
      >
        <path
          d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </span>
  )
})

// Streak indicator for habits (flame icon + number)
const StreakIndicator = memo(function StreakIndicator({ streak }: { streak: number }) {
  if (streak <= 0) return null

  return (
    <div className="flex items-center gap-0.5 text-xs font-medium text-success">
      <span>🔥</span>
      <span>{streak}</span>
    </div>
  )
})

// Source icons for tasks created from integrations
const SourceIcon = memo(function SourceIcon({ source }: { source: string }) {
  if (source === 'email' || source === 'gmail') {
    return (
      <svg width={12} height={12} viewBox="0 0 24 24" className="text-text-muted" aria-label="From email">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" stroke="currentColor" strokeWidth="2" fill="none"/>
        <polyline points="22,6 12,13 2,6" stroke="currentColor" strokeWidth="2" fill="none"/>
      </svg>
    )
  }
  if (source === 'calendar') {
    return (
      <svg width={12} height={12} viewBox="0 0 24 24" className="text-text-muted" aria-label="From calendar">
        <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none"/>
        <line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="2"/>
      </svg>
    )
  }
  return null
})

// Swipe action indicator icons
const SwipeCompleteIcon = memo(function SwipeCompleteIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
})

const SwipeSnoozeIcon = memo(function SwipeSnoozeIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" />
    </svg>
  )
})

const SwipeDeleteIcon = memo(function SwipeDeleteIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white">
      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    </svg>
  )
})

export const TaskListItem = memo(function TaskListItem({
  task,
  onClick,
  onDelete,
  onHabitComplete,
  onSnooze,
  onTogglePin,
  onQuickComplete,
  onOpenContextMenu
}: TaskListItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false)
  const taskType = task.type || TaskType.TASK
  const isHabit = taskType === TaskType.HABIT
  const isReminder = taskType === TaskType.REMINDER
  const isEvent = taskType === TaskType.EVENT
  const canComplete = isCompletable(task)
  const overdue = isOverdue(task)

  // Check if task has incomplete steps for quick complete
  const hasIncompleteSteps = useMemo(() => {
    return task.steps?.some(s => !s.done) ?? false
  }, [task.steps])

  // Determine swipe actions based on task type and available handlers
  const canSwipeRight = Boolean((hasIncompleteSteps && onQuickComplete) || (isHabit && onHabitComplete))
  const canSwipeLeft = Boolean(onSnooze && !isHabit) || Boolean(onDelete)

  // Swipe gesture hook
  const { ref: swipeRef, state: swipeState } = useSwipeGesture({
    threshold: 80,
    onSwipeRight: canSwipeRight ? () => {
      if (isHabit && onHabitComplete) {
        onHabitComplete()
      } else if (onQuickComplete) {
        onQuickComplete()
      }
    } : undefined,
    onSwipeLeft: canSwipeLeft ? () => {
      if (onSnooze && !isHabit) {
        setShowSnoozeMenu(true)
      } else if (onDelete) {
        onDelete()
      }
    } : undefined,
    onLongPress: onOpenContextMenu || (() => setShowMenu(true)),
    enableSwipeRight: canSwipeRight,
    enableSwipeLeft: canSwipeLeft,
  })

  // Get scheduled time for reminders/events
  const scheduledTime = formatScheduledTime(task.scheduled_at)

  // Context processing - filter out placeholder/debug values
  const rawContextText = task.context_text?.trim() || ''

  // Skip placeholder or empty-equivalent context
  const isPlaceholderContext = (text: string) => {
    const lower = text.toLowerCase()
    return (
      !text ||
      lower === 'no additional context provided.' ||
      lower === 'no additional context provided' ||
      lower === 'no context provided.' ||
      lower === 'no context provided' ||
      lower === 'none provided.' ||
      lower === 'none provided' ||
      lower === 'n/a' ||
      lower === 'none' ||
      lower.includes('other (i will specify)')
    )
  }

  const contextText = isPlaceholderContext(rawContextText) ? '' : rawContextText
  const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase()
  const shouldShowContext =
    contextText.length > 0 &&
    normalizeText(contextText) !== normalizeText(task.title)
  const contextParts = contextText
    .split(' · ')
    .map((part) => part.trim())
    .filter(part => part && !isPlaceholderContext(part))
  // Show only first context part for simplified view
  const condensedContext = contextParts.length > 0 ? contextParts[0] : ''

  // Build secondary text based on type
  const getSecondaryText = () => {
    if (isReminder && scheduledTime) {
      return scheduledTime
    }
    if (isEvent && scheduledTime) {
      const sourceLabel = task.external_source?.provider === 'google' ? 'Google Calendar' : ''
      return sourceLabel ? `${scheduledTime} · ${sourceLabel}` : scheduledTime
    }
    if (shouldShowContext) {
      return condensedContext
    }
    return null
  }

  const secondaryText = getSecondaryText()

  // Calculate swipe action area visibility based on offset
  const swipeOffset = swipeState.offsetX
  const isSwipingRight = swipeOffset > 0
  const isSwipingLeft = swipeOffset < 0
  const swipeProgress = Math.min(Math.abs(swipeOffset) / 80, 1)
  const thresholdReached = swipeState.thresholdReached

  // Determine what action is shown on left swipe
  const leftSwipeAction = onSnooze && !isHabit ? 'snooze' : 'delete'

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Right swipe action area (complete) - revealed when swiping right */}
      {canSwipeRight && (
        <div
          className={`
            absolute inset-y-0 left-0 flex items-center justify-start pl-6
            transition-opacity duration-100
            ${isSwipingRight ? 'opacity-100' : 'opacity-0'}
          `}
          style={{
            width: Math.max(Math.abs(swipeOffset), 0),
            backgroundColor: thresholdReached && isSwipingRight ? 'var(--success)' : 'rgba(107, 144, 128, 0.7)',
          }}
        >
          <div
            className="transition-transform duration-100"
            style={{
              transform: `scale(${0.8 + swipeProgress * 0.4})`,
              opacity: swipeProgress,
            }}
          >
            <SwipeCompleteIcon />
          </div>
        </div>
      )}

      {/* Left swipe action area (snooze/delete) - revealed when swiping left */}
      {canSwipeLeft && (
        <div
          className={`
            absolute inset-y-0 right-0 flex items-center justify-end pr-6
            transition-opacity duration-100
            ${isSwipingLeft ? 'opacity-100' : 'opacity-0'}
          `}
          style={{
            width: Math.max(Math.abs(swipeOffset), 0),
            backgroundColor: leftSwipeAction === 'delete'
              ? (thresholdReached && isSwipingLeft ? 'var(--danger)' : 'rgba(220, 107, 107, 0.7)')
              : (thresholdReached && isSwipingLeft ? 'var(--accent)' : 'rgba(217, 117, 86, 0.7)'),
          }}
        >
          <div
            className="transition-transform duration-100"
            style={{
              transform: `scale(${0.8 + swipeProgress * 0.4})`,
              opacity: swipeProgress,
            }}
          >
            {leftSwipeAction === 'snooze' ? <SwipeSnoozeIcon /> : <SwipeDeleteIcon />}
          </div>
        </div>
      )}

      {/* Main card content - moves with swipe */}
      <div
        ref={swipeRef}
        onClick={onClick}
        className={`
          relative
          bg-card rounded-xl
          border border-border-subtle
          cursor-pointer
          hover:bg-card-hover hover:shadow-sm hover:-translate-y-[1px]
          active:scale-[0.995] active:shadow-none active:translate-y-0
          transition-all duration-150 ease-out
          group
          ${overdue && isReminder ? 'border-danger/30' : ''}
          ${swipeState.isSwiping ? 'transition-none' : 'transition-transform duration-200 ease-out'}
        `}
        style={{
          transform: swipeState.isSwiping
            ? `translateX(${swipeOffset}px)`
            : 'translateX(0)',
        }}
      >
        <div className="flex items-center p-4 gap-3">
          {/* Type icon or streak for habits */}
          {isHabit && task.streak?.current ? (
            <StreakIndicator streak={task.streak.current} />
          ) : (
            <TypeIcon type={taskType} />
          )}

          {/* Content - simplified: just title and one line of context */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Pin indicator */}
              {task.pinned && (
                <svg width={12} height={12} viewBox="0 0 24 24" className="text-accent flex-shrink-0" aria-label="Pinned">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/>
                </svg>
              )}
              {task.source && task.source !== 'manual' && !isEvent && (
                <SourceIcon source={task.source} />
              )}
              <div className={`text-base font-medium text-text truncate ${overdue && isReminder ? 'text-danger' : ''}`}>
                {task.title}
              </div>
              {/* Energy level indicator */}
              {task.energy && (
                <EnergyBadge energy={task.energy} size="sm" />
              )}
              {/* Recurrence indicator - show for tasks/reminders with recurrence (habits already show repeat icon) */}
              {task.recurrence && !isHabit && (
                <RecurrenceIcon />
              )}
              {task.due_date && !isReminder && !isEvent && (
                <DeadlineBadge dueDate={task.due_date} compact />
              )}
            </div>
            {/* Secondary text: time for reminders/events, context for tasks */}
            {secondaryText && (
              <div className={`text-xs truncate mt-1 ${overdue && isReminder ? 'text-danger/80' : 'text-text-muted'}`}>
                {secondaryText}
              </div>
            )}
          </div>

          {/* Kebab menu - always visible on mobile for accessibility */}
          <div className="relative flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className="
                min-w-[44px] min-h-[44px] p-2 -mr-2 rounded-md
                flex items-center justify-center
                text-text-muted hover:text-text hover:bg-surface
                opacity-40 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100
                transition-opacity
              "
              aria-label="Task menu"
            >
              <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="8" cy="3" r="1.25" fill="currentColor" />
                <circle cx="8" cy="8" r="1.25" fill="currentColor" />
                <circle cx="8" cy="13" r="1.25" fill="currentColor" />
              </svg>
            </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false) }} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-md shadow-md overflow-hidden min-w-[140px] animate-rise">
                  {isHabit && onHabitComplete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowMenu(false)
                        onHabitComplete()
                      }}
                      className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-success hover:bg-success/10 flex items-center gap-2 transition-colors duration-150 ease-out"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-success">
                        <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Done for today
                    </button>
                  )}
                  {onSnooze && !isHabit && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowMenu(false)
                        setShowSnoozeMenu(true)
                      }}
                      className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text-soft hover:bg-surface flex items-center gap-2 transition-colors duration-150 ease-out"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" strokeLinecap="round" />
                      </svg>
                      Snooze
                    </button>
                  )}
                  {onTogglePin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowMenu(false)
                        onTogglePin()
                      }}
                      className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text-soft hover:bg-surface flex items-center gap-2 transition-colors duration-150 ease-out"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill={task.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" className={task.pinned ? 'text-accent' : ''}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      {task.pinned ? 'Unpin' : 'Pin to top'}
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowMenu(false)
                        onDelete()
                      }}
                      className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-danger hover:bg-danger-soft flex items-center gap-2 transition-colors duration-150 ease-out"
                    >
                      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-danger">
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                      </svg>
                      Delete
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Arrow */}
          <svg width={16} height={16} viewBox="0 0 16 16" className="text-text-muted flex-shrink-0">
            <path
              d="M6 4L10 8L6 12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>
      </div>

      {/* Snooze Menu */}
      {showSnoozeMenu && onSnooze && (
        <div onClick={(e) => e.stopPropagation()}>
          <SnoozeMenu
            onSnooze={(date) => {
              onSnooze(date)
              setShowSnoozeMenu(false)
            }}
            onCancel={() => setShowSnoozeMenu(false)}
          />
        </div>
      )}
    </div>
  )
})
