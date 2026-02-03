'use client'

import { FormEvent } from 'react'
import { AICard, AICardState } from './AICard'

interface EmptyStateMessage {
  symbol: string
  title: string
  subtitle: string
}

interface StackViewEmptyStateProps {
  ambientStyle: React.CSSProperties
  emptyState: EmptyStateMessage
  celebrateEmpty: boolean
  // Toolbar props
  onSwitchView?: () => void
  onSignOut?: () => void
  isDemoUser?: boolean
  // AI card props
  aiCard?: AICardState | null
  pendingInput?: string | null
  onDismissAI?: () => void
  onQuickReply?: (reply: string) => void
  onGoToTask: (taskId: string) => void
  onAICardAction?: (action: { type: string; stepId?: string | number; title?: string; context?: string }) => void
  // Input form props
  inputValue: string
  onInputChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
}

export function StackViewEmptyState({
  ambientStyle,
  emptyState,
  celebrateEmpty,
  onSwitchView,
  onSignOut,
  isDemoUser,
  aiCard,
  pendingInput,
  onDismissAI,
  onQuickReply,
  onGoToTask,
  onAICardAction,
  inputValue,
  onInputChange,
  onSubmit,
}: StackViewEmptyStateProps) {
  return (
    <div className="min-h-screen flex flex-col transition-all duration-700" style={ambientStyle}>
      {/* Subtle texture - pointer-events-none so it doesn't block input clicks */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />

      {/* Centered content container for desktop */}
      <div className="w-full max-w-lg mx-auto flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="sticky top-0 z-20 px-4 py-3 flex items-center justify-end">
          <div className="flex items-center gap-1">
            {onSwitchView && (
              <button
                onClick={onSwitchView}
                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-all duration-150"
                title="Switch to list view"
              >
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            )}
            {onSignOut && (
              <button
                onClick={onSignOut}
                className="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-[var(--text-muted)]/50 hover:text-[var(--text-muted)] hover:bg-[var(--surface)] transition-all duration-150"
                title={isDemoUser ? 'Exit demo' : 'Sign out'}
                aria-label={isDemoUser ? 'Exit demo' : 'Sign out'}
              >
                <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          {/* Show AI card when processing, otherwise show empty state */}
          {aiCard && onDismissAI ? (
            <div className="w-full max-w-sm">
              <AICard
                card={aiCard}
                pendingInput={pendingInput}
                onDismiss={onDismissAI}
                onQuickReply={onQuickReply}
                onGoToTask={onGoToTask}
                onAction={onAICardAction}
              />
            </div>
          ) : (
            <div className={`text-center transition-all duration-700 ${celebrateEmpty ? 'scale-105' : ''}`}>
              <div
                className={`text-5xl mb-4 transition-all duration-500 ${celebrateEmpty ? 'animate-bounce' : 'opacity-40'}`}
                style={{ fontFamily: 'var(--font-display)', animationDuration: celebrateEmpty ? '0.6s' : undefined }}
              >
                {emptyState.symbol}
              </div>
              <h1
                className="text-2xl font-medium text-[var(--text)] mb-1"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {emptyState.title}
              </h1>
              <p className="text-sm text-[var(--text-soft)]">
                {emptyState.subtitle}
              </p>
            </div>
          )}

          <form onSubmit={onSubmit} className="w-full max-w-xs mt-12">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder="What's next?"
              autoFocus
              className="w-full px-5 py-4 text-lg bg-[var(--card)] rounded-2xl text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-shadow"
              style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
            />
          </form>
        </div>
      </div>
    </div>
  )
}
