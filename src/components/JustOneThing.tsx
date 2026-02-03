'use client'

import { Task, Step } from '@/hooks/useUserData'
import { Checkbox } from './Checkbox'
import { splitStepText } from '@/lib/stepText'
import { useEffect } from 'react'

interface JustOneThingProps {
  task: Task | null
  onComplete: (taskId: string, stepId: string | number) => void
  onExit: () => void
  onGoToTask?: (taskId: string) => void
}

/**
 * Gets the most important task to focus on.
 * Priority: pinned > due today/overdue > oldest incomplete
 */
export function getTopTask(tasks: Task[]): Task | null {
  // Filter to tasks with incomplete steps and not snoozed
  const today = new Date().toISOString().split('T')[0]
  const activeTasks = tasks.filter(task => {
    if (task.snoozed_until && task.snoozed_until > today) return false
    const steps = task.steps || []
    return steps.some(s => !s.done)
  })

  if (activeTasks.length === 0) return null

  // Pinned tasks come first
  const pinned = activeTasks.find(t => t.pinned)
  if (pinned) return pinned

  // Then due today or overdue
  const dueToday = activeTasks.find(t => {
    if (!t.due_date) return false
    return t.due_date <= today
  })
  if (dueToday) return dueToday

  // Fall back to first incomplete task
  return activeTasks[0] || null
}

/**
 * Full-screen focus mode showing only ONE task.
 * Maximum focus for users with decision paralysis.
 * Hides all distractions, shows only the single most important thing.
 */
export function JustOneThing({ task, onComplete, onExit, onGoToTask }: JustOneThingProps) {
  // Keyboard shortcut to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onExit()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onExit])

  // Empty state - no tasks to focus on
  if (!task) {
    return (
      <div className="fixed inset-0 z-50 bg-canvas flex items-center justify-center p-6">
        <div className="text-center max-w-md animate-rise">
          {/* Success icon */}
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-6">
            <svg width={32} height={32} viewBox="0 0 24 24" className="text-success">
              <path
                d="M5 12l5 5L20 7"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <p className="text-2xl font-medium text-text mb-3">Nothing to focus on</p>
          <p className="text-text-muted mb-8">All clear. Nice work.</p>
          <button
            onClick={onExit}
            className="
              px-8 py-4
              bg-accent text-white
              rounded-xl font-semibold text-lg
              transition-all duration-150 ease-out
              hover:bg-accent/90
              active:scale-95
            "
          >
            Exit
          </button>
        </div>
      </div>
    )
  }

  // Get the next incomplete step
  const steps = task.steps || []
  const nextStep = steps.find(s => !s.done)
  const completedSteps = steps.filter(s => s.done).length
  const totalSteps = steps.length
  const allStepsDone = totalSteps > 0 && completedSteps === totalSteps

  // Parse the step text
  const stepTitle = nextStep ? splitStepText(nextStep.text).title : null

  return (
    <div className="fixed inset-0 z-50 bg-canvas flex flex-col">
      {/* Minimal header */}
      <div className="flex justify-end p-4 safe-area-top">
        <button
          onClick={onExit}
          className="
            text-sm text-text-muted hover:text-text
            transition-colors duration-150 ease-out
            flex items-center gap-1.5
            min-h-[44px] px-3
            rounded-lg hover:bg-surface
          "
        >
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
          Exit focus
        </button>
      </div>

      {/* Centered task */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center animate-rise">
          {/* Label */}
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-6">
            Just this one thing
          </p>

          {/* Task title */}
          <h1 className="text-3xl font-semibold text-text mb-6 leading-snug">
            {task.title}
          </h1>

          {/* Progress indicator */}
          {totalSteps > 1 && (
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
                />
              </div>
              <span className="text-xs text-text-muted tabular-nums">
                {completedSteps}/{totalSteps}
              </span>
            </div>
          )}

          {/* Next step - the ONE thing to do */}
          {nextStep && (
            <div className="mb-10">
              <p className="text-sm text-text-muted mb-3">Next step:</p>
              <div
                className="
                  flex items-start gap-4
                  p-5
                  bg-card border-2 border-border
                  rounded-xl
                  text-left
                  cursor-pointer
                  hover:border-accent/50
                  transition-all duration-150 ease-out
                "
                onClick={() => onComplete(task.id, nextStep.id)}
              >
                <div className="flex-shrink-0 pt-0.5">
                  <Checkbox
                    checked={false}
                    onToggle={() => onComplete(task.id, nextStep.id)}
                    size={28}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xl text-text font-medium leading-snug">
                    {stepTitle}
                  </p>
                  {nextStep.summary && (
                    <p className="text-sm text-text-soft mt-2">{nextStep.summary}</p>
                  )}
                  {nextStep.time && (
                    <p className="text-xs text-text-muted mt-2 flex items-center gap-1.5">
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" strokeLinecap="round" />
                      </svg>
                      {nextStep.time}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* All steps done state */}
          {allStepsDone && (
            <div className="mb-10 p-6 bg-success-soft rounded-xl">
              <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                <svg width={24} height={24} viewBox="0 0 24 24" className="text-success">
                  <path
                    d="M5 12l5 5L20 7"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </div>
              <p className="text-lg font-medium text-text">All steps complete!</p>
              <p className="text-sm text-text-soft mt-1">Great work on this task.</p>
            </div>
          )}

          {/* Main action button */}
          {!allStepsDone && nextStep && (
            <button
              onClick={() => onComplete(task.id, nextStep.id)}
              className="
                w-full max-w-xs mx-auto
                px-8 py-4
                bg-accent text-white
                rounded-2xl
                font-semibold text-lg
                transition-all duration-150 ease-out
                hover:bg-accent/90
                active:scale-95
              "
            >
              Done
            </button>
          )}

          {/* See full task link */}
          {onGoToTask && (
            <button
              onClick={() => {
                onExit()
                onGoToTask(task.id)
              }}
              className="
                mt-6
                text-sm text-text-muted hover:text-accent
                transition-colors duration-150 ease-out
              "
            >
              See full task
            </button>
          )}
        </div>
      </div>

      {/* Bottom safe area padding for mobile */}
      <div className="safe-area-bottom" />
    </div>
  )
}
