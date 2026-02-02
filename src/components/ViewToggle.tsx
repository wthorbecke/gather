'use client'

import { memo } from 'react'
import type { ViewMode } from '@/hooks/useViewState'

interface ViewToggleProps {
  currentView: ViewMode
  onViewChange: (view: ViewMode) => void
}

/**
 * View toggle for header - switches between list, day, and stack views
 */
export const ViewToggle = memo(function ViewToggle({ currentView, onViewChange }: ViewToggleProps) {
  const views: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    {
      mode: 'list',
      label: 'List',
      icon: (
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="6" x2="20" y2="6" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="18" x2="20" y2="18" />
        </svg>
      ),
    },
    {
      mode: 'day',
      label: 'Day',
      icon: (
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      ),
    },
    {
      mode: 'stack',
      label: 'Stack',
      icon: (
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="6" width="16" height="14" rx="2" />
          <path d="M6 4h12" className="opacity-60" />
          <path d="M8 2h8" className="opacity-30" />
        </svg>
      ),
    },
  ]

  return (
    <div className="flex items-center bg-surface rounded-lg p-0.5">
      {views.map(({ mode, icon, label }) => (
        <button
          key={mode}
          onClick={() => onViewChange(mode)}
          className={`
            p-3 min-w-[44px] min-h-[44px] rounded-md transition-all duration-150
            flex items-center justify-center
            ${currentView === mode
              ? 'bg-card text-text shadow-sm'
              : 'text-text-muted hover:text-text'
            }
          `}
          title={label}
          aria-label={`${label} view`}
        >
          {icon}
        </button>
      ))}
    </div>
  )
})
