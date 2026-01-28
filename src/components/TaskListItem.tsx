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
      className="group bg-card rounded-lg p-4 cursor-pointer shadow-[0_0_0_1px_var(--border)] hover:bg-card-hover transition-all duration-200 ease-in-out relative card-hover"
    >
      {/* Delete button - appears on hover */}
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
            transition-all duration-200 ease-in-out btn-press tap-target
            ${showDelete ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'}
          `}
          aria-label="Delete task"
          title="Delete task"
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

      <div className="flex justify-between mb-3 pr-8">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="text-base font-medium text-text truncate">{task.title}</div>
            {task.due_date && (
              <DeadlineBadge
                dueDate={task.due_date}
                compact
              />
            )}
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
            transition-opacity duration-200
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

      {total > 0 && (
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="flex-1 h-[3px] bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-success transition-all duration-200 ease-in-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-text-muted">
            {done}/{total}
          </span>
        </div>
      )}
    </div>
  )
}
