'use client'

import { useMemo, memo } from 'react'

interface DeadlineBadgeProps {
  dueDate: string | null
  deadlineType?: 'hard' | 'soft' | 'flexible'
  warnDaysBefore?: number
  compact?: boolean
}

/**
 * Smart deadline badge that shows urgency visually
 *
 * - Red: Overdue
 * - Orange: Due within warning period
 * - Yellow: Due within a week
 * - Gray: Due later
 */
export const DeadlineBadge = memo(function DeadlineBadge({
  dueDate,
  deadlineType = 'soft',
  warnDaysBefore = 3,
  compact = false,
}: DeadlineBadgeProps) {
  const status = useMemo(() => {
    if (!dueDate) return null

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const due = new Date(dueDate)
    due.setHours(0, 0, 0, 0)

    const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return {
        level: 'overdue' as const,
        days: Math.abs(diffDays),
        label: diffDays === -1 ? 'Yesterday' : `${Math.abs(diffDays)}d overdue`,
        color: 'var(--danger)',
        bgColor: 'rgba(220, 107, 107, 0.15)',
      }
    }

    if (diffDays === 0) {
      return {
        level: 'today' as const,
        days: 0,
        label: 'Today',
        color: 'var(--danger)',
        bgColor: 'rgba(220, 107, 107, 0.15)',
      }
    }

    if (diffDays === 1) {
      return {
        level: 'tomorrow' as const,
        days: 1,
        label: 'Tomorrow',
        color: 'var(--accent)', // Use design system accent (coral)
        bgColor: 'var(--accent-soft)',
      }
    }

    if (diffDays <= warnDaysBefore) {
      return {
        level: 'warning' as const,
        days: diffDays,
        label: `${diffDays}d`,
        color: 'var(--accent)', // Use design system accent (coral)
        bgColor: 'var(--accent-soft)',
      }
    }

    if (diffDays <= 7) {
      return {
        level: 'soon' as const,
        days: diffDays,
        label: `${diffDays}d`,
        color: 'var(--text-soft)', // Use design system text-soft
        bgColor: 'var(--surface)',
      }
    }

    // Format date for later deadlines
    const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
    return {
      level: 'later' as const,
      days: diffDays,
      label: formatter.format(due),
      color: 'var(--text-muted)',
      bgColor: 'var(--surface)',
    }
  }, [dueDate, warnDaysBefore])

  if (!status) return null

  // Hard deadlines get special emphasis
  const isHard = deadlineType === 'hard'
  const showIcon = status.level === 'overdue' || status.level === 'today' || (isHard && status.level === 'warning')

  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium"
        style={{ color: status.color }}
      >
        {showIcon && <span>⚠</span>}
        {status.label}
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-all"
      style={{
        color: status.color,
        backgroundColor: status.bgColor,
        border: isHard && status.level !== 'later' ? `1px solid ${status.color}` : 'none',
      }}
    >
      {showIcon && (
        <span className="text-[10px]">
          {status.level === 'overdue' ? '!' : '⏰'}
        </span>
      )}
      {status.label}
      {isHard && status.level !== 'later' && (
        <span className="text-[10px] opacity-70">firm</span>
      )}
    </span>
  )
})

/**
 * Get deadline urgency for sorting/filtering
 */
export function getDeadlineUrgency(dueDate: string | null): number {
  if (!dueDate) return 999

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)

  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  // Overdue tasks are most urgent (negative = more urgent)
  // Then today, tomorrow, etc.
  return diffDays
}

/**
 * Format due date for display
 */
export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)

  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    return diffDays === -1 ? 'Yesterday' : `${Math.abs(diffDays)} days ago`
  }
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Tomorrow'
  if (diffDays <= 7) return `In ${diffDays} days`

  const formatter = new Intl.DateTimeFormat('en-US', {
    weekday: diffDays <= 14 ? 'long' : undefined,
    month: 'short',
    day: 'numeric',
  })
  return formatter.format(due)
}
