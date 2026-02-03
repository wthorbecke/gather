'use client'

import { useEffect, useRef, useState, memo } from 'react'
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
  onEdit?: (step: Step, newText: string) => void
  onDelete?: (step: Step) => void
}

export const StepItem = memo(function StepItem({ step, isNext, isExpanded, onToggle, onExpand, onStuck, onFocus, onEdit, onDelete }: StepItemProps) {
  const hasExpandableContent = step.detail || step.alternatives || step.examples || step.checklist || step.action || step.source
  const normalizedActionUrl = normalizeActionUrl(step.action?.url)
  const { title: derivedTitle, remainder: derivedRemainder } = splitStepText(step.text)
  const derivedSummary = step.summary || (derivedRemainder ? derivedRemainder : undefined)
  const [justCompleted, setJustCompleted] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(step.text)
  const editInputRef = useRef<HTMLInputElement>(null)
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

  // Focus the edit input when entering edit mode
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [isEditing])

  // Reset edit text when step changes
  useEffect(() => {
    setEditText(step.text)
  }, [step.text])

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
    setEditText(step.text)
  }

  const handleSaveEdit = () => {
    const trimmedText = editText.trim()
    if (trimmedText && trimmedText !== step.text && onEdit) {
      onEdit(step, trimmedText)
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditText(step.text)
    setIsEditing(false)
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelEdit()
    }
  }

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
    <div data-step-id={step.id} className={`group ${getContainerClasses()}`}>
      {/* Main row */}
      <div
        onClick={() => !step.done && !isEditing && hasExpandableContent && onExpand()}
        className={`flex gap-3 p-3 ${!step.done && hasExpandableContent && !isEditing ? 'cursor-pointer' : ''}`}
      >
        {/* Checkbox */}
        <div className="flex-shrink-0 pt-0.5">
          <Checkbox checked={step.done} onToggle={onToggle} size={18} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleSaveEdit}
              onKeyDown={handleEditKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="w-full text-sm leading-snug text-text bg-subtle border border-border rounded-md px-2 py-1 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30"
            />
          ) : (
            <div
              className={`text-sm leading-snug ${step.done ? 'line-through text-text-muted' : 'text-text'}`}
            >
              {derivedTitle}
            </div>
          )}
          {!isEditing && !isExpanded && !step.done && derivedSummary && (
            <div className="text-xs text-text-muted mt-0.5 leading-relaxed">
              {derivedSummary}
              {inlineSource}
            </div>
          )}
          {/* Quick help button - always visible for incomplete steps */}
          {!isEditing && !isExpanded && !step.done && onStuck && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onStuck(step)
              }}
              className="mt-2 -ml-1 px-2 py-1 text-xs text-accent/70 hover:text-accent flex items-center gap-1 transition-colors duration-[80ms]"
            >
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" strokeLinecap="round" />
                <path d="M12 17h.01" strokeLinecap="round" />
              </svg>
              Get help with this
            </button>
          )}
        </div>

        {/* Edit button - shows on hover or in expanded view for incomplete steps */}
        {!step.done && onEdit && !isEditing && (
          <button
            onClick={handleStartEdit}
            className="flex-shrink-0 min-w-[44px] min-h-[44px] -m-2 flex items-center justify-center text-text-muted hover:text-text opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150"
            aria-label="Edit step"
          >
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M11.5 2.5l2 2M2 14l1-4 9-9 2 2-9 9-3 1z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

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

          {/* Checklist - visual bullets, not interactive (use dashes to avoid checkbox confusion) */}
          {step.checklist && (
            <div className="p-2.5 bg-subtle rounded-md mb-3">
              <div className="text-xs text-text-muted font-medium mb-1.5">Checklist</div>
              {step.checklist.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-xs text-text-soft mb-1 last:mb-0"
                >
                  <span className="text-text-muted select-none">–</span>
                  <span>{item}</span>
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
                    px-3 py-2.5 min-h-[44px] rounded-md
                    text-link text-sm font-medium
                    hover:bg-link-soft
                    transition-colors duration-150 ease-out
                    btn-press
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
            {onEdit && (
              <button
                onClick={handleStartEdit}
                className="
                  py-2 px-3
                  bg-transparent border border-border
                  rounded-md text-sm text-text-soft
                  hover:bg-card-hover
                  transition-all duration-[80ms] ease-out
                  btn-press
                  flex items-center justify-center gap-2
                "
              >
                <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M11.5 2.5l2 2M2 14l1-4 9-9 2 2-9 9-3 1z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Edit
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
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(step)
                }}
                className="
                  py-2 px-3
                  bg-transparent border border-danger/30
                  rounded-md text-sm text-danger
                  hover:bg-danger-soft
                  transition-all duration-[80ms] ease-out
                  btn-press
                  flex items-center justify-center gap-2
                "
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                </svg>
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
})
