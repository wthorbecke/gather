'use client'

import { useState, useCallback, useMemo } from 'react'
import { Task, Step } from '@/hooks/useUserData'
import { pickBestTask, getAlternativeTasks, getTaskPickReason } from '@/lib/taskPicker'
import { EnergyBadge } from './EnergyBadge'
import { EnergyLevel } from '@/lib/constants'
import { splitStepText } from '@/lib/stepText'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { NoTasksEmptyState } from './NoTasksEmptyState'

interface FocusLauncherProps {
  tasks: Task[]
  userEnergy?: EnergyLevel | null
  onStartFocus: (task: Task, stepIndex: number) => void
  onSnooze: (taskId: string, duration: 'later' | 'tomorrow' | 'skip') => void
  onExit: () => void
}

/**
 * Focus Launcher - One-Task-at-a-Time Mode
 *
 * Presents the user with exactly ONE task to work on, eliminating decision paralysis.
 * Uses smart task selection to pick the most important/relevant task.
 */
export function FocusLauncher({
  tasks,
  userEnergy,
  onStartFocus,
  onSnooze,
  onExit,
}: FocusLauncherProps) {
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Pick the best task
  const bestTask = useMemo(
    () => selectedTaskId
      ? tasks.find(t => t.id === selectedTaskId) || pickBestTask(tasks, userEnergy)
      : pickBestTask(tasks, userEnergy),
    [tasks, userEnergy, selectedTaskId]
  )

  // Get alternatives
  const alternatives = useMemo(
    () => getAlternativeTasks(tasks, bestTask?.id || null, 3, userEnergy),
    [tasks, bestTask?.id, userEnergy]
  )

  // Get first incomplete step
  const firstIncompleteStep = useMemo(() => {
    if (!bestTask?.steps) return null
    const idx = bestTask.steps.findIndex(s => !s.done)
    if (idx === -1) return null
    return { step: bestTask.steps[idx], index: idx }
  }, [bestTask])

  // Pick reason for display
  const pickReason = useMemo(
    () => bestTask ? getTaskPickReason(bestTask, userEnergy) : '',
    [bestTask, userEnergy]
  )

  // Handle starting focus
  const handleStart = useCallback(() => {
    if (bestTask && firstIncompleteStep) {
      onStartFocus(bestTask, firstIncompleteStep.index)
    }
  }, [bestTask, firstIncompleteStep, onStartFocus])

  // Handle picking an alternative
  const handlePickAlternative = useCallback((task: Task) => {
    setSelectedTaskId(task.id)
    setShowAlternatives(false)
  }, [])

  // Keyboard shortcuts
  const shortcuts = useMemo(() => [
    { key: 'Escape', action: onExit, description: 'Exit' },
    { key: 'Enter', action: handleStart, description: 'Start focus' },
    { key: 'p', action: () => setShowAlternatives(v => !v), description: 'Pick another' },
  ], [onExit, handleStart])

  useKeyboardShortcuts({ shortcuts, enabled: !showAlternatives })

  // No tasks available
  if (!bestTask || !firstIncompleteStep) {
    return (
      <NoTasksEmptyState
        title="Nothing to focus on"
        subtitle="All your tasks are done. Nice work."
        buttonText="Back to list"
        onAction={onExit}
      />
    )
  }

  const { title: stepTitle, remainder: stepDetail } = splitStepText(firstIncompleteStep.step.text)
  const totalSteps = bestTask.steps?.length || 0
  const completedSteps = bestTask.steps?.filter(s => s.done).length || 0

  return (
    <div className="fixed inset-0 z-50 bg-canvas flex flex-col">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <button
          onClick={onExit}
          className="text-sm text-text-muted hover:text-text transition-colors flex items-center gap-1.5 min-h-[44px] min-w-[44px] justify-center"
        >
          <svg width={16} height={16} viewBox="0 0 16 16">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
          </svg>
          Exit
        </button>

        <div className="text-xs text-text-muted flex items-center gap-2">
          <span>Press Enter to start</span>
          <span className="bg-surface px-1.5 py-0.5 rounded text-[10px]">↵</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 max-w-lg mx-auto w-full">
        {/* Pick reason tag */}
        <div className="mb-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-accent/10 text-accent rounded-full">
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" />
              <path d="M22 4L12 14.01l-3-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {pickReason}
          </span>
        </div>

        {/* Task title */}
        <h2
          className="text-lg text-text-soft mb-2 text-center"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {bestTask.title}
        </h2>

        {/* Energy badge */}
        {bestTask.energy && (
          <div className="mb-4">
            <EnergyBadge energy={bestTask.energy} showLabel size="md" />
          </div>
        )}

        {/* First step - THE thing to do */}
        <div className="text-center mb-6">
          <h1
            className="text-2xl md:text-3xl font-semibold text-text leading-relaxed mb-2"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {stepTitle}
          </h1>
          {stepDetail && (
            <p className="text-text-soft text-sm max-w-md">{stepDetail}</p>
          )}
        </div>

        {/* Time estimate */}
        {firstIncompleteStep.step.time && (
          <div className="flex items-center gap-2 text-sm text-text-muted mb-6">
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" strokeLinecap="round" />
            </svg>
            {firstIncompleteStep.step.time}
          </div>
        )}

        {/* Progress indicator */}
        {totalSteps > 1 && (
          <div className="flex items-center gap-3 mb-8">
            <div className="w-32 h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-300"
                style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
              />
            </div>
            <span className="text-xs text-text-muted">
              {completedSteps}/{totalSteps} done
            </span>
          </div>
        )}

        {/* Start button */}
        <button
          onClick={handleStart}
          className="w-full max-w-xs py-4 rounded-2xl bg-accent text-white text-lg font-semibold hover:opacity-90 transition-all duration-150 active:scale-[0.98] mb-4"
          style={{
            boxShadow: '0 4px 20px rgba(224, 122, 95, 0.3), 0 2px 8px rgba(224, 122, 95, 0.2)',
          }}
        >
          Start this now
        </button>

        {/* Secondary actions */}
        <div className="flex items-center gap-4 text-sm">
          <button
            onClick={() => onSnooze(bestTask.id, 'later')}
            className="text-text-muted hover:text-text transition-colors py-2 px-3"
          >
            Not now
          </button>
          <span className="text-border">•</span>
          <button
            onClick={() => setShowAlternatives(true)}
            className="text-text-muted hover:text-text transition-colors py-2 px-3 flex items-center gap-1"
          >
            Pick something else
            <svg width={12} height={12} viewBox="0 0 16 16" className="opacity-60">
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            </svg>
          </button>
        </div>
      </div>

      {/* Alternatives panel */}
      {showAlternatives && (
        <div className="fixed inset-0 z-50 bg-canvas/95 backdrop-blur-sm flex flex-col animate-fade-in">
          <div className="p-4 flex items-center justify-between border-b border-border">
            <h2 className="text-lg font-medium text-text">Pick a different task</h2>
            <button
              onClick={() => setShowAlternatives(false)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-text-muted hover:text-text transition-colors"
            >
              <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4 max-w-lg mx-auto w-full">
            <p className="text-sm text-text-soft mb-4">
              Here are a few alternatives. We&apos;ll limit your choices to avoid overwhelm.
            </p>

            <div className="space-y-3">
              {alternatives.map(task => {
                const firstStep = task.steps?.find(s => !s.done)
                const { title } = firstStep ? splitStepText(firstStep.text) : { title: 'Start this task' }
                const reason = getTaskPickReason(task, userEnergy)

                return (
                  <button
                    key={task.id}
                    onClick={() => handlePickAlternative(task)}
                    className="w-full p-4 rounded-xl bg-card border border-border hover:border-accent/50 transition-all text-left group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-text-muted mb-1">{reason}</div>
                        <h3 className="font-medium text-text truncate mb-1">{task.title}</h3>
                        <p className="text-sm text-text-soft truncate">{title}</p>
                      </div>
                      {task.energy && (
                        <EnergyBadge energy={task.energy} size="sm" />
                      )}
                    </div>
                  </button>
                )
              })}

              {alternatives.length === 0 && (
                <div className="text-center py-8 text-text-muted">
                  No other tasks available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
