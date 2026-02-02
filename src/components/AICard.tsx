'use client'

import { useState, useEffect, useRef } from 'react'
import { Task } from '@/hooks/useUserData'
import { hasAuthoritativeSources } from '@/lib/sourceQuality'
import { RichText } from './RichText'
import { cleanAIMessage } from '@/lib/ai'

// Conversational, lowercase - like a friend thinking out loud
const loadingMessages = [
  'let me look into this...',
  'checking a few things...',
  'finding what you need...',
  'one sec...',
  'pulling together the details...',
  'making this doable...',
]

export interface AICardState {
  thinking?: boolean
  streaming?: boolean // True when streaming tokens (shows partial message with cursor)
  streamingText?: string // Partial text being streamed
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
  autoFocusInput?: boolean // Focus the input (e.g., when user clicks "Other")
  savedAnswer?: string // Previously saved answer for this question (from user preferences)
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

  // Cycle loading messages every 1.5 seconds (faster to maintain ADHD attention)
  useEffect(() => {
    if (card.thinking) {
      thinkingStartRef.current = Date.now()
      setLoadingMessageIndex(0)
      const interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % loadingMessages.length)
      }, 1500)
      return () => clearInterval(interval)
    } else {
      thinkingStartRef.current = null
      setLoadingMessageIndex(0)
    }
  }, [card.thinking])

  // Task created card stays until user dismisses or clicks to view

  useEffect(() => {
    if (!showSources) {
      setSourcesOpen(false)
    }
  }, [showSources])

  const handleDismiss = () => {
    if (isDismissing) return
    setIsDismissing(true)
    setTimeout(() => onDismiss(), 150)
  }

  return (
    <div
      data-testid="ai-card"
      className={`
        ai-card rounded-xl p-4
        mb-4
        ${isDismissing ? 'animate-fade-out' : 'animate-fade-in'}
      `}
      style={{
        background: card.thinking ? 'var(--ai-bg-thinking)' : 'var(--ai-bg)',
        border: '1px solid var(--ai-border)',
        boxShadow: card.thinking
          ? '0 0 0 1px var(--ai-glow), 0 2px 8px var(--ai-glow)'
          : '0 1px 3px var(--ai-glow)',
      }}
    >
      {/* Header row with dismiss button */}
      {pendingInput && (
        <div className="flex items-start justify-between gap-3 mb-3 pb-3 border-b border-border-subtle overflow-hidden">
          <div className="text-sm text-text-muted flex-1 min-w-0 truncate">
            &ldquo;{pendingInput}&rdquo;
          </div>
          <button
            onClick={handleDismiss}
            className="
              min-w-[44px] min-h-[44px] -m-2
              flex items-center justify-center
              text-text-muted hover:text-text
              transition-colors duration-150
              btn-press flex-shrink-0
            "
            aria-label="Dismiss"
          >
            <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Dismiss button when no header */}
      {!pendingInput && (
        <div className="flex justify-end mb-2">
          <button
            onClick={handleDismiss}
            className="
              min-w-[44px] min-h-[44px] -m-2
              flex items-center justify-center
              text-text-muted hover:text-text
              transition-colors duration-150
              btn-press
            "
            aria-label="Dismiss"
          >
            <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M4 4L12 12M12 4L4 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}

      {card.thinking || card.streaming ? (
        <div aria-busy="true" aria-live="polite" role="status">
          {/* Show previous message if this is a follow-up */}
          {card.message && !card.streaming && (
            <div className="text-base leading-relaxed mb-4 opacity-60">
              <RichText>{cleanAIMessage(card.message)}</RichText>
            </div>
          )}

          {/* Streaming text with cursor */}
          {card.streaming && card.streamingText && (
            <div className="text-base leading-relaxed mb-4">
              <RichText>{cleanAIMessage(card.streamingText)}</RichText>
              <span
                className="inline-block w-2 h-4 ml-0.5 bg-accent/60 rounded-sm"
                style={{ animation: 'cursorBlink 1s ease-in-out infinite' }}
              />
            </div>
          )}

          {/* Thinking indicator - only show when not streaming text yet */}
          {!card.streamingText && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5 loading-indicator">
                  <span
                    className="w-2 h-2 rounded-full bg-accent/40"
                    style={{ animation: 'thinkingPulse 1.4s ease-in-out infinite' }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-accent/40"
                    style={{ animation: 'thinkingPulse 1.4s ease-in-out infinite', animationDelay: '0.2s' }}
                  />
                  <span
                    className="w-2 h-2 rounded-full bg-accent/40"
                    style={{ animation: 'thinkingPulse 1.4s ease-in-out infinite', animationDelay: '0.4s' }}
                  />
                </div>
                <span className="text-sm text-text-soft italic">{loadingMessages[loadingMessageIndex]}</span>
              </div>
            </div>
          )}
          <style jsx>{`
            @keyframes thinkingPulse {
              0%, 100% { opacity: 0.3; transform: scale(1); }
              50% { opacity: 1; transform: scale(1.2); }
            }
            @keyframes cursorBlink {
              0%, 50% { opacity: 1; }
              51%, 100% { opacity: 0; }
            }
          `}</style>
        </div>
      ) : (
        <>

          {/* AI message */}
          {card.message && !card.question && (
            <div
              className={`text-base leading-relaxed ${
                card.quickReplies || card.taskCreated ? 'mb-4' : ''
              }`}
            >
              <RichText>{cleanAIMessage(card.message)}</RichText>
            </div>
          )}

          {/* Question */}
          {card.question && (
            <div className="mb-4">
              <div className="flex items-center justify-between gap-3 text-xs text-text-muted mb-2">
                {card.question.total > 1 && (
                  <div className="tabular-nums">{card.question.index} of {card.question.total}</div>
                )}
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
              <div className="text-base font-medium leading-snug">{questionText}</div>
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
                  className={`transition-transform duration-150 ${sourcesOpen ? 'rotate-180' : ''}`}
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
                      className="
                        inline-flex items-center gap-1
                        rounded-sm border border-border
                        bg-canvas px-2.5 py-1
                        text-xs text-text-soft
                        hover:text-text hover:bg-card-hover
                        transition-colors duration-[80ms]
                        btn-press tap-target animate-rise
                      "
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
          {card.quickReplies && onQuickReply && (() => {
            const savedAnswer = card.savedAnswer
            // Ensure "Other" is always visible if present
            const otherIndex = quickReplies.findIndex(r => r.toLowerCase().includes('other'))
            const hasOther = otherIndex >= 0
            const otherOption = hasOther ? quickReplies[otherIndex] : null
            const nonOtherReplies = hasOther
              ? quickReplies.filter((_, i) => i !== otherIndex)
              : quickReplies

            // Smart selection: if many options (like 50 states), pick top 3-4 common ones
            // Most populous US states for state questions
            const commonStates = ['California', 'Texas', 'New York', 'Florida', 'Illinois', 'Pennsylvania']
            let selectedReplies: string[]

            if (nonOtherReplies.length > 6) {
              // Many options - pick common ones that exist in the list, or first 3
              const commonMatches = commonStates.filter(s =>
                nonOtherReplies.some(r => r.toLowerCase() === s.toLowerCase())
              ).slice(0, 3)
              selectedReplies = commonMatches.length >= 2
                ? commonMatches
                : nonOtherReplies.slice(0, 3)

              // If saved answer exists and isn't in selected, add it first
              if (savedAnswer && !selectedReplies.some(r => r.toLowerCase() === savedAnswer.toLowerCase())) {
                const savedMatch = nonOtherReplies.find(r => r.toLowerCase() === savedAnswer.toLowerCase())
                if (savedMatch) {
                  selectedReplies = [savedMatch, ...selectedReplies.slice(0, 2)]
                }
              }
            } else {
              selectedReplies = nonOtherReplies
            }

            const visibleReplies = [...selectedReplies, ...(otherOption ? [otherOption] : [])]
            const isSaved = (reply: string) => savedAnswer && reply.toLowerCase() === savedAnswer.toLowerCase()

            return (
              <div className="flex flex-wrap gap-2">
                {visibleReplies.map((reply, index) => (
                  <button
                    key={reply}
                    onClick={() => onQuickReply(reply)}
                    className={`
                      px-4 py-2.5 rounded-full text-sm font-medium
                      transition-all duration-150 ease-out
                      tap-target btn-press animate-rise
                      ${isSaved(reply)
                        ? 'bg-accent text-white shadow-sm'
                        : 'bg-card border border-border text-text hover:border-accent/40 hover:bg-accent/5 hover:shadow-sm'
                      }
                    `}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    {reply}
                    {isSaved(reply) && ' ✓'}
                  </button>
                ))}
              </div>
            )
          })()}

          {/* Actions */}
          {actions.length > 0 && onAction && (
            <div className="flex flex-wrap gap-2 mt-3">
              {actions.map((action, index) => (
                <button
                  key={`${action.type}-${index}`}
                  onClick={() => onAction(action)}
                  className="
                    px-4 py-2
                    bg-card border border-border rounded-sm
                    text-sm text-text
                    hover:bg-card-hover
                    transition-all duration-[80ms] ease-out
                    btn-press tap-target animate-rise
                  "
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
              onClick={() => {
                onGoToTask(card.taskCreated!.id)
                // Also dismiss the card when navigating
                handleDismiss()
              }}
              className="
                p-3 mt-3
                bg-card border border-border rounded-md
                flex items-center gap-3
                cursor-pointer
                hover:bg-card-hover
                btn-press animate-rise
              "
            >
              <div className="w-6 h-6 rounded-sm bg-success/15 flex items-center justify-center flex-shrink-0">
                <svg width={14} height={14} viewBox="0 0 16 16" className="text-success">
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
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{card.taskCreated.title}</div>
                <div className="text-xs text-text-muted">
                  {card.taskCreated.steps?.length || 0} steps
                </div>
              </div>
              <svg width={14} height={14} viewBox="0 0 16 16" className="text-text-muted flex-shrink-0">
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
