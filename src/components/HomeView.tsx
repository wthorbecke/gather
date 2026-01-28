'use client'

import { useMemo, useEffect } from 'react'
import { Task } from '@/hooks/useUserData'
import { splitStepText } from '@/lib/stepText'
import { getNextStep } from '@/hooks/useTaskSearch'
import { UnifiedInput } from './UnifiedInput'
import { AICard, AICardState } from './AICard'
import { TaskListItem } from './TaskListItem'
import { Checkbox } from './Checkbox'
import { getDeadlineUrgency } from './DeadlineBadge'
import { CalendarWidget } from './CalendarSidebar'
import { content, OTHER_SPECIFY_OPTION } from '@/config/content'

interface HomeViewProps {
  tasks: Task[]
  aiCard: AICardState | null
  pendingInput: string | null
  onSubmit: (value: string) => void
  onQuickAdd: (value: string) => void
  onQuickReply: (reply: string) => void
  onDismissAI: () => void
  onGoToTask: (taskId: string) => void
  onToggleStep: (taskId: string, stepId: string | number) => void
  onSuggestionClick: (suggestion: string) => void
  onDeleteTask?: (taskId: string) => void
  onAICardAction?: (action: { type: string; stepId?: string | number; title?: string; context?: string }) => void
  onBackQuestion?: () => void
  canGoBack?: boolean
}

export function HomeView({
  tasks,
  aiCard,
  pendingInput,
  onSubmit,
  onQuickAdd,
  onQuickReply,
  onDismissAI,
  onGoToTask,
  onToggleStep,
  onSuggestionClick,
  onDeleteTask,
  onAICardAction,
  onBackQuestion,
  canGoBack = false,
}: HomeViewProps) {
  // Filter out snoozed tasks
  const activeTasks = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return tasks.filter(task => {
      if (!task.snoozed_until) return true
      return task.snoozed_until <= today
    })
  }, [tasks])

  // Sort by deadline urgency
  const sortedTasks = useMemo(() => {
    return [...activeTasks].sort((a, b) => {
      const urgencyA = getDeadlineUrgency(a.due_date)
      const urgencyB = getDeadlineUrgency(b.due_date)
      return urgencyA - urgencyB
    })
  }, [activeTasks])

  const snoozedCount = tasks.length - activeTasks.length
  const nextStep = getNextStep(activeTasks)
  const shouldAutoFocus = Boolean(aiCard?.autoFocusInput) || Boolean(aiCard?.question && (!aiCard.quickReplies || aiCard.quickReplies.length === 0))
  const isQuestionFlow = Boolean(aiCard?.question)
  const inputPlaceholder = isQuestionFlow ? content.placeholders.aiFreeText : content.placeholders.homeInput
  const totalSteps = activeTasks.reduce((sum, task) => sum + (task.steps?.length || 0), 0)
  const incompleteSteps = activeTasks.reduce(
    (sum, task) => sum + (task.steps?.filter((step) => !step.done).length || 0),
    0
  )
  const getDerivedStepTitle = (text: string) => splitStepText(text).title

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
    <div className="min-h-screen px-5 pt-6 pb-8">
      <div className="max-w-[540px] mx-auto">
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

        {/* Calendar Widget */}
        <CalendarWidget />

        {/* Next Step highlight */}
        {nextStep && (
          <div className="mb-6">
            <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-3">
              Up next
            </div>

            <div
              onClick={() => onGoToTask(nextStep.task.id)}
              className="
                bg-card rounded-md cursor-pointer overflow-hidden
                border border-border
                hover:bg-card-hover
                animate-rise
              "
            >
              <div className="p-4 flex gap-4">
                <div className="flex-shrink-0" aria-label="Mark as done">
                  <Checkbox
                    checked={nextStep.step.done}
                    onToggle={() => onToggleStep(nextStep.task.id, nextStep.step.id)}
                    size={20}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-medium mb-0.5">{getDerivedStepTitle(nextStep.step.text)}</div>
                  {nextStep.step.summary && (
                    <div className="text-sm text-text-soft">{nextStep.step.summary}</div>
                  )}
                </div>
              </div>
              <div className="px-4 py-2.5 bg-subtle flex justify-between items-center border-t border-border-subtle">
                <span className="text-sm text-text-muted truncate">{nextStep.task.title}</span>
                <span className="text-sm text-text-muted tabular-nums">
                  {nextStep.task.steps?.filter((s) => s.done).length || 0}/{nextStep.task.steps?.length || 0}
                </span>
              </div>
            </div>
          </div>
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

        {/* All Tasks */}
        {sortedTasks.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-medium text-text-muted uppercase tracking-wide">All tasks</div>
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
              {sortedTasks.map((task, index) => (
                <div key={task.id} className="animate-rise" style={{ animationDelay: `${index * 40}ms` }}>
                  <TaskListItem
                    task={task}
                    onClick={() => onGoToTask(task.id)}
                    onDelete={onDeleteTask ? () => onDeleteTask(task.id) : undefined}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
