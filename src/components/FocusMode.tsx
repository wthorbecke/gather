'use client'

import { useState, useEffect, useMemo } from 'react'
import { Step } from '@/hooks/useUserData'
import { Checkbox } from './Checkbox'
import { splitStepText } from '@/lib/stepText'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

interface FocusModeProps {
  step: Step
  taskTitle: string
  totalSteps: number
  currentStepIndex: number
  onToggleStep: () => void
  onExit: () => void
  onNext?: () => void
  onPrevious?: () => void
  onStuck?: () => void
}

/**
 * Full-screen focus mode for a single step
 * Removes all distractions and guides the user through one thing at a time
 */
export function FocusMode({
  step,
  taskTitle,
  totalSteps,
  currentStepIndex,
  onToggleStep,
  onExit,
  onNext,
  onPrevious,
  onStuck,
}: FocusModeProps) {
  const [showDetails, setShowDetails] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(true)

  // Timer that counts up
  useEffect(() => {
    if (!isTimerRunning) return
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [isTimerRunning])

  // Keyboard shortcuts
  const shortcuts = useMemo(() => [
    {
      key: 'Escape',
      action: onExit,
      description: 'Exit focus mode',
    },
    {
      key: 'Enter',
      action: () => {
        onToggleStep()
        if (!step.done && onNext) {
          setTimeout(onNext, 300)
        }
      },
      description: 'Mark step complete',
    },
    {
      key: 'ArrowRight',
      action: () => onNext?.(),
      description: 'Next step',
    },
    {
      key: 'ArrowLeft',
      action: () => onPrevious?.(),
      description: 'Previous step',
    },
    {
      key: 'd',
      action: () => setShowDetails(prev => !prev),
      description: 'Toggle details',
    },
    {
      key: ' ',
      action: () => setIsTimerRunning(prev => !prev),
      description: 'Pause/resume timer',
    },
  ], [onExit, onToggleStep, onNext, onPrevious, step.done])

  useKeyboardShortcuts({ shortcuts, enabled: true })

  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const { title, remainder } = splitStepText(step.text)
  const hasDetail = Boolean(remainder || step.detail || step.summary)

  return (
    <div className="fixed inset-0 z-50 bg-canvas flex flex-col">
      {/* Header - minimal */}
      <div className="p-4 flex items-center justify-between border-b border-border">
        <button
          onClick={onExit}
          className="text-sm text-text-muted hover:text-text transition-colors flex items-center gap-1"
        >
          <svg width={16} height={16} viewBox="0 0 16 16">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
          Exit focus
        </button>

        <div className="text-sm text-text-muted">
          Step {currentStepIndex + 1} of {totalSteps}
        </div>

        {/* Timer */}
        <div className="flex items-center gap-3">
          <div className={`font-mono text-sm ${isTimerRunning ? 'text-accent' : 'text-text-muted'}`}>
            {formatTime(elapsedTime)}
          </div>
          {/* Keyboard hint */}
          <div className="group relative">
            <button className="text-text-muted hover:text-text transition-colors">
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" strokeLinecap="round" />
              </svg>
            </button>
            <div className="absolute right-0 top-full mt-2 bg-elevated border border-border rounded-lg shadow-lg p-3 min-w-[180px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <div className="text-xs font-medium text-text-muted mb-2">Keyboard shortcuts</div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-text-soft">Complete</span><span className="text-text-muted">Enter</span></div>
                <div className="flex justify-between"><span className="text-text-soft">Next</span><span className="text-text-muted">→</span></div>
                <div className="flex justify-between"><span className="text-text-soft">Previous</span><span className="text-text-muted">←</span></div>
                <div className="flex justify-between"><span className="text-text-soft">Details</span><span className="text-text-muted">D</span></div>
                <div className="flex justify-between"><span className="text-text-soft">Pause timer</span><span className="text-text-muted">Space</span></div>
                <div className="flex justify-between"><span className="text-text-soft">Exit</span><span className="text-text-muted">Esc</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content - centered, large */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-xl mx-auto">
        {/* Task context - subtle */}
        <div className="text-sm text-text-muted mb-8 text-center">
          {taskTitle}
        </div>

        {/* The step - large and prominent */}
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold text-text leading-relaxed mb-4">
            {title}
          </h1>

          {hasDetail && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-soft bg-surface hover:bg-surface/80 rounded-full transition-colors"
            >
              <svg
                width={12}
                height={12}
                viewBox="0 0 16 16"
                className={`transition-transform ${showDetails ? 'rotate-180' : ''}`}
              >
                <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </svg>
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          )}

          {showDetails && (
            <div className="mt-4 text-base text-text-soft animate-fade-in">
              {remainder || step.detail || step.summary}
            </div>
          )}
        </div>

        {/* Time estimate if available */}
        {step.time && (
          <div className="text-sm text-text-muted mb-8 flex items-center gap-2">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" strokeLinecap="round" />
            </svg>
            {step.time}
          </div>
        )}

        {/* Action button - large checkbox */}
        <div className="mb-8">
          <button
            onClick={() => {
              onToggleStep()
              if (!step.done && onNext) {
                // Auto-advance to next step after a brief moment
                setTimeout(onNext, 300)
              }
            }}
            className={`flex items-center gap-4 p-6 rounded-2xl transition-all ${
              step.done
                ? 'bg-success/10 border-2 border-success'
                : 'bg-surface border-2 border-border hover:border-accent'
            }`}
          >
            <Checkbox checked={step.done} onToggle={() => {}} size={32} />
            <span className={`text-lg font-medium ${step.done ? 'text-success' : 'text-text'}`}>
              {step.done ? 'Done!' : 'Mark as done'}
            </span>
          </button>
        </div>

        {/* Stuck button */}
        {onStuck && !step.done && (
          <button
            onClick={onStuck}
            className="text-sm text-text-muted hover:text-accent transition-colors mb-4"
          >
            I'm stuck on this step
          </button>
        )}
      </div>

      {/* Navigation footer */}
      <div className="p-4 border-t border-border flex items-center justify-between">
        <button
          onClick={onPrevious}
          disabled={currentStepIndex === 0}
          className="p-2 text-text-soft hover:text-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Previous step"
        >
          <svg width={20} height={20} viewBox="0 0 16 16">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        </button>

        <div className="flex gap-1.5">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentStepIndex
                  ? 'bg-accent'
                  : i < currentStepIndex
                  ? 'bg-success'
                  : 'bg-border'
              }`}
            />
          ))}
        </div>

        <button
          onClick={onNext}
          disabled={currentStepIndex === totalSteps - 1}
          className="p-2 text-text-soft hover:text-text transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Next step"
        >
          <svg width={20} height={20} viewBox="0 0 16 16">
            <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
        </button>
      </div>
    </div>
  )
}
