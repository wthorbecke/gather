'use client'

import { useState, useCallback, memo } from 'react'
import { Step } from '@/hooks/useUserData'
import { StepItem } from './StepItem'

interface StepListProps {
  steps: Step[]
  expandedStepId: string | number | null
  onToggleStep: (stepId: string | number) => void
  onExpandStep: (step: Step) => void
  onStuckOnStep: (step: Step) => void
  onFocusStep: (index: number) => void
  onEditStep?: (stepId: string | number, newText: string) => void
  onDeleteStep?: (stepId: string | number) => void
  onMoveStep?: (stepId: string | number, direction: 'up' | 'down') => void
  onAddStep?: (text: string) => void
}

export const StepList = memo(function StepList({
  steps,
  expandedStepId,
  onToggleStep,
  onExpandStep,
  onStuckOnStep,
  onFocusStep,
  onEditStep,
  onDeleteStep,
  onMoveStep,
  onAddStep,
}: StepListProps) {
  const [showAddStep, setShowAddStep] = useState(false)
  const [newStepText, setNewStepText] = useState('')

  const nextStepId = steps.find((s) => !s.done)?.id

  // Memoized callbacks for StepItem to prevent unnecessary re-renders
  const handleToggle = useCallback((stepId: string | number) => {
    onToggleStep(stepId)
  }, [onToggleStep])

  const handleExpand = useCallback((step: Step) => {
    onExpandStep(step)
  }, [onExpandStep])

  const handleEdit = useCallback((stepId: string | number, newText: string) => {
    onEditStep?.(stepId, newText)
  }, [onEditStep])

  const handleDelete = useCallback((stepId: string | number) => {
    onDeleteStep?.(stepId)
  }, [onDeleteStep])

  const handleMoveUp = useCallback((stepId: string | number) => {
    onMoveStep?.(stepId, 'up')
  }, [onMoveStep])

  const handleMoveDown = useCallback((stepId: string | number) => {
    onMoveStep?.(stepId, 'down')
  }, [onMoveStep])

  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, index) => {
        const isNext = step.id === nextStepId
        const isExpanded = expandedStepId === step.id

        return (
          <div key={step.id} className="animate-rise" style={{ animationDelay: `${index * 40}ms` }}>
            <StepItem
              step={step}
              isNext={isNext}
              isExpanded={isExpanded}
              onToggle={() => handleToggle(step.id)}
              onExpand={() => handleExpand(step)}
              onStuck={onStuckOnStep}
              onFocus={() => onFocusStep(index)}
              onEdit={onEditStep ? (step, newText) => handleEdit(step.id, newText) : undefined}
              onDelete={onDeleteStep ? (step) => handleDelete(step.id) : undefined}
              onMoveUp={onMoveStep && index > 0 ? () => handleMoveUp(step.id) : undefined}
              onMoveDown={onMoveStep && index < steps.length - 1 ? () => handleMoveDown(step.id) : undefined}
            />
          </div>
        )
      })}

      {/* Add step button/input */}
      {onAddStep && (
        <div className="mt-2">
          {showAddStep ? (
            <div className="bg-card border border-border rounded-md p-3 animate-rise">
              <input
                type="text"
                value={newStepText}
                onChange={(e) => setNewStepText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newStepText.trim()) {
                    onAddStep(newStepText.trim())
                    setNewStepText('')
                    setShowAddStep(false)
                  } else if (e.key === 'Escape') {
                    setNewStepText('')
                    setShowAddStep(false)
                  }
                }}
                placeholder="What needs to be done?"
                className="w-full text-sm bg-transparent border-none outline-none text-text placeholder:text-text-muted"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    if (newStepText.trim()) {
                      onAddStep(newStepText.trim())
                      setNewStepText('')
                      setShowAddStep(false)
                    }
                  }}
                  disabled={!newStepText.trim()}
                  className="px-3 py-1.5 bg-accent text-white rounded-md text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setNewStepText('')
                    setShowAddStep(false)
                  }}
                  className="px-3 py-1.5 bg-subtle text-text-soft rounded-md text-sm hover:bg-card-hover transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddStep(true)}
              className="w-full py-2.5 px-3 border border-dashed border-border rounded-md text-sm text-text-muted hover:text-text hover:border-text-muted transition-colors flex items-center justify-center gap-2"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Add step
            </button>
          )}
        </div>
      )}
    </div>
  )
})

