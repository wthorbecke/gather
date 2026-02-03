'use client'

import { RefObject, CSSProperties } from 'react'
import { Task, Step } from '@/hooks/useUserData'

// Card types - shared with StackView
type EmailCard = { type: 'email'; id: string; subject: string; from: string; snippet: string }
type CalendarCard = { type: 'calendar'; id: string; title: string; time: string; location?: string }

export type StackCard =
  | { type: 'step'; task: Task; step: Step; stepIndex: number; totalSteps: number; dismissCount: number }
  | { type: 'task'; task: Task; dismissCount: number }
  | EmailCard
  | CalendarCard

export interface CardContent {
  contextLabel: string
  mainText: string
  buttonText: string
  progress: { current: number; total: number } | null
  isSecondary: boolean
  phoneNumber: string | null
  summary: string
  timeEstimate: string
  dueInfo: string
  skipConsequence: string
}

interface StackViewMainCardProps {
  cardRef: RefObject<HTMLDivElement | null>
  topCard: StackCard
  cardContent: CardContent
  isDragging: boolean
  exitTransform: string
  exitDirection: 'left' | 'right' | 'up' | null
  cardSurfaceStyle: CSSProperties
  accentButtonStyle: CSSProperties
  affirmation: string | null
  isHolding: boolean
  holdComplete: boolean
  onComplete: (card: StackCard) => void
  onStartHold: () => void
  onEndHold: () => void
  onDragStart: (clientX: number) => void
  onDragMove: (clientX: number) => void
  onDragEnd: () => void
  onTouchEnd: () => void
}

export function StackViewMainCard({
  cardRef,
  topCard,
  cardContent,
  isDragging,
  exitTransform,
  exitDirection,
  cardSurfaceStyle,
  accentButtonStyle,
  affirmation,
  isHolding,
  holdComplete,
  onComplete,
  onStartHold,
  onEndHold,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTouchEnd,
}: StackViewMainCardProps) {
  const {
    contextLabel,
    mainText,
    buttonText,
    progress,
    isSecondary,
    phoneNumber,
    summary,
    timeEstimate,
    dueInfo,
    skipConsequence,
  } = cardContent

  return (
    <div
      ref={cardRef}
      className="absolute inset-0 cursor-grab active:cursor-grabbing select-none touch-none"
      style={{
        zIndex: 10,
        transform: isDragging ? undefined : exitTransform,
        opacity: exitDirection ? (exitDirection === 'up' ? 0 : 1) : 1,
        transition: isDragging ? 'none' : 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        willChange: isDragging ? 'transform' : 'auto',
      }}
      onMouseDown={(e) => onDragStart(e.clientX)}
      onMouseMove={(e) => onDragMove(e.clientX)}
      onMouseUp={onDragEnd}
      onMouseLeave={() => { onTouchEnd(); onDragEnd(); }}
      onTouchStart={(e) => onDragStart(e.touches[0].clientX)}
      onTouchMove={(e) => onDragMove(e.touches[0].clientX)}
      onTouchEnd={onDragEnd}
    >
      {/* Card surface */}
      <div
        className="relative h-full rounded-[24px] overflow-hidden"
        style={cardSurfaceStyle}
      >
        {/* Affirmation overlay */}
        {affirmation && exitDirection === 'up' && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-[var(--success)]/20 rounded-[26px] animate-pulse">
            <span
              className="text-5xl font-semibold text-[var(--success)] animate-bounce"
              style={{ fontFamily: 'var(--font-display)', animationDuration: '0.4s' }}
            >
              {affirmation}
            </span>
          </div>
        )}

        {/* Card content */}
        <div className="relative h-full flex flex-col p-6">
          {/* Context label - subtle, top */}
          {contextLabel && (
            <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-muted)] mb-2">
              {contextLabel}
            </span>
          )}

          {/* Main action - THE thing */}
          <h2
            className="text-[26px] leading-tight font-semibold text-[var(--text)] overflow-hidden line-clamp-3"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {phoneNumber ? (
              <>
                {mainText.split(phoneNumber)[0]}
                <a
                  href={`tel:${phoneNumber.replace(/\D/g, '')}`}
                  className="text-[var(--accent)] underline decoration-[var(--accent)]/30 underline-offset-2 hover:decoration-[var(--accent)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  {phoneNumber}
                </a>
                {mainText.split(phoneNumber)[1] || ''}
              </>
            ) : (
              mainText
            )}
          </h2>

          {/* Summary and metadata - fills the card with useful context */}
          <div className="flex-1 flex flex-col justify-center py-4 space-y-3">
            {summary && (
              <p className="text-[15px] leading-relaxed text-[var(--text-soft)] line-clamp-3">
                {summary}
              </p>
            )}
            {(timeEstimate || dueInfo) && (
              <div className="flex items-center gap-3 text-[13px]">
                {timeEstimate && (
                  <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" strokeLinecap="round" />
                    </svg>
                    {timeEstimate}
                  </span>
                )}
                {dueInfo && (
                  <span className={`flex items-center gap-1.5 ${dueInfo.includes('overdue') ? 'text-[var(--danger)]' : dueInfo.includes('today') ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {dueInfo}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Bottom section */}
          <div className="mt-auto space-y-3">
            {/* Progress bar - only for multi-step tasks */}
            {progress && progress.total > 1 && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1 bg-[var(--border)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all duration-300"
                    style={{ width: `${((progress.current - 1) / progress.total) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {progress.current} of {progress.total}
                </span>
              </div>
            )}

            {/* Action button - click OR hold to complete */}
            <button
              onClick={() => onComplete(topCard)}
              onMouseDown={onStartHold}
              onMouseUp={onEndHold}
              onMouseLeave={onEndHold}
              onTouchStart={(e) => { e.stopPropagation(); onStartHold(); }}
              onTouchEnd={(e) => { e.stopPropagation(); onEndHold(); }}
              className={`
                relative w-full py-4 rounded-2xl text-[17px] font-semibold overflow-hidden
                transition-all duration-150
                ${isSecondary
                  ? 'bg-[var(--surface)] text-[var(--text)] border border-[var(--border)]'
                  : 'text-white'
                }
                ${isHolding ? 'scale-[0.97]' : 'active:scale-[0.98]'}
              `}
              style={isSecondary ? undefined : accentButtonStyle}
            >
              {/* Hold progress fill - CSS animation, no React state updates */}
              {!isSecondary && (
                <div
                  className={`absolute inset-0 bg-white/25 origin-left ${isHolding ? 'hold-progress-fill' : ''}`}
                  style={{
                    transform: isHolding ? undefined : 'scaleX(0)',
                    transition: isHolding ? 'none' : 'transform 0.15s ease-out',
                  }}
                />
              )}
              <span className="relative z-10">
                {holdComplete ? '...' : buttonText}
              </span>
            </button>

            {/* Skip hint with clear consequence */}
            <div className="text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-1.5">
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="opacity-60">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              <span>{skipConsequence}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
