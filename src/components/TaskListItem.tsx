'use client'

import { useState } from 'react'
import { Task } from '@/hooks/useUserData'
import { DeadlineBadge } from './DeadlineBadge'

interface TaskListItemProps {
  task: Task
  onClick: () => void
  onDelete?: () => void
}

export function TaskListItem({ task, onClick, onDelete }: TaskListItemProps) {
  const [showDelete, setShowDelete] = useState(false)
  const steps = task.steps || []
  const done = steps.filter((s) => s.done).length
  const total = steps.length
  const progress = total > 0 ? (done / total) * 100 : 0

  // Context processing
  const contextText = task.context_text?.trim() || ''
  const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase()
  const shouldShowContext =
    contextText.length > 0 &&
    normalizeText(contextText) !== normalizeText(task.title)
  const contextParts = contextText
    .split(' · ')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      part.toLowerCase().includes('other (i will specify)') ? 'Not specified' : part
    )
  const condensedContext = contextParts.length > 0
    ? `${contextParts.slice(0, 2).join(', ')}${contextParts.length > 2 ? ` +${contextParts.length - 2} more` : ''}`
    : contextText

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
      className="
        group relative
        bg-card rounded-lg p-4
        border border-border
        cursor-pointer
        transition-all duration-150 ease-out
        hover:shadow-card-hover hover:border-border
        active:scale-[0.99]
      "
    >
      {/* Delete button */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={`
            absolute right-3 top-3 z-10
            w-10 h-10 rounded-lg
            flex items-center justify-center
            text-text-muted hover:text-danger hover:bg-danger-soft
            transition-all duration-150 ease-out
            btn-press tap-target
            ${showDelete ? 'opacity-100' : 'opacity-0 pointer-events-none'}
          `}
          aria-label="Delete task"
        >
          <svg width={14} height={14} viewBox="0 0 16 16">
            <path
              d="M3 4h10M5.5 4v8a1.5 1.5 0 001.5 1.5h2a1.5 1.5 0 001.5-1.5V4M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </button>
      )}

      {/* Content */}
      <div className="flex justify-between items-start mb-3 pr-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-lg font-medium text-text truncate">{task.title}</div>
            {task.due_date && <DeadlineBadge dueDate={task.due_date} compact />}
          </div>
          {shouldShowContext && (
            <div className="text-sm text-text-muted mt-0.5 truncate">{condensedContext}</div>
          )}
        </div>
        <svg
          width={16}
          height={16}
          viewBox="0 0 16 16"
          className={`
            text-text-muted flex-shrink-0 ml-2
            transition-opacity duration-150
            ${showDelete ? 'opacity-0' : 'opacity-100'}
          `}
        >
          <path
            d="M6 4L10 8L6 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      {/* Progress */}
      {total > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-success rounded-full transition-all duration-200 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-text-muted tabular-nums">
            {done}/{total}
          </span>
        </div>
      )}
    </div>
  )
}
