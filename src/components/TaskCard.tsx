'use client'

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
  description: string
  badge: string
  category: 'urgent' | 'soon' | 'waiting'
  actions: TaskAction[]
  onClick?: () => void
  subtaskProgress?: SubtaskProgress | null
}

const categoryStyles = {
  urgent: {
    border: 'border-l-[3px] border-l-[var(--rose)]',
    badge: 'bg-[var(--rose-soft)] text-[var(--rose)]',
  },
  soon: {
    border: 'border-l-[3px] border-l-[var(--accent)]',
    badge: 'bg-[var(--bg-warm)] text-[var(--accent)]',
  },
  waiting: {
    border: 'border-l-[3px] border-l-[var(--sage)] opacity-70',
    badge: 'bg-[var(--sage-soft)] text-[var(--sage)]',
  },
}

export function TaskCard({ title, description, badge, category, actions, onClick, subtaskProgress }: TaskCardProps) {
  const styles = categoryStyles[category]

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-[var(--border-light)] rounded-2xl p-6 mb-4 transition-all hover:shadow-soft-hover ${styles.border} ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-serif text-lg font-medium text-[var(--text)]">{title}</h3>
        <span className={`text-[0.7rem] px-3 py-1 rounded-full whitespace-nowrap ${styles.badge}`}>
          {badge}
        </span>
      </div>
      {description && (
        <p className="text-[0.9rem] text-[var(--text-soft)] mb-4 leading-relaxed">{description}</p>
      )}

      {/* Subtask Progress */}
      {subtaskProgress && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="flex-1 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--sage)] rounded-full transition-all duration-300"
                style={{ width: `${(subtaskProgress.completed / subtaskProgress.total) * 100}%` }}
              />
            </div>
            <span className="text-[0.75rem] text-[var(--text-muted)]">
              {subtaskProgress.completed}/{subtaskProgress.total}
            </span>
          </div>
          {subtaskProgress.completed === subtaskProgress.total && (
            <p className="text-[0.75rem] text-[var(--sage)]">All steps complete! Ready to finish?</p>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {actions.map((action, i) => (
          action.type === 'link' ? (
            <a
              key={i}
              href={action.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-4 py-2.5 text-[0.8rem] rounded-lg transition-all inline-flex items-center gap-1.5 ${
                action.primary
                  ? 'bg-[var(--text)] border border-[var(--text)] text-white hover:bg-[var(--text-soft)]'
                  : 'bg-[var(--bg-warm)] border border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
              }`}
            >
              {action.label}
            </a>
          ) : (
            <button
              key={i}
              onClick={action.onClick}
              className={`px-4 py-2.5 text-[0.8rem] rounded-lg transition-all inline-flex items-center gap-1.5 ${
                action.primary
                  ? 'bg-[var(--text)] border border-[var(--text)] text-white hover:bg-[var(--text-soft)]'
                  : 'bg-[var(--bg-warm)] border border-[var(--border)] text-[var(--text-soft)] hover:bg-[var(--bg)] hover:text-[var(--text)]'
              }`}
            >
              {action.label}
            </button>
          )
        ))}
      </div>
    </div>
  )
}
