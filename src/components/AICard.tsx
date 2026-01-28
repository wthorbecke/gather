'use client'

import { useState, useEffect, useRef } from 'react'
import { Task } from '@/hooks/useUserData'
import { hasAuthoritativeSources } from '@/lib/sourceQuality'
import { content } from '@/config/content'

const loadingMessages = [
  'Finding the steps...',
  'Almost there...',
]

export interface AICardState {
  thinking?: boolean
  message?: string
  introMessage?: string
  question?: {
    text: string
    index: number
    total: number
  }
  sources?: { title: string; url: string }[]
  quickReplies?: string[]
  actions?: Array<{
    type: 'mark_step_done' | 'focus_step' | 'create_task' | 'show_sources'
    stepId?: string | number
    title?: string
    context?: string
    label?: string
  }>
  showSources?: boolean
  pendingTaskName?: string
  taskCreated?: Task
  taskId?: string
}

interface AICardProps {
  card: AICardState
  pendingInput?: string | null
  onDismiss: () => void
  onQuickReply?: (reply: string) => void
  onGoToTask?: (taskId: string) => void
  onAction?: (action: { type: string; stepId?: string | number; title?: string; context?: string }) => void
  onBackQuestion?: () => void
  attachInput?: boolean
  canGoBack?: boolean
}

export function AICard({
  card,
  pendingInput,
  onDismiss,
  onQuickReply,
  onGoToTask,
  onAction,
  onBackQuestion,
  attachInput = false,
  canGoBack = false,
}: AICardProps) {
  const questionText = card.question?.text?.trim() || 'Quick question:'
  const sources = card.sources
  const sourceCount = sources?.length ?? 0
  const hasSources = sources !== undefined
  const hasOfficialSources = sourceCount > 0 && sources ? hasAuthoritativeSources(sources) : false
  const showSources = card.showSources !== false
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const quickReplies = card.quickReplies || []
  const actions = card.actions || []
  const [isDismissing, setIsDismissing] = useState(false)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const thinkingStartRef = useRef<number | null>(null)

  // Cycle loading message after 5 seconds
  useEffect(() => {
    if (card.thinking) {
      thinkingStartRef.current = Date.now()
      setLoadingMessageIndex(0)
      const timer = setTimeout(() => {
        setLoadingMessageIndex(1)
      }, 5000)
      return () => clearTimeout(timer)
    } else {
      thinkingStartRef.current = null
      setLoadingMessageIndex(0)
    }
  }, [card.thinking])

  useEffect(() => {
    if (!showSources) {
      setSourcesOpen(false)
    }
  }, [showSources])

  const handleDismiss = () => {
    if (isDismissing) return
    setIsDismissing(true)
    setTimeout(() => onDismiss(), 200)
  }

  return (
    <div
      className={`bg-ai-bg border border-ai-border rounded-lg p-4 relative ${
        attachInput ? 'rounded-b-none border-b-0 mb-0' : 'mb-6'
      } ${isDismissing ? 'animate-fade-out' : 'animate-fade-in'}`}
    >
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1.5 text-text-soft hover:text-text hover:bg-surface/50 rounded-md transition-all tap-target btn-press"
        aria-label="Dismiss"
      >
        <svg width={16} height={16} viewBox="0 0 16 16">
          <path
            d="M4 4L12 12M12 4L4 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {card.thinking ? (
        <>
          {/* Show previous message if this is a follow-up */}
          {card.message && (
            <div className="text-base leading-relaxed mb-4 opacity-60">
              {card.message}
            </div>
          )}
          <div className="space-y-3">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-4/5" />
            <div className="text-xs text-text-muted">{loadingMessages[loadingMessageIndex]}</div>
          </div>
        </>
      ) : (
        <>
          {/* User's input echo */}
          {pendingInput && (
            <div className="text-sm text-text-muted mb-3 pb-3 border-b border-border-subtle">
              "{pendingInput}"
            </div>
          )}

          {/* AI message */}
          {card.message && !card.question && (
            <div
              className={`text-base leading-relaxed ${
                card.quickReplies || card.taskCreated ? 'mb-4' : ''
              }`}
            >
              {card.message}
            </div>
          )}

          {card.question && (
            <div className="mb-4">
              <div className="flex items-center justify-between gap-3 text-xs text-text-muted mb-2">
                {card.question.total > 1 ? (
                  <div>{card.question.index} of {card.question.total}</div>
                ) : null}
                {onBackQuestion && canGoBack && (
                  <button
                    onClick={onBackQuestion}
                    className="inline-flex items-center gap-1 text-text-muted hover:text-text transition-colors btn-press tap-target"
                  >
                    <svg width={12} height={12} viewBox="0 0 16 16">
                      <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    </svg>
                    Back
                  </button>
                )}
              </div>
              <div className="text-base font-medium leading-snug">
                {questionText}
              </div>
            </div>
          )}

          {/* Sources */}
          {hasSources && showSources && sourceCount > 0 && (
            <div className="mb-3">
              <button
                onClick={() => setSourcesOpen((prev) => !prev)}
                className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text transition-colors btn-press tap-target"
              >
                Sources ({sourceCount})
                <svg
                  width={12}
                  height={12}
                  viewBox="0 0 16 16"
                  className={`transition-transform duration-200 ${sourcesOpen ? 'rotate-180' : ''}`}
                >
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
              </button>
              {sourcesOpen && card.sources && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {card.sources.map((source, i) => (
                    <a
                      key={i}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-canvas/70 px-2.5 py-1 text-xs text-text-soft hover:text-text hover:border-border transition-colors btn-press tap-target animate-rise"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      {source.title}
                      <svg width={10} height={10} viewBox="0 0 12 12">
                        <path d="M3 9L9 3M9 3H5M9 3V7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                      </svg>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
          {hasSources && sourceCount > 0 && !hasOfficialSources && (
            <div className="text-xs text-text-muted mb-3">
              Couldn&apos;t find an official source. Treat requirements as provisional.
            </div>
          )}

          {/* Quick replies */}
          {card.quickReplies && onQuickReply && (
            <div className="flex flex-wrap gap-2">
              {quickReplies.slice(0, 8).map((reply, index) => (
                <button
                  key={reply}
                  onClick={() => onQuickReply(reply)}
                  className="quick-reply-btn px-3.5 py-2 bg-canvas border border-border rounded-full text-sm text-text tap-target animate-rise"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  {reply}
                </button>
              ))}
            </div>
          )}

          {actions.length > 0 && onAction && (
            <div className="flex flex-wrap gap-2 mt-3">
              {actions.map((action, index) => (
                <button
                  key={`${action.type}-${index}`}
                  onClick={() => onAction(action)}
                  className="px-4 py-2 bg-canvas border border-border rounded-full text-sm text-text hover:border-accent transition-all btn-press tap-target animate-rise"
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  {action.label || action.type}
                </button>
              ))}
            </div>
          )}

          {/* Task created confirmation */}
          {card.taskCreated && onGoToTask && (
            <div
              onClick={() => onGoToTask(card.taskCreated!.id)}
              className="p-4 bg-success-soft rounded-lg flex items-center gap-3 cursor-pointer transition-transform hover:-translate-y-0.5 btn-press animate-rise"
            >
              <div className="w-8 h-8 rounded-full bg-success/30 flex items-center justify-center">
                <svg width={16} height={16} viewBox="0 0 16 16" className="text-success">
                  <path
                    d="M3 8L6.5 11.5L13 4.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <div className="text-base font-medium">{card.taskCreated.title}</div>
                <div className="text-sm text-text-soft">
                  {card.taskCreated.steps?.length || 0} steps - Click to view
                </div>
              </div>
              <svg width={16} height={16} viewBox="0 0 16 16" className="text-text-muted">
                <path
                  d="M6 4L10 8L6 12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </div>
          )}
        </>
      )}

    </div>
  )
}
