'use client'

interface HabitItemProps {
  name: string
  description?: string
  link?: string
  completed: boolean
  onToggle: () => void
}

export function HabitItem({ name, description, link, completed, onToggle }: HabitItemProps) {
  return (
    <div
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName !== 'A') {
          onToggle()
        }
      }}
      className={`flex items-center gap-4 p-4 bg-white rounded-xl cursor-pointer border border-[var(--border-light)] transition-all hover:shadow-soft-hover hover:-translate-y-0.5 ${
        completed ? 'opacity-50' : ''
      }`}
    >
      <div
        className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          completed
            ? 'bg-[var(--sage)] border-[var(--sage)]'
            : 'border-[var(--border)]'
        }`}
      >
        {completed && (
          <svg
            className="w-3 h-3 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <div className="flex-1">
        <div className={`text-[0.95rem] ${completed ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text)]'}`}>
          {name}
        </div>
        {description && (
          <div className="text-[0.8rem] text-[var(--text-muted)] mt-0.5">{description}</div>
        )}
      </div>
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[0.8rem] text-[var(--accent)] opacity-70 hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          play →
        </a>
      )}
    </div>
  )
}
