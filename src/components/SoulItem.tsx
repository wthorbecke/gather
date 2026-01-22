'use client'

interface SoulItemProps {
  name: string
  icon: string
  iconColor: string
  lastDone?: Date
  defaultText: string
  onDone: () => void
}

function getTimeAgo(date: Date): { text: string; color: string } {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return { text: 'Today ✓', color: 'var(--sage)' }
  } else if (days === 1) {
    return { text: 'Yesterday', color: 'var(--text-muted)' }
  } else {
    return {
      text: `${days} days ago`,
      color: days > 7 ? 'var(--rose)' : 'var(--text-muted)',
    }
  }
}

export function SoulItem({ name, icon, iconColor, lastDone, defaultText, onDone }: SoulItemProps) {
  const status = lastDone ? getTimeAgo(lastDone) : { text: defaultText, color: 'var(--text-muted)' }

  return (
    <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-[var(--border-light)] transition-all hover:shadow-soft-hover">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
        style={{ backgroundColor: iconColor }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-[0.95rem] text-[var(--text)] mb-0.5">{name}</div>
        <div className="text-[0.8rem]" style={{ color: status.color }}>
          {status.text}
        </div>
      </div>
      <button
        onClick={onDone}
        className="px-4 py-2 bg-[var(--bg-warm)] border border-[var(--border)] rounded-full text-[0.8rem] text-[var(--text-soft)] hover:bg-[var(--sage-soft)] hover:border-[var(--sage)] hover:text-[var(--sage)] transition-all"
      >
        Done
      </button>
    </div>
  )
}
