'use client'

import { useEffect, useRef, useState } from 'react'
import { Step } from '@/hooks/useUserData'
import { splitStepText } from '@/lib/stepText'
import { isAuthoritativeSource, isLowQualitySource, isNewsSource } from '@/lib/sourceQuality'
import { normalizeActionUrl } from '@/config/content'
import { Checkbox } from './Checkbox'

interface StepItemProps {
  step: Step
  isNext: boolean
  isExpanded: boolean
  onToggle: () => void
  onExpand: () => void
  onStuck?: (step: Step) => void
  onFocus?: (step: Step) => void
}

export function StepItem({ step, isNext, isExpanded, onToggle, onExpand, onStuck, onFocus }: StepItemProps) {
  const hasExpandableContent = step.detail || step.alternatives || step.examples || step.checklist || step.action || step.source
  const normalizedActionUrl = normalizeActionUrl(step.action?.url)
  const { title: derivedTitle, remainder: derivedRemainder } = splitStepText(step.text)
  const derivedSummary = step.summary || (derivedRemainder ? derivedRemainder : undefined)
  const [justCompleted, setJustCompleted] = useState(false)
  const prevDoneRef = useRef(step.done)

  useEffect(() => {
    const wasDone = prevDoneRef.current
    prevDoneRef.current = step.done
    if (!wasDone && step.done) {
      setJustCompleted(true)
      const timeout = setTimeout(() => setJustCompleted(false), 220)
      return () => clearTimeout(timeout)
    }
  }, [step.done])

  const hasOfficialSource = step.source ? isAuthoritativeSource(step.source.url) : true
  const hasAllowedSource = step.source
    ? !(isLowQualitySource(step.source.url) || isNewsSource(step.source.url))
    : false

  const inlineSource = step.source && hasAllowedSource ? (
    <>
      {' '}
      <a
        href={step.source.url}
        target="_blank"
        rel="noopener noreferrer"
        title={step.source.url}
        className="text-text-muted hover:text-text-soft align-baseline"
        onClick={(e) => e.stopPropagation()}
      >
        <sup className="text-[0.7rem] leading-none border-b border-dotted border-text-muted/50">
          [1]
        </sup>
      </a>
    </>
  ) : null

  // Dynamic class based on state
  const getContainerClasses = () => {
    const base = 'bg-card border border-border rounded-md'

    if (step.done) {
      return `${base} opacity-60 ${justCompleted ? 'step-complete' : ''}`
    }

    if (isExpanded) {
      return `${base} bg-card`
    }

    return `${base} hover:bg-card-hover`
  }

  return (
    <div data-step-id={step.id} className={getContainerClasses()}>
      {/* Main row */}
      <div
        onClick={() => !step.done && hasExpandableContent && onExpand()}
        className={`flex gap-3 p-3 ${!step.done && hasExpandableContent ? 'cursor-pointer' : ''}`}
      >
        {/* Checkbox */}
        <div className="flex-shrink-0 pt-0.5">
          <Checkbox checked={step.done} onToggle={onToggle} size={18} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm leading-snug ${step.done ? 'line-through text-text-muted' : 'text-text'}`}
          >
            {derivedTitle}
          </div>
          {!isExpanded && !step.done && derivedSummary && (
            <div className="text-xs text-text-muted mt-0.5 leading-relaxed">
              {derivedSummary}
              {inlineSource}
            </div>
          )}
        </div>

        {/* Expand arrow */}
        {!step.done && hasExpandableContent && (
          <svg
            width={16}
            height={16}
            viewBox="0 0 16 16"
            className={`text-text-muted flex-shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`}
          >
            <path
              d="M4 6L8 10L12 6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && !step.done && (
        <div className="px-3 pb-3 pt-0 ml-7 animate-rise">
          {step.detail && (
            <p className="text-xs text-text-soft leading-relaxed mb-3">
              {step.detail}
              {inlineSource}
            </p>
          )}

          {/* Alternatives or Examples */}
          {(step.alternatives || step.examples) && (
            <div className="p-2.5 bg-subtle rounded-md mb-3">
              <div className="text-xs text-text-muted font-medium mb-1.5">
                {step.alternatives ? 'Also accepted' : 'Examples'}
              </div>
              <div className="text-xs text-text-soft leading-relaxed">
                {(step.alternatives || step.examples)!.join(' · ')}
              </div>
            </div>
          )}

          {/* Checklist */}
          {step.checklist && (
            <div className="p-2.5 bg-subtle rounded-md mb-3">
              <div className="text-xs text-text-muted font-medium mb-1.5">Checklist</div>
              {step.checklist.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs text-text-soft mb-1 last:mb-0"
                >
                  <span className="text-text-muted">○</span>
                  {item}
                </div>
              ))}
            </div>
          )}

          {/* Action button and metadata */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {step.action && (
                <a
                  href={normalizedActionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="
                    inline-flex items-center gap-1.5
                    px-2.5 py-1.5 rounded-md
                    text-link text-sm
                    hover:bg-link-soft
                    transition-colors duration-[80ms]
                  "
                >
                  {step.action.text}
                  <svg width={10} height={10} viewBox="0 0 12 12">
                    <path
                      d="M3 9L9 3M9 3H5M9 3V7"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </svg>
                </a>
              )}
              {step.time && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-subtle text-text-muted rounded-sm text-xs font-medium">
                  Est. {step.time}
                </span>
              )}
            </div>

            {step.source && hasAllowedSource && !step.detail && !step.summary && (
              <span className="text-xs text-text-muted">
                via{' '}
                <a
                  href={step.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted hover:text-text-soft border-b border-dotted border-text-muted/40"
                >
                  {step.source.name}
                </a>
              </span>
            )}
          </div>

          {step.source && !hasOfficialSource && (
            <div className="mt-2 text-xs text-text-muted">
              Non-official source. Verify locally.
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex gap-2">
            {onFocus && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onFocus(step)
                }}
                className="
                  flex-1 py-2 px-3
                  bg-text text-canvas
                  rounded-md text-sm font-medium
                  hover:bg-text/90
                  transition-all duration-[80ms] ease-out
                  btn-press
                  flex items-center justify-center gap-2
                "
              >
                <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="8" cy="8" r="6" />
                  <circle cx="8" cy="8" r="2" fill="currentColor" />
                </svg>
                Focus
              </button>
            )}
            {onStuck && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onStuck(step)
                }}
                className={`
                  ${onFocus ? 'flex-1' : 'w-full'}
                  py-2 px-3
                  bg-transparent border border-border
                  rounded-md text-sm text-text-soft
                  hover:bg-card-hover
                  transition-all duration-[80ms] ease-out
                  btn-press
                `}
              >
                I&apos;m stuck
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
