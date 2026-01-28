'use client'

import { useState, useEffect } from 'react'
import { Task, Step } from '@/hooks/useUserData'
import { UnifiedInput } from './UnifiedInput'
import { useTheme } from './ThemeProvider'
import { AICard, AICardState } from './AICard'
import { StepItem } from './StepItem'
import { SegmentedProgress } from './SegmentedProgress'
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
  const { theme, toggleTheme } = useTheme()
  const [expandedStepId, setExpandedStepId] = useState<string | number | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showFullContext, setShowFullContext] = useState(false)
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false)
  const [focusStepIndex, setFocusStepIndex] = useState<number | null>(null)

  // Handle step expansion
  const handleStepExpand = (step: Step) => {
    const isCurrentlyExpanded = expandedStepId === step.id
    if (isCurrentlyExpanded) {
      setExpandedStepId(null)
      onSetStepContext(null)
    } else {
      setExpandedStepId(step.id)
      onSetStepContext(step)
    }
  }

  // Handle "I'm stuck" on a step
  const handleStuckOnStep = (step: Step) => {
    onSetStepContext(step)
    setExpandedStepId(step.id)
    if (onStuckOnStep) {
      onStuckOnStep(step)
    } else {
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

  // Clean up context
  const cleanContext = (text: string): string => {
    let cleaned = text
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
    cleaned = cleaned.replace(/\.$/, '').trim()
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    }
    return cleaned
  }

  const processedContext = cleanContext(contextText)
  const shouldShowContext =
    processedContext.length > 0 &&
    normalizeText(processedContext) !== normalizeText(task.title) &&
    !(normalizeText(processedContext).includes(normalizeText(task.title)) && processedContext.length < task.title.length + 20)

  const contextParts = processedContext
    .split(' · ')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.toLowerCase().includes('other (i will specify)')) return 'Not specified'
      if (part.toLowerCase().startsWith('yes, ')) return part.slice(5)
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
  const nextStepId = steps.find((s) => !s.done)?.id

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header - matches home view structure */}
      <div className="sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm border-b border-border-subtle">
        <div className="px-5 py-4">
          <div className="max-w-[540px] mx-auto">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="
                  -ml-2 p-2 rounded-md
                  text-text-muted hover:text-text hover:bg-surface
                  flex items-center justify-center
                  transition-colors duration-150
                  btn-press
                "
                aria-label="Back"
              >
                <svg width={18} height={18} viewBox="0 0 16 16">
                  <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                </svg>
              </button>
              <h1 className="flex-1 text-xl font-display font-semibold text-text truncate">{task.title}</h1>

              {/* Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="
                    -mr-2 p-2 rounded-md
                    text-text-muted hover:text-text hover:bg-surface
                    flex items-center justify-center
                    btn-press
                  "
                  aria-label="Menu"
                >
                  <svg width={18} height={18} viewBox="0 0 16 16">
                    <circle cx="8" cy="3" r="1.5" fill="currentColor" />
                    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                    <circle cx="8" cy="13" r="1.5" fill="currentColor" />
                  </svg>
                </button>

            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-md shadow-md overflow-hidden min-w-[160px] animate-rise">
                  <button
                    onClick={() => {
                      toggleTheme()
                      setShowMenu(false)
                    }}
                    className="w-full px-3 py-2.5 text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5"
                  >
                    {theme === 'light' ? (
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    ) : (
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                        <circle cx="12" cy="12" r="5" />
                        <line x1="12" y1="1" x2="12" y2="3" />
                        <line x1="12" y1="21" x2="12" y2="23" />
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                        <line x1="1" y1="12" x2="3" y2="12" />
                        <line x1="21" y1="12" x2="23" y2="12" />
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                      </svg>
                    )}
                    {theme === 'light' ? 'Dark mode' : 'Light mode'}
                  </button>
                  {onSnoozeTask && (
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        setShowSnoozeMenu(true)
                      }}
                      className="w-full px-3 py-2.5 text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5"
                    >
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" strokeLinecap="round" />
                      </svg>
                      Snooze
                    </button>
                  )}
                  <div className="h-px bg-border my-1" />
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowDeleteConfirm(true)
                    }}
                    className="w-full px-3 py-2.5 text-left text-sm text-danger hover:bg-danger-soft flex items-center gap-2.5"
                  >
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-danger">
                      <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                    </svg>
                    Delete
                  </button>
                </div>
              </>
            )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-6">
        <div className="max-w-[540px] mx-auto">

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="bg-danger-soft border border-danger/30 rounded-md p-4 mb-6 animate-fade-in">
            <p className="text-sm text-text mb-3">Delete this task? This can&apos;t be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  onDeleteTask()
                }}
                className="px-4 py-2 bg-danger text-white rounded-md text-sm font-medium hover:bg-danger/90 transition-colors duration-[80ms] btn-press tap-target"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-subtle text-text rounded-md text-sm font-medium hover:bg-card-hover transition-colors duration-[80ms] btn-press tap-target"
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

        {/* Input */}
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
              autoFocus={Boolean(aiCard?.autoFocusInput)}
            />
          )
        })()}


        {/* Progress */}
        {totalCount > 0 && (
          <div className="mb-5 flex items-center gap-3">
            <span className="text-xs text-text-muted tabular-nums">{doneCount}/{totalCount}</span>
            <div className="w-24">
              <SegmentedProgress completed={doneCount} total={totalCount} height={4} />
            </div>
          </div>
        )}

        {/* Steps */}
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
                  onToggle={() => onToggleStep(step.id)}
                  onExpand={() => handleStepExpand(step)}
                  onStuck={handleStuckOnStep}
                  onFocus={() => setFocusStepIndex(index)}
                />
              </div>
            )
          })}
        </div>

        {/* Empty state */}
        {steps.length === 0 && (
          <div className="text-center py-12">
            <div className="text-text-muted mb-2">{content.emptyStates.taskNoStepsTitle}</div>
            <div className="text-sm text-text-muted">{content.emptyStates.taskNoStepsBody}</div>
          </div>
        )}
        </div>
      </div>

      {/* Snooze Menu */}
      {showSnoozeMenu && onSnoozeTask && (
        <SnoozeMenu
          onSnooze={(date) => {
            onSnoozeTask(date)
            setShowSnoozeMenu(false)
            onBack()
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
