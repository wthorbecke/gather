'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Task, Step } from '@/hooks/useUserData'
import { IntegrationProvider, TaskType, EnergyLevel } from '@/lib/constants'
import { UnifiedInput } from './UnifiedInput'
import { useTheme } from './ThemeProvider'
import { AICard, AICardState } from './AICard'
import { StepItem } from './StepItem'
import { SegmentedProgress } from './SegmentedProgress'
import { HabitCalendar } from './HabitCalendar'
import { content } from '@/config/content'
import { SnoozeMenu } from './SnoozeMenu'
import { SchedulePicker } from './SchedulePicker'
import { RecurrencePickerModal } from './RecurrencePickerModal'
import { Recurrence } from '@/hooks/useUserData'
import { EnergyBadge, EnergyPicker } from './EnergyBadge'

// Lazy load FocusMode - only needed when user enters focus mode
const FocusMode = dynamic(() => import('./FocusMode').then(mod => ({ default: mod.FocusMode })), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 bg-canvas flex items-center justify-center">
      <div className="animate-pulse text-text-muted">Loading focus mode...</div>
    </div>
  ),
})

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
  onEditStep?: (stepId: string | number, newText: string) => void
  onDeleteStep?: (stepId: string | number) => void
  onAddStep?: (text: string) => void
  onMoveStep?: (stepId: string | number, direction: 'up' | 'down') => void
  onSetStepContext: (step: Step | null) => void
  onRemoveTag: (index: number) => void
  onDeleteTask: () => void
  onSnoozeTask?: (date: string) => void
  onScheduleTask?: (datetime: string | null) => void
  onSetRecurrence?: (recurrence: Recurrence | null) => void
  onAddToCalendar?: () => Promise<{ success: boolean; error?: string }>
  onRemoveFromCalendar?: () => Promise<{ success: boolean; error?: string }>
  onDuplicateTask?: () => void
  onSetEnergy?: (energy: EnergyLevel | null) => void
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
  onEditStep,
  onDeleteStep,
  onAddStep,
  onMoveStep,
  onSetStepContext,
  onRemoveTag,
  onDeleteTask,
  onSnoozeTask,
  onScheduleTask,
  onSetRecurrence,
  onAddToCalendar,
  onRemoveFromCalendar,
  onDuplicateTask,
  onSetEnergy,
  focusStepId,
  onStuckOnStep,
}: TaskViewProps) {
  const { theme, toggleTheme } = useTheme()
  const [expandedStepId, setExpandedStepId] = useState<string | number | null>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showFullContext, setShowFullContext] = useState(false)
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false)
  const [showSchedulePicker, setShowSchedulePicker] = useState(false)
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false)
  const [showEnergyPicker, setShowEnergyPicker] = useState(false)
  const [focusStepIndex, setFocusStepIndex] = useState<number | null>(null)
  const [addingToCalendar, setAddingToCalendar] = useState(false)
  const [calendarAdded, setCalendarAdded] = useState(false)
  const [removingFromCalendar, setRemovingFromCalendar] = useState(false)
  const [calendarRemoved, setCalendarRemoved] = useState(false)
  const [showAddStep, setShowAddStep] = useState(false)
  const [newStepText, setNewStepText] = useState('')

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
                  -ml-2 p-3 min-w-[44px] min-h-[44px] rounded-md
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
                    -mr-2 p-3 min-w-[44px] min-h-[44px] rounded-md
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
                    className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out"
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
                      className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out"
                    >
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 6v6l4 2" strokeLinecap="round" />
                      </svg>
                      Snooze
                    </button>
                  )}
                  {/* Schedule time - time blocking */}
                  {onScheduleTask && (
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        setShowSchedulePicker(true)
                      }}
                      className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out"
                    >
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <path d="M16 2v4M8 2v4M3 10h18" />
                        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" strokeLinecap="round" />
                      </svg>
                      {task.scheduled_at ? 'Reschedule' : 'Schedule time'}
                    </button>
                  )}
                  {/* Set repeat - for reminders and tasks with scheduled_at */}
                  {onSetRecurrence && (task.type === TaskType.REMINDER || task.scheduled_at) && (
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        setShowRecurrencePicker(true)
                      }}
                      className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out"
                    >
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                        <path d="M17 1l4 4-4 4" />
                        <path d="M3 11V9a4 4 0 014-4h14" />
                        <path d="M7 23l-4-4 4-4" />
                        <path d="M21 13v2a4 4 0 01-4 4H3" />
                      </svg>
                      {task.recurrence ? 'Edit repeat' : 'Set repeat'}
                    </button>
                  )}
                  {/* Energy level - helps users match tasks to their current energy */}
                  {onSetEnergy && (
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        setShowEnergyPicker(true)
                      }}
                      className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out"
                    >
                      <span className="text-sm w-4 text-center">
                        {task.energy === 'low' ? '🌿' : task.energy === 'medium' ? '⚡' : task.energy === 'high' ? '🔥' : '⚪'}
                      </span>
                      {task.energy ? 'Change energy' : 'Set energy'}
                    </button>
                  )}
                  {/* Calendar options - only show if task has due date and is not from Google */}
                  {task.due_date && task.external_source?.provider !== IntegrationProvider.GOOGLE && (
                    <>
                      {/* Add to Calendar - show if not already added */}
                      {onAddToCalendar && !task.calendar_event_id && (
                        <button
                          onClick={async () => {
                            setShowMenu(false)
                            setAddingToCalendar(true)
                            const result = await onAddToCalendar()
                            setAddingToCalendar(false)
                            if (result.success) {
                              setCalendarAdded(true)
                              setTimeout(() => setCalendarAdded(false), 3000)
                            }
                          }}
                          disabled={addingToCalendar || calendarAdded}
                          className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out disabled:opacity-50"
                        >
                          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <path d="M16 2v4M8 2v4M3 10h18" />
                            <path d="M12 14v4M10 16h4" strokeLinecap="round" />
                          </svg>
                          {addingToCalendar ? 'Adding...' : calendarAdded ? 'Added to Calendar' : 'Add to Calendar'}
                        </button>
                      )}
                      {/* Remove from Calendar - show if already added */}
                      {onRemoveFromCalendar && task.calendar_event_id && (
                        <button
                          onClick={async () => {
                            setShowMenu(false)
                            setRemovingFromCalendar(true)
                            const result = await onRemoveFromCalendar()
                            setRemovingFromCalendar(false)
                            if (result.success) {
                              setCalendarRemoved(true)
                              setTimeout(() => setCalendarRemoved(false), 3000)
                            }
                          }}
                          disabled={removingFromCalendar || calendarRemoved}
                          className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out disabled:opacity-50"
                        >
                          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <path d="M16 2v4M8 2v4M3 10h18" />
                            <path d="M9 15l6-6M9 9l6 6" strokeLinecap="round" />
                          </svg>
                          {removingFromCalendar ? 'Removing...' : calendarRemoved ? 'Removed' : 'Remove from Calendar'}
                        </button>
                      )}
                    </>
                  )}
                  {/* Duplicate task */}
                  {onDuplicateTask && (
                    <button
                      onClick={() => {
                        setShowMenu(false)
                        onDuplicateTask()
                      }}
                      className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-text hover:bg-subtle flex items-center gap-2.5 transition-colors duration-150 ease-out"
                    >
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                      Duplicate
                    </button>
                  )}
                  <div className="h-px bg-border my-1" />
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setShowDeleteConfirm(true)
                    }}
                    className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-danger hover:bg-danger-soft flex items-center gap-2.5 transition-colors duration-150 ease-out"
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


        {/* Habit Streak Stats */}
        {task.type === TaskType.HABIT && task.streak && (
          <div className="mb-5 p-4 bg-surface rounded-xl border border-border">
            <div className="flex items-center justify-between">
              {/* Current streak */}
              <div className="flex items-center gap-2">
                <span className="text-2xl">🔥</span>
                <div>
                  <div className="text-2xl font-bold text-text tabular-nums">{task.streak.current}</div>
                  <div className="text-xs text-text-muted">day streak</div>
                </div>
              </div>

              {/* Best streak */}
              <div className="text-right">
                <div className="text-sm font-medium text-text-soft tabular-nums">
                  Best: {task.streak.best} days
                </div>
                {task.streak.lastCompleted && (
                  <div className="text-xs text-text-muted">
                    Last: {new Date(task.streak.lastCompleted).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Encouragement message */}
            {task.streak.current > 0 && task.streak.current === task.streak.best && (
              <div className="mt-3 pt-3 border-t border-border text-sm text-success text-center">
                You&apos;re on your best streak! Keep it going!
              </div>
            )}

            {/* Habit completion calendar */}
            {task.streak.completions && task.streak.completions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="text-xs font-medium text-text-muted mb-3 text-center">Last 4 weeks</div>
                <HabitCalendar completions={task.streak.completions} />
              </div>
            )}
          </div>
        )}

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
                  onEdit={onEditStep ? (step, newText) => onEditStep(step.id, newText) : undefined}
                  onDelete={onDeleteStep ? (step) => onDeleteStep(step.id) : undefined}
                  onMoveUp={onMoveStep && index > 0 ? () => onMoveStep(step.id, 'up') : undefined}
                  onMoveDown={onMoveStep && index < steps.length - 1 ? () => onMoveStep(step.id, 'down') : undefined}
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

      {/* Schedule Picker */}
      {showSchedulePicker && onScheduleTask && (
        <SchedulePicker
          currentSchedule={task.scheduled_at}
          onSchedule={(datetime) => {
            onScheduleTask(datetime)
            setShowSchedulePicker(false)
          }}
          onCancel={() => setShowSchedulePicker(false)}
        />
      )}

      {/* Recurrence Picker */}
      {showRecurrencePicker && onSetRecurrence && (
        <RecurrencePickerModal
          currentRecurrence={task.recurrence}
          onSave={(recurrence) => {
            onSetRecurrence(recurrence)
            setShowRecurrencePicker(false)
          }}
          onCancel={() => setShowRecurrencePicker(false)}
        />
      )}

      {/* Energy Picker */}
      {showEnergyPicker && onSetEnergy && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setShowEnergyPicker(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-backdrop-in" />
          <div
            className="relative z-10 bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm mx-0 sm:mx-4 p-6 shadow-modal animate-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-text mb-2">Energy level</h3>
            <p className="text-sm text-text-muted mb-4">
              How much focus does this task require?
            </p>
            <EnergyPicker
              value={task.energy}
              onChange={(energy) => {
                onSetEnergy(energy)
                setShowEnergyPicker(false)
              }}
              taskTitle={task.title}
            />
            <button
              onClick={() => setShowEnergyPicker(false)}
              className="w-full mt-4 py-3 text-text-soft hover:text-text text-sm font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
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
