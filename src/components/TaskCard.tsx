'use client'

import { SegmentedProgress } from './SegmentedProgress'

interface TaskAction {
  type: 'link' | 'email' | 'ai_help'
  label: string
  url?: string
  onClick?: () => void
  primary?: boolean
}

interface SubtaskProgress {
  completed: number
  total: number
}

interface TaskCardProps {
  title: string
  description?: string | null
  context?: string | null
  badge?: string | null
  category?: 'urgent' | 'soon' | 'waiting' | 'completed'
  actions?: TaskAction[]
  onClick?: () => void
  subtaskProgress?: SubtaskProgress | null
}

export function TaskCard({
  title,
  description,
  context,
  badge,
  category = 'soon',
  actions = [],
  onClick,
  subtaskProgress
}: TaskCardProps) {
  const displayContext = context || description

  return (
    <div
      onClick={onClick}
      className={`bg-elevated border border-border rounded-xl p-5 mb-3 card-hover ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="flex justify-between items-start mb-1">
        <h3 className="text-lg font-semibold text-text">{title}</h3>
        {subtaskProgress && (
          <span className="text-xs text-text-muted ml-3 whitespace-nowrap">
            {subtaskProgress.completed}/{subtaskProgress.total}
          </span>
        )}
      </div>

      {displayContext && (
        <p className="text-sm text-text-muted mb-3 leading-relaxed">{displayContext}</p>
      )}

      {subtaskProgress && subtaskProgress.total > 0 && (
        <div className="mb-3">
          <SegmentedProgress
            completed={subtaskProgress.completed}
            total={subtaskProgress.total}
          />
          {subtaskProgress.completed === subtaskProgress.total && subtaskProgress.total > 0 && (
            <p className="text-xs text-success mt-2">All steps complete!</p>
          )}
        </div>
      )}

      {badge && (
        <span className="inline-block text-xs px-3 py-1 rounded-full bg-accent-soft text-accent">
          {badge}
        </span>
      )}

      {actions.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-3">
          {actions.map((action, i) => (
            action.type === 'link' ? (
              <a
                key={i}
                href={action.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`px-4 py-2 text-sm rounded-lg transition-all btn-press ${
                  action.primary
                    ? 'bg-accent text-white hover:opacity-90'
                    : 'bg-surface border border-border text-text-soft hover:bg-elevated hover:text-text'
                }`}
              >
                {action.label}
              </a>
            ) : (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation()
                  action.onClick?.()
                }}
                className={`px-4 py-2 text-sm rounded-lg transition-all btn-press ${
                  action.primary
                    ? 'bg-accent text-white hover:opacity-90'
                    : 'bg-surface border border-border text-text-soft hover:bg-elevated hover:text-text'
                }`}
              >
                {action.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  )
}
