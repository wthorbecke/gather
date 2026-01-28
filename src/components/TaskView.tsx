'use client'

import { useState, useEffect } from 'react'
import { Task, Step } from '@/hooks/useUserData'
import { UnifiedInput } from './UnifiedInput'
import { ThemeToggle } from './ThemeProvider'
import { AICard, AICardState } from './AICard'
import { StepItem } from './StepItem'
import { content } from '@/config/content'
import { SnoozeMenu } from './SnoozeMenu'
import { FocusMode } from './FocusMode'

interface ContextTag {
  type: 'task' | 'step'
  label: string
  task?: Task
  step?: Step
}

interface TaskViewProps {
  task: Task
  tasks: Task[]
  aiCard: AICardState | null
  contextTags: ContextTag[]
  onBack: () => void
  onSubmit: (value: string) => void
  onDismissAI: () => void
  onQuickReply?: (reply: string) => void
  onAICardAction?: (action: { type: string; stepId?: string | number; title?: string; context?: string }) => void
  onToggleStep: (stepId: string | number) => void
  onSetStepContext: (step: Step | null) => void
  onRemoveTag: (index: number) => void
  onDeleteTask: () => void
  onSnoozeTask?: (date: string) => void
  focusStepId?: string | number | null
  onStuckOnStep?: (step: Step) => void
}

export function TaskView({
  task,
  tasks,
  aiCard,
  contextTags,
  onBack,
  onSubmit,
  onDismissAI,
  onQuickReply,
  onAICardAction,
  onToggleStep,
  onSetStepContext,
  onRemoveTag,
  onDeleteTask,
  onSnoozeTask,
  focusStepId,
  onStuckOnStep,
}: TaskViewProps) {
  const [expandedStepId, setExpandedStepId] = useState<string | number | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showFullContext, setShowFullContext] = useState(false)
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false)
  const [focusStepIndex, setFocusStepIndex] = useState<number | null>(null)

  // Handle step expansion - add/remove step context
  const handleStepExpand = (step: Step) => {
    const isCurrentlyExpanded = expandedStepId === step.id
    if (isCurrentlyExpanded) {
      setExpandedStepId(null)
      onSetStepContext(null) // Remove step context
    } else {
      setExpandedStepId(step.id)
      onSetStepContext(step) // Add step context
    }
  }

  // Handle "I'm stuck" on a step
  const handleStuckOnStep = (step: Step) => {
    // First, set the step context so the AI knows what step we're talking about
    onSetStepContext(step)
    setExpandedStepId(step.id)

    // Use the explicit handler if provided, otherwise send a stuck message via onSubmit
    if (onStuckOnStep) {
      onStuckOnStep(step)
    } else {
      // Send a contextual "stuck" message
      onSubmit(`I'm stuck on the step: "${step.text}"`)
    }
  }

  const steps = task.steps || []
  useEffect(() => {
    if (!focusStepId) return
    const target = steps.find((s) => s.id === focusStepId)
    if (!target) return
    setExpandedStepId(target.id)
    onSetStepContext(target)
    const element = document.querySelector(`[data-step-id="${target.id}"]`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [focusStepId, steps, onSetStepContext])
  const doneCount = steps.filter((s) => s.done).length
  const totalCount = steps.length
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0
  const contextText = task.context_text?.trim() || ''
  const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase()

  // Clean up context before checking if it should show
  const cleanContext = (text: string): string => {
    let cleaned = text
    // Skip useless placeholder context
    const skipPhrases = [
      /^none provided\.?$/i,
      /^no additional context\.?$/i,
      /^no context needed\.?$/i,
      /^n\/a$/i,
      /^not applicable\.?$/i,
    ]
    for (const phrase of skipPhrases) {
      if (phrase.test(cleaned.trim())) return ''
    }
    // Remove verbose AI-generated prefixes
    const verbosePrefixes = [
      /^the user wants to /i,
      /^the user needs to /i,
      /^user wants to /i,
      /^this is about /i,
      /^help with /i,
    ]
    for (const prefix of verbosePrefixes) {
      cleaned = cleaned.replace(prefix, '')
    }
    // Remove trailing periods and clean up
    cleaned = cleaned.replace(/\.$/, '').trim()
    // Capitalize first letter
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    }
    return cleaned
  }

  const processedContext = cleanContext(contextText)
  const shouldShowContext =
    processedContext.length > 0 &&
    normalizeText(processedContext) !== normalizeText(task.title) &&
    // Also skip if it's just a slightly longer paraphrase
    !(normalizeText(processedContext).includes(normalizeText(task.title)) && processedContext.length < task.title.length + 20)

  const contextParts = processedContext
    .split(' · ')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      // Clean up various patterns
      if (part.toLowerCase().includes('other (i will specify)')) return 'Not specified'
      // Remove "Yes, " prefix from boolean answers
      if (part.toLowerCase().startsWith('yes, ')) return part.slice(5)
      // Remove "No, " prefix from boolean answers
      if (part.toLowerCase().startsWith('no, ')) return part.slice(4)
      return part
    })
  const contextItems = contextParts.length > 0 ? contextParts : (contextText ? [contextText] : [])
  const formatList = (items: string[]) => {
    if (items.length === 0) return ''
    if (items.length === 1) return items[0]
    if (items.length === 2) return `${items[0]} and ${items[1]}`
    return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
  }
  const summaryText = formatList(contextItems.slice(0, 2))
  const fullText = formatList(contextItems)
  const hasMoreContext = contextItems.length > 2 || contextText.length > 160
  const visibleContext = showFullContext ? fullText : summaryText

  // Find the next incomplete step
  const nextStepId = steps.find((s) => !s.done)?.id

  return (
    <div className="min-h-screen px-5 py-8">
      <div className="max-w-[540px] mx-auto">
        {/* Header row */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="w-11 h-11 rounded-lg bg-subtle text-text-soft hover:text-text flex items-center justify-center transition-colors btn-press tap-target"
          >
            <svg width={16} height={16} viewBox="0 0 16 16">
              <path
                d="M10 12L6 8L10 4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
          <h1 className="flex-1 text-xl font-display font-semibold text-text truncate">{task.title}</h1>

          <div className="flex items-center gap-2">
            <ThemeToggle compact />
            {/* Overflow menu */}
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-11 h-11 rounded-lg bg-subtle text-text-muted hover:text-text flex items-center justify-center transition-colors btn-press tap-target"
              >
                <svg width={16} height={16} viewBox="0 0 16 16">
                  <circle cx="8" cy="3" r="1.5" fill="currentColor" />
                  <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                  <circle cx="8" cy="13" r="1.5" fill="currentColor" />
                </svg>
              </button>

              {showMenu && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowMenu(false)}
                  />
                  {/* Menu */}
                  <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[140px] animate-rise">
                    {onSnoozeTask && (
                      <button
                        onClick={() => {
                          setShowMenu(false)
                          setShowSnoozeMenu(true)
                        }}
                        className="w-full px-4 py-3 text-left text-sm text-text hover:bg-subtle transition-colors tap-target flex items-center gap-2"
                      >
                        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="opacity-60">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" strokeLinecap="round" />
                        </svg>
                        Snooze
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        setShowDeleteConfirm(true)
                      }}
                      className="w-full px-4 py-3 text-left text-sm text-danger hover:bg-danger/10 transition-colors tap-target"
                    >
                      Delete task
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-6 animate-fade-in">
            <p className="text-sm text-text mb-3">Delete this task? This can&apos;t be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  onDeleteTask()
                }}
                className="px-4 py-2 bg-danger text-white rounded-md text-sm font-medium hover:bg-danger/90 transition-colors btn-press tap-target"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-subtle text-text rounded-md text-sm font-medium hover:bg-subtle/80 transition-colors btn-press tap-target"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* AI Card */}
        {aiCard && (
          <AICard
            card={aiCard}
            onDismiss={onDismissAI}
            onQuickReply={onQuickReply}
            onAction={onAICardAction}
          />
        )}

        {/* Input with context tags */}
        {(() => {
          const stepTagIndices = contextTags
            .map((tag, index) => ({ tag, index }))
            .filter(({ tag }) => tag.type === 'step')
          const stepTags = stepTagIndices.map(({ tag }) => tag)
          const inputPlaceholder = stepTags.length > 0
            ? content.placeholders.taskStepContext
            : aiCard
              ? content.placeholders.taskFollowUp
              : content.placeholders.taskInput
          return (
            <UnifiedInput
              tasks={tasks}
              contextTags={stepTags}
              onSubmit={onSubmit}
              onRemoveTag={(idx) => onRemoveTag(stepTagIndices[idx].index)}
              placeholder={inputPlaceholder}
              allowDropdown={false}
            />
          )
        })()}

        {/* Context - collapsed by default with info toggle */}
        {shouldShowContext && visibleContext && (
          <div className="mb-4">
            {!showFullContext ? (
              <button
                onClick={() => setShowFullContext(true)}
                className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-soft transition-colors btn-press tap-target"
              >
                <svg width={14} height={14} viewBox="0 0 16 16" className="opacity-60">
                  <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                  <circle cx="8" cy="5.5" r="0.75" fill="currentColor" />
                  <path d="M8 7.5V11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Show context
              </button>
            ) : (
              <div className="text-sm text-text-soft leading-relaxed animate-fade-in">
                <span className="text-text-muted">Context:</span>{' '}
                {fullText}
                <button
                  onClick={() => setShowFullContext(false)}
                  className="ml-2 text-xs text-text-muted hover:text-text transition-colors"
                >
                  Hide
                </button>
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {totalCount > 0 && (
          <div className="mb-6">
            <div className="h-[4px] bg-border rounded-full overflow-hidden relative">
              <div
                className="h-full bg-success rounded-full transition-all duration-300 ease-out progress-bar-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-sm text-text-muted mt-2">
              {doneCount} of {totalCount} complete
              {doneCount === totalCount && totalCount > 0 && (
                <span className="ml-2 text-success">✓</span>
              )}
            </div>
          </div>
        )}

        {/* Steps */}
        <div className="flex flex-col gap-3">
          {steps.map((step, index) => {
            const isNext = step.id === nextStepId
            const isExpanded = expandedStepId === step.id

            return (
              <div key={step.id} className="animate-rise" style={{ animationDelay: `${index * 40}ms` }}>
                <StepItem
                  step={step}
                  isNext={isNext}
                  isExpanded={isExpanded}
                  onToggle={() => onToggleStep(step.id)}
                  onExpand={() => handleStepExpand(step)}
                  onStuck={handleStuckOnStep}
                  onFocus={() => setFocusStepIndex(index)}
                />
              </div>
            )
          })}
        </div>

        {/* Empty steps state */}
        {steps.length === 0 && (
          <div className="text-center py-12">
            <div className="text-text-muted mb-2">{content.emptyStates.taskNoStepsTitle}</div>
            <div className="text-sm text-text-muted">{content.emptyStates.taskNoStepsBody}</div>
          </div>
        )}
      </div>

      {/* Snooze Menu */}
      {showSnoozeMenu && onSnoozeTask && (
        <SnoozeMenu
          onSnooze={(date) => {
            onSnoozeTask(date)
            setShowSnoozeMenu(false)
            onBack() // Return to home after snoozing
          }}
          onCancel={() => setShowSnoozeMenu(false)}
        />
      )}

      {/* Focus Mode */}
      {focusStepIndex !== null && steps[focusStepIndex] && (
        <FocusMode
          step={steps[focusStepIndex]}
          taskTitle={task.title}
          totalSteps={steps.length}
          currentStepIndex={focusStepIndex}
          onToggleStep={() => onToggleStep(steps[focusStepIndex].id)}
          onExit={() => setFocusStepIndex(null)}
          onNext={focusStepIndex < steps.length - 1 ? () => setFocusStepIndex(focusStepIndex + 1) : undefined}
          onPrevious={focusStepIndex > 0 ? () => setFocusStepIndex(focusStepIndex - 1) : undefined}
          onStuck={() => {
            setFocusStepIndex(null)
            if (onStuckOnStep) {
              onStuckOnStep(steps[focusStepIndex])
            }
          }}
        />
      )}
    </div>
  )
}
