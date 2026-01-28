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
}

export function StepItem({ step, isNext, isExpanded, onToggle, onExpand, onStuck }: StepItemProps) {
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

  return (
    <div
      data-step-id={step.id}
      className={`
        rounded-lg transition-all duration-200 ease-out step-item
        ${step.done ? 'opacity-50' : ''}
        ${isExpanded && !step.done ? 'bg-card shadow-sm ring-1 ring-border' : ''}
        ${isNext && !step.done && !isExpanded ? 'step-item-next bg-success/[0.06] border-l-2 border-l-success' : ''}
        ${!isNext && !step.done && !isExpanded ? 'border-l-2 border-l-transparent hover:bg-subtle/50' : ''}
        ${justCompleted ? 'step-complete' : ''}
      `}
    >
      {/* Main row */}
      <div
        onClick={() => !step.done && hasExpandableContent && onExpand()}
        className={`
          flex gap-4 p-4
          ${!step.done && hasExpandableContent ? 'cursor-pointer' : ''}
        `}
      >
        {/* Checkbox */}
        <Checkbox checked={step.done} onToggle={onToggle} size={20} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div
            className={`
              text-base
              ${isNext && !step.done ? 'font-medium' : ''}
              ${step.done ? 'line-through text-text-muted' : 'text-text'}
            `}
          >
            {derivedTitle}
          </div>
          {!isExpanded && !step.done && derivedSummary && (
            <div className="text-sm text-text-soft mt-1">
              {derivedSummary}
              {inlineSource}
            </div>
          )}
        </div>

        {/* Expand arrow */}
        {!step.done && hasExpandableContent && (
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <span>Details</span>
            <svg
              width={16}
              height={16}
              viewBox="0 0 16 16"
              className={`text-text-muted transition-transform duration-200 ease-in-out ${
                isExpanded ? 'rotate-180' : ''
              }`}
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && !step.done && (
        <div className="px-4 pb-4 ml-9 animate-rise">
          {step.detail && (
            <p className="text-sm text-text-soft leading-relaxed mb-4">
              {step.detail}
              {inlineSource}
            </p>
          )}

          {/* Alternatives or Examples */}
          {(step.alternatives || step.examples) && (
            <div className="p-3 bg-subtle rounded-md mb-4">
              <div className="text-xs text-text-muted font-medium mb-2">
                {step.alternatives ? 'Also accepted' : 'Examples'}
              </div>
              <div className="text-sm text-text-soft leading-relaxed">
                {(step.alternatives || step.examples)!.join(' · ')}
              </div>
            </div>
          )}

          {/* Checklist */}
          {step.checklist && (
            <div className="p-3 bg-subtle rounded-md mb-4">
              <div className="text-xs text-text-muted font-medium mb-2">
                Checklist
              </div>
              {step.checklist.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-sm text-text-soft mb-1 last:mb-0"
                >
                  <span className="text-text-muted">○</span>
                  {item}
                </div>
              ))}
            </div>
          )}

          {/* Action button and metadata row */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              {step.action && (
                <a
                  href={normalizedActionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-link-soft text-link rounded-md text-sm font-medium hover:bg-link/20 transition-colors"
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
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 bg-subtle text-text-muted rounded-full text-xs font-medium"
                  title="AI time estimate"
                >
                  ⏱ Est. {step.time}
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

          {/* I'm stuck button */}
          {onStuck && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onStuck(step)
              }}
              className="mt-4 w-full py-2.5 px-4 bg-transparent border border-border rounded-lg text-sm text-text-soft hover:border-accent hover:text-accent transition-all btn-press"
            >
              I'm stuck on this step
            </button>
          )}
        </div>
      )}
    </div>
  )
}
