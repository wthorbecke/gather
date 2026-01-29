'use client'

import { useState } from 'react'
import { Task } from '@/hooks/useUserData'
import { DeadlineBadge } from './DeadlineBadge'

interface TaskListItemProps {
  task: Task
  onClick: () => void
  onDelete?: () => void
}

// Source icons for tasks created from integrations
const SourceIcon = ({ source }: { source: string }) => {
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
}

export function TaskListItem({ task, onClick, onDelete }: TaskListItemProps) {
  const [showMenu, setShowMenu] = useState(false)
  const steps = task.steps || []
  const done = steps.filter((s) => s.done).length
  const total = steps.length

  // Determine if step count is meaningful
  // Don't show "0/1 steps" when there's only one step that matches the task title
  const hasMeaningfulSteps = total > 1 || (total === 1 && steps[0].text.toLowerCase().trim() !== task.title.toLowerCase().trim())

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
      className="
        group
        bg-card rounded-md
        border border-border
        cursor-pointer
        hover:bg-card-hover
        active:scale-[0.995]
        overflow-hidden
      "
    >
      <div className="flex items-center p-4 gap-3">
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {task.source && task.source !== 'manual' && (
              <SourceIcon source={task.source} />
            )}
            <div className="text-base font-medium text-text truncate">{task.title}</div>
            {task.due_date && <DeadlineBadge dueDate={task.due_date} compact />}
          </div>
          <div className="text-sm text-text-muted truncate">
            {shouldShowContext ? condensedContext : !hasMeaningfulSteps ? 'Tap to add steps' : null}
            {hasMeaningfulSteps && (
              <span className={shouldShowContext ? 'ml-2' : ''}>{done}/{total} steps</span>
            )}
          </div>
        </div>

        {/* Kebab menu */}
        <div className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className="
              p-1.5 rounded-md
              text-text-muted hover:text-text hover:bg-surface
              opacity-0 group-hover:opacity-100
              transition-opacity
            "
            aria-label="Menu"
          >
            <svg width={16} height={16} viewBox="0 0 16 16">
              <circle cx="8" cy="3" r="1.25" fill="currentColor" />
              <circle cx="8" cy="8" r="1.25" fill="currentColor" />
              <circle cx="8" cy="13" r="1.25" fill="currentColor" />
            </svg>
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false) }} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-md shadow-md overflow-hidden min-w-[120px] animate-rise">
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowMenu(false)
                      onDelete()
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft flex items-center gap-2"
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
  )
}
