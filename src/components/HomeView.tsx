'use client'

import { useMemo, useEffect, useState } from 'react'
import { Task, MoodEntry } from '@/hooks/useUserData'
import { useDarkMode } from '@/hooks/useDarkMode'
import { splitStepText } from '@/lib/stepText'
import { getNextStep } from '@/hooks/useTaskSearch'
import { UnifiedInput, ParsedInputMetadata } from './UnifiedInput'
import { AICard, AICardState } from './AICard'
import { TaskListItem } from './TaskListItem'
import { Checkbox } from './Checkbox'
import { getDeadlineUrgency } from './DeadlineBadge'
import { CalendarWidget } from './CalendarSidebar'
import { EmailTasksCard } from './EmailTasksCard'
import { StatsCard } from './StatsCard'
import { content, OTHER_SPECIFY_OPTION } from '@/config/content'
import { TaskInsight } from './TaskInsight'
import { EnergySuggestions } from './EnergySuggestions'

// Time-based ambient style - shared atmosphere with StackView
function getAmbientStyle(taskCount: number, isDark: boolean) {
  const hour = new Date().getHours()
  const calmRatio = Math.max(0, 1 - taskCount / 8) // Fewer items = calmer

  if (isDark) {
    if (hour >= 5 && hour < 9) {
      return { background: `linear-gradient(170deg, hsl(30, 35%, ${8 + calmRatio * 3}%) 0%, hsl(220, 20%, 4%) 100%)` }
    } else if (hour >= 17 && hour < 21) {
      return { background: `linear-gradient(170deg, hsl(${15 + calmRatio * 15}, 40%, ${9 + calmRatio * 3}%) 0%, hsl(260, 20%, 5%) 100%)` }
    } else if (hour >= 21 || hour < 5) {
      return { background: `linear-gradient(170deg, hsl(240, 25%, ${7 + calmRatio * 2}%) 0%, hsl(240, 20%, 3%) 100%)` }
    }
    return { background: `linear-gradient(170deg, hsl(220, 15%, ${7 + calmRatio * 2}%) 0%, hsl(220, 12%, 4%) 100%)` }
  } else {
    if (hour >= 5 && hour < 9) {
      return { background: `linear-gradient(170deg, hsl(45, ${40 + calmRatio * 20}%, ${95 - calmRatio * 3}%) 0%, hsl(50, 20%, 98%) 100%)` }
    } else if (hour >= 17 && hour < 21) {
      return { background: `linear-gradient(170deg, hsl(25, ${35 + calmRatio * 20}%, ${95 - calmRatio * 3}%) 0%, hsl(35, 20%, 98%) 100%)` }
    } else if (hour >= 21 || hour < 5) {
      return { background: `linear-gradient(170deg, hsl(220, ${20 + calmRatio * 10}%, ${96 - calmRatio * 2}%) 0%, hsl(220, 15%, 98%) 100%)` }
    }
    return { background: `linear-gradient(170deg, hsl(50, ${15 + calmRatio * 15}%, ${97 - calmRatio * 2}%) 0%, hsl(50, 10%, 99%) 100%)` }
  }
}

interface HomeViewProps {
  tasks: Task[]
  moodEntries?: MoodEntry[]
  aiCard: AICardState | null
  pendingInput: string | null
  onSubmit: (value: string, metadata?: ParsedInputMetadata) => void
  onQuickAdd: (value: string, metadata?: ParsedInputMetadata) => void
  onQuickReply: (reply: string) => void
  onDismissAI: () => void
  onGoToTask: (taskId: string) => void
  onToggleStep: (taskId: string, stepId: string | number) => void
  onToggleHabit?: (taskId: string) => void
  onSuggestionClick: (suggestion: string) => void
  onDeleteTask?: (taskId: string) => void
  onClearCompleted?: () => void
  onTogglePin?: (taskId: string) => void
  onSnoozeTask?: (taskId: string, date: string) => void
  onAICardAction?: (action: { type: string; stepId?: string | number; title?: string; context?: string }) => void
  onBackQuestion?: () => void
  canGoBack?: boolean
  isDemoUser?: boolean
  onOpenTemplates?: () => void
  onOpenBrainDump?: () => void
}

export function HomeView({
  tasks,
  moodEntries = [],
  aiCard,
  pendingInput,
  onSubmit,
  onQuickAdd,
  onQuickReply,
  onDismissAI,
  onGoToTask,
  onToggleStep,
  onToggleHabit,
  onSuggestionClick,
  onDeleteTask,
  onClearCompleted,
  onTogglePin,
  onSnoozeTask,
  onAICardAction,
  onBackQuestion,
  canGoBack = false,
  isDemoUser = false,
  onOpenTemplates,
  onOpenBrainDump,
}: HomeViewProps) {
  // State for task list visibility
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [showCompletedTasks, setShowCompletedTasks] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // Filter out snoozed tasks
  const activeTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return tasks.filter(task => {
      if (!task.snoozed_until) return true
      return task.snoozed_until <= today
    })
  }, [tasks])

  // Sort by pinned first, then deadline urgency
  const sortedTasks = useMemo(() => {
    return [...activeTasks].sort((a, b) => {
      // Pinned tasks come first
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      // Then sort by deadline urgency
      const urgencyA = getDeadlineUrgency(a.due_date)
      const urgencyB = getDeadlineUrgency(b.due_date)
      return urgencyA - urgencyB
    })
  }, [activeTasks])

  const snoozedCount = tasks.length - activeTasks.length
  // Use sortedTasks so "Do this now" shows the most urgent task's next step
  const nextStep = getNextStep(sortedTasks)
  const shouldAutoFocus = Boolean(aiCard?.autoFocusInput) || Boolean(aiCard?.question && (!aiCard.quickReplies || aiCard.quickReplies.length === 0))
  const isQuestionFlow = Boolean(aiCard?.question)
  const inputPlaceholder = isQuestionFlow ? content.placeholders.aiFreeText : content.placeholders.homeInput
  const totalSteps = activeTasks.reduce((sum, task) => sum + (task.steps?.length || 0), 0)
  const incompleteSteps = activeTasks.reduce(
    (sum, task) => sum + (task.steps?.filter((step) => !step.done).length || 0),
    0
  )
  const getDerivedStepTitle = (text: string) => splitStepText(text).title

  // Use centralized dark mode hook (single MutationObserver shared across components)
  const isDark = useDarkMode()

  // Memoize ambient style to prevent new object creation on every render
  const ambientStyle = useMemo(() => getAmbientStyle(activeTasks.length, isDark), [activeTasks.length, isDark])

  // Global Enter key handler for question flow with saved answer
  useEffect(() => {
    if (!isQuestionFlow || !aiCard?.savedAnswer) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if no input is focused
      const activeElement = document.activeElement
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA'

      if (e.key === 'Enter' && !isInputFocused && aiCard.savedAnswer) {
        e.preventDefault()
        onQuickReply(aiCard.savedAnswer)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isQuestionFlow, aiCard?.savedAnswer, onQuickReply])

  return (
    <div
      className="min-h-screen px-5 pt-6 pb-8 transition-all duration-700"
      style={ambientStyle}
    >
      {/* Subtle paper texture - matches StackView */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
      <div className="relative max-w-[540px] mx-auto">
        {/* Suggestions - only show when no tasks */}
        {!aiCard && activeTasks.length === 0 && (
          <div className="-mx-5 mb-6">
            <div className="flex gap-2 overflow-x-auto pb-1 px-5 scrollbar-hide">
              {content.homeSuggestions.map((s, index) => (
                <button
                  key={s}
                  onClick={() => onSuggestionClick(s)}
                  className="
                    px-4 py-2 whitespace-nowrap flex-shrink-0
                    bg-transparent border border-border rounded-sm
                    text-sm text-text-soft
                    hover:bg-card-hover hover:text-text
                    transition-all duration-[80ms] ease-out
                    btn-press tap-target animate-rise
                  "
                  style={{ animationDelay: `${index * 40}ms` }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI Card */}
        {aiCard && (
          <AICard
            card={aiCard}
            pendingInput={pendingInput}
            onDismiss={onDismissAI}
            onQuickReply={onQuickReply}
            onGoToTask={onGoToTask}
            onAction={onAICardAction}
            onBackQuestion={onBackQuestion}
            attachInput={isQuestionFlow}
            canGoBack={canGoBack}
          />
        )}

        {/* Empty state intro - show above input when no tasks */}
        {tasks.length === 0 && !aiCard && (
          <div className="text-center mb-4">
            <div className="text-lg font-medium text-text">{content.emptyStates.homeNoTasksTitle}</div>
            <div className="text-sm text-text-muted mt-1">{content.emptyStates.homeNoTasksBody}</div>
          </div>
        )}

        {/* Input */}
        {(() => {
          // Don't treat "Other" as a confirmable saved answer
          const isOtherSelected = aiCard?.savedAnswer?.toLowerCase().includes(OTHER_SPECIFY_OPTION.toLowerCase())
          const confirmableSavedAnswer = isOtherSelected ? undefined : aiCard?.savedAnswer
          return (
            <UnifiedInput
              tasks={tasks}
              onSubmit={onSubmit}
              onQuickAdd={onQuickAdd}
              onOpenTemplates={onOpenTemplates}
              onOpenBrainDump={onOpenBrainDump}
              placeholder={isQuestionFlow ? (confirmableSavedAnswer ? `Press enter to confirm "${confirmableSavedAnswer}"` : 'Type your answer...') : inputPlaceholder}
              animatedPlaceholders={isQuestionFlow || aiCard ? [] : content.animatedPlaceholders}
              autoFocus={shouldAutoFocus}
              allowDropdown={!isQuestionFlow}
              suggestions={isQuestionFlow && aiCard?.quickReplies ? aiCard.quickReplies : []}
              defaultSubmitValue={isQuestionFlow ? confirmableSavedAnswer : undefined}
              onSelectResult={(result) => {
                if (result.type === 'task') {
                  onGoToTask(result.task.id)
                } else if (result.step) {
                  onGoToTask(result.task.id)
                }
              }}
            />
          )
        })()}

        {/* Task Intelligence Insight - only show when there are tasks and no AI conversation */}
        {!aiCard && activeTasks.length > 0 && (
          <TaskInsight onGoToTask={onGoToTask} />
        )}

        {/* Calendar Widget */}
        <CalendarWidget
          isDemoUser={isDemoUser}
          tasks={tasks}
          onSelectTask={(task) => onGoToTask(task.id)}
        />

        {/* Email Tasks */}
        <EmailTasksCard
          onAddTask={(title, context, dueDate) => {
            // Use the quick add with the title, ignoring context/dueDate for now
            onQuickAdd(title)
          }}
          isDemoUser={isDemoUser}
        />

        {/* Weekly Stats - only show when not in AI conversation */}
        {!aiCard && <StatsCard tasks={tasks} moodEntries={moodEntries} />}

        {/* FOCUS: The ONE thing to do now - prominent, impossible to miss */}
        {nextStep && (
          <div className="mb-8">
            {/* Header with accent styling */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-sm font-semibold text-accent uppercase tracking-wide">Do this now</span>
            </div>

            {/* Main focus card - elevated, accented */}
            <div
              className="
                bg-card rounded-xl cursor-pointer overflow-hidden
                border-2 border-accent/30
                shadow-lg shadow-accent/5
                hover:border-accent/50 hover:shadow-accent/10
                transition-all duration-200
                animate-rise
              "
            >
              {/* Main content area */}
              <div
                onClick={() => onGoToTask(nextStep.task.id)}
                className="p-5"
              >
                <div className="flex gap-4">
                  {/* Large checkbox for easy tapping */}
                  <div className="flex-shrink-0 pt-0.5" aria-label="Mark as done">
                    <Checkbox
                      checked={nextStep.step.done}
                      onToggle={() => onToggleStep(nextStep.task.id, nextStep.step.id)}
                      size={24}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Step title - larger, bolder */}
                    <div className="text-lg font-semibold text-text mb-1 leading-snug">
                      {getDerivedStepTitle(nextStep.step.text)}
                    </div>
                    {/* Summary */}
                    {nextStep.step.summary && (
                      <div className="text-sm text-text-soft mb-3 line-clamp-2">{nextStep.step.summary}</div>
                    )}
                    {/* Metadata row - time, due date */}
                    <div className="flex items-center gap-4 text-xs text-text-muted">
                      {nextStep.step.time && (
                        <span className="flex items-center gap-1">
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 6v6l4 2" strokeLinecap="round" />
                          </svg>
                          {nextStep.step.time}
                        </span>
                      )}
                      {nextStep.task.due_date && (() => {
                        const due = new Date(nextStep.task.due_date)
                        const today = new Date()
                        today.setHours(0, 0, 0, 0)
                        due.setHours(0, 0, 0, 0)
                        const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                        let dueText = ''
                        let urgentClass = ''
                        if (diff < 0) {
                          dueText = `${Math.abs(diff)}d overdue`
                          urgentClass = 'text-danger font-medium'
                        } else if (diff === 0) {
                          dueText = 'Due today'
                          urgentClass = 'text-accent font-medium'
                        } else if (diff === 1) {
                          dueText = 'Due tomorrow'
                        } else if (diff <= 7) {
                          dueText = `Due in ${diff}d`
                        }
                        if (!dueText) return null
                        return (
                          <span className={`flex items-center gap-1 ${urgentClass}`}>
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="4" width="18" height="18" rx="2" />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            {dueText}
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Task context footer - only when relevant */}
              {(() => {
                const stepTitle = getDerivedStepTitle(nextStep.step.text).toLowerCase().trim()
                const taskTitle = nextStep.task.title.toLowerCase().trim()
                const stepCount = nextStep.task.steps?.length || 0
                const doneCount = nextStep.task.steps?.filter((s) => s.done).length || 0
                const showContext = stepTitle !== taskTitle && stepCount > 1

                if (!showContext) return null

                return (
                  <div
                    onClick={() => onGoToTask(nextStep.task.id)}
                    className="px-5 py-3 bg-subtle/50 flex justify-between items-center border-t border-border-subtle"
                  >
                    <span className="text-sm text-text-soft truncate">{nextStep.task.title}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${(doneCount / stepCount) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-text-muted tabular-nums">{doneCount}/{stepCount}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* Low energy alternatives - show when there's a main task */}
        {nextStep && (
          <EnergySuggestions
            tasks={activeTasks}
            currentTaskId={nextStep.task.id}
            onGoToTask={onGoToTask}
          />
        )}

        {/* All done state */}
        {!nextStep && tasks.length > 0 && totalSteps > 0 && incompleteSteps === 0 && (
          <div className="mb-6 p-6 bg-success-soft rounded-md text-center">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-3">
              <svg width={24} height={24} viewBox="0 0 24 24" className="text-success">
                <path
                  d="M5 12l5 5L20 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <div className="text-base font-medium text-text mb-1">{content.emptyStates.homeAllCaughtUpTitle}</div>
            <div className="text-sm text-text-soft">{content.emptyStates.homeAllCaughtUpBody}</div>
          </div>
        )}

        {!nextStep && tasks.length > 0 && totalSteps === 0 && (
          <div className="mb-6 p-6 bg-subtle rounded-md text-center">
            <div className="text-base font-medium text-text mb-1">{content.emptyStates.homeNoStepsTitle}</div>
            <div className="text-sm text-text-soft">{content.emptyStates.homeNoStepsBody}</div>
          </div>
        )}

        {/* All Tasks - exclude the "Up Next" task to avoid duplication */}
        {(() => {
          const tasksToShow = nextStep
            ? sortedTasks.filter(t => t.id !== nextStep.task.id)
            : sortedTasks

          if (tasksToShow.length === 0) return null

          // Separate completed tasks (100% progress) from incomplete
          const isTaskComplete = (task: Task) => {
            const steps = task.steps || []
            if (steps.length === 0) return false
            return steps.every(s => s.done)
          }

          const incompleteTasks = tasksToShow.filter(t => !isTaskComplete(t))
          const completedTasks = tasksToShow.filter(t => isTaskComplete(t))

          // Limit visible incomplete tasks to 5 unless expanded
          const visibleLimit = 5
          const visibleIncompleteTasks = showAllTasks
            ? incompleteTasks
            : incompleteTasks.slice(0, visibleLimit)
          const hiddenCount = incompleteTasks.length - visibleLimit

          return (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  {nextStep ? 'Other tasks' : 'All tasks'}
                </div>
                {snoozedCount > 0 && (
                  <div className="text-xs text-text-muted flex items-center gap-1.5">
                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 6v6l4 2" strokeLinecap="round" />
                    </svg>
                    {snoozedCount} snoozed
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {/* Incomplete tasks */}
                {visibleIncompleteTasks.map((task, index) => (
                  <div key={task.id} className="animate-rise" style={{ animationDelay: `${index * 40}ms` }}>
                    <TaskListItem
                      task={task}
                      onClick={() => onGoToTask(task.id)}
                      onDelete={onDeleteTask ? () => onDeleteTask(task.id) : undefined}
                      onHabitComplete={onToggleHabit ? () => onToggleHabit(task.id) : undefined}
                      onSnooze={onSnoozeTask ? (date) => onSnoozeTask(task.id, date) : undefined}
                      onTogglePin={onTogglePin ? () => onTogglePin(task.id) : undefined}
                    />
                  </div>
                ))}

                {/* Show more button */}
                {!showAllTasks && hiddenCount > 0 && (
                  <button
                    onClick={() => setShowAllTasks(true)}
                    className="py-2 text-sm text-text-muted hover:text-text transition-colors duration-150"
                  >
                    Show {hiddenCount} more
                  </button>
                )}

                {/* Collapsed completed tasks row */}
                {completedTasks.length > 0 && !showCompletedTasks && (
                  <button
                    onClick={() => setShowCompletedTasks(true)}
                    className="
                      py-3 px-4
                      bg-success-soft/50 rounded-md
                      text-sm text-text-soft
                      hover:bg-success-soft transition-colors duration-150
                      flex items-center justify-between
                    "
                  >
                    <div className="flex items-center gap-2">
                      <svg width={14} height={14} viewBox="0 0 24 24" className="text-success">
                        <path
                          d="M5 12l5 5L20 7"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                      </svg>
                      {completedTasks.length} completed
                    </div>
                    <svg width={14} height={14} viewBox="0 0 16 16" className="text-text-muted">
                      <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                    </svg>
                  </button>
                )}

                {/* Expanded completed tasks */}
                {showCompletedTasks && completedTasks.length > 0 && (
                  <>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowCompletedTasks(false)}
                        className="
                          flex-1 py-2 px-4
                          bg-success-soft/30 rounded-md
                          text-xs text-text-muted
                          hover:bg-success-soft/50 transition-colors duration-150
                          flex items-center justify-between
                        "
                      >
                        <span>{completedTasks.length} completed</span>
                        <svg width={12} height={12} viewBox="0 0 16 16" className="text-text-muted rotate-180">
                          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                        </svg>
                      </button>
                      {onClearCompleted && !showClearConfirm && (
                        <button
                          onClick={() => setShowClearConfirm(true)}
                          className="
                            py-2 px-3
                            rounded-md
                            text-xs text-text-muted
                            hover:text-danger hover:bg-danger-soft/50
                            transition-colors duration-150
                          "
                          title="Clear all completed tasks"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                    {/* Clear confirmation */}
                    {showClearConfirm && onClearCompleted && (
                      <div className="bg-danger-soft/30 border border-danger/30 rounded-md p-3 animate-rise">
                        <p className="text-sm text-text mb-3">
                          Delete {completedTasks.length} completed task{completedTasks.length !== 1 ? 's' : ''}?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              onClearCompleted()
                              setShowClearConfirm(false)
                              setShowCompletedTasks(false)
                            }}
                            className="px-3 py-1.5 bg-danger text-white rounded-md text-sm font-medium hover:bg-danger/90 transition-colors"
                          >
                            Delete all
                          </button>
                          <button
                            onClick={() => setShowClearConfirm(false)}
                            className="px-3 py-1.5 bg-subtle text-text rounded-md text-sm font-medium hover:bg-card-hover transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {completedTasks.map((task, index) => (
                      <div key={task.id} className="animate-rise opacity-60" style={{ animationDelay: `${index * 40}ms` }}>
                        <TaskListItem
                          task={task}
                          onClick={() => onGoToTask(task.id)}
                          onDelete={onDeleteTask ? () => onDeleteTask(task.id) : undefined}
                          onHabitComplete={onToggleHabit ? () => onToggleHabit(task.id) : undefined}
                          onSnooze={onSnoozeTask ? (date) => onSnoozeTask(task.id, date) : undefined}
                          onTogglePin={onTogglePin ? () => onTogglePin(task.id) : undefined}
                        />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )
        })()}

      </div>
    </div>
  )
}
