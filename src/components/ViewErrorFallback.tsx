'use client'

interface ViewErrorFallbackProps {
  /** The error that was caught */
  error?: Error
  /** Handler to reset the error state and retry */
  resetError?: () => void
  /** Optional custom message (defaults to "Something went wrong") */
  message?: string
  /** Optional custom description */
  description?: string
  /** View name for context (e.g., "tasks", "calendar") */
  viewName?: string
}

/**
 * A friendly fallback UI for when a view crashes.
 * Follows the Gather design system - no guilt-tripping, clear recovery path.
 */
export function ViewErrorFallback({
  error,
  resetError,
  message = 'Something went wrong',
  description,
  viewName,
}: ViewErrorFallbackProps) {
  const defaultDescription = viewName
    ? `We hit a snag loading your ${viewName}. Your data is safe.`
    : "We hit a snag loading this view. Your data is safe."

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center animate-fade-in">
      {/* Icon */}
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: 'var(--danger-soft)' }}
      >
        <svg
          width={24}
          height={24}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: 'var(--danger)' }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      {/* Message */}
      <h2
        className="text-lg font-medium mb-2"
        style={{ color: 'var(--text)' }}
      >
        {message}
      </h2>

      {/* Description */}
      <p
        className="text-sm mb-6 max-w-xs"
        style={{ color: 'var(--text-soft)' }}
      >
        {description || defaultDescription}
      </p>

      {/* Actions */}
      <div className="flex gap-3">
        {resetError && (
          <button
            onClick={resetError}
            className="px-5 py-2.5 min-h-[44px] text-white rounded-xl text-sm font-medium transition-all duration-150 ease-out btn-press"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Try again
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all duration-150 ease-out btn-press"
          style={{
            backgroundColor: 'var(--surface)',
            color: 'var(--text-soft)'
          }}
        >
          Refresh page
        </button>
      </div>

      {/* Error details in development */}
      {process.env.NODE_ENV === 'development' && error && (
        <details className="mt-6 text-left max-w-md w-full">
          <summary
            className="text-xs cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
          >
            Error details (dev only)
          </summary>
          <pre
            className="mt-2 p-3 rounded-lg text-xs overflow-auto max-h-32"
            style={{
              backgroundColor: 'var(--surface)',
              color: 'var(--text-soft)'
            }}
          >
            {error.message}
            {error.stack && `\n\n${error.stack}`}
          </pre>
        </details>
      )}
    </div>
  )
}
