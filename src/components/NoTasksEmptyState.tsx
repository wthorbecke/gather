'use client'

interface NoTasksEmptyStateProps {
  title?: string
  subtitle?: string
  buttonText?: string
  onAction: () => void
}

/**
 * Shared empty state component for when no tasks are available.
 * Used by FocusLauncher, HelpMePick, and other task selection modals.
 */
export function NoTasksEmptyState({
  title = 'Nothing to pick',
  subtitle = 'All your tasks are done!',
  buttonText = 'Back',
  onAction,
}: NoTasksEmptyStateProps) {
  return (
    <div className="fixed inset-0 z-50 bg-canvas/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-elevated border border-border rounded-2xl p-6 max-w-sm w-full text-center shadow-modal">
        <div className="text-4xl mb-4 opacity-40">🎯</div>
        <h2 className="text-xl font-medium text-text mb-2">{title}</h2>
        <p className="text-text-soft mb-6">{subtitle}</p>
        <button
          onClick={onAction}
          className="px-6 py-3 rounded-xl bg-surface text-text hover:bg-card transition-colors"
        >
          {buttonText}
        </button>
      </div>
    </div>
  )
}
